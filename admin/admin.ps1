# Admin.ps1
# Pinball Scores Backend App
# Manages players, scrapes data, inspects results, and publishes updates.

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$DataDir = Join-Path $ScriptDir "..\data"
$TempDir = Join-Path $DataDir "temp"
$PlayerFile = Join-Path $DataDir "playerid.txt"

# Ensure directories exist
if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir | Out-Null }
if (-not (Test-Path $PlayerFile)) { New-Item -ItemType File -Path $PlayerFile | Out-Null }

# --- Helper Functions ---

function Convert-Numeric {
    param ($Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return 0 }
    $clean = $Value -replace ",", "" -replace "%", ""
    if ($clean -match "^[\d\.]+$") { return [double]$clean }
    return $Value
}

function Get-Players {
    $players = @()
    if (Test-Path $PlayerFile) {
        $lines = Get-Content $PlayerFile
        foreach ($line in $lines) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            if ($line -match '^(.*?)\s+(\d+)$') {
                $players += [PSCustomObject]@{
                    Name = $matches[1].Trim()
                    ID   = $matches[2]
                }
            }
        }
    }
    return $players
}

function Save-Players {
    param ($PlayersList)
    $content = $PlayersList | ForEach-Object { "$($_.Name) $($_.ID)" }
    $content | Set-Content -Path $PlayerFile
}

function Invoke-WebScrape {
    param ([string]$Url, [string]$Type, [string]$Name)
    
    Write-Host "Fetching $Name..." -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
        Write-Host " OK" -ForegroundColor Green
    }
    catch {
        Write-Host " Failed: $_" -ForegroundColor Red
        return
    }

    $html = $response.Content
    $rows = [regex]::Matches($html, '(?s)<tr.*?>(.*?)</tr>')
    $data = @()
    $headers = @()

    foreach ($rowMatch in $rows) {
        $rowContent = $rowMatch.Groups[1].Value
        $headerMatches = [regex]::Matches($rowContent, '(?s)<th.*?>(.*?)</th>')
        if ($headerMatches.Count -gt 0) {
            $headers = $headerMatches | ForEach-Object { $_.Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', '' }
            continue
        }

        $colMatches = [regex]::Matches($rowContent, '(?s)<td.*?>(.*?)</td>')
        if ($colMatches.Count -gt 0) {
            $rowObj = [ordered]@{}
            for ($i = 0; $i -lt $colMatches.Count; $i++) {
                if ($i -ge $headers.Count) { break }
                $header = $headers[$i]
                $valClean = $colMatches[$i].Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', ''
                
                if ($Type -eq 'Player') {
                    if ($header -match 'Plays|Best|% Top') { $rowObj[$header] = Convert-Numeric $valClean }
                    else { $rowObj[$header] = $valClean }
                }
                elseif ($Type -eq 'MachineStats') {
                    if ($header -match 'Appearances|Plays|Average Score|High Score') { $rowObj[$header] = Convert-Numeric $valClean }
                    elseif ($header -eq '') { $rowObj[$header] = Convert-Numeric $valClean }
                    else { $rowObj[$header] = $valClean }
                }
            }
            if ($rowObj.Count -gt 0) { $data += $rowObj }
        }
    }

    $outFile = if ($Type -eq 'Player') { Join-Path $TempDir "${Name}_static.json" } else { Join-Path $TempDir "MachineStats_static.json" }
    $data | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding UTF8
}

# --- Menu Functions ---

function Show-ManagePlayers {
    while ($true) {
        Clear-Host
        Write-Host "=== Manage Players ===" -ForegroundColor Cyan
        $current = Get-Players
        if ($current.Count -gt 0) {
            $current | Format-Table -AutoSize
        }
        else {
            Write-Host "No players found." -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "1. Add Player"
        Write-Host "2. Remove Player"
        Write-Host "B. Back"
        
        $choice = Read-Host "Select option"
        switch ($choice) {
            "1" {
                $name = Read-Host "Enter Player Name (e.g. Craig)"
                $id = Read-Host "Enter Player ID (e.g. 1334)"
                if ($name -and $id) {
                    $current += [PSCustomObject]@{ Name = $name; ID = $id }
                    Save-Players $current
                }
            }
            "2" {
                $toRemove = $current | Out-GridView -Title "Select Player to Remove" -PassThru
                if ($toRemove) {
                    $current = $current | Where-Object { $_.ID -ne $toRemove.ID }
                    Save-Players $current
                }
            }
            "B" { return }
            "b" { return }
        }
    }
}

function Show-ImportData {
    Clear-Host
    Write-Host "=== Import Data (Scrape) ===" -ForegroundColor Cyan
    
    $players = Get-Players
    $machineStats = [PSCustomObject]@{ Name = "Game and score information"; ID = "ALL"; URL = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc" }
    
    $selected = $players + $machineStats | Out-GridView -Title "Select Items to Import" -PassThru
    
    if ($selected) {
        Write-Host "Scraping to $TempDir..." -ForegroundColor Yellow
        foreach ($item in $selected) {
            if ($item.Name -eq "Game and score information") {
                Invoke-WebScrape -Url $item.URL -Type "MachineStats" -Name "MachineStats"
            }
            else {
                $url = "https://pinballleague.uk/player-info.php?playerid=$($item.ID)"
                Invoke-WebScrape -Url $url -Type "Player" -Name $item.Name
            }
        }
        Write-Host "Import complete. Check 'Inspect Updates' to view files." -ForegroundColor Green
        Pause
    }
}

function Show-InspectUpdates {
    Clear-Host
    Write-Host "=== Inspect Updates (Temp Files) ===" -ForegroundColor Cyan
    $files = Get-ChildItem -Path $TempDir -Filter "*.json"
    
    if ($files.Count -eq 0) {
        Write-Host "No temp files found. Run 'Import Data' first." -ForegroundColor Yellow
        Pause
        return
    }
    
    $selectedFile = $files | Out-GridView -Title "Select File to Inspect" -PassThru
    if ($selectedFile) {
        try {
            $json = Get-Content $selectedFile.FullName -Raw | ConvertFrom-Json
            
            # Fix for empty property names (e.g. Rank column in MachineStats) which break Out-GridView
            $cleanJson = $json | ForEach-Object {
                $obj = $_
                $hasEmpty = $false
                foreach ($p in $obj.PSObject.Properties) {
                    if ($p.Name -eq "") { $hasEmpty = $true; break }
                }

                if ($hasEmpty) {
                    # Create a new ordered dictionary to reconstruct the object with valid names
                    $newProps = [ordered]@{}
                    foreach ($prop in $obj.PSObject.Properties) {
                        if ($prop.Name -eq "") {
                            $newProps["Rank"] = $prop.Value
                        }
                        else {
                            $newProps[$prop.Name] = $prop.Value
                        }
                    }
                    [PSCustomObject]$newProps
                }
                else {
                    $obj
                }
            }
            
            $cleanJson | Out-GridView -Title "Inspecting $($selectedFile.Name)"
        }
        catch {
            Write-Error "Failed to parse JSON: $_"
            Pause
        }
    }
}

function Show-PublishUpdates {
    Clear-Host
    Write-Host "=== Publish Updates ===" -ForegroundColor Cyan
    $files = Get-ChildItem -Path $TempDir -Filter "*.json"
    
    if ($files.Count -eq 0) {
        Write-Host "No temp files found to publish." -ForegroundColor Yellow
        Pause
        return
    }
    
    $toPublish = $files | Out-GridView -Title "Select Files to Publish (Overwrite Live Data)" -PassThru
    if ($toPublish) {
        foreach ($file in $toPublish) {
            $dest = Join-Path $DataDir $file.Name
            Move-Item -Path $file.FullName -Destination $dest -Force
            Write-Host "Published: $($file.Name)" -ForegroundColor Green
        }
        Write-Host "Publishing complete." -ForegroundColor Green
        Pause
    }
}

# --- Main Loop ---

while ($true) {
    Clear-Host
    Write-Host "==================================" -ForegroundColor Magenta
    Write-Host "   PINBALL SCORES ADMIN APP      " -ForegroundColor Magenta
    Write-Host "==================================" -ForegroundColor Magenta
    Write-Host "1. Manage Players"
    Write-Host "2. Import Data (Scrape)"
    Write-Host "3. Inspect Updates"
    Write-Host "4. Publish Updates"
    Write-Host "Q. Quit"
    Write-Host "----------------------------------"
    
    $choice = Read-Host "Select option"
    
    switch ($choice) {
        "1" { Show-ManagePlayers }
        "2" { Show-ImportData }
        "3" { Show-InspectUpdates }
        "4" { Show-PublishUpdates }
        "Q" { exit }
        "q" { exit }
    }
}
