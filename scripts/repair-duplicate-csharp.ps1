# PawCare Round 5: safely identify duplicate source files left by merged ZIP packages.
# PowerShell 5.1+ compatible. Preview-only by default; -Apply moves confirmed
# duplicates to a timestamped backup folder OUTSIDE the PawCare repository.
[CmdletBinding()]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $root 'backend\PawCare.Api'
$manifestFile = Join-Path $PSScriptRoot 'csharp-canonical-manifest.json'
if (-not (Test-Path -LiteralPath $api -PathType Container)) { throw "API directory not found: $api" }
if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw "Manifest not found: $manifestFile" }

$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$canonicalPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$canonicalSymbols = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
foreach ($entry in $manifest.files) {
    $rel = [string]$entry.path
    [void]$canonicalPaths.Add($rel)
    foreach ($symbol in $entry.symbols) {
        if ($canonicalSymbols.ContainsKey([string]$symbol)) { throw "Duplicate manifest symbol: $symbol" }
        $canonicalSymbols.Add([string]$symbol, $rel)
    }
}

$duplicates = New-Object 'System.Collections.Generic.List[object]'
$unexpected = New-Object 'System.Collections.Generic.List[string]'
$missingCanonical = New-Object 'System.Collections.Generic.List[string]'
foreach ($entry in $manifest.files) {
    $full = Join-Path $api (([string]$entry.path).Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $missingCanonical.Add([string]$entry.path)
    }
}

foreach ($file in (Get-ChildItem -LiteralPath $api -Recurse -File -Filter '*.cs')) {
    $rel = $file.FullName.Substring($api.Length).TrimStart('\','/').Replace('\','/')
    if ($rel -match '(^|/)(bin|obj)/') { continue }
    if ($canonicalPaths.Contains($rel)) { continue }

    $source = Get-Content -LiteralPath $file.FullName -Raw
    $ns = [regex]::Match($source, '(?m)^\s*namespace\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*[;{]')
    if (-not $ns.Success) {
        $unexpected.Add($rel)
        continue
    }

    $matches = [regex]::Matches($source, '\b(?:class|interface|record(?:\s+struct)?|enum|struct)\s+([A-Za-z_]\w*)\b')
    $conflicts = New-Object 'System.Collections.Generic.List[string]'
    foreach ($decl in $matches) {
        $fq = $ns.Groups[1].Value + '.' + $decl.Groups[1].Value
        if (-not $canonicalSymbols.ContainsKey($fq)) { continue }
        $expectedPath = $canonicalSymbols[$fq]
        # NEVER move a source file when its intended canonical counterpart is missing.
        $expectedFull = Join-Path $api ($expectedPath.Replace('/', '\'))
        if ((Test-Path -LiteralPath $expectedFull -PathType Leaf)) {
            $conflicts.Add("$fq -> $expectedPath")
        }
    }
    if ($conflicts.Count -gt 0) {
        $duplicates.Add([pscustomobject]@{
            RelativePath = $rel
            AbsolutePath = $file.FullName
            Conflicts = ($conflicts -join '; ')
        })
    } else {
        $unexpected.Add($rel)
    }
}

Write-Host "PawCare C# duplicate source audit" -ForegroundColor Cyan
Write-Host "  canonical source files: $($manifest.files.Count)"
Write-Host "  missing canonical sources: $($missingCanonical.Count)"
Write-Host "  redundant conflicting .cs files: $($duplicates.Count)"
Write-Host "  other unlisted .cs files (untouched): $($unexpected.Count)"
if ($missingCanonical.Count -gt 0) {
    Write-Warning 'Some canonical source files are missing. Restore them from the clean Round-4 ZIP before proceeding.'
    foreach ($p in $missingCanonical) { Write-Warning "  MISSING $p" }
}
if ($duplicates.Count -gt 0) {
    Write-Host "`nRedundant duplicate files:" -ForegroundColor Yellow
    foreach ($d in $duplicates) {
        Write-Host "  $($d.RelativePath)" -ForegroundColor Yellow
        Write-Host "    conflicts: $($d.Conflicts)"
    }
}
if ($unexpected.Count -gt 0) {
    Write-Host "`nAdditional source files NOT moved (no confirmed canonical type conflict):"
    foreach ($p in $unexpected) { Write-Host "  $p" }
}
if (-not $Apply) {
    Write-Host "`nPreview only. To back up and remove confirmed duplicates from compilation, run:" -ForegroundColor Cyan
    Write-Host '  .\scripts\repair-duplicate-csharp.ps1 -Apply'
    exit 0
}
if ($missingCanonical.Count -gt 0) {
    throw 'Aborted: canonical files missing. No changes were made.'
}
if ($duplicates.Count -eq 0) {
    Write-Host 'No redundant compiled source files to move.' -ForegroundColor Green
    exit 0
}
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$parent = Split-Path -Parent $root
$backupRoot = Join-Path $parent ("PawCare_Duplicate_Backup_$timestamp")
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($item in $duplicates) {
    $target = Join-Path $backupRoot ($item.RelativePath.Replace('/', '\'))
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    if (Test-Path -LiteralPath $target) { throw "Backup destination already exists: $target" }
    Move-Item -LiteralPath $item.AbsolutePath -Destination $target -ErrorAction Stop
    Write-Host "MOVED: $($item.RelativePath)" -ForegroundColor Green
}
Write-Host "`nMoved $($duplicates.Count) redundant files into: $backupRoot" -ForegroundColor Green
Write-Host 'No canonical file, database migration, frontend or mobile source was modified.'
Write-Host 'Re-run: dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release'
