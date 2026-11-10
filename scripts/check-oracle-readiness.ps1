# PawCare Round 13: local, read-only Oracle readiness inventory.
# Does not connect to Oracle, collect secrets, or execute SQL/migrations.
# Run from the PawCare repository root; no admin rights are required.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationDir = Join-Path $root 'database\oracle\migrations'
$files = @(Get-ChildItem -LiteralPath $migrationDir -Filter 'V???_*.sql' -File | Sort-Object Name)

Write-Host 'PawCare | Oracle test-environment readiness (read-only)' -ForegroundColor Cyan
Write-Host ('Repository: ' + $root)
$ok = ($files.Count -eq 13)
for ($i = 1; $i -le 13; $i++) {
    $expected = ('V{0:D3}_' -f $i)
    if ($files.Count -lt $i -or -not $files[$i - 1].Name.StartsWith($expected)) {
        $ok = $false
        Write-Host ('MISSING / WRONG ORDER: ' + $expected) -ForegroundColor Red
    }
}
if ($ok) { Write-Host 'PASS: 13 local Oracle migrations V001 through V013 detected.' -ForegroundColor Green }
else { Write-Host 'FAIL: Local migration inventory is incomplete or unordered.' -ForegroundColor Red }

$scriptChecks = @(
    'database\oracle\000_create_schema.sql',
    'database\oracle\seeds\001_reference_data.sql',
    'database\oracle\verification\verify_foreign_keys.sql',
    'database\oracle\verification\verify_indexes.sql',
    'database\oracle\verification\verify_seed_consistency.sql',
    'database\oracle\verification\verify_test_target_read_only.sql'
)
foreach ($rel in $scriptChecks) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $rel) -PathType Leaf)) {
        Write-Host ('MISSING: ' + $rel) -ForegroundColor Red
        $ok = $false
    }
}

$client = Get-Command 'sqlplus.exe' -ErrorAction SilentlyContinue
if (-not $client) { $client = Get-Command 'sql.exe' -ErrorAction SilentlyContinue }
if ($client) {
    Write-Host ('SQL client detected: ' + $client.Name + ' (' + $client.Source + ')') -ForegroundColor Green
} else {
    Write-Warning 'No SQL*Plus/SQLcl executable found on PATH. Install an Oracle client or add its bin directory to PATH.'
}

# Oracle might be remote; absence of local services is NOT a database failure.
try {
    $services = @(Get-Service -ErrorAction Stop | Where-Object {
        $_.Name -match 'Oracle|TNSListener' -or $_.DisplayName -match 'Oracle|TNS Listener'
    })
    if ($services.Count -gt 0) {
        Write-Host 'Local Oracle-related Windows services (informational):'
        foreach ($service in $services) { Write-Host ('  ' + $service.Name + ' : ' + $service.Status) }
    } else {
        Write-Host 'No local Oracle services detected; a remote database may still be used.'
    }
} catch {
    Write-Host 'Local service inventory unavailable; skipped (non-fatal).'
}

Write-Host 'No network/database connection was attempted and no credentials were read.'
Write-Host 'NEXT: Connect interactively to a disposable Oracle PDB, then run'
Write-Host '  @database/oracle/verification/verify_test_target_read_only.sql'
Write-Host 'Do not run schema bootstrap or migrations until PDB/schema identity is verified.'
if (-not $ok) { throw 'Local Oracle readiness source checks failed.' }
