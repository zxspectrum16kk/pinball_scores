// ui-machine-detail.js
// Machine detail page

import { findMachineByName, fmtNumber, playerKeyFromName, makeTableSortable, getScoreClass } from './utils.js';
import { getSelectedPlayers } from './data.js';

export function renderMachineDetailPage(machines) {
  const container = document.getElementById('machine-detail');
  const select = document.getElementById('machine-select');

  if (!container || !select) return;

  // Populate dropdown if empty
  if (select.options.length <= 1) {
    machines.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.machine;
      opt.textContent = m.machine;
      select.appendChild(opt);
    });

    // Handle selection change
    select.addEventListener('change', (e) => {
      const newVal = e.target.value;
      if (newVal) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('machine', newVal);
        window.history.pushState({}, '', newUrl);
        renderContent(newVal);
      } else {
        container.innerHTML = '';
      }
    });
  }

  // Initial render based on URL
  const machineParam = new URLSearchParams(window.location.search).get('machine');
  if (machineParam) {
    select.value = machineParam;
    renderContent(machineParam);
  }

  function renderContent(machineName) {
    const m = findMachineByName(machines, machineName);
    if (!m) {
      container.innerHTML = `<p>Machine "<strong>${machineName}</strong>" not found.</p>`;
      return;
    }

    const highScore = m.highScore || 0;
    const avgScore = m.avgScore;
    const appearances = m.appearances || 0;
    const totalPlays = m.machinePlays || 0;

    const selectedPlayers = getSelectedPlayers();

    const players = selectedPlayers.map(name => {
      const key = playerKeyFromName(name);
      return {
        name: name,
        stats: m[key] || { plays: 0, best: 0 }
      };
    });

    const trophy = ' 🏆';

    const playerRowsHtml = players.map(p => {
      const plays = p.stats.plays || 0;
      const best = p.stats.best || 0;

      const percentOfHigh = (highScore && best)
        ? ((best / highScore) * 100).toFixed(1) + '%'
        : '';

      const aboveAvgFlag = (avgScore && best)
        ? (best > avgScore ? 'Above avg' : 'Below avg')
        : '';

      const isLifetimeHigh = highScore && best === highScore;

      const cls = getScoreClass(best, avgScore, highScore);
      const scoreAttr = cls ? `class="${cls}"` : '';

      return `
        <tr>
          <td>${p.name}</td>
          <td>${plays}</td>
          <td ${scoreAttr}>${best ? fmtNumber(best) : ''}${isLifetimeHigh ? trophy : ''}</td>
          <td>${percentOfHigh}</td>
          <td>${aboveAvgFlag}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <h2>${m.machine}</h2>

      <div class="summary">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Appearances</strong>
            <span>${appearances}</span>
          </div>
          <div class="summary-item">
            <strong>Total Plays</strong>
            <span>${totalPlays}</span>
          </div>
          <div class="summary-item">
            <strong>Average Score</strong>
            <span>${avgScore != null ? fmtNumber(avgScore) : '—'}</span>
          </div>
          <div class="summary-item">
            <strong>High Score</strong>
            <span>${highScore ? fmtNumber(highScore) : '—'}</span>
          </div>
          <div class="summary-item">
            <strong>High Score Player</strong>
            <span>${m.highPlayer || '—'}</span>
          </div>
        </div>
      </div>

      <h2>Player stats</h2>
      <div class="table-wrapper">
        <table id="machine-player-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Plays</th>
              <th>Best Score</th>
              <th>% of High</th>
              <th>Vs Average</th>
            </tr>
          </thead>
          <tbody>
            ${playerRowsHtml}
          </tbody>
        </table>
      </div>

      <p class="note">
        Trophy icons mark where a player's best score matches the recorded high score for this machine.
      </p>
    `;

    makeTableSortable('machine-player-table', [1, 2, 3]);
  }
}

