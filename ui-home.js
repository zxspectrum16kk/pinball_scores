// ui-home.js
// Home dashboard page

import { fmtNumber, playerKeyFromName } from './utils.js';
import { getSelectedPlayers } from './data.js';

const PLAYER_COLORS = [
  { main: '#0077cc' },
  { main: '#2ecc71' },
  { main: '#e67e22' },
  { main: '#9b59b6' },
  { main: '#e74c3c' },
  { main: '#16a085' },
  { main: '#f39c12' },
  { main: '#2c3e50' },
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function detectCurrentSeason(machines, selectedPlayers) {
  let maxYear = 0;
  selectedPlayers.forEach(name => {
    const key = playerKeyFromName(name);
    machines.forEach(m => {
      (m[key]?.events || []).forEach(e => { if (e.year > maxYear) maxYear = e.year; });
    });
  });
  return maxYear || null;
}

function getYearBest(machine, playerKey, year) {
  if (!year) return machine[playerKey]?.best || 0;
  const events = (machine[playerKey]?.events || []).filter(e => e.year === year);
  return events.length ? Math.max(...events.map(e => e.score)) : 0;
}

function playerPlayedYear(machine, playerKey, year) {
  if (!year) return (machine[playerKey]?.plays || 0) > 0;
  return (machine[playerKey]?.events || []).some(e => e.year === year);
}

function computeYearStats(machines, selectedPlayers, year) {
  const stats = {};
  selectedPlayers.forEach(name => {
    stats[name] = { machinesPlayed: 0, wins: 0, aboveAvg: 0, lifetimeHighs: 0, totalPerfPercent: 0, perfCount: 0, avgPer: '0%' };
  });

  machines.forEach(m => {
    const yearScores = selectedPlayers.map(name => {
      const key = playerKeyFromName(name);
      const best = getYearBest(m, key, year);
      const played = playerPlayedYear(m, key, year);
      return { name, best, played };
    });

    yearScores.forEach(s => {
      if (!s.played) return;
      stats[s.name].machinesPlayed++;
      if (m.avgScore && s.best > m.avgScore) stats[s.name].aboveAvg++;
      if (m.highScore > 0) {
        stats[s.name].totalPerfPercent += (s.best / m.highScore) * 100;
        stats[s.name].perfCount++;
      }
      if (m.highScore && s.best === m.highScore) stats[s.name].lifetimeHighs++;
    });

    const playersThisYear = yearScores.filter(s => s.played && s.best > 0);
    if (playersThisYear.length >= 2) {
      const winner = playersThisYear.reduce((best, cur) => cur.best > best.best ? cur : best, { name: '', best: 0 });
      if (winner.best > 0) stats[winner.name].wins++;
    }
  });

  Object.values(stats).forEach(s => {
    s.avgPer = s.perfCount > 0 ? (s.totalPerfPercent / s.perfCount).toFixed(1) + '%' : '0%';
  });

  return stats;
}

function computeWinRate(machines, playerName, selectedPlayers, wins, year) {
  const key = playerKeyFromName(playerName);
  let contested = 0;
  machines.forEach(m => {
    if (!playerPlayedYear(m, key, year)) return;
    const othersPlayed = selectedPlayers.some(n => {
      if (n === playerName) return false;
      return playerPlayedYear(m, playerKeyFromName(n), year);
    });
    if (othersPlayed) contested++;
  });
  if (contested === 0) return '—';
  return Math.round((wins / contested) * 100) + '%';
}

function computeBadges(machines, selectedPlayers, stats) {
  const badges = new Map();
  selectedPlayers.forEach(n => badges.set(n, []));
  if (selectedPlayers.length < 2) return badges;

  const maxWins = Math.max(...selectedPlayers.map(n => stats[n].wins));
  if (maxWins > 0) {
    selectedPlayers.filter(n => stats[n].wins === maxWins)
      .forEach(n => badges.get(n).push({ label: 'Group Champion', cls: 'badge--gold', icon: '👑' }));
  }

  const maxPlayed = Math.max(...selectedPlayers.map(n => stats[n].machinesPlayed));
  if (maxPlayed > 0) {
    selectedPlayers.filter(n => stats[n].machinesPlayed === maxPlayed)
      .forEach(n => badges.get(n).push({ label: 'Machine Hunter', cls: 'badge--blue', icon: '🎯' }));
  }

  const maxAvgPct = Math.max(...selectedPlayers.map(n => parseFloat(stats[n].avgPer) || 0));
  if (maxAvgPct > 0) {
    selectedPlayers.filter(n => (parseFloat(stats[n].avgPer) || 0) === maxAvgPct)
      .forEach(n => badges.get(n).push({ label: 'Precision Player', cls: 'badge--green', icon: '🎱' }));
  }

  const maxHighs = Math.max(...selectedPlayers.map(n => stats[n].lifetimeHighs));
  if (maxHighs > 0) {
    selectedPlayers.filter(n => stats[n].lifetimeHighs === maxHighs)
      .forEach(n => badges.get(n).push({ label: 'Record Breaker', cls: 'badge--purple', icon: '🏆' }));
  }

  const improvedCounts = selectedPlayers.map(n => {
    const key = playerKeyFromName(n);
    let count = 0;
    machines.forEach(m => {
      const events = m[key]?.events;
      if (!events || events.length < 2) return;
      if (events[events.length - 1].score > events[0].score) count++;
    });
    return { name: n, count };
  });
  const maxImproved = Math.max(...improvedCounts.map(x => x.count));
  if (maxImproved > 0) {
    improvedCounts.filter(x => x.count === maxImproved)
      .forEach(x => badges.get(x.name).push({ label: 'Most Improved', cls: 'badge--orange', icon: '📈' }));
  }

  return badges;
}

function computeH2H(machines, playerA, playerB, year) {
  const keyA = playerKeyFromName(playerA);
  const keyB = playerKeyFromName(playerB);
  let winsA = 0, winsB = 0, ties = 0;
  machines.forEach(m => {
    const bestA = getYearBest(m, keyA, year);
    const bestB = getYearBest(m, keyB, year);
    if (!bestA || !bestB) return;
    if (bestA > bestB) winsA++;
    else if (bestB > bestA) winsB++;
    else ties++;
  });
  return { winsA, winsB, ties };
}

function animateCounters(container) {
  const duration = 800;
  container.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseInt(el.dataset.counter, 10);
    if (isNaN(target) || target === 0) return;
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = Math.round(target * ease).toLocaleString();
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(step);
  });

  container.querySelectorAll('[data-counter-pct]').forEach(el => {
    const target = parseFloat(el.dataset.counterPct);
    if (isNaN(target) || target === 0) return;
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = (target * ease).toFixed(1) + '%';
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(1) + '%';
    }
    requestAnimationFrame(step);
  });

  container.querySelectorAll('[data-bar-width]').forEach(el => {
    setTimeout(() => { el.style.width = el.dataset.barWidth + '%'; }, 50);
  });
}

function renderDashboard(container, machines, stats, selectedPlayers, year) {
  const activeStats = year ? computeYearStats(machines, selectedPlayers, year) : stats;
  const byWins = [...selectedPlayers].sort((a, b) => activeStats[b].wins - activeStats[a].wins);
  const rankMap = new Map(byWins.map((name, i) => [name, i + 1]));
  const badges = computeBadges(machines, selectedPlayers, activeStats);

  const totalMachinesPlayed = machines.filter(m =>
    selectedPlayers.some(n => playerPlayedYear(m, playerKeyFromName(n), year))
  ).length;

  const totalPlays = year
    ? selectedPlayers.reduce((sum, n) => {
        const key = playerKeyFromName(n);
        return sum + machines.reduce((s, m) => {
          return s + (m[key]?.events || []).filter(e => e.year === year).length;
        }, 0);
      }, 0)
    : selectedPlayers.reduce((sum, n) => {
        const key = playerKeyFromName(n);
        return sum + machines.reduce((s, m) => s + (m[key]?.plays || 0), 0);
      }, 0);

  const leader = byWins[0];
  const maxWins = activeStats[leader]?.wins || 0;

  const compBars = byWins.map((name, idx) => {
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const w = maxWins > 0 ? ((activeStats[name].wins / maxWins) * 100).toFixed(1) : 0;
    return `
      <div class="comparison-row">
        <span class="comparison-label">${name}</span>
        <div class="comparison-bar-track">
          <div class="comparison-bar-fill" data-bar-width="${w}" style="background:${color.main};width:0%"></div>
        </div>
        <span class="comparison-bar-label">${activeStats[name].wins}</span>
      </div>`;
  }).join('');

  const groupOverviewHtml = `
    <div class="group-overview home-card">
      <h3 class="home-card-title">Group overview</h3>
      <div class="group-totals">
        <div class="group-total-item">
          <span class="stat-value" data-counter="${totalMachinesPlayed}">${totalMachinesPlayed}</span>
          <span class="stat-label">machines played</span>
        </div>
        <div class="group-total-item">
          <span class="stat-value" data-counter="${totalPlays}">${totalPlays}</span>
          <span class="stat-label">total plays</span>
        </div>
        <div class="group-total-item">
          <span class="stat-value" style="font-size:16px">${leader}</span>
          <span class="stat-label">current leader</span>
        </div>
      </div>
      <div class="comparison-section">
        <div class="comparison-section-title">Wins comparison</div>
        ${compBars}
      </div>
    </div>`;

  const playerCardsHtml = byWins.map((name, idx) => {
    const p = { name, ...activeStats[name] };
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const rank = rankMap.get(name);
    const key = playerKeyFromName(name);
    const playerBadges = badges.get(name) || [];
    const winRate = computeWinRate(machines, name, selectedPlayers, p.wins, year);
    const avgPctNum = parseFloat(p.avgPer) || 0;

    const standouts = machines
      .filter(m => {
        const best = getYearBest(m, key, year);
        return best > 0 && m.avgScore && best > m.avgScore && m.highScore;
      })
      .map(m => ({ machine: m.machine, best: getYearBest(m, key, year), pct: (getYearBest(m, key, year) / m.highScore) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    const toughest = machines
      .filter(m => {
        const best = getYearBest(m, key, year);
        return best > 0 && m.avgScore && best < m.avgScore && m.highScore;
      })
      .map(m => ({ machine: m.machine, best: getYearBest(m, key, year), pct: (getYearBest(m, key, year) / m.highScore) * 100 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);

    const revisit = machines
      .filter(m => {
        const best = getYearBest(m, key, year);
        return best > 0 && m.avgScore && best > m.avgScore;
      })
      .sort((a, b) => {
        const playsA = year
          ? (a[key]?.events || []).filter(e => e.year === year).length
          : (a[key]?.plays || 0);
        const playsB = year
          ? (b[key]?.events || []).filter(e => e.year === year).length
          : (b[key]?.plays || 0);
        return playsA - playsB;
      })
      .slice(0, 3);

    const badgesHtml = playerBadges.length ? `
      <div class="badge-row">
        ${playerBadges.map(b => `<span class="badge ${b.cls}">${b.icon} ${b.label}</span>`).join('')}
      </div>` : '';

    const standoutsHtml = standouts.length ? `
      <div class="home-card">
        <h3 class="home-card-title">Standout results</h3>
        ${standouts.map(s => `
          <div class="standout-item">
            <div class="standout-left">
              <div class="standout-machine"><a href="machine.html?machine=${encodeURIComponent(s.machine)}">${s.machine}</a></div>
              <div class="standout-detail">Best ${fmtNumber(s.best)} · above machine average</div>
            </div>
            <div class="standout-pct-group">
              <div class="standout-bar-wrap">
                <div class="standout-bar-fill" style="width:${Math.min(s.pct, 100).toFixed(1)}%;background:${color.main}"></div>
              </div>
              <span class="standout-pct ${s.pct >= 50 ? 'text-success' : 'text-warning'}">${s.pct.toFixed(1)}% of high</span>
            </div>
          </div>`).join('')}
      </div>` : '';

    const toughestHtml = toughest.length ? `
      <div class="home-card">
        <h3 class="home-card-title">Toughest machines</h3>
        ${toughest.map(t => `
          <div class="tough-item">
            <div class="tough-left">
              <div class="tough-machine"><a href="machine.html?machine=${encodeURIComponent(t.machine)}">${t.machine}</a></div>
              <div class="tough-detail">Best ${fmtNumber(t.best)} · below machine average</div>
            </div>
            <div class="tough-pct-group">
              <div class="standout-bar-wrap">
                <div class="standout-bar-fill" style="width:${Math.min(t.pct, 100).toFixed(1)}%;background:#e74c3c"></div>
              </div>
              <span class="tough-pct text-warning">${t.pct.toFixed(1)}% of high</span>
            </div>
          </div>`).join('')}
      </div>` : '';

    const revisitHtml = revisit.length ? `
      <div class="home-card">
        <h3 class="home-card-title">Machines to revisit</h3>
        ${revisit.map(m => {
          const plays = year
            ? (m[key]?.events || []).filter(e => e.year === year).length
            : (m[key]?.plays || 0);
          return `
            <div class="revisit-item">
              <div class="revisit-machine"><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></div>
              <div class="revisit-detail">${plays} play${plays !== 1 ? 's' : ''} · best score above machine average</div>
            </div>`;
        }).join('')}
      </div>` : '';

    const rankStr = rank.toString().padStart(2, '0');

    return `
      <div class="player-section">
        <div class="home-card player-card" style="border-top:3px solid ${color.main}">
          <div class="pc-header">
            <span class="pc-name">${name}</span>
            <span class="pc-rank" style="color:${color.main}">${rankStr} / GROUP</span>
          </div>
          ${badgesHtml}
          <div class="pc-wins">
            <span class="pc-wins-num" style="color:${color.main}" data-counter="${p.wins}">${p.wins}</span>
            <span class="pc-wins-label">group wins</span>
          </div>
          <div class="pc-divider"></div>
          <div class="player-stats-row">
            <div><span class="stat-value" data-counter="${p.machinesPlayed}">${p.machinesPlayed}</span><span class="stat-label">machines played</span></div>
            <div><span class="stat-value" data-counter="${p.aboveAvg}">${p.aboveAvg}</span><span class="stat-label">above average</span></div>
            <div><span class="stat-value" data-counter="${p.lifetimeHighs}">${p.lifetimeHighs}</span><span class="stat-label">high scores</span></div>
            <div><span class="stat-value" data-counter-pct="${avgPctNum}">${p.avgPer}</span><span class="stat-label">avg performance</span></div>
            <div><span class="stat-value">${winRate}</span><span class="stat-label">win rate</span></div>
          </div>
          <a href="index.html?player=${encodeURIComponent(name)}" class="explore-link" style="color:${color.main}">Explore ${name}'s scores →</a>
        </div>
        ${standoutsHtml}
        ${toughestHtml}
        ${revisitHtml}
      </div>`;
  }).join('');

  let h2hHtml = '';
  if (selectedPlayers.length >= 2) {
    const pairRows = [];
    for (let i = 0; i < byWins.length; i++) {
      for (let j = i + 1; j < byWins.length; j++) {
        const pA = byWins[i];
        const pB = byWins[j];
        const colorA = PLAYER_COLORS[i % PLAYER_COLORS.length];
        const colorB = PLAYER_COLORS[j % PLAYER_COLORS.length];
        const { winsA, winsB, ties } = computeH2H(machines, pA, pB, year);
        const total = winsA + winsB + ties;

        if (total === 0) {
          pairRows.push(`
            <div class="h2h-row">
              <div class="h2h-names">
                <span class="h2h-name" style="color:${colorA.main}">${pA}</span>
                <span class="h2h-vs">vs</span>
                <span class="h2h-name" style="color:${colorB.main}">${pB}</span>
              </div>
              <span class="h2h-no-data">No shared machines yet</span>
            </div>`);
          continue;
        }

        const pctA = ((winsA / total) * 100).toFixed(1);
        const pctB = ((winsB / total) * 100).toFixed(1);

        pairRows.push(`
          <div class="h2h-row">
            <div class="h2h-names">
              <span class="h2h-name ${winsA > winsB ? 'h2h-leading' : ''}" style="color:${colorA.main}">${pA}</span>
              <span class="h2h-vs">vs</span>
              <span class="h2h-name ${winsB > winsA ? 'h2h-leading' : ''}" style="color:${colorB.main}">${pB}</span>
            </div>
            <div class="h2h-bars">
              <div class="h2h-bar-wrap">
                <div class="h2h-bar" data-bar-width="${pctA}" style="background:${colorA.main};width:0%"></div>
              </div>
              <div class="h2h-counts">
                <span style="color:${colorA.main}">${winsA}</span>
                ${ties > 0 ? `<span class="h2h-ties">${ties} tied</span>` : '<span class="h2h-ties">&ndash;</span>'}
                <span style="color:${colorB.main}">${winsB}</span>
              </div>
              <div class="h2h-bar-wrap">
                <div class="h2h-bar" data-bar-width="${pctB}" style="background:${colorB.main};width:0%"></div>
              </div>
            </div>
            <div class="h2h-detail">${total} shared machine${total !== 1 ? 's' : ''}</div>
          </div>`);
      }
    }

    h2hHtml = `
      <div class="home-card h2h-section">
        <h3 class="home-card-title">Head-to-head rivalries</h3>
        ${pairRows.join('')}
      </div>`;
  }

  const wrap = document.getElementById('dashboard-content');
  if (wrap) {
    wrap.innerHTML = groupOverviewHtml + playerCardsHtml + h2hHtml;
    animateCounters(wrap);
  }
}

export function renderHomePage(machines, stats) {
  const container = document.getElementById('home-dashboard');
  if (!container) return;

  const selectedPlayers = getSelectedPlayers().filter(name => stats[name]);
  if (!selectedPlayers.length) {
    container.innerHTML = '<p class="note">No players selected. Visit <a href="players.html">Settings</a> to choose players.</p>';
    return;
  }

  const currentSeason = detectCurrentSeason(machines, selectedPlayers);

  const toggleHtml = currentSeason ? `
    <div class="season-toggle">
      <button class="stoggle-btn stoggle-btn--active" data-year="">All time</button>
      <button class="stoggle-btn" data-year="${currentSeason}">${currentSeason}</button>
    </div>
  ` : '';

  container.innerHTML = toggleHtml + '<div id="dashboard-content"></div>';

  let activeYear = null;
  renderDashboard(container, machines, stats, selectedPlayers, null);

  container.querySelectorAll('.stoggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.stoggle-btn').forEach(b => b.classList.remove('stoggle-btn--active'));
      btn.classList.add('stoggle-btn--active');
      activeYear = btn.dataset.year ? parseInt(btn.dataset.year, 10) : null;
      renderDashboard(container, machines, stats, selectedPlayers, activeYear);
    });
  });
}
