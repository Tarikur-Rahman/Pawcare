# Exports the CURRENT PawCare source tree for collaborative editing.
# Does not change the project or connect to Oracle. Run from the PawCare root.
[CmdletBinding()]
param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$OutputZip = ''
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath (Join-Path $root 'backend') -PathType Container)) {
    throw "Expected the PawCare project root (with a backend folder): $root"
}

if ([string]::IsNullOrWhiteSpace($OutputZip)) {
    $parent = Split-Path -Parent $root
    $OutputZip = Join-Path $parent ('PawCare_Source_{0}.zip' -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
}
$output = [System.IO.Path]::GetFullPath($OutputZip)
if ($output.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Put the ZIP outside the project folder to avoid packaging itself.'
}
if (Test-Path -LiteralPath $output) { throw "Refusing to overwrite: $output" }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$excludeDirs = @('.git', '.next', 'node_modules', 'bin', 'obj', '.vs', '.idea', '.expo', '.turbo', 'dist', 'build', 'coverage', '.cache', '.gradle', 'TestResults', 'OracleBackups', 'results')
$excludeFiles = @('.env', '.env.*', 'appsettings.json', 'appsettings.*.json', '.npmrc', '.pypirc', 'google-services.json', 'GoogleService-Info.plist', 'id_rsa', 'id_ed25519', '*.key', '*.pem', '*.pfx', '*.p12', '*.jks', '*.keystore', '*.mobileprovision', '*.bkp', '*.bak', '*.dmp', '*.db', '*.sqlite', '*.sqlite3', '*.zip', '*.log')

$zip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
$added = 0
$skipped = 0
try {
    $dirs = New-Object 'System.Collections.Generic.Stack[string]'
    $dirs.Push($root)
    while ($dirs.Count -gt 0) {
        $dir = $dirs.Pop()
        foreach ($child in [System.IO.Directory]::EnumerateDirectories($dir)) {
            $info = New-Object System.IO.DirectoryInfo($child)
            if ($excludeDirs -contains $info.Name -or ($info.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                $skipped++
                continue
            }
            $dirs.Push($child)
        }
        foreach ($path in [System.IO.Directory]::EnumerateFiles($dir)) {
            $info = New-Object System.IO.FileInfo($path)
            if ($info.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { $skipped++; continue }
            $exclude = $false
            foreach ($pattern in $excludeFiles) {
                if ($info.Name -like $pattern) { $exclude = $true; break }
            }
            if ($exclude) { $skipped++; continue }
            $relative = $path.Substring($root.Length).TrimStart('\','/').Replace('\', '/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $path, $relative, [System.IO.Compression.CompressionLevel]::Optimal)
            $added++
        }
    }
} finally {
    $zip.Dispose()
}

Write-Host "Created: $output"
Write-Host "Source files added: $added; excluded files/directories: $skipped"
Write-Warning 'Before uploading, check that no credentials, passwords, or private personal data are embedded in source code or other included files.'
