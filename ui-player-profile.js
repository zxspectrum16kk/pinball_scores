// ui-player-profile.js
// Player profile page

import { fmtNumber, playerKeyFromName, makeTableSortable } from './utils.js';
import { ALL_PLAYERS } from './data.js';

export function renderPlayerProfilePage(machines, stats) {
  const container = document.getElementById('player-profile');
  if (!container) return;

  const playerParam = new URLSearchParams(window.location.search).get('player') || '';
  const playerName = ALL_PLAYERS.find(
    p => p.toLowerCase() === playerParam.toLowerCase()
  );

  if (!playerName) {
    container.innerHTML = `
      <p>No or unknown player specified.</p>
      <p>Try one of:</p>
      <ul>
        ${ALL_PLAYERS.map(p => `<li><a href="index.html?player=${encodeURIComponent(p)}">${p}</a></li>`).join('')}
      </ul>
    `;
    return;
  }

  const s = stats[playerName];
  if (!s) {
    container.innerHTML = `<p>No stats found for ${playerName}.</p>`;
    return;
  }

  const key = playerKeyFromName(playerName);
  const machinesForPlayer = machines.filter(m => (m[key]?.plays || 0) > 0);

  const mp = s.machinesPlayed;
  const wins = s.wins;
  const winPctOverall = mp > 0 ? ((wins / mp) * 100).toFixed(1) + '%' : '0%';

  const summaryHtml = `
    <h2>${playerName}</h2>
    <div class="summary">
      <div class="summary-grid">
        <div class="summary-item">
          <strong>Machines Played</strong>
          <span>${mp}</span>
        </div>
        <div class="summary-item">
          <strong>Wins (overall)</strong>
          <span>${wins} (${winPctOverall})</span>
        </div>
        <div class="summary-item">
          <strong>Above Average</strong>
          <span>${s.aboveAvg}</span>
        </div>
        <div class="summary-item">
          <strong>👑 High Scores</strong>
          <span>${s.lifetimeHighs}</span>
        </div>
      </div>
    </div>
  `;

  const trophy = ' 🏆';

  const rowsHtml = machinesForPlayer.map(m => {
    const pd = m[key] || { plays: 0, best: 0 };
    const plays = pd.plays || 0;
    const best = pd.best || 0;

    const highScore = m.highScore || 0;
    const avgScore = m.avgScore;

    const percentOfHigh = (highScore && best)
      ? ((best / highScore) * 100).toFixed(1) + '%'
      : '';

    const aboveAvgFlag = (avgScore && best)
      ? (best > avgScore ? 'Above avg' : 'Below avg')
      : '';

    const isLifetimeHigh = highScore && best === highScore;

    return `
      <tr>
        <td>
          <a href="machine.html?machine=${encodeURIComponent(m.machine)}">
            ${m.machine}
          </a>
        </td>
        <td>${plays}</td>
        <td>${best ? fmtNumber(best) : ''}${isLifetimeHigh ? trophy : ''}</td>
        <td>${percentOfHigh}</td>
        <td>${avgScore != null ? fmtNumber(avgScore) : ''}</td>
        <td>${aboveAvgFlag}</td>
      </tr>
    `;
  }).join('');

  const tableHtml = `
    <h2>Machines played</h2>
    <div class="table-wrapper">
      <table id="player-machines-table">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Plays</th>
            <th>Best Score</th>
            <th>% of High</th>
            <th>Machine Avg</th>
            <th>Vs Average</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
    <p class="note">
      Trophy icon marks where ${playerName} matches the recorded high score for that machine.
    </p>
  `;

  container.innerHTML = summaryHtml + tableHtml;
  makeTableSortable('player-machines-table', [1, 2, 3, 4]);
}
