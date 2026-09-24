// ui-leaderboard.js
// Leaderboard (overall) page

import { playerKeyFromName, makeTableSortable, playerColor } from './utils.js';
import { getSelectedPlayers, ALL_PLAYERS } from './data.js';

export function renderLeaderboardChart(containerId, selectedPlayers, winsMap, contestedMap, stats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!selectedPlayers || selectedPlayers.length === 0) {
    container.innerHTML = '';
    return;
  }

  const winsList  = selectedPlayers.map(n => winsMap[n] || 0);
  const aboveList = selectedPlayers.map(n => (stats[n]?.aboveAvg) || 0);
  const playedList = selectedPlayers.map(n => (stats[n]?.machinesPlayed) || 0);

  const maxWins  = Math.max(...winsList, 1);
  const maxAbove = Math.max(...aboveList, 1);
  const maxPlayed = Math.max(...playedList, 1);

  // Sort by wins for the podium
  const ranked = [...selectedPlayers]
    .map(n => ({ name: n, wins: winsMap[n] || 0, color: playerColor(ALL_PLAYERS, n) }))
    .sort((a, b) => b.wins - a.wins);

  // Podium layout: 2nd left, 1st centre, 3rd right
  const podiumSlots = ranked.length >= 3
    ? [ranked[1], ranked[0], ranked[2]]
    : ranked.length === 2
      ? [ranked[1], ranked[0]]
      : [ranked[0]];

  const placeLabel = { 0: '1st', 1: '2nd', 2: '3rd' };
  const placeClass = { 0: 'podium-block--gold', 1: 'podium-block--silver', 2: 'podium-block--bronze' };

  const podiumColsHtml = podiumSlots.map(p => {
    const place = ranked.indexOf(p); // 0-indexed rank
    const heightPx = Math.max(44, Math.round((p.wins / maxWins) * 110));
    return `
      <div class="podium-col">
        <div class="podium-player-name" style="color:${p.color}">${p.name}</div>
        <div class="podium-wins-count">${p.wins}<span class="podium-wins-label"> wins</span></div>
        <div class="podium-block ${placeClass[place]}" style="height:${heightPx}px; background:${p.color}">
          ${placeLabel[place]}
        </div>
      </div>`;
  }).join('');

  // Detailed per-player bar chart
  const barsHtml = selectedPlayers.map(name => {
    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPct = contested > 0 ? ((wins / contested) * 100).toFixed(1) + '%' : '0%';
    const above = stats[name]?.aboveAvg || 0;
    const played = stats[name]?.machinesPlayed || 0;
    const color = playerColor(ALL_PLAYERS, name);

    return `
      <div class="chart-player-block" style="border-left:4px solid ${color}">
        <div class="chart-player-name" style="color:${color}">${name}</div>

        <div class="chart-row">
          <span class="chart-label">Wins / Win %</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner" style="width:${(wins / maxWins) * 100}%; background:${color}"></div>
          </div>
          <span class="chart-value">${wins} (${winPct})</span>
        </div>

        <div class="chart-row">
          <span class="chart-label">Above Avg</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner" style="width:${(above / maxAbove) * 100}%; background:${color}; opacity:0.7"></div>
          </div>
          <span class="chart-value">${above}</span>
        </div>

        <div class="chart-row">
          <span class="chart-label">Machines Played</span>
          <div class="chart-bar-outer">
            <div class="chart-bar-inner" style="width:${(played / maxPlayed) * 100}%; background:${color}; opacity:0.5"></div>
          </div>
          <span class="chart-value">${played}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <h2>Wins podium</h2>
    <div class="podium">${podiumColsHtml}</div>
    <h2 style="margin-top:28px">Breakdown</h2>
    ${barsHtml}
  `;
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
      if (d && d.plays > 0) active.push({ name, best: d.best || 0 });
    });

    if (active.length < 2) return;

    active.forEach(a => { contestedMap[a.name] += 1; });

    let maxScore = -1, maxName = '', tie = false;
    active.forEach(a => {
      if (a.best > maxScore) { maxScore = a.best; maxName = a.name; tie = false; }
      else if (a.best === maxScore) { tie = true; }
    });

    if (!tie && maxName && maxScore > 0) winsMap[maxName] += 1;
  });

  tbody.innerHTML = '';

  let maxMachines = 0, maxWins = 0, maxWinPct = 0, maxAvgPer = 0, maxAbove = 0, maxHighs = 0;

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

    const color = playerColor(ALL_PLAYERS, name);
    const machinesPlayed = s.machinesPlayed;
    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPctVal = contested > 0 ? (wins / contested) * 100 : 0;
    const winPct = contested > 0 ? winPctVal.toFixed(1) + '%' : '0%';
    const avgPerVal = parseFloat(s.avgPer) || 0;

    const tr = document.createElement('tr');
    tr.style.setProperty('--player-color', color);
    tr.innerHTML = `
      <td class="rank-cell" data-label="Rank"></td>
      <td data-label="Player">
        <span class="player-dot" style="background:${color}"></span>
        <a href="index.html?player=${encodeURIComponent(name)}">${name}</a>
      </td>
      <td data-label="Machines" class="${machinesPlayed === maxMachines && maxMachines > 0 ? 'highlight-gold' : ''}">${machinesPlayed}</td>
      <td data-label="Wins" class="${wins === maxWins && maxWins > 0 ? 'highlight-gold' : ''}">${wins}</td>
      <td data-label="Win %" class="${winPctVal === maxWinPct && maxWinPct > 0 ? 'highlight-gold' : ''}">${winPct}</td>
      <td data-label="Avg %" class="${avgPerVal === maxAvgPer && maxAvgPer > 0 ? 'highlight-gold' : ''}">${s.avgPer}</td>
      <td data-label="Above Avg" class="${s.aboveAvg === maxAbove && maxAbove > 0 ? 'highlight-gold' : ''}">${s.aboveAvg}</td>
      <td data-label="High Scores" class="${s.lifetimeHighs === maxHighs && maxHighs > 0 ? 'highlight-gold' : ''}">${s.lifetimeHighs}</td>
    `;
    tbody.appendChild(tr);
  });

  makeTableSortable('overall-table', [2, 3, 4, 5, 6, 7], { index: 2, direction: 'desc' });

  renderLeaderboardChart('leaderboard-chart', selectedPlayers, winsMap, contestedMap, stats);
}
