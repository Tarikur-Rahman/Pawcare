# PawCare — Round 7 .NET 10 test-runner compatibility fix

Date: 2026-11-06

## Verified user-provided evidence

- The ASP.NET Core 10 API compiled successfully after the earlier source cleanup.
- The dependency scan returned: `The given project PawCare.Api has no vulnerable packages given the current sources.`
- `dotnet test` for **both** `PawCare.Api.Tests` and `PawCare.IntegrationTests` failed *before tests ran*, because the SDK selected its default VSTest mode while the Microsoft.Testing.Platform MSBuild targets rejected it.
- The reported targets path contains `Microsoft.Testing.Platform.MSBuild/2.5.1`.

## Fix

Create `PawCare/global.json` with:

```json
{
  "test": {
    "runner": "Microsoft.Testing.Platform"
  }
}
```

This opts .NET 10 `dotnet test` into Microsoft.Testing.Platform (MTP). Both PawCare test projects already target `net10.0`, use `xunit.v3` 4.0.2 and have `OutputType` set to `Exe`; neither project file was changed. The original package references to `Microsoft.NET.Test.Sdk` and `xunit.runner.visualstudio` are retained for compatibility, as suggested in xUnit's documentation.

No application code, SQL migrations or test assertions were changed.

Official references:

- https://learn.microsoft.com/dotnet/core/tools/dotnet-test
- https://learn.microsoft.com/dotnet/core/testing/migrating-vstest-microsoft-testing-platform
- https://xunit.net/docs/getting-started/v3/microsoft-testing-platform

## Apply

**Patch:** extract the contents under the patch archive's `PawCare/` folder into the *existing* PawCare repository root. Confirm `PawCare/global.json` is adjacent to `PawCare/backend/` and `PawCare/scripts/`. Running `dotnet test` from that root is important so the SDK discovers `global.json`.

**No need to copy the full repository ZIP over an existing directory**; merging full ZIPs can leave duplicate C# files behind. Use the patch ZIP on existing installations.

## Verify in Windows PowerShell — PawCare root

```powershell
dotnet test .\backend\PawCare.Api.Tests\PawCare.Api.Tests.csproj -c Release
dotnet test .\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj -c Release
```

The integration suite includes non-Oracle checks; live Oracle checks are individually skipped unless the explicit disposable test-PDB opt-in is configured. Do not enable the Oracle opt-in against production or migrate a live database as part of this change.

Expected outcome: the MTP/VSTest error should disappear and actual test discovery/execution should start. Additional C# test compilation errors or failing assertions may become visible. **No .NET SDK was available in the artifact environment; tests have not been executed or certified passing here.**

If the error persists, confirm `Get-Content .\global.json` from the same working directory and `dotnet --version` reports 10.x. Note that `global.json` can also be shadowed by another file higher/lower in the directory hierarchy depending on your working directory.
