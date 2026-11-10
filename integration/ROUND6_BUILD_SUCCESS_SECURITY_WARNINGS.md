# PawCare Integration Round 6 — Backend build succeeded; security and nullable warning fixes

Date: 2026-11-06.

## Evidence from user's Windows .NET 10 build

- `dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release`: **succeeded**.
- Built assembly: `backend/PawCare.Api/bin/Release/net10.0/PawCare.Api.dll`.
- Build reported **657 warnings**, with no compiler errors.
- Warnings include `NU1902` / `NU1903` for transitive `System.Security.Cryptography.Pkcs` 8.0.1, nullable warnings `CS8604`, and many XML-documentation warnings `CS1591`.
- Compilation success does not imply Oracle connectivity, API runtime success, web/mobile builds, passing tests, or production readiness.

## Changes made

1. `backend/PawCare.Api/PawCare.Api.csproj`: add a direct package reference to **System.Security.Cryptography.Pkcs 10.0.13**. Microsoft's October 2026 advisories list 10.0.13 as patched for both the high and moderate vulnerabilities; 8.0.1 is affected. A direct dependency is expected to override the older transitive dependency during NuGet resolution. Check the restored graph on Windows; package compatibility and clean restore have **not** been run in this environment.
2. `backend/PawCare.Api/Modules/Shared/ModuleDb.cs`: annotate `ModuleRules.Found`'s boolean guard with `[DoesNotReturnIf(false)]`, informing the C# compiler that a false condition always throws. Runtime behavior is unchanged; this should eliminate the `CS8604` warnings where repository records are checked for null, but must be verified in a real build.
3. Keep `CS1591` warnings visible. They indicate incomplete documentation for public APIs and are not security advisories. Suppressing them across the project would hide the gap instead of fixing it.

## Verify in the PawCare project root (PowerShell)

```powershell
dotnet restore .\backend\PawCare.Api\PawCare.Api.csproj
dotnet list .\backend\PawCare.Api\PawCare.Api.csproj package --include-transitive --vulnerable
dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release -v:q
dotnet test .\backend\PawCare.Api.Tests\PawCare.Api.Tests.csproj -c Release
```

If tests run, record pass/fail/skip counts. Some tests are opt-in contract checks and cannot confirm live Oracle behavior. Use a separately authorized disposable Oracle PDB for integration tests; do not set destructive database credentials or run unreviewed migrations on production.

After successful backend unit tests, switch from Node 26 to Node 22 for the Next.js/Expo checks, then run `npm.cmd install` in both `frontend` and `mobile` and execute each package's `typecheck` and `test` scripts.

## References

- https://github.com/dotnet/runtime/security/advisories/GHSA-846f-f764-76mx — high severity; 10.0.13 patched.
- https://github.com/dotnet/runtime/security/advisories/GHSA-2fmv-rv2c-59x7 — moderate severity; 10.0.13 patched.
