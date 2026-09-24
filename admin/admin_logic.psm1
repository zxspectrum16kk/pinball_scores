
# Admin Logic Module
# Contains backend logic for managing players, scraping, and publishing.

$ScriptDir = $PSScriptRoot
$DataDir = Join-Path $ScriptDir "..\data"
$TempDir = Join-Path $DataDir "temp"
$BackupDir = Join-Path $DataDir "backup"
$PlayerFile = Join-Path $DataDir "playerid.txt"

# Ensure directories exist
if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir | Out-Null }
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
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

# Fetches per-event scores for one player+machine combination.
# Returns array of { event, year, league, meet, score, rank }
function Invoke-ScrapeEvents {
    param (
        [string]$PlayerId,
        [string]$MachineId,
        [string]$PlayerFullName
    )

    $ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    $url = "https://pinballleague.uk/scores.php?playerid=$PlayerId&machineid=$MachineId"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent $ua -TimeoutSec 20
        $html = $response.Content

        $events = @()
        $rows = [regex]::Matches($html, '(?s)<tr[^>]*>(.*?)</tr>')

        # Scores page uses <td> for all rows (no <th> header row).
        # Fixed column order: 0=Rank, 1=Player, 2=Score, 3=Event
        foreach ($row in $rows) {
            $rowContent = $row.Groups[1].Value
            $tdMatches = [regex]::Matches($rowContent, '(?s)<td[^>]*>(.*?)</td>')
            if ($tdMatches.Count -lt 4) { continue }

            $rank      = ($tdMatches[0].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
            $player    = ($tdMatches[1].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
            $scoreRaw  = ($tdMatches[2].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
            $eventStr  = ($tdMatches[3].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()

            if ($player -ne $PlayerFullName) { continue }

            $yearMatch   = [regex]::Match($eventStr, '^(\d{4})')
            $leagueMatch = [regex]::Match($eventStr, '^\d{4}\s+(.+?)\s+-\s+Meet')
            $meetMatch   = [regex]::Match($eventStr, 'Meet\s+(\d+)')

            $events += [ordered]@{
                event  = $eventStr
                year   = if ($yearMatch.Success)  { [int]$yearMatch.Groups[1].Value }  else { 0 }
                league = if ($leagueMatch.Success) { $leagueMatch.Groups[1].Value }     else { '' }
                meet   = if ($meetMatch.Success)  { [int]$meetMatch.Groups[1].Value }  else { 0 }
                score  = Convert-Numeric $scoreRaw
                rank   = Convert-Numeric $rank
            }
        }

        # Sort by year asc, then meet asc (chronological)
        $events = $events | Sort-Object { $_.year * 100 + $_.meet }
        # Use ArrayList so ConvertTo-Json always serializes as [] even for 1 item
        $list = [System.Collections.ArrayList]::new()
        foreach ($e in $events) { $list.Add($e) | Out-Null }
        return ,$list
    }
    catch {
        # Rate-limited or transient error — wait and retry once
        Start-Sleep -Seconds 10
        try {
            $ua2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent $ua2 -TimeoutSec 20
            $html = $response.Content
            $events = @()
            $rows = [regex]::Matches($html, '(?s)<tr[^>]*>(.*?)</tr>')
            foreach ($row in $rows) {
                $rowContent = $row.Groups[1].Value
                $tdMatches = [regex]::Matches($rowContent, '(?s)<td[^>]*>(.*?)</td>')
                if ($tdMatches.Count -lt 4) { continue }
                $rank     = ($tdMatches[0].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
                $player   = ($tdMatches[1].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
                $scoreRaw = ($tdMatches[2].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
                $eventStr = ($tdMatches[3].Groups[1].Value -replace '<[^>]+>','' -replace '&nbsp;',' ').Trim()
                if ($player -ne $PlayerFullName) { continue }
                $yearMatch   = [regex]::Match($eventStr, '^(\d{4})')
                $leagueMatch = [regex]::Match($eventStr, '^\d{4}\s+(.+?)\s+-\s+Meet')
                $meetMatch   = [regex]::Match($eventStr, 'Meet\s+(\d+)')
                $events += [ordered]@{
                    event  = $eventStr
                    year   = if ($yearMatch.Success)  { [int]$yearMatch.Groups[1].Value }  else { 0 }
                    league = if ($leagueMatch.Success) { $leagueMatch.Groups[1].Value }     else { '' }
                    meet   = if ($meetMatch.Success)  { [int]$meetMatch.Groups[1].Value }  else { 0 }
                    score  = Convert-Numeric $scoreRaw
                    rank   = Convert-Numeric $rank
                }
            }
            $events = $events | Sort-Object { $_.year * 100 + $_.meet }
            $list = [System.Collections.ArrayList]::new()
            foreach ($e in $events) { $list.Add($e) | Out-Null }
            return ,$list
        }
        catch {
            return ,([System.Collections.ArrayList]::new())
        }
    }
}

function Invoke-ScrapeValues {
    param ($Targets)

    $players = Get-PlayerList
    $workList = @()

    # If "ALL" is in targets, include everything
    if ($Targets -contains "ALL") {
        $workList += @{ Type = "MachineStats"; Name = "MachineStats"; URL = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc" }
        $workList += $players | ForEach-Object { @{ Type = "Player"; Name = $_.Name; ID = $_.ID; URL = "https://pinballleague.uk/player-info.php?playerid=$($_.ID)" } }
    }
    else {
        if ($Targets -contains "MachineStats") {
            $workList += @{ Type = "MachineStats"; Name = "MachineStats"; URL = "https://pinballleague.uk/machines.php?region=all&season=all&sort=plays&dir=desc" }
        }
        foreach ($t in $Targets) {
            if ($t -eq "MachineStats" -or $t -eq "ALL") { continue }
            $p = $players | Where-Object { $_.ID -eq $t }
            if ($p) {
                $workList += @{ Type = "Player"; Name = $p.Name; ID = $p.ID; URL = "https://pinballleague.uk/player-info.php?playerid=$($p.ID)" }
            }
        }
    }

    # --- Progress tracking ---
    $progressFilePath = Join-Path $TempDir "scrape_progress.json"
    $progressItems = [System.Collections.ArrayList]::new()
    foreach ($w in $workList) {
        $progressItems.Add([ordered]@{
            name     = $w.Name
            status   = "pending"
            machines = 0
            done     = 0
            total    = 0
        }) | Out-Null
    }
    $progress = [ordered]@{
        status    = "running"
        startedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        current   = ""
        completed = 0
        total     = $workList.Count
        items     = $progressItems
    }
    try { $progress | ConvertTo-Json -Depth 5 | Set-Content $progressFilePath -Encoding UTF8 } catch {}

    $results = @()

    foreach ($item in $workList) {
        $itemProg = $progressItems | Where-Object { $_.name -eq $item.Name } | Select-Object -First 1
        if ($itemProg) { $itemProg.status = "running" }
        $progress.current = $item.Name
        try { $progress | ConvertTo-Json -Depth 5 | Set-Content $progressFilePath -Encoding UTF8 } catch {}

        try {
            $url = $item.URL
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -TimeoutSec 20
            $html = $response.Content

            $rows = [regex]::Matches($html, '(?s)<tr[^>]*>(.*?)</tr>')
            $data = @()
            $headers = @()
            $Type = $item.Type

            foreach ($rowMatch in $rows) {
                $rowContent = $rowMatch.Groups[1].Value
                $headerMatches = [regex]::Matches($rowContent, '(?s)<th[^>]*>(.*?)</th>')
                if ($headerMatches.Count -gt 0) {
                    $headers = $headerMatches | ForEach-Object {
                        $_.Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', ''
                    }
                    continue
                }

                $colMatches = [regex]::Matches($rowContent, '(?s)<td[^>]*>(.*?)</td>')
                if ($colMatches.Count -gt 0) {
                    $rowObj = [ordered]@{}

                    if ($Type -eq 'Player') {
                        $machineId = $null

                        for ($i = 0; $i -lt $colMatches.Count; $i++) {
                            if ($i -ge $headers.Count) { break }
                            $header   = $headers[$i]
                            $rawCell  = $colMatches[$i].Groups[1].Value

                            # Capture machine ID from the href on the Plays cell
                            if ($header -match 'Plays' -and -not $machineId) {
                                $hrefMatch = [regex]::Match($rawCell, 'machineid=(\d+)')
                                if ($hrefMatch.Success) { $machineId = [int]$hrefMatch.Groups[1].Value }
                            }

                            $valClean = $rawCell -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', ''
                            if ($header -match 'Plays|Best|% Top') { $rowObj[$header] = Convert-Numeric $valClean }
                            else { $rowObj[$header] = $valClean }
                        }

                        if ($machineId) { $rowObj['MachineId'] = $machineId }
                    }
                    elseif ($Type -eq 'MachineStats') {
                        for ($i = 0; $i -lt $colMatches.Count; $i++) {
                            if ($i -ge $headers.Count) { break }
                            $header   = $headers[$i]
                            $valClean = $colMatches[$i].Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '^\s+|\s+$', ''
                            if ($header -match 'Appearances|Plays|Average Score|High Score') { $rowObj[$header] = Convert-Numeric $valClean }
                            elseif ($header -eq '') { $rowObj[$header] = Convert-Numeric $valClean }
                            else { $rowObj[$header] = $valClean }
                        }
                    }

                    if ($rowObj.Count -gt 0) { $data += $rowObj }
                }
            }

            # For players: fetch per-event scores for each machine
            if ($Type -eq 'Player' -and $data.Count -gt 0) {
                # Extract full name from <h1>Craig Cole</h1>
                $playerFullName = ''
                $h1Match = [regex]::Match($html, '(?s)<h1[^>]*>\s*([^<]+?)\s*</h1>')
                if ($h1Match.Success) { $playerFullName = $h1Match.Groups[1].Value.Trim() }

                $playerId = $item.ID
                if ($itemProg) { $itemProg.total = $data.Count }

                $machineIdx = 0
                foreach ($machine in $data) {
                    if ($machine['MachineId']) {
                        $machine['Events'] = Invoke-ScrapeEvents -PlayerId $playerId -MachineId $machine['MachineId'] -PlayerFullName $playerFullName
                        # Pause between requests to avoid Cloudflare rate limiting
                        $jitter = Get-Random -Minimum 1800 -Maximum 2500
                        Start-Sleep -Milliseconds $jitter
                    }
                    else {
                        $machine['Events'] = @()
                    }
                    $machineIdx++
                    if ($itemProg) { $itemProg.done = $machineIdx }
                    # Write progress every 5 machines (or on the last one)
                    if ($machineIdx % 5 -eq 0 -or $machineIdx -eq $data.Count) {
                        try { $progress | ConvertTo-Json -Depth 5 | Set-Content $progressFilePath -Encoding UTF8 } catch {}
                    }
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
                if ($itemProg) { $itemProg.status = "done"; $itemProg.machines = $data.Count }
            }
            else {
                $results += @{ Name = $item.Name; Status = "Failed"; Error = "No data found (Blocked or Empty)" }
                if ($itemProg) { $itemProg.status = "failed" }
            }
        }
        catch {
            $results += @{ Name = $item.Name; Status = "Failed"; Error = "$_" }
            if ($itemProg) { $itemProg.status = "failed" }
        }
        finally {
            $progress.completed++
            try { $progress | ConvertTo-Json -Depth 5 | Set-Content $progressFilePath -Encoding UTF8 } catch {}
        }
    }

    $progress.status = "complete"
    $progress.current = ""
    try { $progress | ConvertTo-Json -Depth 5 | Set-Content $progressFilePath -Encoding UTF8 } catch {}

    return @($results)
}

function Get-StagedDiff {
    $players = Get-PlayerList
    $diff = @()

    foreach ($p in $players) {
        $tempFile = Join-Path $TempDir "$($p.Name)_static.json"
        $liveFile = Join-Path $DataDir "$($p.Name)_static.json"

        if (-not (Test-Path $tempFile)) { continue }

        $tempData = @(Get-Content $tempFile -Raw | ConvertFrom-Json)
        $liveData = if (Test-Path $liveFile) { @(Get-Content $liveFile -Raw | ConvertFrom-Json) } else { @() }

        # Find the machine name field (header containing "Machine")
        $machineKey = $null
        if ($tempData.Count -gt 0) {
            $machineKey = ($tempData[0].PSObject.Properties | Where-Object { $_.Name -match 'Machine' } | Select-Object -First 1).Name
        }

        $tempMachineNames = if ($machineKey) { @($tempData | ForEach-Object { $_.($machineKey) }) } else { @() }
        $liveMachineNames = if ($machineKey -and $liveData.Count -gt 0) { @($liveData | ForEach-Object { $_.($machineKey) }) } else { @() }

        $newMachineList = @($tempMachineNames | Where-Object { $_ -notin $liveMachineNames })

        $improvedList = @()
        foreach ($tm in $tempData) {
            $machineName = if ($machineKey) { $tm.($machineKey) } else { $null }
            if (-not $machineName) { continue }
            $lm = $liveData | Where-Object { $machineKey -and $_.($machineKey) -eq $machineName } | Select-Object -First 1
            if ($lm) {
                $tempBest = [double]($tm.'Best Score')
                $liveBest = [double]($lm.'Best Score')
                if ($tempBest -gt $liveBest -and $liveBest -gt 0) {
                    $improvedList += [ordered]@{
                        machine  = $machineName
                        oldScore = $liveBest
                        newScore = $tempBest
                    }
                }
            }
        }

        $tempWithEvents = ($tempData | Where-Object {
            $evts = $_.Events
            $evts -and (($evts -is [System.Array] -and $evts.Count -gt 0) -or ($evts -isnot [System.Array]))
        } | Measure-Object).Count

        $liveWithEvents = ($liveData | Where-Object {
            $evts = $_.Events
            $evts -and (($evts -is [System.Array] -and $evts.Count -gt 0) -or ($evts -isnot [System.Array]))
        } | Measure-Object).Count

        $diff += [ordered]@{
            player         = $p.Name
            totalMachines  = $tempData.Count
            newMachines    = $newMachineList.Count
            newMachineList = $newMachineList
            improvedScores = $improvedList.Count
            improvedList   = $improvedList
            eventCoverage  = $tempWithEvents
            coverageChange = $tempWithEvents - $liveWithEvents
        }
    }

    # MachineStats diff
    $tempStats = Join-Path $TempDir "MachineStats_static.json"
    $liveStats = Join-Path $DataDir "MachineStats_static.json"
    if (Test-Path $tempStats) {
        $tempStatsData = @(Get-Content $tempStats -Raw | ConvertFrom-Json)
        $liveCount = if (Test-Path $liveStats) { @(Get-Content $liveStats -Raw | ConvertFrom-Json).Count } else { 0 }
        $diff += [ordered]@{
            player         = "MachineStats"
            totalMachines  = $tempStatsData.Count
            newMachines    = $tempStatsData.Count - $liveCount
            newMachineList = @()
            improvedScores = 0
            improvedList   = @()
            eventCoverage  = $tempStatsData.Count
            coverageChange = 0
        }
    }

    return $diff
}

function Get-StagedFiles {
    return Get-ChildItem -Path $TempDir -Filter "*.json" | Select-Object Name, @{Name="LastWriteTime"; Expression={$_.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")}}, Length
}

function Publish-StagedFiles {
    $files = Get-ChildItem -Path $TempDir -Filter "*.json"
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $count = 0
    $backupCount = 0

    foreach ($file in $files) {
        try {
            $dest = Join-Path $DataDir $file.Name
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

            # Backup existing live file before overwriting
            if (Test-Path $dest) {
                $backupPath = Join-Path $BackupDir "${baseName}_${timestamp}.json"
                Copy-Item -Path $dest -Destination $backupPath -Force
                $backupCount++
                # Keep only the 3 most recent backups per file
                Get-ChildItem -Path $BackupDir -Filter "${baseName}_*.json" |
                    Sort-Object LastWriteTime -Descending |
                    Select-Object -Skip 3 |
                    Remove-Item -Force
            }

            Copy-Item -Path $file.FullName -Destination $dest -Force
            Remove-Item -Path $file.FullName -Force
            $count++
        }
        catch {
            Write-Host "Error publishing file $($file.Name): $_"
        }
    }

    Update-PlayersJson
    return @{ success = $true; count = $count; backupCount = $backupCount; message = "Published $count files ($backupCount backed up to data/backup/)." }
}

Export-ModuleMember -Function Get-PlayerList, Add-Player, Remove-Player, Invoke-ScrapeValues, Get-StagedFiles, Get-StagedDiff, Publish-StagedFiles, Update-PlayersJson
