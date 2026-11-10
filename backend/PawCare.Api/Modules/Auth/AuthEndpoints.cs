using Microsoft.AspNetCore.RateLimiting;
using PawCare.Api.Common;
namespace PawCare.Api.Modules.Auth;
public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group=endpoints.MapGroup("/api/v1/auth").WithTags("Auth");
        group.MapPost("/register",async (HttpContext context,RegisterRequest request,AuthService service,CancellationToken ct)=>
            ApiResponses.Created(context,"/api/v1/auth/me",await service.Register(request,ct))).AllowAnonymous();
        group.MapPost("/login",async (HttpContext context,LoginRequest request,AuthService service,CancellationToken ct)=>
            ApiResponses.Ok(context,await service.Login(request,ct))).AllowAnonymous();
        group.MapPost("/refresh",async (HttpContext context,RefreshRequest request,AuthService service,CancellationToken ct)=>
            ApiResponses.Ok(context,await service.Refresh(request,ct))).AllowAnonymous();
        group.MapPost("/verify-email",async (HttpContext context,VerifyEmailRequest request,AuthService service,CancellationToken ct)=>{
            await service.VerifyEmail(request,ct); return Results.NoContent();}).AllowAnonymous();
        group.MapGet("/verify-email",async (HttpContext context,string token,AuthService service,CancellationToken ct)=>{
            await service.VerifyEmail(new VerifyEmailRequest(token),ct); return Results.NoContent();}).AllowAnonymous();
        group.MapPost("/resend-verification",async (HttpContext context,ResendVerificationRequest request,AuthService service,CancellationToken ct)=>{
            await service.ResendVerification(request,ct);
            return Results.Accepted(value: new { message="If the account can be verified, instructions will be sent." });}).AllowAnonymous();
        group.MapPost("/forgot-password",async (ForgotPasswordRequest request,AuthService service,CancellationToken ct)=>{
            await service.ForgotPassword(request,ct);
            return Results.Accepted(value: new { message="If an eligible account exists, password reset instructions will be emailed." });
        }).AllowAnonymous().RequireRateLimiting("password-recovery");
        group.MapPost("/reset-password",async (ResetPasswordRequest request,AuthService service,CancellationToken ct)=>{
            await service.ResetPassword(request,ct);
            return Results.Ok(new { message="Password changed. You can now sign in." });
        }).AllowAnonymous().RequireRateLimiting("password-recovery");
        group.MapGet("/me",async (HttpContext context,AuthService service,CancellationToken ct)=> {
            var user=await service.Me(context.User,ct);
            return user is null ? ApiResponses.Error(context,DomainErrors.NotFound()) : ApiResponses.Ok(context,user);
        }).RequireAuthorization();
        group.MapPost("/logout",async (HttpContext context,LogoutRequest request,AuthService service,CancellationToken ct)=> {
            await service.Logout(context.User,request,ct);
            return Results.NoContent();
        }).RequireAuthorization();
        return endpoints;
    }
}
