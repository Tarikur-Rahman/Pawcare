[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$orchestration = Join-Path $root 'database\oracle\orchestration\apply_v002_v012.sql'
$migrationDir = Join-Path $root 'database\oracle\migrations'

if (-not (Test-Path -LiteralPath $orchestration -PathType Leaf)) {
    throw "Orchestration script was not found: $orchestration"
}

$scriptText = [IO.File]::ReadAllText($orchestration)
if ($scriptText -match '(?im)^\s*connect\b' -or
    $scriptText -match '(?i)standardinput|password\s*=|@database\\oracle\\seeds\\002_demo_data_dev_only\.sql') {
    throw 'Unsafe authentication, password transport, or demo-seed content found in orchestration script.'
}

$requiredReferences = @(
    'V002_identity_profiles.sql',
    'V003_assets_notifications_audit.sql',
    'V004_adoption.sql',
    'V005_donations.sql',
    'V006_pet_marketplace.sql',
    'V007_moderation_favorites.sql',
    'V008_lost_found.sql',
    'V009_food_catalog_inventory.sql',
    'V010_cart_orders.sql',
    'V011_payments_delivery_reviews.sql',
    'V012_outbox_keys_indexes.sql',
    'V013_auth_verification.sql',
    '001_reference_data.sql',
    'verify_foreign_keys.sql',
    'verify_indexes.sql',
    'verify_seed_consistency.sql'
)
foreach ($reference in $requiredReferences) {
    if ($scriptText.IndexOf($reference, [StringComparison]::Ordinal) -lt 0) {
        throw "Missing required script reference: $reference"
    }
}

$algorithm = [Security.Cryptography.SHA256]::Create()
try {
    for ($i = 1; $i -le 13; $i++) {
        $version = 'V{0:D3}' -f $i
        $file = Get-ChildItem -LiteralPath $migrationDir -Filter "$version`_*.sql" -File
        if ($null -eq $file) {
            throw "Missing migration source for $version."
        }

        $source = [IO.File]::ReadAllText($file.FullName).Replace("`r`n", "`n").Replace("`r", "`n")
        $begin = "-- BEGIN $version DDL (checksum scope starts after this line)"
        $end = "-- END $version DDL (checksum scope ends before this line)"
        $beginIndex = $source.IndexOf($begin, [StringComparison]::Ordinal)
        $endIndex = $source.IndexOf($end, [StringComparison]::Ordinal)
        if ($beginIndex -lt 0 -or $endIndex -le $beginIndex) {
            throw "$version has missing or unordered checksum markers."
        }

        $lineEnd = $source.IndexOf("`n", $beginIndex + $begin.Length)
        $scope = $source.Substring($lineEnd + 1, $endIndex - $lineEnd - 1)
        $hash = ([BitConverter]::ToString(
            $algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($scope))
        )).Replace('-', '').ToLowerInvariant()
        $occurrences = ([Regex]::Matches($scriptText, $hash, [Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
        if ($occurrences -ne 1) {
            throw "$version scoped checksum is not embedded exactly once in the orchestration script."
        }
    }
}
finally {
    $algorithm.Dispose()
}

if ($scriptText -notmatch '(?im)^\s*whenever\s+sqlerror\s+exit\b' -or
    $scriptText -notmatch '(?im)^\s*whenever\s+oserror\s+exit\b') {
    throw 'Required SQL*Plus error directives are missing.'
}

Write-Host 'PASS: orchestration references V002-V013, reference seed, and all three verifiers.'
Write-Host 'PASS: all thirteen immutable migration checksum scopes match embedded assertions.'
Write-Host 'PASS: no CONNECT, redirected stdin, password assignment, or demo seed was found.'
Write-Host 'PASS: validation was static only; no Oracle connection or SQL execution was attempted.'
