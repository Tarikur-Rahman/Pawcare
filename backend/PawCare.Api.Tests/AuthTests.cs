using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PawCare.Api.Configuration;
using PawCare.Api.Security;
using Xunit;

namespace PawCare.Api.Tests;

/// <summary>Executable authentication primitive tests, plus opt-in real-API contracts.</summary>
public sealed class AuthTests
{
    private const string TestPassword = "a-safely-long-test-password-46";

    [Fact]
    public void HashAndVerify_ValidPasswordSucceeds_AndWrongPasswordFails()
    {
        var hasher = new PasswordHasher();
        var stored = hasher.HashPassword(TestPassword);
        Assert.StartsWith("pbkdf2-sha256$600000$", stored);
        Assert.DoesNotContain(TestPassword, stored, StringComparison.Ordinal);
        Assert.Equal(PasswordVerificationOutcome.Success, hasher.VerifyPassword(stored, TestPassword));
        Assert.Equal(PasswordVerificationOutcome.Failed, hasher.VerifyPassword(stored, TestPassword + "x"));
    }

    [Fact]
    public void HashingSamePassword_UsesIndependentRandomSalts()
    {
        var hasher = new PasswordHasher();
        var first = hasher.HashPassword(TestPassword);
        var second = hasher.HashPassword(TestPassword);
        Assert.NotEqual(first, second);
        Assert.Equal(PasswordVerificationOutcome.Success, hasher.VerifyPassword(first, TestPassword));
        Assert.Equal(PasswordVerificationOutcome.Success, hasher.VerifyPassword(second, TestPassword));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("DEMO_LOGIN_DISABLED")]
    [InlineData("pbkdf2-sha256$999999999$bad$bad")]
    [InlineData("pbkdf2-sha256$600000$invalid$bad")]
    [InlineData("pbkdf2-sha256$1$abc$def")]
    [InlineData("unknown$600000$abc$def")]
    public void MalformedOrDemoHashes_NeverAuthenticate(string? hash)
    {
        Assert.Equal(PasswordVerificationOutcome.Failed,
            new PasswordHasher().VerifyPassword(hash, TestPassword));
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    public void TooShortPassword_CannotBeHashed(string password)
    {
        Assert.Throws<ArgumentException>(() => new PasswordHasher().HashPassword(password));
    }

    [Fact]
    public void OverlongPassword_CannotBeHashed()
    {
        Assert.Throws<ArgumentException>(() => new PasswordHasher().HashPassword(new string('p', 129)));
    }

    [Fact]
    public void ValidOlderIterationHash_IsAcceptedButMarkedForRehash()
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            TestPassword, salt, 300_000, HashAlgorithmName.SHA256, 32);
        var stored = $"pbkdf2-sha256$300000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        Assert.Equal(PasswordVerificationOutcome.SuccessRehashNeeded,
            new PasswordHasher().VerifyPassword(stored, TestPassword));
    }

    [Fact]
    public async Task IssuedJwt_HasTrustedClaimsAndValidSignatureAndFifteenMinuteLifetime()
    {
        var jwt = JwtSettings();
        var service = new JwtTokenService(new StaticOptionsMonitor<PawCareJwtOptions>(jwt), TimeProvider.System);
        var before = TimeProvider.System.GetUtcNow();
        var issued = service.IssueAccessToken(46, "OWNER", "ACTIVE");
        var parsed = new JsonWebToken(issued.AccessToken);
        Assert.Equal("Bearer", issued.TokenType);
        Assert.Equal("PawCare.Tests", parsed.Issuer);
        Assert.Contains("PawCare.TestClients", parsed.Audiences);
        Assert.Contains(parsed.Claims, x => x.Type == "sub" && x.Value == "46");
        Assert.Contains(parsed.Claims, x => x.Type == "role" && x.Value == "OWNER");
        Assert.Contains(parsed.Claims, x => x.Type == "jti" && !string.IsNullOrWhiteSpace(x.Value));
        Assert.InRange(issued.ExpiresAtUtc, before.AddMinutes(14), before.AddMinutes(16));

        var validation = await new JsonWebTokenHandler().ValidateTokenAsync(
            issued.AccessToken,
            new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                ValidateIssuer = true,
                ValidIssuer = jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = jwt.Audience,
                ValidateLifetime = true,
                RequireSignedTokens = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            });
        Assert.True(validation.IsValid);
    }

    [Fact]
    public void EachJwtHasDifferentJti()
    {
        var service = new JwtTokenService(new StaticOptionsMonitor<PawCareJwtOptions>(JwtSettings()), TimeProvider.System);
        var first = new JsonWebToken(service.IssueAccessToken(46, "OWNER", "ACTIVE").AccessToken);
        var second = new JsonWebToken(service.IssueAccessToken(46, "OWNER", "ACTIVE").AccessToken);
        Assert.NotEqual(first.Id, second.Id);
    }

    [Theory]
    [InlineData(0, "OWNER", "ACTIVE")]
    [InlineData(46, "OWNER", "SUSPENDED")]
    [InlineData(46, "SELLER", "ACTIVE")]
    [InlineData(46, "ADMIN", "PENDING")]
    public void JwtIssuance_DeniesInvalidIdentityRoleOrStatus(long userId, string role, string status)
    {
        var service = new JwtTokenService(new StaticOptionsMonitor<PawCareJwtOptions>(JwtSettings()), TimeProvider.System);
        Assert.ThrowsAny<Exception>(() => service.IssueAccessToken(userId, role, status));
    }

    [Fact]
    public void JwtIssuance_RejectsWeakOrPlaceholderSigningKey()
    {
        var weak = JwtSettings();
        weak.SigningKey = "REPLACE_ME_WITH_REAL_SECRET";
        var service = new JwtTokenService(new StaticOptionsMonitor<PawCareJwtOptions>(weak), TimeProvider.System);
        Assert.Throws<InvalidOperationException>(() => service.IssueAccessToken(1, "OWNER", "ACTIVE"));
    }

    // PC-AUTH-001. Requires completed auth endpoints and a disposable dedicated test account.
    [Fact]
    public async Task Api_RefreshRotationAndLogout_InvalidateOldCredentials()
    {
        using var scenario = ContractScenario.Open("auth-refresh-rotation");
        var login = await scenario.SendAsync("login");
        Assert.Equal(200, login.Status);
        var oldRefresh = login.RequiredString("data.refreshToken");
        var firstAccess = login.RequiredString("data.accessToken");
        Assert.False(string.IsNullOrWhiteSpace(firstAccess));

        var refresh = await scenario.SendAsync("refresh", body: new JsonObject { ["refreshToken"] = oldRefresh });
        Assert.Equal(200, refresh.Status);
        var newRefresh = refresh.RequiredString("data.refreshToken");
        Assert.NotEqual(oldRefresh, newRefresh);
        var newAccess = refresh.RequiredString("data.accessToken");

        var replay = await scenario.SendAsync("refresh", body: new JsonObject { ["refreshToken"] = oldRefresh });
        Assert.Contains(replay.Status, new[] { 400, 401, 403 });

        var logout = await scenario.SendAsync("logout", accessToken: newAccess,
            body: new JsonObject { ["refreshToken"] = newRefresh });
        Assert.Contains(logout.Status, new[] { 200, 204 });
        var revoked = await scenario.SendAsync("refresh", body: new JsonObject { ["refreshToken"] = newRefresh });
        Assert.Contains(revoked.Status, new[] { 400, 401, 403 });
    }

    [Fact]
    public async Task Api_InvalidCredentials_DoNotRevealAccountExistence()
    {
        using var scenario = ContractScenario.Open("auth-invalid-login");
        var unknown = await scenario.SendAsync("unknownAccount");
        var incorrect = await scenario.SendAsync("wrongPassword");
        Assert.Equal(401, unknown.Status);
        Assert.Equal(401, incorrect.Status);
        Assert.Equal(unknown.RequiredString("code"), incorrect.RequiredString("code"));
        Assert.Equal(unknown.RequiredString("message"), incorrect.RequiredString("message"));
    }

    private static PawCareJwtOptions JwtSettings() => new()
    {
        Issuer = "PawCare.Tests",
        Audience = "PawCare.TestClients",
        SigningKey = "0123456789abcdef0123456789abcdef0123456789abcdef"
    };

    private sealed class StaticOptionsMonitor<T>(T value) : IOptionsMonitor<T>
    {
        public T CurrentValue => value;
        public T Get(string? name) => value;
        public IDisposable OnChange(Action<T, string?> listener) => new Noop();
        private sealed class Noop : IDisposable { public void Dispose() { } }
    }
}

/// <summary>
/// Shared black-box fixture runner for deferred API contracts in this seven-file suite.
/// Set PAWCARE_RUN_API_CONTRACT_TESTS=1 and PAWCARE_TEST_SCENARIOS_DIR to an isolated
/// test-fixture directory. Each named JSON file defines baseUrl (loopback only)
/// and steps with method, path, optional tokenEnv, json, headers.
/// NEVER point at a database/application with production or real customer records.
/// When disabled, tests are SKIPPED, not reported as PASSED.
/// </summary>
internal sealed class ContractScenario : IDisposable
{
    private readonly JsonObject _root;
    private readonly HttpClient _client;

    private ContractScenario(JsonObject root, HttpClient client)
    {
        _root = root;
        _client = client;
    }

    public static ContractScenario Open(string name)
    {
        Assert.SkipUnless(
            Environment.GetEnvironmentVariable("PAWCARE_RUN_API_CONTRACT_TESTS") == "1",
            "Real feature API not deployed. Opt in only with an isolated disposable Oracle test environment.");

        var dir = Environment.GetEnvironmentVariable("PAWCARE_TEST_SCENARIOS_DIR");
        if (string.IsNullOrWhiteSpace(dir))
            throw new InvalidOperationException("PAWCARE_TEST_SCENARIOS_DIR is required when API contracts are enabled.");
        var path = Path.Combine(dir, name + ".json");
        if (!File.Exists(path))
            throw new FileNotFoundException($"Missing isolated test scenario: {name}.json", path);
        var root = JsonNode.Parse(File.ReadAllText(path)) as JsonObject
            ?? throw new InvalidDataException("Scenario JSON must be an object.");
        var url = root["baseUrl"]?.GetValue<string>() ?? string.Empty;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            !uri.IsLoopback || uri.Scheme != Uri.UriSchemeHttp)
            throw new InvalidOperationException("Contract API baseUrl must be an HTTP loopback URL (dedicated test instance).");
        if (Environment.GetEnvironmentVariable("PAWCARE_TEST_ISOLATED_ORACLE") != "YES")
            throw new InvalidOperationException("Confirm a disposable Oracle test DB with PAWCARE_TEST_ISOLATED_ORACLE=YES.");

        return new ContractScenario(root, new HttpClient { BaseAddress = uri, Timeout = TimeSpan.FromSeconds(30) });
    }

    public string Setting(string name) =>
        _root["settings"]?[name]?.ToString() ??
        throw new InvalidDataException($"Scenario missing settings.{name}.");

    public async Task<ContractReply> SendAsync(
        string stepName, JsonNode? body = null, string? accessToken = null, CancellationToken ct = default)
    {
        var step = _root["steps"]?[stepName] as JsonObject
            ?? throw new InvalidDataException($"Scenario missing steps.{stepName}.");
        var method = step["method"]?.GetValue<string>() ?? "GET";
        var path = step["path"]?.GetValue<string>()
            ?? throw new InvalidDataException($"Step {stepName} requires path.");
        if (!path.StartsWith("/api/", StringComparison.Ordinal) || path.StartsWith("//", StringComparison.Ordinal))
            throw new InvalidOperationException("Only PawCare API-relative paths are permitted.");
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        var tokenEnv = step["tokenEnv"]?.GetValue<string>();
        var token = accessToken;
        if (token is null && tokenEnv is not null)
        {
            token = Environment.GetEnvironmentVariable(tokenEnv);
            if (string.IsNullOrWhiteSpace(token))
                throw new InvalidOperationException($"Missing test token environment variable {tokenEnv}.");
        }
        if (!string.IsNullOrWhiteSpace(token))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        if (step["headers"] is JsonObject headers)
            foreach (var header in headers)
                request.Headers.TryAddWithoutValidation(header.Key, header.Value?.ToString() ?? string.Empty);

        var payload = body ?? step["json"];
        if (payload is not null)
            request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await _client.SendAsync(request, ct);
        var data = await response.Content.ReadAsStringAsync(ct);
        JsonNode? parsed = null;
        if (!string.IsNullOrWhiteSpace(data))
        {
            try { parsed = JsonNode.Parse(data); }
            catch (System.Text.Json.JsonException) { /* Unexpected non-JSON still fails relevant field assertions. */ }
        }
        return new ContractReply((int)response.StatusCode, parsed);
    }

    public async Task<(ContractReply First, ContractReply Second)> SendConcurrentAsync(string first, string second)
    {
        var ready = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task<ContractReply> Run(string step)
        {
            await ready.Task;
            return await SendAsync(step);
        }
        var a = Run(first);
        var b = Run(second);
        ready.SetResult(true);
        await Task.WhenAll(a, b);
        return (await a, await b);
    }

    public void Dispose() => _client.Dispose();
}

internal sealed record ContractReply(int Status, JsonNode? Body)
{
    public JsonNode? At(string path)
    {
        JsonNode? node = Body;
        foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries))
            node = node is JsonObject obj ? obj[segment] : null;
        return node;
    }

    public string RequiredString(string path) =>
        At(path)?.ToString() ?? throw new InvalidDataException($"Expected JSON field {path} missing (HTTP {Status}).");

    public long RequiredInt64(string path) =>
        long.TryParse(RequiredString(path), System.Globalization.NumberStyles.Integer,
            System.Globalization.CultureInfo.InvariantCulture, out var number)
            ? number : throw new InvalidDataException($"Field {path} is not an integer.");
}
