# PawCare V013 source-only repair. No Oracle connection or database changes.
# Run from the PawCare repository root, not inside SQL*Plus.
[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$verifier = Join-Path $ProjectRoot 'database\oracle\deployment\verify_v013.sql'
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
    throw "Missing verifier file: $verifier"
}
$text = [System.IO.File]::ReadAllText($verifier)
$pattern = '(?is)\bSELECT\s+column_position\s*,\s*column_name\s*,\s*column_expression\b[\s\S]*?;'
$matches = [regex]::Matches($text, $pattern)
if ($matches.Count -ne 1) {
    throw "Expected exactly one ambiguous final display query, found $($matches.Count). No changes made."
}
$existing = $matches[0].Value
foreach ($required in @('USER_IND_COLUMNS', 'USER_IND_EXPRESSIONS', 'IX_EMAIL_VERIFY_USER')) {
    if ($existing.IndexOf($required, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "The matched SQL does not contain $required. No changes made."
    }
}
$corrected = @'
SELECT ic.column_position, ic.column_name, ie.column_expression
FROM USER_IND_COLUMNS ic
LEFT JOIN USER_IND_EXPRESSIONS ie
  ON ie.index_name = ic.index_name
 AND ie.column_position = ic.column_position
WHERE ic.index_name = 'IX_EMAIL_VERIFY_USER'
ORDER BY ic.column_position;
'@
$backup = "$verifier.pre-v013-display-fix.bak"
if (Test-Path -LiteralPath $backup) {
    throw "Backup already exists: $backup. No changes made."
}
[System.IO.File]::Copy($verifier, $backup)
$revised = $text.Substring(0, $matches[0].Index) + $corrected + $text.Substring($matches[0].Index + $matches[0].Length)
[System.IO.File]::WriteAllText($verifier, $revised, [System.Text.UTF8Encoding]::new($false))
Write-Host "PASS: Updated final V013 display query (source only). Backup: $backup"
Write-Host 'Do not rerun V013 or reinsert its ledger row.'
