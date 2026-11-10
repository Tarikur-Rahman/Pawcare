# PawCare — Round 3: C# Raw SQL Literal Repair

## Problem and cause

Windows .NET 10 compilation failed with 2,337 C# syntax errors (CS9000, CS8997, CS1003 and cascading errors). Many Oracle SQL string literals started with `"""` on the same line as SQL and closed after text on that same line. C# multiline raw string delimiters must be positioned properly.

## Exact repair

- Repaired **132 raw literals across 24 module C# files**, replacing malformed `"""..."""` expressions with syntactically valid verbatim string literals (`@"..."`).
- Preserved the original string payload (including line breaks and Oracle bind placeholders); every embedded `"` was escaped as `""` in C# source to preserve the actual SQL text.
- Added a `source-audit.py` guard that catches the same malformed multiline raw literal pattern in future changes.
- Corrected source-audit SDK detection, which previously reported `.NET SDK available: false` even on a Windows machine with .NET 10 installed.
- Did **not** modify Oracle migrations, payment-state rules, user data, or environmental credentials.

## Validation performed

- All 132 replacements matched their original literal contents after decoding.
- Source audit and package integrity checks passed.
- No .NET SDK is available in this execution environment. **The patch is not certified compiled**. Re-run `dotnet build` on Windows; further C# binding/type errors may be reported and must be corrected separately.

## Windows installation

1. Back up your current PawCare project or commit it to Git.
2. Extract `PawCare_Round3_CSharp_Fix_Patch.zip` alongside your project so its `PawCare/` folder merges into the existing one, preserving the same relative paths. Alternatively copy the contents of its `PawCare/` folder into your current project root.
3. From your project root run:

```powershell
dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release
```

For a concise compiler-error log:

```powershell
dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release -v:q 2>&1 | Tee-Object .\backend-build-round3.log
```

The previously reported NU1902 and NU1903 vulnerabilities for transitive `System.Security.Cryptography.Pkcs` 8.0.1 also remain to be resolved. Inspect dependency paths with `dotnet list .\backend\PawCare.Api\PawCare.Api.csproj package --include-transitive --vulnerable`, then upgrade the appropriate parent dependency to a compatible patched version. Do not suppress these advisories.

The web and mobile npm lockfiles and subsequent Oracle/device tests are not addressed by this C# syntax repair.
