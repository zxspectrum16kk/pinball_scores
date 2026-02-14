// Player Performance Heat Map Page
import { ALL_PLAYERS, getSelectedPlayers } from './data.js';
import { fmtNumber, makeTableSortable } from './utils.js';

// Helper function to convert player name to key
function playerKeyFromName(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

export function renderPlayerHeatmapPage(machines, stats) {
  const container = document.getElementById('heatmap-container');
  const select = document.getElementById('player-select-heatmap');
  const unplayedCheck = document.getElementById('show-unplayed');

  if (!container || !select) return;

  // Fallback: If ALL_PLAYERS is empty, use keys from stats
  let allPlayers = ALL_PLAYERS;
  if (!allPlayers || allPlayers.length === 0) {
    if (stats) {
      allPlayers = Object.keys(stats).sort();
    }
  }

  // Filter by Selected Players from Settings
  const selectedPlayers = getSelectedPlayers();
  let playersList = allPlayers;

  if (selectedPlayers && selectedPlayers.length > 0) {
    playersList = allPlayers.filter(p => selectedPlayers.includes(p));
  }

  if (!playersList || playersList.length === 0) {
    // If no players selected (or match), fallback to all or show message?
    // User requested "use the players that have been chosen", so we respect that.
    // But if that list is empty, it might be confusing. 
    // Let's fallback to ALL if the filtered list is empty (edge case), 
    // OR just show "No players selected in Settings". 
    // Given the user request, showing what is in settings is most accurate.
    // If settings has players, but they aren't in ALL_PLAYERS (weird), we might have issues.

    // Strict adherence:
    if (selectedPlayers && selectedPlayers.length > 0) {
      container.innerHTML = '<p>No matching data for the selected players.</p>';
      return;
    }

    // If settings is empty, maybe fallback to all? 
    // "use the players that have been chosen" -> implies if none chosen, none shown?
    // The app defaults to "Select All" usually.
    // Let's fallback to allPlayers if selectedPlayers is strictly empty/null
    playersList = allPlayers;
  }

  if (!playersList || playersList.length === 0) {
    container.innerHTML = '<p>No players data available.</p>';
    return;
  }

  // Populate player dropdown if empty or default
  if (select.options.length > 0 && select.options[0].value === "") {
    select.innerHTML = '';
    // playersList.forEach(playerName => { ... });
    // Optimized:
    select.innerHTML = playersList.map(p => `<option value="${p}">${p}</option>`).join('');

    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const playerParam = urlParams.get('player');

    if (playerParam && playersList.includes(playerParam)) {
      select.value = playerParam;
    } else {
      select.value = playersList[0];
    }

    // Update URL to match current selection
    if (select.value && select.value !== playerParam) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('player', select.value);
      window.history.replaceState({}, '', newUrl);
    }
  }

  // Event Listeners
  select.addEventListener('change', (e) => {
    const newVal = e.target.value;
    if (newVal) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('player', newVal);
      window.history.pushState({}, '', newUrl);
      updateView();
    }
  });

  if (unplayedCheck) {
    unplayedCheck.addEventListener('change', updateView);
  }

  // Initial Render
  updateView();

  function updateView() {
    const playerName = select.value;
    if (!playerName) return;
    renderHeatmap(playerName);
  }

  function renderHeatmap(playerName) {
    const key = playerKeyFromName(playerName);
    const playerStats = stats[playerName];

    if (!playerStats) {
      container.innerHTML = `<p>No stats found for ${playerName}.</p>`;
      return;
    }

    // Process ALL machines
    let processedMachines = machines.map(m => {
      const playerData = m[key] || {};
      const best = playerData.best || 0;
      const plays = playerData.plays || 0;
      const highScore = m.highScore || 0;
      const avgScore = m.avgScore || 0;

      // Calculate performance percentage
      let performancePercent = 0;
      if (highScore > 0 && best > 0) {
        performancePercent = (best / highScore) * 100;
      }

      return {
        machine: m.machine,
        best,
        plays,
        highScore,
        avgScore,
        performancePercent,
        isLifetimeHigh: highScore > 0 && best === highScore,
        played: plays > 0
      };
    });

    // Filter
    const showUnplayed = unplayedCheck ? unplayedCheck.checked : false;
    if (!showUnplayed) {
      processedMachines = processedMachines.filter(m => m.played);
    }

    // Sort (Default to Performance)
    processedMachines.sort((a, b) => {
      // perfDesc (Default)
      // Secondary sort by plays, then best
      if (b.performancePercent !== a.performancePercent) {
        return b.performancePercent - a.performancePercent;
      }
      return b.best - a.best;
    });

    if (processedMachines.length === 0) {
      container.innerHTML = `<p>${playerName} has no machines matching the criteria.</p>`;
      return;
    }

    // Build heat map HTML
    let html = `
      <h2>${playerName}'s Performance</h2>
      
      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Avg Performance</strong>
            <span>${playerStats.avgPer || '0%'}</span>
          </div>
          <div class="summary-item">
            <strong>Group Wins</strong>
            <span>${playerStats.wins || 0}</span>
          </div>
          <div class="summary-item">
            <strong>Machines Played</strong>
            <span>${playerStats.machinesPlayed}</span>
          </div>
          <div class="summary-item">
            <strong>Lifetime Highs</strong>
            <span>${playerStats.lifetimeHighs}</span>
          </div>
          <div class="summary-item">
            <strong>Above Average</strong>
            <span>${playerStats.aboveAvg}</span>
          </div>
        </div>
      </div>

      <div class="heatmap-legend">
        <strong>Performance Scale:</strong>
        <span class="legend-item"><span class="legend-box perf-excellent"></span> Excellent (80%+)</span>
        <span class="legend-item"><span class="legend-box perf-good"></span> Good (60-79%)</span>
        <span class="legend-item"><span class="legend-box perf-average"></span> Average (40-59%)</span>
        <span class="legend-item"><span class="legend-box perf-poor"></span> Needs Work (&lt;40%)</span>
      </div>

      <div class="table-wrapper">
        <table id="heatmap-table" class="heatmap-table">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Player's Best Score</th>
              <th>Plays</th>
              <th>Performance vs High</th>
              <th>High Score</th>
              <th>Avg Score</th>
            </tr>
          </thead>
          <tbody>
    `;

    processedMachines.forEach(m => {
      const perfClass = getPerformanceClass(m.performancePercent);
      const trophy = m.isLifetimeHigh ? ' 🏆' : '';
      const perfBar = Math.min(100, m.performancePercent);

      // Check if player beat average
      const beatAverage = m.best > m.avgScore;
      const avgScoreDisplay = m.avgScore > 0 ? fmtNumber(m.avgScore) : '—';
      const avgScoreClass = (beatAverage && m.played) ? 'text-success' : '';
      const avgScoreTick = (beatAverage && m.played) ? ' ✓' : '';

      const bestDisplay = m.played ? fmtNumber(m.best) : '-';
      const playsDisplay = m.played ? m.plays : '-';
      const pctDisplay = m.played ? m.performancePercent.toFixed(1) + '%' : '-';
      const barStyle = m.played ? `width: ${perfBar}%` : 'width: 0%';
      const barClass = m.played ? perfClass : '';

      html += `
        <tr>
          <td><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></td>
          <td>${bestDisplay}${trophy}</td>
          <td>${playsDisplay}</td>
          <td class="perf-cell">
            <div class="perf-bar-container">
              <div class="perf-bar ${barClass}" style="${barStyle}"></div>
              <span class="perf-text">${pctDisplay}</span>
            </div>
          </td>
          <td>${m.highScore > 0 ? fmtNumber(m.highScore) : '—'}</td>
          <td class="${avgScoreClass}">${avgScoreDisplay}${avgScoreTick}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    // Enable table sorting
    // Columns: 0=Machine, 1=Best Score, 2=Plays, 3=Performance %, 4=High Score, 5=Avg Score
    // Numeric columns: 1, 2, 3, 4, 5 (all except Machine name)
    makeTableSortable('heatmap-table', [1, 2, 3, 4, 5], { index: 3, direction: 'desc' });
  }

  function getPerformanceClass(percent) {
    if (percent >= 80) return 'perf-excellent';
    if (percent >= 60) return 'perf-good';
    if (percent >= 40) return 'perf-average';
    return 'perf-poor';
  }
}
