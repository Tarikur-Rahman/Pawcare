# PawCare Oracle Backend Integration Execution Report

Generated: 2026-11-08T01:31:47.9879517Z

## Result

| Check | Result |
|---|---|
| Oracle target | FREEPDB1 / PAWCARE_APP |
| API build | PASS |
| Oracle integration tests | pass |
| Database connectivity/readiness | PASS |
| /api/health | HTTP 200 |
| /api/health/ready | HTTP 200 |

## Test counts

Integration test exit code: 0

- Total: 19
- Passed: 19
- Failed: 0
- Skipped: 0

## Sanitized test diagnostics

`	ext
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(358,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(359,26): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(344,30): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(390,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(391,28): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(368,30): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(369,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(370,26): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(400,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(401,26): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(442,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(443,26): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(452,34): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(467,38): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(878,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(879,27): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(885,29): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(905,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(906,28): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(919,44): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\SqlProviderParityTests.cs(920,27): warning xUnit1051: Calls to methods which accept CancellationToken should use TestContext.Current.CancellationToken to allow test cancellation to be more responsive. (https://xunit.net/xunit.analyzers/rules/xUnit1051) [C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj]
Running tests from C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\bin\Release\net10.0\PawCare.IntegrationTests.dll (net10.0|x64)
C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.IntegrationTests\bin\Release\net10.0\PawCare.IntegrationTests.dll (net10.0|x64) passed (6s 636ms)
Test run summary: Passed!
  total: 19
  failed: 0
  succeeded: 19
  skipped: 0
`

## Database verification

The readiness endpoint opened Oracle and verified that the SCHEMA_MIGRATIONS
ledger contains V001-V013 (13 Oracle migration versions). No migration or seed SQL was
executed by this workflow.

## Security and scope

The Oracle password was entered through a private Read-Host -AsSecureString
prompt. It was never written to a file, command-line argument, report, or log.
Payment processing, demo data, migrations, schema rebuilds and all background workers remained disabled.