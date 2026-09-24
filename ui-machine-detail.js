// ui-machine-detail.js
// Machine detail page

import { findMachineByName, fmtNumber, playerKeyFromName, makeTableSortable, getScoreClass } from './utils.js';
import { getSelectedPlayers } from './data.js';

export function renderMachineDetailPage(machines) {
  const container = document.getElementById('machine-detail');
  const select = document.getElementById('machine-select');

  if (!container || !select) return;

  // Pre-compute difficulty ranks once (rank 1 = hardest)
  const diffRanked = machines
    .filter(m => m.avgScore && m.highScore)
    .sort((a, b) => (a.avgScore / a.highScore) - (b.avgScore / b.highScore));
  const diffTotal = diffRanked.length;
  const diffRankMap = new Map(diffRanked.map((m, i) => [m.machine, i + 1]));

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

  function buildRivalryHighlight(players) {
    const withScores = players.filter(p => p.stats.best > 0);
    if (withScores.length < 2) return '';

    let minGap = Infinity, pair = null;
    for (let i = 0; i < withScores.length; i++) {
      for (let j = i + 1; j < withScores.length; j++) {
        const a = withScores[i], b = withScores[j];
        const higher = Math.max(a.stats.best, b.stats.best);
        const gap = Math.abs(a.stats.best - b.stats.best) / higher;
        if (gap < minGap) { minGap = gap; pair = [a, b]; }
      }
    }
    if (!pair) return '';

    const [p1, p2] = pair[0].stats.best >= pair[1].stats.best ? [pair[0], pair[1]] : [pair[1], pair[0]];
    const diff = p1.stats.best - p2.stats.best;
    const gapPct = (minGap * 100).toFixed(1);
    const label = diff === 0
      ? 'Exact tie on this machine'
      : minGap < 0.02
        ? `Virtual tie — ${fmtNumber(diff)} apart (${gapPct}%)`
        : `${p1.name} leads ${p2.name} by ${fmtNumber(diff)} (${gapPct}%)`;

    return `
      <div class="rivalry-highlight">
        <div class="rivalry-icon">&#9651;</div>
        <div class="rivalry-body">
          <div class="rivalry-title">Closest rivalry on this machine</div>
          <div class="rivalry-names">${p1.name} <span class="rivalry-score">${fmtNumber(p1.stats.best)}</span> vs ${p2.name} <span class="rivalry-score">${fmtNumber(p2.stats.best)}</span></div>
          <div class="rivalry-gap">${label}</div>
        </div>
      </div>`;
  }

  function buildHistoryHtml(players) {
    const withHistory = players.filter(p => p.stats.events && p.stats.events.length > 0);
    if (!withHistory.length) return '';

    const blocks = withHistory.map(p => {
      const events = p.stats.events;
      const maxScore = Math.max(...events.map(e => e.score));
      const rows = events.map(e => `
        <tr${e.score === maxScore ? ' class="history-best"' : ''}>
          <td>${e.year}</td>
          <td>${e.league || '—'}</td>
          <td>Meet ${e.meet}</td>
          <td>${fmtNumber(e.score)}${e.score === maxScore ? ' 🏆' : ''}</td>
          <td>${e.rank}</td>
        </tr>
      `).join('');
      return `
        <div class="history-player">
          <h3 class="history-player-name">${p.name}</h3>
          <div class="table-wrapper">
            <table class="history-table">
              <thead>
                <tr><th>Year</th><th>League</th><th>Meet</th><th>Score</th><th>Rank</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    return `
      <h2>Score history</h2>
      <div class="score-history">${blocks}</div>
    `;
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
        stats: m[key] || { plays: 0, best: 0, events: [] }
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
        <div class="summary-grid summary-grid--3col">
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
          <div class="summary-item">
            <strong>Difficulty Rank</strong>
            <span>${diffRankMap.has(m.machine) ? `${diffRankMap.get(m.machine)} of ${diffTotal}` : '—'}</span>
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

      ${buildRivalryHighlight(players)}

      ${buildHistoryHtml(players)}
    `;

    makeTableSortable('machine-player-table', [1, 2, 3]);
  }
}

