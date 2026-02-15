// ui-leaderboard.js
// Leaderboard (overall) page

import { playerKeyFromName, makeTableSortable } from './utils.js';
import { getSelectedPlayers } from './data.js';

export function renderLeaderboardChart(containerId, selectedPlayers, winsMap, contestedMap, stats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!selectedPlayers || selectedPlayers.length === 0) {
    container.innerHTML = '';
    return;
  }

  const winsList = selectedPlayers.map(n => winsMap[n] || 0);
  const aboveList = selectedPlayers.map(n => (stats[n]?.aboveAvg) || 0);
  const playedList = selectedPlayers.map(n => (stats[n]?.machinesPlayed) || 0);

  const maxWins = Math.max(...winsList, 1);
  const maxAbove = Math.max(...aboveList, 1);
  const maxPlayed = Math.max(...playedList, 1);

  let html = `<h2>Player Comparison</h2>`;

  selectedPlayers.forEach(name => {
    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPct = contested > 0 ? ((wins / contested) * 100).toFixed(1) + '%' : '0%';
    const above = stats[name]?.aboveAvg || 0;
    const played = stats[name]?.machinesPlayed || 0;

    html += `
      <div class="chart-player-block">
        <div class="chart-player-name">${name}</div>

        <div class="chart-row">
          <span class="chart-label">Wins / Win %</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner bar-wins" style="width:${(wins / maxWins) * 100}%"></div>
          </div>
          <span class="chart-value">${wins} (${winPct})</span>
        </div>

        <div class="chart-row">
          <span class="chart-label">Above Avg</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner bar-above" style="width:${(above / maxAbove) * 100}%"></div>
          </div>
          <span class="chart-value">${above}</span>
        </div>

        <div class="chart-row">
          <span class="chart-label">Machines Played</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner bar-played" style="width:${(played / maxPlayed) * 100}%"></div>
          </div>
          <span class="chart-value">${played}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderOverallPage(machines, stats) {
  const tbody = document.querySelector('#overall-table tbody');
  if (!tbody) return;

  const resetBtn = document.getElementById('reset-sort');
  if (resetBtn) {
    resetBtn.onclick = () => window.location.reload();
  }

  const selectedPlayers = getSelectedPlayers();

  const winsMap = {};
  const contestedMap = {};
  selectedPlayers.forEach(name => {
    winsMap[name] = 0;
    contestedMap[name] = 0;
  });

  machines.forEach(m => {
    const active = [];

    selectedPlayers.forEach(name => {
      const key = playerKeyFromName(name);
      const d = m[key];
      if (d && d.plays > 0) {
        active.push({ name, best: d.best || 0 });
      }
    });

    if (active.length < 2) return;

    active.forEach(a => {
      contestedMap[a.name] += 1;
    });

    let maxScore = -1;
    let maxName = '';
    let tie = false;
    active.forEach(a => {
      if (a.best > maxScore) {
        maxScore = a.best;
        maxName = a.name;
        tie = false;
      } else if (a.best === maxScore) {
        tie = true;
      }
    });

    if (!tie && maxName && maxScore > 0) {
      winsMap[maxName] += 1;
    }
  });

  tbody.innerHTML = '';

  let maxMachines = 0;
  let maxWins = 0;
  let maxWinPct = 0;
  let maxAvgPer = 0;
  let maxAbove = 0;
  let maxHighs = 0;

  selectedPlayers.forEach(name => {
    const s = stats[name];
    if (!s) return;

    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPctVal = contested > 0 ? (wins / contested) * 100 : 0;
    const avgPerVal = parseFloat(s.avgPer) || 0;

    if (s.machinesPlayed > maxMachines) maxMachines = s.machinesPlayed;
    if (wins > maxWins) maxWins = wins;
    if (winPctVal > maxWinPct) maxWinPct = winPctVal;
    if (avgPerVal > maxAvgPer) maxAvgPer = avgPerVal;
    if (s.aboveAvg > maxAbove) maxAbove = s.aboveAvg;
    if (s.lifetimeHighs > maxHighs) maxHighs = s.lifetimeHighs;
  });

  selectedPlayers.forEach(name => {
    const s = stats[name];
    if (!s) return;

    const machinesPlayed = s.machinesPlayed;
    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPctVal = contested > 0 ? (wins / contested) * 100 : 0;
    const winPct = contested > 0 ? winPctVal.toFixed(1) + '%' : '0%';
    const avgPerVal = parseFloat(s.avgPer) || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-cell"></td>
      <td>
        <a href="index.html?player=${encodeURIComponent(name)}">
          ${name}
        </a>
      </td>
      <td class="${machinesPlayed === maxMachines && maxMachines > 0 ? 'highlight-gold' : ''}">${machinesPlayed}</td>
      <td class="${wins === maxWins && maxWins > 0 ? 'highlight-gold' : ''}">${wins}</td>
      <td class="${winPctVal === maxWinPct && maxWinPct > 0 ? 'highlight-gold' : ''}">${winPct}</td>
      <td class="${avgPerVal === maxAvgPer && maxAvgPer > 0 ? 'highlight-gold' : ''}">${s.avgPer}</td>
      <td class="${s.aboveAvg === maxAbove && maxAbove > 0 ? 'highlight-gold' : ''}">${s.aboveAvg}</td>
      <td class="${s.lifetimeHighs === maxHighs && maxHighs > 0 ? 'highlight-gold' : ''}">${s.lifetimeHighs}</td>
    `;
    tbody.appendChild(tr);
  });

  makeTableSortable('overall-table', [2, 3, 4, 5, 6, 7], { index: 2, direction: 'desc' });

  renderLeaderboardChart('leaderboard-chart', selectedPlayers, winsMap, contestedMap, stats);
}
