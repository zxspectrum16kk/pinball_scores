# Publish-Scores.ps1
# Moves scraped JSON files from data/temp/ to data/

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$DataDir = Join-Path $ScriptDir "..\data"
$TempDir = Join-Path $DataDir "temp"

if (-not (Test-Path $TempDir)) {
    Write-Warning "Temp directory not found ($TempDir). Run scrape_scores.ps1 first."
    exit
}

$files = Get-ChildItem -Path $TempDir -Filter "*.json"

if ($files.Count -eq 0) {
    Write-Warning "No JSON files found in $TempDir."
    exit
}

Write-Host "Found $($files.Count) files to publish."
$files | Out-GridView -Title "Select Files to Publish (Cancel to abort)" -PassThru | ForEach-Object {
    $dest = Join-Path $DataDir $_.Name
    Move-Item -Path $_.FullName -Destination $dest -Force
    Write-Host "Published: $($_.Name)"
}

Write-Host "Done."
