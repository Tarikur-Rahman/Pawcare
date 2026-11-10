using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Auth;
public sealed class AuthRepository(ModuleDb db)
{
    public Task<Dictionary<string, object?>?> Account(string email, CancellationToken ct) => db.One(
        "SELECT user_id, email, password_hash, role, status FROM USERS WHERE email=:email",
        ModuleRules.P(("email", email)), ct);

    public Task<Dictionary<string, object?>?> Self(long id, CancellationToken ct) => db.One(
        @"SELECT u.user_id AS ""id"", u.email, u.role, u.status, p.display_name AS ""displayName"" 
           FROM USERS u LEFT JOIN USER_PROFILES p ON p.user_id=u.user_id WHERE u.user_id=:id",
        ModuleRules.P(("id",id)), ct);

    public async Task<List<string>> Capabilities(long id, CancellationToken ct) =>
        (await db.Query(@"SELECT capability FROM USER_CAPABILITIES
            WHERE user_id=:id AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at>SYSTIMESTAMP)
            ORDER BY capability", ModuleRules.P(("id", id)), ct))
        .Select(row => ModuleRules.Str(row, "CAPABILITY"))
        .ToList();

    public async Task<long> Register(string email, string encodedPassword, string displayName, CancellationToken ct) =>
        await db.Transaction(async (conn,tx) => {
            var id=await db.InsertId(@"INSERT INTO USERS (email,password_hash,role,status)
                VALUES (:email,:hash,'OWNER','PENDING_VERIFICATION')",
                ModuleRules.P(("email",email),("hash",encodedPassword)), "user_id",ct,conn,tx);
            await db.Execute("INSERT INTO USER_PROFILES(user_id,display_name) VALUES (:id,:name)",
                ModuleRules.P(("id",id),("name",displayName)),ct,conn,tx);
            return id;
        },ct);

    public async Task<bool> IssueVerificationToken(long userId, string tokenHash,
        DateTimeOffset expiresAt, CancellationToken ct) =>
        await db.Transaction(async (conn, tx) =>
        {
            var recent = Convert.ToInt32(await db.Scalar(
                @"SELECT COUNT(*) FROM EMAIL_VERIFICATION_TOKENS
                  WHERE user_id=:user_id AND created_at>SYSTIMESTAMP-NUMTODSINTERVAL(1,'HOUR')",
                ModuleRules.P(("user_id", userId)), ct, conn, tx));
            if (recent >= 3) return false;
            await db.Execute(@"UPDATE EMAIL_VERIFICATION_TOKENS SET used_at=SYSTIMESTAMP
                WHERE user_id=:user_id AND used_at IS NULL",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            await db.Execute(@"INSERT INTO EMAIL_VERIFICATION_TOKENS
                (user_id,token_hash,expires_at) VALUES (:user_id,:token_hash,:expires_at)",
                ModuleRules.P(("user_id", userId),("token_hash", tokenHash),("expires_at", expiresAt)),
                ct, conn, tx);
            return true;
        }, ct);

    public async Task<bool> VerifyToken(string tokenHash, CancellationToken ct) =>
        await db.Transaction(async (conn, tx) =>
        {
            var row = await db.One(@"SELECT t.token_id AS ""tokenId"",u.user_id AS ""userId"",u.status
                FROM EMAIL_VERIFICATION_TOKENS t JOIN USERS u ON u.user_id=t.user_id
                WHERE t.token_hash=:token_hash AND t.used_at IS NULL
                  AND t.expires_at>SYSTIMESTAMP AND u.status='PENDING_VERIFICATION'
                  FOR UPDATE OF t.used_at",
                ModuleRules.P(("token_hash", tokenHash)), ct, conn, tx);
            if (row is null) return false;
            await db.Execute(@"UPDATE EMAIL_VERIFICATION_TOKENS SET used_at=SYSTIMESTAMP
                WHERE token_id=:token_id AND used_at IS NULL",
                ModuleRules.P(("token_id", ModuleRules.Id(row, "tokenId"))), ct, conn, tx);
            if (ModuleRules.Str(row, "STATUS") == "PENDING_VERIFICATION")
                await db.Execute(@"UPDATE USERS SET status='ACTIVE',email_verified_at=SYSTIMESTAMP,
                    updated_at=SYSTIMESTAMP WHERE user_id=:user_id AND status='PENDING_VERIFICATION'",
                    ModuleRules.P(("user_id", ModuleRules.Id(row, "userId"))), ct, conn, tx);
            return true;
        }, ct);

    // A USERS row lock serializes issuance and consumption for the same account.
    public Task<bool> IssuePasswordResetToken(long userId, string tokenHash,
        DateTimeOffset expiresAt, CancellationToken ct) =>
        db.Transaction(async (conn, tx) =>
        {
            var user = await db.One(@"SELECT user_id FROM USERS
                WHERE user_id=:user_id AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            if (user is null) return false;
            var issued = Convert.ToInt32(await db.Scalar(@"
                SELECT COUNT(*) FROM PASSWORD_RESET_TOKENS
                WHERE user_id=:user_id AND created_at>SYSTIMESTAMP-NUMTODSINTERVAL(1,'HOUR')",
                ModuleRules.P(("user_id", userId)), ct, conn, tx));
            if (issued >= 3) return false;
            await db.Execute(@"UPDATE PASSWORD_RESET_TOKENS SET used_at=SYSTIMESTAMP
                WHERE user_id=:user_id AND used_at IS NULL",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            await db.Execute(@"INSERT INTO PASSWORD_RESET_TOKENS
                (user_id,token_hash,expires_at) VALUES (:user_id,:token_hash,:expires_at)",
                ModuleRules.P(("user_id", userId), ("token_hash", tokenHash), ("expires_at", expiresAt)),
                ct, conn, tx);
            return true;
        }, ct);

    public Task<bool> ConsumePasswordResetToken(string tokenHash, string newPasswordHash,
        CancellationToken ct) => db.Transaction(async (conn, tx) =>
        {
            // Always take the USERS lock before the token lock to avoid deadlocks
            // with concurrent reset-link issuance. Then recheck expiry/usage.
            var candidate = await db.One(@"SELECT user_id AS ""userId"" FROM PASSWORD_RESET_TOKENS
                WHERE token_hash=:token_hash", ModuleRules.P(("token_hash", tokenHash)), ct, conn, tx);
            if (candidate is null) return false;
            var userId = ModuleRules.Id(candidate, "userId");
            var account = await db.One(@"SELECT user_id FROM USERS
                WHERE user_id=:user_id AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            if (account is null) return false;
            var token = await db.One(@"SELECT reset_id FROM PASSWORD_RESET_TOKENS
                WHERE token_hash=:token_hash AND user_id=:user_id AND used_at IS NULL
                  AND expires_at>SYSTIMESTAMP FOR UPDATE OF used_at",
                ModuleRules.P(("token_hash", tokenHash), ("user_id", userId)), ct, conn, tx);
            if (token is null) return false;
            var updated = await db.Execute(@"UPDATE USERS SET password_hash=:new_hash,
                updated_at=SYSTIMESTAMP WHERE user_id=:user_id AND status='ACTIVE'",
                ModuleRules.P(("new_hash", newPasswordHash), ("user_id", userId)), ct, conn, tx);
            if (updated != 1) return false;
            await db.Execute(@"UPDATE PASSWORD_RESET_TOKENS SET used_at=SYSTIMESTAMP
                WHERE user_id=:user_id AND used_at IS NULL",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            await db.Execute(@"UPDATE SESSIONS SET revoked_at=SYSTIMESTAMP
                WHERE user_id=:user_id AND revoked_at IS NULL",
                ModuleRules.P(("user_id", userId)), ct, conn, tx);
            return true;
        }, ct);

    public Task<long> SaveSession(long userId, string hash, string? device, DateTimeOffset expires, CancellationToken ct) =>
        db.InsertId(@"INSERT INTO SESSIONS(user_id,refresh_token_hash,device_label,expires_at)
            VALUES (:id,:hash,:device,:expiry)",ModuleRules.P(("id",userId),("hash",hash),
            ("device",device),("expiry",expires)),"session_id",ct);

    public async Task<Dictionary<string,object?>> RotateSession(string oldHash, string newHash,
        DateTimeOffset newExpiry,CancellationToken ct) => await db.Transaction(async (conn,tx)=> {
            var row=await db.One(@"SELECT s.session_id AS ""sessionId"",u.user_id AS ""userId"",u.role,u.status
                 FROM SESSIONS s JOIN USERS u ON u.user_id=s.user_id
                 WHERE s.refresh_token_hash=:hash AND s.revoked_at IS NULL AND s.expires_at>SYSTIMESTAMP
                 FOR UPDATE OF s.refresh_token_hash",ModuleRules.P(("hash",oldHash)),ct,conn,tx);
            ModuleRules.Found(row is not null && ModuleRules.Str(row,"STATUS")=="ACTIVE");
            await db.Execute(@"UPDATE SESSIONS SET refresh_token_hash=:new_hash,rotated_at=SYSTIMESTAMP,
                 expires_at=:expiry WHERE session_id=:id",ModuleRules.P(("new_hash",newHash),
                 ("expiry",newExpiry),("id",ModuleRules.Id(row!,"sessionId"))),ct,conn,tx);
            return row!;
        },ct);

    public Task<int> Logout(long userId, string hash, CancellationToken ct) => db.Execute(@"
        UPDATE SESSIONS SET revoked_at=SYSTIMESTAMP
        WHERE user_id=:user_id AND refresh_token_hash=:hash AND revoked_at IS NULL",
        ModuleRules.P(("user_id",userId),("hash",hash)),ct);
}
