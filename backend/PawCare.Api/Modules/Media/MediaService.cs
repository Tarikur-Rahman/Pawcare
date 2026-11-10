using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Infrastructure.Storage;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Media;
public sealed class MediaService(ModuleDb db,IServiceProvider services)
{
    public async Task<object> Upload(ClaimsPrincipal user,IFormFile file,CancellationToken ct)
    {
        var storage=services.GetService<IObjectStorage>();
        if(storage is null) throw new DomainException(DomainErrors.ServiceUnavailable());
        ModuleRules.Check(file.Length is >0 and <=20L*1024*1024,"file","File must be 1 byte to 20 MiB.");
        var actor=ModuleRules.UserId(user);
        await using var body=file.OpenReadStream();
        var item=await storage.StoreQuarantinedAsync(body,file.ContentType,file.Length,ct);
        try
        {
            var id=await db.InsertId(@"INSERT INTO FILE_ASSETS(owner_user_id,object_key,mime_type,size_bytes,sha256_hex,
                access_policy,scan_status,exif_stripped) VALUES (:actor,:key,:mime,:size_bytes,:hash,
                'PRIVATE','PENDING',0)",
                ModuleRules.P(("actor",actor),("key",item.ObjectKey),("mime",item.MimeType),
                    ("size_bytes",item.SizeBytes),("hash",item.Sha256Hex)),"file_id",ct);
            return new { id,status="PENDING_SCAN",access="PRIVATE" };
        }
        catch
        {
            // Best-effort cleanup of a quarantined object when metadata creation fails.
            try { await storage.DeleteQuarantinedAsync(item.ObjectKey,CancellationToken.None); }
            catch { /* orphan cleanup job may be required */ }
            throw;
        }
    }
    public async Task<object> MyAssets(ClaimsPrincipal user,CancellationToken ct)=>await db.Query(@"
        SELECT file_id AS ""id"",mime_type AS ""mimeType"",size_bytes AS ""sizeBytes"",
            scan_status AS ""scanStatus"",access_policy AS ""access"",created_at AS ""createdAt""
        FROM FILE_ASSETS WHERE owner_user_id=:user_id AND deleted_at IS NULL ORDER BY created_at DESC
        FETCH FIRST 100 ROWS ONLY",ModuleRules.P(("user_id",ModuleRules.UserId(user))),ct);
}
