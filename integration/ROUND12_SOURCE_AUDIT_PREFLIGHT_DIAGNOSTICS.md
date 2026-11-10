# Round 12 — Preflight source audit diagnostics and Windows execution policy

## Triggering Windows results

- Oracle object source inventory, feature inventory, frontend and mobile source validation, both npm lockfiles, and .NET 10 detection: PASS.
- `Oracle SHA-256 + project static audit`: FAIL, but the preflight previously displayed only 150 characters of the JSON diagnostics. **The exact pre-patch failure cannot be determined from the pasted output.**
- `verify-windows.ps1`: rejected by Windows PowerShell because the script is unsigned. No script execution occurred.

## Minimal changes

1. `scripts/source-audit.py`: validate first-party JSON only, pruning generated/dependency folders (`node_modules`, `.next`, `.expo`, `.git`, `bin`, `obj`, `dist`, etc.). First-party JSON files, including both `package-lock.json` files, the project's manifest, and database migration checksum checks **remain validated**. The project file count and backend C# inventory also exclude generated files.
2. `scripts/release-preflight.py`: parse the source audit's structured `problems` report and display up to 15 diagnostic problems without truncation. The preflight retains nonzero strict-mode behavior and existing release blockers.
3. No Oracle SQL, backend C#, Next.js UI, Expo UI, package versions, test assertions, secrets, or PowerShell policy settings were modified.

## Validation in the artifact environment

- Python compilation and static `source-audit.py` pass on clean Round 12 source.
- Synthetic test with deliberately invalid `node_modules` and `.next` JSON: audit still passes.
- Synthetic test with deliberately invalid **first-party** JSON: audit fails with the concrete path and error.
- SHA-256 archive manifest and ZIP integrity verified.
- Windows preflight and PowerShell script **not executed in this environment**. If a real first-party source error remains on Windows, the updated preflight will report it.

## Windows steps from the PawCare root

```powershell
python .\scripts\source-audit.py
python .\scripts\release-preflight.py --output .\integration\results\preflight-round12.json

# Review this first-party project script before running it.
Get-Content .\scripts\verify-windows.ps1
Unblock-File .\scripts\verify-windows.ps1
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
.\scripts\verify-windows.ps1
```

This PowerShell policy applies to the **current PowerShell session only**. If a Group Policy enforces AllSigned or Restricted, do not override organizational policy. Use the equivalent manual dotnet/npm commands or obtain authorization/signing.

A passing source audit does not establish release readiness. Disposable Oracle PDB validation, browser/device tests, incomplete registration verification and payment workflows, and remaining mobile audit advisories still block production release.
