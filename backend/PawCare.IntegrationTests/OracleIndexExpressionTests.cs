using Xunit;

namespace PawCare.IntegrationTests;

public sealed class OracleIndexExpressionTests
{
    [Theory]
    [InlineData("FUNCTION-BASED NORMAL", 1, true)]
    [InlineData("FUNCTION-BASED NORMAL", 3, true)]
    [InlineData("NORMAL", 1, false)]
    [InlineData("FUNCTION-BASED NORMAL", 0, false)]
    [InlineData("FUNCTION-BASED BITMAP", 1, false)]
    [InlineData("FUNCTION-BASED NORMAL", -1, false)]
    public void IndexType_IsRelaxedOnlyForImplicitTstzExpressions(
        string actualType, int implicitTimestampColumns, bool expected) =>
        Assert.Equal(expected,
            SqlProviderParityTests.IsImplicitTstzFunctionBasedNormal(
                actualType, implicitTimestampColumns));

    [Fact]
    public void CaseRewrite_IsAcceptedOnlyWhenItsSourceBranchesAndNullFallthroughMatch()
    {
        Assert.True(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END",
            "CASE \"STATUS\" WHEN 'REQUESTED' THEN \"VET_USER_ID\" " +
            "WHEN 'CONFIRMED' THEN \"VET_USER_ID\" END"));

        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END",
            "CASE \"STATUS\" WHEN 'REQUESTED' THEN \"VET_USER_ID\" " +
            "WHEN 'CANCELLED' THEN \"VET_USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END",
            "CASE \"STATUS\" WHEN 'REQUESTED' THEN \"OTHER_ID\" " +
            "WHEN 'CONFIRMED' THEN \"OTHER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END",
            "CASE \"STATUS\" WHEN 'REQUESTED' THEN \"VET_USER_ID\" " +
            "WHEN 'CONFIRMED' THEN \"VET_USER_ID\" ELSE NULL END"));
    }

    [Fact]
    public void TimestampCaseRewrite_IsAcceptedOnlyForAnExplicitlyAllowedTstzResult()
    {
        const string expected =
            "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN starts_at END";
        const string rewritten =
            "SYS_EXTRACT_UTC(CASE \"STATUS\" WHEN 'REQUESTED' THEN \"STARTS_AT\" " +
            "WHEN 'CONFIRMED' THEN \"STARTS_AT\" END)";

        Assert.True(SqlProviderParityTests.ExpressionsEquivalent(
            expected, rewritten, allowTimestampWrapper: true));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            expected, rewritten));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            expected,
            "SYS_EXTRACT_UTC(CASE \"STATUS\" WHEN 'REQUESTED' THEN \"OTHER_AT\" " +
            "WHEN 'CONFIRMED' THEN \"OTHER_AT\" END)",
            allowTimestampWrapper: true));
    }

    [Fact]
    public void IdentifierQuoting_IsEquivalentOnlyForUppercaseOracleIdentifiers()
    {
        Assert.True(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status = 'ACTIVE' THEN user_id END",
            "CASE \"STATUS\" WHEN 'ACTIVE' THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN status = 'ACTIVE' THEN user_id END",
            "CASE \"status\" WHEN 'ACTIVE' THEN \"USER_ID\" END"));
    }

    [Fact]
    public void ConjunctiveCaseRewrite_AllowsOnlyOneOuterPredicateParenthesisPair()
    {
        const string expected =
            "CASE WHEN is_default=1 AND status='ACTIVE' THEN user_id END";
        const string actual =
            "CASE WHEN (\"IS_DEFAULT\"=1 AND \"STATUS\"='ACTIVE') " +
            "THEN \"USER_ID\" END";

        Assert.True(SqlProviderParityTests.ExpressionsEquivalent(expected, actual));
        Assert.True(SqlProviderParityTests.ExpressionsEquivalent(
            "CASE WHEN is_default=1 AND status='ACTIVE' THEN scope END",
            "CASE  WHEN (\"IS_DEFAULT\"=1 AND \"STATUS\"='ACTIVE') THEN \"SCOPE\" END"));

        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"IS_DEFAULT\"<>1 AND \"STATUS\"='ACTIVE') " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"IS_DEFAULT\"=1 AND \"STATUS\"='INACTIVE') " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"OTHER_FLAG\"=1 AND \"STATUS\"='ACTIVE') " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"IS_DEFAULT\"=1 OR \"STATUS\"='ACTIVE') " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN ((\"IS_DEFAULT\"=1 AND \"STATUS\"='ACTIVE')) " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"IS_DEFAULT\"=1 AND \"STATUS\"='ACTIVE' AND \"SCOPE\"='X') " +
            "THEN \"USER_ID\" END"));
        Assert.False(SqlProviderParityTests.ExpressionsEquivalent(expected,
            "CASE WHEN (\"IS_DEFAULT\"=1 AND \"STATUS\"='ACTIVE') " +
            "THEN \"USER_ID\" ELSE NULL END"));
    }
}
