# Launch an already-built PawCare backend DLL using a configured Oracle DB.
# Some Windows installations block generated apphost .exe files; this uses dotnet <dll>.
# BindToLan opens a listening port on private network interfaces. Use only on trusted Wi-Fi.
param([switch]$BindToLan)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$api = Join-Path $root 'backend\PawCare.Api'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { throw 'Install .NET SDK 10 first.' }
Push-Location $api
try {
    $env:DOTNET_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = if ($BindToLan) { 'http://0.0.0.0:5080' } else { 'http://127.0.0.1:5080' }
    if (-not (Test-Path '.env')) { throw 'Copy .env.example to .env and configure Oracle and JWT settings.' }
    & dotnet build '.\PawCare.Api.csproj' -c Debug
    if ($LASTEXITCODE -ne 0) { throw 'API build failed. Inspect compiler errors.' }
    & dotnet '.\bin\Debug\net10.0\PawCare.Api.dll'
    if ($LASTEXITCODE -ne 0) { throw "API exited with code $LASTEXITCODE" }
} finally { Pop-Location }
