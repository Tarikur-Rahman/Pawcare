namespace PawCare.Api.Infrastructure.Clock;

/// <summary>
/// Test-friendly clock abstraction. All persistence timestamps and token expiry
/// comparisons should use UTC, not local device or server time.
/// </summary>
public interface ISystemClock
{
    DateTimeOffset UtcNow { get; }
    DateOnly TodayUtc { get; }
    bool IsExpired(DateTimeOffset expiresAtUtc);
}

/// <summary>
/// Uses the TimeProvider already registered by AddPawCareServices().
/// For tests, inject a fake TimeProvider instead of changing system time.
/// </summary>
public sealed class SystemClock(TimeProvider timeProvider) : ISystemClock
{
    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();

    public DateOnly TodayUtc => DateOnly.FromDateTime(UtcNow.UtcDateTime);

    public bool IsExpired(DateTimeOffset expiresAtUtc) => UtcNow >= expiresAtUtc;
}
