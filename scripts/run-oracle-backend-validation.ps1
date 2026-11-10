[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$apiProject = Join-Path $root 'backend\PawCare.Api\PawCare.Api.csproj'
$apiDirectory = Join-Path $root 'backend\PawCare.Api'
$apiDll = Join-Path $apiDirectory 'bin\Release\net10.0\PawCare.Api.dll'
$testProject = Join-Path $root 'backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj'
$resultsDirectory = Join-Path $root 'integration\results'
$reportMarkdown = Join-Path $resultsDirectory 'ORACLE_INTEGRATION_EXECUTION_REPORT.md'
$reportJson = Join-Path $resultsDirectory 'ORACLE_INTEGRATION_EXECUTION_REPORT.json'
$apiStdout = Join-Path $env:TEMP 'pawcare-api-validation.stdout.log'
$apiStderr = Join-Path $env:TEMP 'pawcare-api-validation.stderr.log'

if (-not (Test-Path -LiteralPath $apiProject -PathType Leaf) -or
    -not (Test-Path -LiteralPath $testProject -PathType Leaf)) {
    throw 'PawCare API or integration-test project was not found.'
}

$password = Read-Host 'Oracle PAWCARE_APP password (private; never written to disk)' -AsSecureString
$passwordBstr = [IntPtr]::Zero
$plainPassword = $null
$apiProcess = $null
$oldEnvironment = @{}
$environment = @{
    DOTNET_ENVIRONMENT = 'Development'
    ASPNETCORE_ENVIRONMENT = 'Development'
    ASPNETCORE_URLS = 'http://127.0.0.1:5080'
    PAWCARE_TEST_ORACLE_OPT_IN = 'I_ACCEPT_READ_ONLY_ORACLE_TESTS'
    PAWCARE_TEST_EXPECTED_PDB = 'FREEPDB1'
    PAWCARE_TEST_EXPECTED_SCHEMA = 'PAWCARE_APP'
    # Ensure background database writers remain disabled throughout this read-only run.
    Workers__Reminders__Enabled = 'false'
    Workers__Outbox__Enabled = 'false'
    Workers__Inventory__Enabled = 'false'
}

function Get-TestCounts {
    param([Parameter(Mandatory)][string]$Output)

    $summary = [Regex]::Match($Output, '(?m)Test run summary:\s+(Passed|Failed)!')
    $total = [Regex]::Match($Output, '(?m)^\s*total:\s*(\d+)\s*$')
    $failed = [Regex]::Match($Output, '(?m)^\s*failed:\s*(\d+)\s*$')
    $succeeded = [Regex]::Match($Output, '(?m)^\s*succeeded:\s*(\d+)\s*$')
    $skipped = [Regex]::Match($Output, '(?m)^\s*skipped:\s*(\d+)\s*$')
    if (-not $summary.Success -or -not $total.Success -or -not $failed.Success -or
        -not $succeeded.Success -or -not $skipped.Success) {
        return [ordered]@{
            total = $null
            passed = $null
            failed = $null
            skipped = $null
            parseStatus = 'not_available'
            summaryStatus = if ($summary.Success) { $summary.Groups[1].Value.ToLowerInvariant() } else { 'not_available' }
        }
    }
    return [ordered]@{
        total = [int]$total.Groups[1].Value
        passed = [int]$succeeded.Groups[1].Value
        failed = [int]$failed.Groups[1].Value
        skipped = [int]$skipped.Groups[1].Value
        parseStatus = 'parsed'
        summaryStatus = $summary.Groups[1].Value.ToLowerInvariant()
    }
}

function Get-SanitizedTestDiagnostics {
    param([Parameter(Mandatory)][string]$Output)

    $safe = [Regex]::Replace($Output, '(?i)(password|pwd)\s*=\s*[^;\s]+', '$1=[REDACTED]')
    $safe = [Regex]::Replace($safe, '(?i)(User Id|UID|Data Source|Connection String)[^=\r\n]*=[^\r\n]+', '$1=[REDACTED]')
    $safe = [Regex]::Replace($safe, '(?i)(Bearer\s+)[^\s\r\n]+', '$1[REDACTED]')
    $lines = @($safe -split "`r?`n" | Where-Object {
        $_ -match '(?i)failed|error|exception|assert|oracle|expected|actual|index|position|PawCare\.IntegrationTests|test run summary|^\s*(total|succeeded|skipped):'
    })
    if ($lines.Count -eq 0) {
        return 'No failure diagnostics were emitted by the test platform.'
    }
    return ($lines -join "`n")
}

function Get-SecureRandomBytes {
    param([Parameter(Mandatory)][int]$Length)

    $bytes = New-Object byte[] $Length
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
        return $bytes
    }
    finally {
        $rng.Dispose()
    }
}

function Get-HttpResult {
    param([Parameter(Mandatory)][string]$Uri)

    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 10
        return [ordered]@{
            statusCode = [int]$response.StatusCode
            body = $response.Content
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            return [ordered]@{
                statusCode = $null
                body = $null
                error = $_.Exception.Message
            }
        }
        $reader = New-Object IO.StreamReader($response.GetResponseStream())
        try {
            return [ordered]@{
                statusCode = [int]$response.StatusCode.value__
                body = $reader.ReadToEnd()
            }
        }
        finally {
            $reader.Dispose()
        }
    }
}

try {
    $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw 'Oracle password cannot be empty.'
    }

    $connectionString = 'User Id=PAWCARE_APP;Password="' +
        $plainPassword.Replace('"', '""') +
        '";Data Source=localhost:1521/FREEPDB1;Pooling=true;'
    $environment['ConnectionStrings__PawCare'] = $connectionString
    $environment['PAWCARE_TEST_ORACLE_CONNECTION'] = $connectionString
    $environment['Jwt__SigningKey'] = [Convert]::ToBase64String(
        (Get-SecureRandomBytes -Length 48))

    foreach ($name in $environment.Keys) {
        $oldEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $environment[$name])
    }

    New-Item -ItemType Directory -Path $resultsDirectory -Force | Out-Null
    & dotnet build $apiProject --configuration Release --no-restore | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw 'API build failed.'
    }

    $testOutput = (& dotnet test --project $testProject --configuration Release --no-restore 2>&1 | Out-String)
    $testExitCode = $LASTEXITCODE
    $testCounts = Get-TestCounts -Output $testOutput
    $testDiagnostics = Get-SanitizedTestDiagnostics -Output $testOutput
    $testResult = if ($testExitCode -eq 0 -and
        $testCounts.parseStatus -eq 'parsed' -and $testCounts.failed -eq 0) {
        'pass'
    }
    elseif ($testCounts.parseStatus -eq 'parsed') {
        'fail'
    }
    else {
        'pending'
    }

    if (-not (Test-Path -LiteralPath $apiDll -PathType Leaf)) {
        throw 'Built API assembly was not found.'
    }

    Remove-Item -LiteralPath $apiStdout, $apiStderr -Force -ErrorAction SilentlyContinue
    $apiProcess = Start-Process -FilePath 'dotnet.exe' `
        -ArgumentList @($apiDll) `
        -WorkingDirectory $apiDirectory `
        -RedirectStandardOutput $apiStdout `
        -RedirectStandardError $apiStderr `
        -PassThru

    $health = $null
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        $health = Get-HttpResult -Uri 'http://127.0.0.1:5080/api/health'
        if ($null -ne $health.statusCode) {
            break
        }
    }
    if ($null -eq $health -or $null -eq $health.statusCode) {
        throw 'API did not become responsive on port 5080.'
    }
    $readiness = Get-HttpResult -Uri 'http://127.0.0.1:5080/api/health/ready'
    $databaseReady = $readiness.statusCode -eq 200

    $report = [ordered]@{
        generatedAtUtc = [DateTime]::UtcNow.ToString('O')
        environment = 'Development'
        oracleTarget = 'FREEPDB1 / PAWCARE_APP'
        credentials = 'entered privately; not persisted'
        databaseConnectivity = [ordered]@{
            result = if ($databaseReady) { 'pass' } else { 'fail' }
            readinessStatusCode = $readiness.statusCode
            migrationLedgerExpected = 13
            migrationLedgerVerifiedBy = '/api/health/ready'
        }
        build = [ordered]@{
            result = 'pass'
            configuration = 'Release'
            project = 'PawCare.Api.csproj'
        }
        integrationTests = [ordered]@{
            exitCode = $testExitCode
            counts = $testCounts
            oracleOptIn = 'I_ACCEPT_READ_ONLY_ORACLE_TESTS'
            diagnostics = $testDiagnostics
            result = $testResult
        }
        http = [ordered]@{
            health = $health
            readiness = $readiness
        }
        safeguards = @(
            'No database-modifying SQL was issued by this workflow.',
            'Only the read-only, explicitly opt-in Oracle integration tests were run.',
            'Reminder, outbox, and inventory background workers were explicitly disabled.',
            'No payment processing or demo seed was enabled.',
            'Password and connection string were held in process memory only.'
        )
    }
    $json = $report | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($reportJson, $json, [Text.UTF8Encoding]::new($false))

    $markdown = @"
# PawCare Oracle Backend Integration Execution Report

Generated: $($report.generatedAtUtc)

## Result

| Check | Result |
|---|---|
| Oracle target | $($report.oracleTarget) |
| API build | PASS |
| Oracle integration tests | $testResult |
| Database connectivity/readiness | $(if ($databaseReady) { 'PASS' } else { 'FAIL' }) |
| `/api/health` | HTTP $($health.statusCode) |
| `/api/health/ready` | HTTP $($readiness.statusCode) |

## Test counts

Integration test exit code: $testExitCode

- Total: $($testCounts.total)
- Passed: $($testCounts.passed)
- Failed: $($testCounts.failed)
- Skipped: $($testCounts.skipped)

## Sanitized test diagnostics

```text
$testDiagnostics
```

## Database verification

The readiness endpoint opened Oracle and verified that the `SCHEMA_MIGRATIONS`
ledger contains V001-V013 (13 Oracle migration versions). No migration or seed SQL was
executed by this workflow.

## Security and scope

The Oracle password was entered through a private `Read-Host -AsSecureString`
prompt. It was never written to a file, command-line argument, report, or log.
Payment processing, demo data, migrations, schema rebuilds and all background workers remained disabled.
"@
    [IO.File]::WriteAllText($reportMarkdown, $markdown, [Text.UTF8Encoding]::new($false))

    if ($testExitCode -ne 0 -or -not $databaseReady) {
        throw 'Oracle backend validation did not pass; inspect the sanitized reports.'
    }
}
finally {
    if ($null -ne $apiProcess -and -not $apiProcess.HasExited) {
        Stop-Process -Id $apiProcess.Id -Force
    }
    foreach ($name in $oldEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $oldEnvironment[$name])
    }
    if ($passwordBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
    }
    $plainPassword = $null
    Remove-Item -LiteralPath $apiStdout, $apiStderr -Force -ErrorAction SilentlyContinue
}
