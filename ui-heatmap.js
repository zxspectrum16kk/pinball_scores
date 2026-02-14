// Player Performance Heat Map Page
import { ALL_PLAYERS } from './data.js';
import { fmtNumber } from './utils.js';

// Helper function to convert player name to key
function playerKeyFromName(name) {
  return name.toLowerCase().replace(/\s+/g, '');
}

export function renderPlayerHeatmapPage(machines, stats) {
  const container = document.getElementById('heatmap-container');
  const select = document.getElementById('player-select-heatmap');

  if (!container || !select) return;

  // Fallback: If ALL_PLAYERS is empty, use keys from stats
  let playersList = ALL_PLAYERS;
  if (!playersList || playersList.length === 0) {
    if (stats) {
      playersList = Object.keys(stats).sort();
    }
  }

  if (!playersList || playersList.length === 0) {
    container.innerHTML = '<p>No players data available.</p>';
    return;
  }

  // Populate player dropdown
  // We check if we still have the default "Loading" option (value="")
  // If so, we clear it and populate.
  if (select.options.length > 0 && select.options[0].value === "") {
    select.innerHTML = '';

    // Add a default "Select Player" option or just populate
    // Since we want to auto-select the first player, we won't add an empty placeholder

    playersList.forEach(playerName => {
      const opt = document.createElement('option');
      opt.value = playerName;
      opt.textContent = playerName;
      select.appendChild(opt);
    });

    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const playerParam = urlParams.get('player');

    if (playerParam && playersList.includes(playerParam)) {
      select.value = playerParam;
    } else if (playersList.length > 0) {
      // Default to first player if no URL parameter or invalid param
      select.value = playersList[0];
    }

    // Update URL to match current selection (if default was used)
    if (select.value && select.value !== playerParam) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('player', select.value);
      window.history.replaceState({}, '', newUrl);
    }

    // Handle selection change
    select.addEventListener('change', (e) => {
      const newVal = e.target.value;
      if (newVal) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('player', newVal);
        window.history.pushState({}, '', newUrl);
        renderHeatmap(newVal);
      }
    });
  }

  // Initial render
  if (select.value) {
    renderHeatmap(select.value);
  }

  function renderHeatmap(playerName) {
    const key = playerKeyFromName(playerName);
    const playerStats = stats[playerName];

    if (!playerStats) {
      container.innerHTML = `<p>No stats found for ${playerName}.</p>`;
      return;
    }

    // Get all machines this player has played
    const playerMachines = machines
      .filter(m => (m[key]?.plays || 0) > 0)
      .map(m => {
        const playerData = m[key];
        const best = playerData.best || 0;
        const plays = playerData.plays || 0;
        const highScore = m.highScore || 0;
        const avgScore = m.avgScore || 0;

        // Calculate performance percentage
        let performancePercent = 0;
        if (highScore > 0) {
          performancePercent = (best / highScore) * 100;
        }

        return {
          machine: m.machine,
          best,
          plays,
          highScore,
          avgScore,
          performancePercent,
          isLifetimeHigh: highScore > 0 && best === highScore
        };
      })
      .sort((a, b) => b.performancePercent - a.performancePercent); // Sort by performance

    if (playerMachines.length === 0) {
      container.innerHTML = `<p>${playerName} hasn't played any machines yet.</p>`;
      return;
    }

    // Build heat map HTML
    let html = `
      <h2>${playerName}'s Performance</h2>
      
      <div class="summary">
        <div class="summary-grid">
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
        <table class="heatmap-table">
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

    playerMachines.forEach(m => {
      const perfClass = getPerformanceClass(m.performancePercent);
      const trophy = m.isLifetimeHigh ? ' 🏆' : '';
      const perfBar = Math.min(100, m.performancePercent);

      // Check if player beat average
      const beatAverage = m.best > m.avgScore;
      const avgScoreDisplay = m.avgScore > 0 ? fmtNumber(m.avgScore) : '—';
      const avgScoreClass = beatAverage ? 'text-success' : '';
      const avgScoreTick = beatAverage ? ' ✓' : '';

      html += `
        <tr>
          <td><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></td>
          <td>${fmtNumber(m.best)}${trophy}</td>
          <td>${m.plays}</td>
          <td class="perf-cell">
            <div class="perf-bar-container">
              <div class="perf-bar ${perfClass}" style="width: ${perfBar}%"></div>
              <span class="perf-text">${m.performancePercent.toFixed(1)}%</span>
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
  }

  function getPerformanceClass(percent) {
    if (percent >= 80) return 'perf-excellent';
    if (percent >= 60) return 'perf-good';
    if (percent >= 40) return 'perf-average';
    return 'perf-poor';
  }
}
