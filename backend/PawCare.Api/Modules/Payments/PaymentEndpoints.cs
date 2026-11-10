using PawCare.Api.Common;
namespace PawCare.Api.Modules.Payments;
public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group=app.MapGroup("/api/v1/payments").WithTags("Payments");
        group.MapPost("/checkout",async (HttpContext c,StartPaymentRequest r,PaymentService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Start(c.User,r,ct))).RequireAuthorization();
        group.MapPost("/webhook/{provider}",async (string provider,HttpContext c,PaymentService s,CancellationToken ct)=>{
            // Reject oversized requests before reading the body into memory.
            if(c.Request.ContentLength is >1_048_576 or 0)
                return ApiResponses.Error(c,DomainErrors.ValidationFailed(new Dictionary<string,string[]>{{"body",["Invalid webhook size."]}}));
            await using var buffer=new MemoryStream();
            var bytes=new byte[8192];int count;
            while((count=await c.Request.Body.ReadAsync(bytes.AsMemory(),ct))>0)
            {
                if(buffer.Length+count>1_048_576)
                    return ApiResponses.Error(c,DomainErrors.ValidationFailed(new Dictionary<string,string[]>{{"body",["Webhook too large."]}}));
                await buffer.WriteAsync(bytes.AsMemory(0,count),ct);
            }
            var headers=c.Request.Headers.ToDictionary(x=>x.Key,x=>x.Value.ToString(),StringComparer.OrdinalIgnoreCase);
            return ApiResponses.Ok(c,await s.Receive(provider,buffer.ToArray(),headers,ct));
        }).AllowAnonymous(); // Authentication is the provider's cryptographic signature, NOT a JWT.
        return app;
    }
}
