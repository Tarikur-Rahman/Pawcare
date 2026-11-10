# PawCare integration Round 5 — C# duplicate type clean-up

## Evidence

The actual Windows .NET 10 build reported 115 errors, predominantly `CS0101`, `CS0111`, and `CS8863`, after the Round-4 raw-string syntax corrections. The log names legacy paths such as `Infrastructure/SystemClock.cs`, `Infrastructure/Data/*.cs`, and `Infrastructure/PushGateway.cs`, which do **not** appear in the canonical Round-4 integrated ZIP. Canonical paths use `Infrastructure/Clock/`, `Infrastructure/Database/`, and `Infrastructure/Notifications/`. Duplicate worker, email, payment, and storage type definitions are also reported.

The canonical Round-4 archive contains **93 C# files in `backend/PawCare.Api/` and 174 distinct declared type identifiers**, with no duplicate identifiers in that manifest. The audit manifest in `scripts/` describes those sources. It does not assert that the project compiles.

## Safe cleanup process

1. Back up your current PawCare project. Ensure you previously extracted the Round-4 fixes.
2. Apply this package to the existing PawCare root, or use the full Round-5 archive in a **new, empty** folder. **Do not merge the full archive over the old directory**, as ZIP extraction does not delete old files.
3. Open PowerShell at `PawCare/`. Run `./scripts/repair-duplicate-csharp.ps1` to preview redundant files. The script finds **noncanonical** `.cs` files that declare a type already declared by an existing **canonical** `.cs` file.
4. Review the displayed list. Run `./scripts/repair-duplicate-csharp.ps1 -Apply` to **move** confirmed duplicates to a timestamped backup sibling directory. No source files are irreversibly deleted. The script does not move arbitrary extra files, canonical source files, missing-canonical situations, or `obj/bin` generated sources.
5. Run `dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release`.

If types remain duplicated, inspect the full compiler output and compare class declarations. If C# type-checking errors appear, these are a separate issue and require a new iteration. The static source audit did not invoke `dotnet` and cannot certify compilation.

## Security and dependency warning

The logged warnings `NU1902`/`NU1903` concern transitive `System.Security.Cryptography.Pkcs` 8.0.1 and are **not** addressed by this duplicate-source patch. On your Windows machine use `dotnet list .\backend\PawCare.Api\PawCare.Api.csproj package --include-transitive` to identify the dependency path, then update the appropriate direct/transitive packages after checking compatibility and current advisories.

## Scope

- Added `scripts/repair-duplicate-csharp.ps1` with preview and `-Apply` modes.
- Added `scripts/csharp-canonical-manifest.json` for recognizing actual duplicates.
- Refreshed the repository SHA-256 file manifest for this delivery (excluding itself).
- No existing C# implementation, security setting, Oracle migration, or service registration was modified in this round.
- Build result after this patch: **NOT YET VERIFIED** (requires the user's Windows .NET environment).
