# Scrape-Scores.ps1
# Scrapes pinball scores from pinballleague.uk and saves as JSON

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$DataDir = Join-Path $ScriptDir "..\data"

# Ensure data directory exists
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

function Convert-Numeric {
    param ($Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return 0 }
    # Remove commas and percentage signs
    $clean = $Value -replace ",", "" -replace "%", ""
    if ($clean -match "^[\d\.]+$") {
        return [double]$clean
    }
    return $Value
}

function Scrape-Url {
    param (
        [string]$Url,
        [string]$Type,
        [string]$Name
    )

    Write-Host "Fetching $Name ($Url)..."
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
    }
    catch {
        Write-Warning "Failed to fetch $Url : $_"
        return
    }

    $html = $response.Content
    
    # Simple table parser using regex for robustness
    $rows = [regex]::Matches($html, '(?s)<tr.*?>(.*?)</tr>')
    
    $data = @()
    $headers = @()

    foreach ($rowMatch in $rows) {
        $rowContent = $rowMatch.Groups[1].Value
        
        # Check for headers <th>
        $headerMatches = [regex]::Matches($rowContent, '(?s)<th.*?>(.*?)</th>')
        if ($headerMatches.Count -gt 0) {
            $headers = $headerMatches | ForEach-Object { 
                $_.Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', '' 
            }
            continue
        }

        # Check for data <td>
        $colMatches = [regex]::Matches($rowContent, '(?s)<td.*?>(.*?)</td>')
        if ($colMatches.Count -gt 0) {
            $rowObj = [ordered]@{}
            for ($i = 0; $i -lt $colMatches.Count; $i++) {
                if ($i -ge $headers.Count) { break }
                
                $header = $headers[$i]
                $valRaw = $colMatches[$i].Groups[1].Value
                
                # Clean value: remove tags, decode entities
                $valClean = $valRaw -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', ''
                
                if ($Type -eq 'Player') {
                    if ($header -match 'Plays|Best|% Top') {
                        $rowObj[$header] = Convert-Numeric $valClean
                    }
                    else {
                        $rowObj[$header] = $valClean
                    }
                }
                elseif ($Type -eq 'MachineStats') {
                    if ($header -match 'Appearances|Plays|Average Score|High Score') {
                        $rowObj[$header] = Convert-Numeric $valClean
                    }
                    elseif ($header -eq '') {
                        $rowObj[$header] = Convert-Numeric $valClean
                    }
                    else {
                        $rowObj[$header] = $valClean
                    }
                }
            }
            if ($rowObj.Count -gt 0) {
                $data += $rowObj
            }
        }
    }

    # Save to JSON
    if ($Type -eq 'Player') {
        $outFile = Join-Path $TempDir "${Name}_static.json"
    }
    else {
        $outFile = Join-Path $TempDir "MachineStats_static.json"
    }
    
    $data | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding UTF8
    Write-Host "Saved to $outFile"
}

# Read playerid.txt
$playerFile = Join-Path $DataDir "playerid.txt"
$players = @()

# Ensure temp directory exists
$TempDir = Join-Path $DataDir "temp"
if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir | Out-Null
}
Write-Host "Scraping to temporary folder: $TempDir"

if (Test-Path $playerFile) {
    $lines = Get-Content $playerFile
    foreach ($line in $lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        
        # Parse line: Name ID
        if ($line -match '^(.*?)\s+(\d+)$') {
            $name = $matches[1].Trim()
            $id = $matches[2]
            $players += [PSCustomObject]@{
                Name = $name
                ID   = $id
                URL  = "https://pinballleague.uk/player-info.php?playerid=$id"
            }
        }
    }
}
else {
    Write-Error "playerid.txt not found at $playerFile"
    exit
}

# Add Machine Stats option
$machineStats = [PSCustomObject]@{
    Name = "Game and score information"
    ID   = "ALL"
    URL  = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc"
}

# Show selection dialog
$selected = $players + $machineStats | Out-GridView -Title "Select Players/Stats to Update" -PassThru

if ($selected) {
    foreach ($item in $selected) {
        if ($item.Name -eq "Game and score information") {
            Scrape-Url -Url $item.URL -Type "MachineStats" -Name "MachineStats"
        }
        else {
            Scrape-Url -Url $item.URL -Type "Player" -Name $item.Name
        }
    }
}
else {
    Write-Warning "No items selected."
}
