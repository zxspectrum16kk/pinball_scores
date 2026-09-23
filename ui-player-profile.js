// ui-player-profile.js
// Player profile page

import { fmtNumber, playerKeyFromName, makeTableSortable } from './utils.js';
import { ALL_PLAYERS } from './data.js';

function getTrend(events) {
  if (!events || events.length < 2) return null;
  const first = events[0].score;
  const last = events[events.length - 1].score;
  const change = (last - first) / first;
  if (change > 0.05) return 'up';
  if (change < -0.05) return 'down';
  return 'flat';
}

function trendBadge(trend) {
  if (trend === 'up')   return `<span class="trend trend--up"   title="Improving">↑</span>`;
  if (trend === 'down') return `<span class="trend trend--down" title="Declining">↓</span>`;
  if (trend === 'flat') return `<span class="trend trend--flat" title="Stable">→</span>`;
  return `<span class="trend trend--none">·</span>`;
}

function computeSeasonSummary(machinesForPlayer, key) {
  const allYears = new Set();
  machinesForPlayer.forEach(m => {
    (m[key]?.events || []).forEach(e => { if (e.year > 0) allYears.add(e.year); });
  });

  const years = [...allYears].sort((a, b) => b - a).slice(0, 3);
  return years.map(year => {
    let played = 0, improved = 0, bestPct = 0, topMachine = '';
    machinesForPlayer.forEach(m => {
      const events = m[key]?.events || [];
      const yearEvents = events.filter(e => e.year === year);
      if (!yearEvents.length) return;
      played++;
      const bestThisYear = Math.max(...yearEvents.map(e => e.score));
      const prevEvents = events.filter(e => e.year < year);
      if (prevEvents.length) {
        const bestBefore = Math.max(...prevEvents.map(e => e.score));
        if (bestThisYear > bestBefore) improved++;
      }
      if (m.highScore > 0) {
        const pct = (bestThisYear / m.highScore) * 100;
        if (pct > bestPct) { bestPct = pct; topMachine = m.machine; }
      }
    });
    return { year, played, improved, topMachine, bestPct };
  });
}

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

  // Compute available years from events
  const allYears = new Set();
  machinesForPlayer.forEach(m => {
    (m[key]?.events || []).forEach(e => { if (e.year > 0) allYears.add(e.year); });
  });
  const sortedYears = [...allYears].sort((a, b) => b - a);

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

  // Season summary cards (last 3 years)
  const seasonSummary = computeSeasonSummary(machinesForPlayer, key);
  const seasonHtml = seasonSummary.length ? `
    <p class="section-label">Season breakdown</p>
    <div class="season-cards">
      ${seasonSummary.map(ss => `
        <div class="season-card">
          <div class="season-year">${ss.year}</div>
          <div class="season-stat">
            <span class="season-stat-num">${ss.played}</span>
            <span class="season-stat-label">machines played</span>
          </div>
          <div class="season-stat">
            <span class="season-stat-num ${ss.improved > 0 ? 'text-success' : ''}">${ss.improved}</span>
            <span class="season-stat-label">improved vs prior year</span>
          </div>
          ${ss.topMachine ? `
            <div class="season-top">
              Best: <a href="machine.html?machine=${encodeURIComponent(ss.topMachine)}">${ss.topMachine}</a>
              <span class="season-pct">${ss.bestPct.toFixed(1)}% of high</span>
            </div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Year filter dropdown
  const filterHtml = sortedYears.length ? `
    <div class="year-filter">
      <label for="year-select">Season:</label>
      <select id="year-select">
        <option value="">All time</option>
        ${sortedYears.map(y => `<option value="${y}">${y}</option>`).join('')}
      </select>
    </div>
  ` : '';

  container.innerHTML = summaryHtml + seasonHtml + `
    <h2>Machines played</h2>
    ${filterHtml}
    <div id="profile-table-wrap"></div>
    <p class="note" id="profile-note">
      Trophy 🏆 marks where ${playerName} holds the recorded high score. Trend arrows show score direction from first play to latest (↑ improving, ↓ declining, → stable).
    </p>
  `;

  function renderTable(yearFilter) {
    const wrap = document.getElementById('profile-table-wrap');
    if (!wrap) return;

    const trophy = '🏆';

    let tableData;
    if (yearFilter) {
      tableData = machinesForPlayer
        .filter(m => (m[key]?.events || []).some(e => e.year === yearFilter))
        .map(m => {
          const yearEvents = (m[key]?.events || []).filter(e => e.year === yearFilter);
          const best = yearEvents.length ? Math.max(...yearEvents.map(e => e.score)) : 0;
          return { m, best, trend: getTrend(yearEvents), plays: m[key]?.plays || 0 };
        });
    } else {
      tableData = machinesForPlayer.map(m => {
        const pd = m[key] || { plays: 0, best: 0, events: [] };
        return { m, best: pd.best || 0, trend: getTrend(pd.events || []), plays: pd.plays || 0 };
      });
    }

    const rowsHtml = tableData.map(({ m, best, trend, plays }) => {
      const highScore = m.highScore || 0;
      const avgScore = m.avgScore;
      const percentOfHigh = (highScore && best) ? ((best / highScore) * 100).toFixed(1) + '%' : '';
      const aboveAvgFlag = (avgScore && best) ? (best > avgScore ? 'Above avg' : 'Below avg') : '';
      const isLifetimeHigh = !yearFilter && highScore && best === highScore;

      return `
        <tr>
          <td><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></td>
          <td>${plays}</td>
          <td>${best ? fmtNumber(best) : ''}${isLifetimeHigh ? ' ' + trophy : ''}</td>
          <td>${percentOfHigh}</td>
          <td>${avgScore != null ? fmtNumber(avgScore) : ''}</td>
          <td>${aboveAvgFlag}</td>
          <td>${trendBadge(trend)}</td>
        </tr>
      `;
    }).join('');

    wrap.innerHTML = `
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
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
    makeTableSortable('player-machines-table', [1, 2, 3, 4]);
  }

  renderTable(null);

  const yearSelect = document.getElementById('year-select');
  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      const yr = yearSelect.value ? parseInt(yearSelect.value, 10) : null;
      renderTable(yr);
    });
  }
}
