using PawCare.Api.Modules.Auth;
using PawCare.Api.Security;
using PawCare.Api.Modules.Shared;
using Xunit;

namespace PawCare.Api.Tests;

public sealed class PasswordResetTests
{
    [Fact]
    public void GeneratedResetTokensAreUniqueOpaqueAndUrlSafe()
    {
        var first = VerificationTokenGenerator.Generate();
        var second = VerificationTokenGenerator.Generate();
        Assert.NotEqual(first, second);
        Assert.True(PasswordResetPolicy.IsValidToken(first));
        Assert.True(PasswordResetPolicy.IsValidToken(second));
        Assert.Equal(64, ModuleRules.Hash(first).Length);
        Assert.NotEqual(ModuleRules.Hash(first), ModuleRules.Hash(second));
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("../../etc/passwd")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+")]
    public void RejectsInvalidResetTokenShapes(string raw) =>
        Assert.False(PasswordResetPolicy.IsValidToken(raw));

    [Fact]
    public void ResetLinkUsesFragmentAndDoesNotSendTokenToNextServer()
    {
        var token = VerificationTokenGenerator.Generate();
        var link = PasswordResetPolicy.BuildLink("http://localhost:3000", token);
        Assert.Equal("http://localhost:3000/reset-password#token=" + token, link);
        Assert.Equal(string.Empty, new Uri(link).Query);
        Assert.Equal(TimeSpan.FromMinutes(30), PasswordResetPolicy.Lifetime);
    }

    [Theory]
    [InlineData("http://example.com")]
    [InlineData("https://example.com/other")]
    [InlineData("https://example.com?next=https://evil.example")]
    [InlineData("https://user:pass@example.com")]
    [InlineData("javascript:alert(1)")]
    public void ResetLinkRejectsUnsafePublicOrigins(string origin) =>
        Assert.Throws<ArgumentException>(() =>
            PasswordResetPolicy.BuildLink(origin, VerificationTokenGenerator.Generate()));

    [Fact]
    public void RecoveredPasswordIsStoredAsPbkdf2HashNotPlaintext()
    {
        var hasher = new PasswordHasher();
        var hash = hasher.HashPassword("a-New-Password-123!");
        Assert.StartsWith("pbkdf2-sha256$", hash);
        Assert.DoesNotContain("a-New-Password-123!", hash);
        Assert.Equal(PasswordVerificationOutcome.Success,
            hasher.VerifyPassword(hash, "a-New-Password-123!"));
        Assert.Equal(PasswordVerificationOutcome.Failed,
            hasher.VerifyPassword(hash, "a-different-password-321!"));
    }
}
