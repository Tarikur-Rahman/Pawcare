using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Users;
public sealed class UsersRepository(ModuleDb db)
{
    public Task<Dictionary<string,object?>?> Profile(long userId,CancellationToken ct)=>db.One(@"
        SELECT u.user_id AS ""id"",u.email,u.role,u.status,p.display_name AS ""displayName"",
               p.phone_e164 AS ""phone"",p.preferred_time_zone AS ""timeZone"",p.preferred_locale AS ""locale""
        FROM USERS u JOIN USER_PROFILES p ON p.user_id=u.user_id WHERE u.user_id=:id",
        ModuleRules.P(("id",userId)),ct);
    public Task<int> Update(long userId,string name,string zone,string locale,string? phone,CancellationToken ct)=>db.Execute(@"
        UPDATE USER_PROFILES SET display_name=:name,phone_e164=:phone,preferred_time_zone=:zone,
        preferred_locale=:locale,updated_at=SYSTIMESTAMP WHERE user_id=:user_id",
        ModuleRules.P(("name",name),("phone",phone),("zone",zone),("locale",locale),("user_id",userId)),ct);
    public Task<List<Dictionary<string,object?>>> Addresses(long id,CancellationToken ct)=>db.Query(@"
        SELECT address_id AS ""id"",recipient_name AS ""recipientName"",line_1 AS ""line1"",line_2 AS ""line2"",
          city,region,postal_code AS ""postalCode"",country_code AS ""countryCode"",scope,is_default AS ""isDefault""
        FROM ADDRESSES WHERE user_id=:id AND status='ACTIVE' ORDER BY is_default DESC,address_id DESC",
        ModuleRules.P(("id",id)),ct);
    public Task<long> AddAddress(long userId,string recipient,string line,string city,string country,string scope,
        CancellationToken ct)=>db.InsertId(@"INSERT INTO ADDRESSES(user_id,recipient_name,line_1,city,country_code,scope)
        VALUES (:id,:recipient,:line,:city,:country,:scope)",
        ModuleRules.P(("id",userId),("recipient",recipient),("line",line),("city",city),
            ("country",country),("scope",scope)),"address_id",ct);
}
