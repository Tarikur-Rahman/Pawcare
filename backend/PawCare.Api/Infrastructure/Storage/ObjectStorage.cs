using System.Buffers;
using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace PawCare.Api.Infrastructure.Storage;

/// <summary>
/// A pending/quarantined object is NOT safe for public serving. Its metadata
/// belongs in Oracle FILE_ASSETS with scan_status=PENDING, exif_stripped=0,
/// and access_policy=PRIVATE until a separate trusted scanning workflow runs.
/// </summary>
public sealed record StoredObject(string ObjectKey, long SizeBytes, string Sha256Hex,
    string MimeType, string ScanStatus = "PENDING", bool ExifStripped = false);

public interface IObjectStorage
{
    Task<StoredObject> StoreQuarantinedAsync(Stream content, string mimeType,
        long declaredLength, CancellationToken cancellationToken = default);

    // INTERNAL use only, after caller identity and object access are verified.
    Task<Stream> OpenQuarantinedReadAsync(string objectKey,
        CancellationToken cancellationToken = default);
    Task DeleteQuarantinedAsync(string objectKey, CancellationToken cancellationToken = default);
}

/// <summary>
/// Development-only PRIVATE filesystem implementation. Never map its root to
/// wwwroot, StaticFiles middleware, a CDN, or a public directory. Production
/// requires an approved private cloud/object-storage adapter with malware
/// scanning, EXIF removal, encryption, lifecycle rules, and signed access.
/// </summary>
public sealed class ObjectStorage : IObjectStorage
{
    private const long HardMaxBytes = 20L * 1024 * 1024;
    private readonly string _quarantineDirectory;

    private static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["application/pdf"] = ".pdf"
        };

    public ObjectStorage(IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        if (!environment.IsDevelopment())
            throw new InvalidOperationException(
                "Local ObjectStorage is development-only. Configure a private production storage adapter.");

        var configuredRoot = configuration["Storage:PrivateRoot"];
        if (string.IsNullOrWhiteSpace(configuredRoot) || !Path.IsPathFullyQualified(configuredRoot))
            throw new InvalidOperationException(
                "Storage:PrivateRoot must be a dedicated, absolute directory outside the application tree.");

        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(configuredRoot));
        var contentRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(environment.ContentRootPath));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (root.Equals(contentRoot, comparison) ||
            root.StartsWith(contentRoot + Path.DirectorySeparatorChar, comparison))
            throw new InvalidOperationException(
                "Storage:PrivateRoot must be outside the PawCare application content directory.");

        _quarantineDirectory = Path.Combine(root, "quarantine");
    }

    public async Task<StoredObject> StoreQuarantinedAsync(
        Stream content,
        string mimeType,
        long declaredLength,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (!content.CanRead) throw new ArgumentException("Readable input is required.", nameof(content));
        if (mimeType is null || !AllowedTypes.TryGetValue(mimeType, out var extension))
            throw new ArgumentException("Unsupported media type.", nameof(mimeType));
        if (declaredLength is <= 0 or > HardMaxBytes)
            throw new ArgumentOutOfRangeException(nameof(declaredLength),
                "Upload size is outside the development storage limit.");

        Directory.CreateDirectory(_quarantineDirectory);
        var uniqueName = Guid.NewGuid().ToString("N") + extension;
        var finalPath = Path.Combine(_quarantineDirectory, uniqueName);
        var temporaryPath = finalPath + ".uploading";
        var objectKey = "quarantine/" + uniqueName; // Server-generated, never user supplied.

        byte[] rented = ArrayPool<byte>.Shared.Rent(64 * 1024);
        byte[] signature = new byte[16];
        int signatureLength = 0;
        long total = 0;
        try
        {
            using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var file = new FileStream(temporaryPath, FileMode.CreateNew,
                FileAccess.Write, FileShare.None, 64 * 1024, FileOptions.Asynchronous))
            {
                while (true)
                {
                    var read = await content.ReadAsync(rented.AsMemory(), cancellationToken)
                        .ConfigureAwait(false);
                    if (read == 0) break;
                    total = checked(total + read);
                    if (total > declaredLength || total > HardMaxBytes)
                        throw new InvalidDataException("Upload exceeded its permitted size.");

                    if (signatureLength < signature.Length)
                    {
                        var available = Math.Min(read, signature.Length - signatureLength);
                        rented.AsSpan(0, available)
                            .CopyTo(signature.AsSpan(signatureLength, available));
                        signatureLength += available;
                    }
                    sha.AppendData(rented, 0, read);
                    await file.WriteAsync(rented.AsMemory(0, read), cancellationToken)
                        .ConfigureAwait(false);
                }
                await file.FlushAsync(cancellationToken).ConfigureAwait(false);
            }

            if (total != declaredLength || !MatchesFileSignature(mimeType, signature.AsSpan(0, signatureLength)))
                throw new InvalidDataException("Upload size or file signature does not match its declaration.");

            File.Move(temporaryPath, finalPath); // Never overwrite an existing object.
            return new StoredObject(objectKey, total,
                Convert.ToHexString(sha.GetHashAndReset()).ToLowerInvariant(), mimeType);
        }
        catch
        {
            TryDelete(temporaryPath);
            throw;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(rented, clearArray: true);
        }
    }

    public Task<Stream> OpenQuarantinedReadAsync(
        string objectKey, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = GetValidatedQuarantinePath(objectKey);
        Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read,
            FileShare.Read, 64 * 1024, FileOptions.Asynchronous | FileOptions.SequentialScan);
        return Task.FromResult(stream);
    }

    public Task DeleteQuarantinedAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        File.Delete(GetValidatedQuarantinePath(objectKey));
        return Task.CompletedTask;
    }

    private string GetValidatedQuarantinePath(string objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey) ||
            !objectKey.StartsWith("quarantine/", StringComparison.Ordinal))
            throw new ArgumentException("Invalid private object key.", nameof(objectKey));
        var name = objectKey["quarantine/".Length..];
        var dotIndex = name.LastIndexOf('.');
        if (dotIndex != 32 || name.Length is < 36 or > 37 ||
            !name.AsSpan(0, 32).ToString().All(static c =>
                (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) ||
            !AllowedTypes.Values.Contains(name[dotIndex..], StringComparer.Ordinal))
        {
            throw new ArgumentException("Invalid private object key.", nameof(objectKey));
        }
        return Path.Combine(_quarantineDirectory, name);
    }

    private static bool MatchesFileSignature(string mimeType, ReadOnlySpan<byte> bytes)
        => mimeType.ToLowerInvariant() switch
        {
            "image/jpeg" => bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff,
            "image/png" => bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/webp" => bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) &&
                            bytes.Slice(8, 4).SequenceEqual("WEBP"u8),
            "application/pdf" => bytes.StartsWith("%PDF-"u8),
            _ => false
        };

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (IOException) { /* A cleanup worker must handle abandoned staging files. */ }
        catch (UnauthorizedAccessException) { /* Do not mask the original upload failure. */ }
    }
}
