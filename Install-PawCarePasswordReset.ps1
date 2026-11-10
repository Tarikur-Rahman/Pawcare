# Safe, preflight-first PawCare V014 patch installer for Windows PowerShell 5.1.
# Run once without -Apply to check for local modifications before copying files.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $ProjectRoot,
    [switch] $Apply
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$payload = Join-Path $PSScriptRoot 'files'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Patch-Manifest.json') -Raw | ConvertFrom-Json
$issues = New-Object 'System.Collections.Generic.List[string]'
$needsUpdate = @()
$alreadyApplied = 0

if (-not (Test-Path -LiteralPath (Join-Path $root 'backend\PawCare.Api\PawCare.Api.csproj') -PathType Leaf)) {
    throw 'Target directory is not the PawCare project root.'
}
foreach ($entry in $manifest) {
    $relative = [string]$entry.path
    if ($relative -match '(^|/)\.\.(/|$)' -or $relative.StartsWith('/')) {
        throw "Unsafe manifest path: $relative"
    }
    $relativeWindows = $relative.Replace('/', '\')
    $dest = Join-Path $root $relativeWindows
    $source = Join-Path $payload $relativeWindows
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Missing patch payload: $relative"
    }
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne ([string]$entry.patchSha256)) {
        throw "Patch file integrity check failed: $relative"
    }
    if (Test-Path -LiteralPath $dest -PathType Leaf) {
        $actualHash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -eq $sourceHash) {
            $alreadyApplied++
            continue
        }
        if ($null -eq $entry.originalSha256) {
            $issues.Add("New-file collision (local file would be replaced): $relative")
            continue
        }
        if ($actualHash -ne ([string]$entry.originalSha256)) {
            $issues.Add("Local source differs from the supplied baseline: $relative")
            continue
        }
    } elseif ($null -ne $entry.originalSha256) {
        $issues.Add("Expected existing source file missing: $relative")
        continue
    }
    $needsUpdate += $entry
}
if ($issues.Count -gt 0) {
    Write-Host 'No files changed. Resolve these differences before applying the patch:' -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host " - $_" }
    throw 'Patch preflight failed. Do not force overwrite local source files.'
}
Write-Host "PASS: $($manifest.Count) patch file checksums; $alreadyApplied already applied; $($needsUpdate.Count) pending."
if (-not $Apply) {
    Write-Host 'Dry-run only: add -Apply to copy files with backups. Oracle remains untouched.' -ForegroundColor Yellow
    return
}
if ($needsUpdate.Count -eq 0) { Write-Host 'All patch files already match; nothing to do.'; return }
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupRoot = Join-Path $PSScriptRoot ("backups\$timestamp")
foreach ($entry in $needsUpdate) {
    $relative = ([string]$entry.path).Replace('/', '\')
    $dest = Join-Path $root $relative
    $source = Join-Path $payload $relative
    if (Test-Path -LiteralPath $dest -PathType Leaf) {
        $backup = Join-Path $backupRoot $relative
        $backupDir = Split-Path -Parent $backup
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item -LiteralPath $dest -Destination $backup -Force
    }
}
Write-Host "Existing files backed up to: $backupRoot"
foreach ($entry in $needsUpdate) {
    $relative = ([string]$entry.path).Replace('/', '\')
    $dest = Join-Path $root $relative
    $source = Join-Path $payload $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Force
}
Write-Host "SUCCESS: $($needsUpdate.Count) PawCare source files installed."
Write-Host 'Oracle V014 NOT applied. Read docs\PASSWORD_RECOVERY_V014.md and run its SQL*Plus preflight first.'
