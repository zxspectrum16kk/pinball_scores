
# Admin Logic Module
# Contains backend logic for managing players, scraping, and publishing.

$ScriptDir = $PSScriptRoot
$DataDir = Join-Path $ScriptDir "..\data"
$TempDir = Join-Path $DataDir "temp"
$PlayerFile = Join-Path $DataDir "playerid.txt"

# Ensure directories exist
if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir | Out-Null }
if (-not (Test-Path $PlayerFile)) { New-Item -ItemType File -Path $PlayerFile | Out-Null }

function Convert-Numeric {
    param ($Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return 0 }
    $clean = $Value -replace ",", "" -replace "%", ""
    if ($clean -match "^[\d\.]+$") { return [double]$clean }
    return $Value
}

function Get-PlayerList {
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

function Update-PlayersJson {
    $players = Get-PlayerList
    $playerConfig = @()
    foreach ($p in $players) {
        $playerConfig += [ordered]@{
            id    = $p.Name.ToLower()
            label = $p.Name
            file  = "data/$($p.Name)_static.json"
        }
    }
    $output = [ordered]@{
        lastUpdated = (Get-Date -Format "yyyy-MM-dd")
        players     = $playerConfig
    }
    $jsonPath = Join-Path $DataDir "players.json"
    $output | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8
}

function Add-Player {
    param ($Name, $ID)
    if (-not $Name -or -not $ID) { throw "Name and ID are required." }
    
    $current = Get-PlayerList
    if ($current | Where-Object { $_.ID -eq $ID }) { throw "Player ID already exists." }
    
    "$Name $ID" | Out-File -FilePath $PlayerFile -Append -Encoding UTF8
    Update-PlayersJson
    return @{ success = $true; message = "Player added." }
}

function Remove-Player {
    param ($ID)
    $current = Get-PlayerList
    $new = $current | Where-Object { $_.ID -ne $ID }
    
    $content = $new | ForEach-Object { "$($_.Name) $($_.ID)" }
    $content | Set-Content -Path $PlayerFile -Encoding UTF8
    Update-PlayersJson
    return @{ success = $true; message = "Player removed." }
}

function Invoke-ScrapeValues {
    param ($Targets) 
    
    $players = Get-PlayerList
    $workList = @()
    
    # If "ALL" is in targets, include everything
    if ($Targets -contains "ALL") {
        # Machine Stats
        $workList += @{ Type = "MachineStats"; Name = "MachineStats"; URL = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc" }
        # All Players
        $workList += $players | ForEach-Object { @{ Type = "Player"; Name = $_.Name; URL = "https://pinballleague.uk/player-info.php?playerid=$($_.ID)" } }
    }
    else {
        # Specific targets
        if ($Targets -contains "MachineStats") {
            $workList += @{ Type = "MachineStats"; Name = "MachineStats"; URL = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc" }
        }
        
        foreach ($t in $Targets) {
            if ($t -eq "MachineStats" -or $t -eq "ALL") { continue }
            
            # Assume $t is Player ID
            $p = $players | Where-Object { $_.ID -eq $t }
            if ($p) {
                $workList += @{ Type = "Player"; Name = $p.Name; URL = "https://pinballleague.uk/player-info.php?playerid=$($p.ID)" }
            }
        }
    }
    
    $results = @()
    
    foreach ($item in $workList) {
        try {
            # Write-Host "Scraping $($item.Name)..." 
            $url = $item.URL
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            $html = $response.Content
            
            $rows = [regex]::Matches($html, '(?s)<tr.*?>(.*?)</tr>')
            $data = @()
            $headers = @()
            $Type = $item.Type

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
            
            if ($item.Type -eq 'Player') {
                $outFile = Join-Path $TempDir "$($item.Name)_static.json"
            }
            else {
                $outFile = Join-Path $TempDir "MachineStats_static.json"
            }

            if ($data.Count -gt 0) {
                $data | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding UTF8
                $results += @{ Name = $item.Name; Status = "Success" }
            }
            else {
                 $results += @{ Name = $item.Name; Status = "Failed"; Error = "No data found (Blocked or Empty)" }
            }
        }
        catch {
            $results += @{ Name = $item.Name; Status = "Failed"; Error = "$_" }
        }
    }
    return @($results)
}

function Get-StagedFiles {
    return Get-ChildItem -Path $TempDir -Filter "*.json" | Select-Object Name, @{Name="LastWriteTime"; Expression={$_.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")}}, Length
}

function Publish-StagedFiles {
    $files = Get-ChildItem -Path $TempDir -Filter "*.json"
    $count = 0
    foreach ($file in $files) {
        try {
            $dest = Join-Path $DataDir $file.Name
            Copy-Item -Path $file.FullName -Destination $dest -Force
            Remove-Item -Path $file.FullName -Force
            $count++
        }
        catch {
            Write-Host "Error publishing file $($file.Name): $_"
        }
    }
    
    Update-PlayersJson
    return @{ success = $true; count = $count; message = "Published $count files." }
}

Export-ModuleMember -Function Get-PlayerList, Add-Player, Remove-Player, Invoke-ScrapeValues, Get-StagedFiles, Publish-StagedFiles, Update-PlayersJson
