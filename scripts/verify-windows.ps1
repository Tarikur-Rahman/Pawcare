# PawCare reproducible local verification. Run in PowerShell 7 or Windows PowerShell 5.1.
# Does not apply Oracle migrations or expose secrets.
param(
    [switch]$InstallDependencies,
    [switch]$RunOracleIntegrationTests,
    [switch]$ExportAndroidBundle
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
function Invoke-Step([string]$title, [scriptblock]$script) {
    Write-Host "`n=== $title ===" -ForegroundColor Cyan
    & $script
    if ($LASTEXITCODE -ne 0) { throw "$title failed with exit code $LASTEXITCODE" }
}
function Assert-Command([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing '$name'. Install it and reopen PowerShell."
    }
}
Assert-Command 'dotnet'
Assert-Command 'node'
Assert-Command 'npm.cmd'
$nodeVersion = (& node --version).Trim()
if (-not $nodeVersion.StartsWith('v22.')) { Write-Warning "PawCare is validated against Node.js 22; detected $nodeVersion." }
Push-Location $root
try {
    $py = Get-Command 'python' -ErrorAction SilentlyContinue
    if ($py) { Invoke-Step 'Source audit' { & python (Join-Path $root 'scripts/source-audit.py') } }
    else { Write-Warning 'Python not found; skipping optional static source audit.' }

    Invoke-Step 'Restore API' { & dotnet restore '.\backend\PawCare.Api\PawCare.Api.csproj' }
    Invoke-Step 'Build API' { & dotnet build '.\backend\PawCare.Api\PawCare.Api.csproj' -c Release --no-restore }
    Invoke-Step 'API unit tests' { & dotnet test '.\backend\PawCare.Api.Tests\PawCare.Api.Tests.csproj' -c Release }
    if ($RunOracleIntegrationTests) {
        if ($env:PAWCARE_TEST_ORACLE_OPT_IN -ne 'I_ACCEPT_READ_ONLY_ORACLE_TESTS') {
            throw 'Read-only Oracle integration tests require explicit opt-in and a disposable test Oracle database.'
        }
        Invoke-Step 'Oracle integration tests' { & dotnet test '.\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj' -c Release }
    }

    Push-Location (Join-Path $root 'frontend')
    try {
        if ($InstallDependencies) { Invoke-Step 'Install web packages + create lockfile' { & npm.cmd install } }
        if (-not (Test-Path 'node_modules')) { throw 'frontend dependencies missing. Rerun with -InstallDependencies.' }
        Invoke-Step 'Web typecheck' { & npm.cmd run typecheck }
        Invoke-Step 'Web tests' { & npm.cmd test }
        Invoke-Step 'Web production build' { & npm.cmd run build }
    } finally { Pop-Location }

    Push-Location (Join-Path $root 'mobile')
    try {
        if ($InstallDependencies) { Invoke-Step 'Install Expo packages + create lockfile' { & npm.cmd install } }
        if (-not (Test-Path 'node_modules')) { throw 'mobile dependencies missing. Rerun with -InstallDependencies.' }
        Invoke-Step 'Mobile typecheck' { & npm.cmd run typecheck }
        Invoke-Step 'Mobile tests' { & npm.cmd test }
        if ($ExportAndroidBundle) {
            Invoke-Step 'Expo Android JS export' { & npx.cmd expo export --platform android --output-dir '.\dist-audit-android' }
        }
    } finally { Pop-Location }
    Write-Host "`nAll selected local checks completed successfully." -ForegroundColor Green
} finally { Pop-Location }
