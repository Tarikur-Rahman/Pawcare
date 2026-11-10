[CmdletBinding()]
param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$validator = Join-Path $PSScriptRoot 'validate-oracle-orchestration.ps1'

& $validator

Write-Host ''
Write-Host 'This runner no longer starts SQL*Plus or transports credentials.' -ForegroundColor Yellow
Write-Host 'Use a normal VS Code PowerShell terminal from:'
Write-Host ('  ' + $root)
Write-Host '  sqlplus /nolog'
Write-Host 'Then, at the private SQL*Plus prompt:'
Write-Host '  CONNECT PAWCARE_APP@"//localhost:1521/FREEPDB1"'
Write-Host 'After successful authentication, run exactly:'
Write-Host '  @database\oracle\orchestration\apply_v002_v012.sql'
if ($SelfTest) {
    Write-Host 'Self-test: PASS (static-only; no Oracle connection attempted).' -ForegroundColor Green
}
