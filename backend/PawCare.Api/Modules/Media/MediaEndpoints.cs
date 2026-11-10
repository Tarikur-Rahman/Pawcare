using PawCare.Api.Common;
namespace PawCare.Api.Modules.Media;
public static class MediaEndpoints
{
    public static IEndpointRouteBuilder MapMediaEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/media").RequireAuthorization().WithTags("Media");
        g.MapGet("/mine",async (HttpContext c,MediaService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.MyAssets(c.User,ct)));
        // Bearer-only API upload; multipart form access is explicit, not cookie-based.
        g.MapPost("/",async (HttpContext c,MediaService s,CancellationToken ct)=>{
            if(!c.Request.HasFormContentType)
                return ApiResponses.Error(c,DomainErrors.ValidationFailed(new Dictionary<string,string[]> {
                    ["file"]=["Multipart form upload is required."] }));
            var form=await c.Request.ReadFormAsync(ct);
            var file=form.Files.GetFile("file");
            if(file is null)
                return ApiResponses.Error(c,DomainErrors.ValidationFailed(new Dictionary<string,string[]> {
                    ["file"]=["Attach a file."] }));
            return ApiResponses.Ok(c,await s.Upload(c.User,file,ct));
        }).DisableAntiforgery(); // API is bearer-token auth, not ambient browser-cookie auth.
        return app;
    }
}
