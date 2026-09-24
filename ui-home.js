// ui-home.js
import { fmtNumber, playerKeyFromName } from './utils.js';
import { getSelectedPlayers, DATA_LAST_UPDATED } from './data.js';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function seasonLabel(year, short = false) {
  const num = year - 2007;
  return short ? `Season ${num} (${year})` : `Season ${num} · Northern League ${year}`;
}

function detectCurrentSeason(machines, selectedPlayers) {
  let max = 0;
  selectedPlayers.forEach(name => {
    const key = playerKeyFromName(name);
    machines.forEach(m => (m[key]?.events || []).forEach(e => { if (e.year > max) max = e.year; }));
  });
  return max || null;
}

function getYearBest(machine, playerKey, year) {
  if (!year) return machine[playerKey]?.best || 0;
  const evs = (machine[playerKey]?.events || []).filter(e => e.year === year);
  return evs.length ? Math.max(...evs.map(e => e.score)) : 0;
}

function playerPlayedYear(machine, playerKey, year) {
  if (!year) return (machine[playerKey]?.plays || 0) > 0;
  return (machine[playerKey]?.events || []).some(e => e.year === year);
}

function computeAllYears(machines, selectedPlayers) {
  const years = new Set();
  selectedPlayers.forEach(name => {
    const key = playerKeyFromName(name);
    machines.forEach(m => (m[key]?.events || []).forEach(e => { if (e.year > 0) years.add(e.year); }));
  });
  return [...years].sort();
}

function computeMeetsAttended(machines, playerName, year) {
  const key = playerKeyFromName(playerName);
  const meetSet = new Set();
  machines.forEach(m => {
    (m[key]?.events || [])
      .filter(e => !year || e.year === year)
      .forEach(e => meetSet.add(`${e.year}|${e.league}|${e.meet}`));
  });
  return meetSet.size;
}

// ── Year-filtered stats ───────────────────────────────────────────────────────

function computeYearStats(machines, selectedPlayers, year) {
  const stats = {};
  selectedPlayers.forEach(n => { stats[n] = { machinesPlayed: 0, wins: 0, aboveAvg: 0, lifetimeHighs: 0, totalPerfPct: 0, perfCount: 0, avgPer: '0%' }; });

  machines.forEach(m => {
    const yearScores = selectedPlayers.map(name => {
      const key = playerKeyFromName(name);
      const best = getYearBest(m, key, year);
      return { name, best, played: playerPlayedYear(m, key, year) };
    });

    yearScores.forEach(s => {
      if (!s.played) return;
      stats[s.name].machinesPlayed++;
      if (m.avgScore && s.best > m.avgScore) stats[s.name].aboveAvg++;
      if (m.highScore > 0) { stats[s.name].totalPerfPct += (s.best / m.highScore) * 100; stats[s.name].perfCount++; }
      if (m.highScore && s.best === m.highScore) stats[s.name].lifetimeHighs++;
    });

    const contested = yearScores.filter(s => s.played && s.best > 0);
    if (contested.length >= 2) {
      const winner = contested.reduce((best, cur) => cur.best > best.best ? cur : best, { name: '', best: 0 });
      if (winner.best > 0) stats[winner.name].wins++;
    }
  });

  Object.values(stats).forEach(s => { s.avgPer = s.perfCount > 0 ? (s.totalPerfPct / s.perfCount).toFixed(1) + '%' : '0%'; });
  return stats;
}

function computeWinRate(machines, playerName, selectedPlayers, wins, year) {
  const key = playerKeyFromName(playerName);
  let contested = 0;
  machines.forEach(m => {
    if (!playerPlayedYear(m, key, year)) return;
    if (selectedPlayers.some(n => n !== playerName && playerPlayedYear(m, playerKeyFromName(n), year))) contested++;
  });
  return contested === 0 ? '—' : Math.round((wins / contested) * 100) + '%';
}

// ── Yearly wins (for sparkline) ───────────────────────────────────────────────

function computeYearlyWins(machines, playerName, selectedPlayers, years) {
  return years.map(year => {
    const ys = computeYearStats(machines, selectedPlayers, year);
    return ys[playerName]?.wins || 0;
  });
}

// ── Recent form ───────────────────────────────────────────────────────────────

function computeRecentForm(machines, playerName) {
  const key = playerKeyFromName(playerName);
  let latestYear = 0, latestMeet = 0;
  machines.forEach(m => {
    (m[key]?.events || []).forEach(e => {
      if (e.year > latestYear || (e.year === latestYear && e.meet > latestMeet)) {
        latestYear = e.year; latestMeet = e.meet;
      }
    });
  });
  if (!latestYear) return null;

  const ratios = [];
  machines.forEach(m => {
    const events = m[key]?.events || [];
    const meetEvs = events.filter(e => e.year === latestYear && e.meet === latestMeet);
    if (!meetEvs.length) return;
    const meetBest = Math.max(...meetEvs.map(e => e.score));
    const lifetimeBest = Math.max(...events.map(e => e.score));
    if (lifetimeBest > 0) ratios.push(meetBest / lifetimeBest);
  });

  if (!ratios.length) return null;
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  let form, label;
  if (avgRatio >= 0.92) { form = 'hot';     label = 'Hot form'; }
  else if (avgRatio <= 0.72) { form = 'cold'; label = 'Cold form'; }
  else { form = 'neutral'; label = 'Neutral'; }

  return { form, label, count: ratios.length, latestYear, latestMeet };
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function renderSparkline(years, wins, color) {
  if (!years.length) return '';
  const max = Math.max(...wins, 1);
  const BW = 28, GAP = 5, CH = 36, LH = 14, SH = 14;
  const totalW = years.length * (BW + GAP) - GAP;
  const totalH = SH + CH + LH;

  const bars = years.map((year, i) => {
    const barH = wins[i] > 0 ? Math.max(4, Math.round((wins[i] / max) * CH)) : 2;
    const x = i * (BW + GAP);
    const barY = SH + CH - barH;
    const isMax = wins[i] === max && wins[i] > 0;
    return [
      `<rect x="${x}" y="${barY}" width="${BW}" height="${barH}" rx="2" fill="${color}" opacity="${isMax ? '1' : '0.28'}"/>`,
      wins[i] > 0 ? `<text x="${x + BW / 2}" y="${barY - 2}" text-anchor="middle" font-size="10" fill="${color}" font-weight="${isMax ? '700' : '400'}">${wins[i]}</text>` : '',
      `<text x="${x + BW / 2}" y="${totalH}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.4">'${String(year).slice(2)}</text>`
    ].join('');
  }).join('');

  return `<div class="sparkline-wrap">
    <svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">${bars}</svg>
    <div class="sparkline-label">Wins by season</div>
  </div>`;
}

// ── Hero card (season at a glance) ────────────────────────────────────────────

function buildHeroCard(machines, selectedPlayers, currentSeason) {
  if (!currentSeason) return '';
  const meetSet = new Set();
  selectedPlayers.forEach(name => {
    const key = playerKeyFromName(name);
    machines.forEach(m => {
      (m[key]?.events || []).filter(e => e.year === currentSeason)
        .forEach(e => meetSet.add(`${e.year}|${e.league}|${e.meet}`));
    });
  });

  const meetsPlayed = meetSet.size;
  const machinesContested = machines.filter(m =>
    selectedPlayers.filter(n => (m[playerKeyFromName(n)]?.events || []).some(e => e.year === currentSeason)).length >= 2
  ).length;
  const totalPlays = selectedPlayers.reduce((sum, name) => {
    const key = playerKeyFromName(name);
    return sum + machines.reduce((s, m) => s + (m[key]?.events || []).filter(e => e.year === currentSeason).length, 0);
  }, 0);

  const updatedStr = DATA_LAST_UPDATED ? `Data updated ${DATA_LAST_UPDATED}` : '';

  return `
    <div class="hero-card">
      <div class="hero-header">
        <div class="hero-title">${seasonLabel(currentSeason)} — at a glance</div>
        ${updatedStr ? `<div class="hero-updated">${updatedStr}</div>` : ''}
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><span class="hero-stat-num">${meetsPlayed}</span><span class="hero-stat-label">meets played</span></div>
        <div class="hero-stat"><span class="hero-stat-num">${machinesContested}</span><span class="hero-stat-label">contested machines</span></div>
        <div class="hero-stat"><span class="hero-stat-num">${totalPlays}</span><span class="hero-stat-label">total plays</span></div>
      </div>
    </div>`;
}

// ── Badges ────────────────────────────────────────────────────────────────────

function computeBadges(machines, selectedPlayers, stats) {
  const badges = new Map();
  selectedPlayers.forEach(n => badges.set(n, []));
  if (selectedPlayers.length < 2) return badges;

  const maxWins = Math.max(...selectedPlayers.map(n => stats[n].wins));
  if (maxWins > 0) selectedPlayers.filter(n => stats[n].wins === maxWins)
    .forEach(n => badges.get(n).push({ label: 'Group Champion', cls: 'badge--gold', icon: '&#9733;', title: 'Leads the group in total machine wins' }));

  const maxPlayed = Math.max(...selectedPlayers.map(n => stats[n].machinesPlayed));
  if (maxPlayed > 0) selectedPlayers.filter(n => stats[n].machinesPlayed === maxPlayed)
    .forEach(n => badges.get(n).push({ label: 'Machine Hunter', cls: 'badge--blue', icon: '&#9678;', title: 'Has played the most machines in this group' }));

  const maxAvgPct = Math.max(...selectedPlayers.map(n => parseFloat(stats[n].avgPer) || 0));
  if (maxAvgPct > 0) selectedPlayers.filter(n => (parseFloat(stats[n].avgPer) || 0) === maxAvgPct)
    .forEach(n => badges.get(n).push({ label: 'Precision Player', cls: 'badge--green', icon: '&#9673;', title: 'Highest average score relative to each machine\'s high score' }));

  const maxHighs = Math.max(...selectedPlayers.map(n => stats[n].lifetimeHighs));
  if (maxHighs > 0) selectedPlayers.filter(n => stats[n].lifetimeHighs === maxHighs)
    .forEach(n => badges.get(n).push({ label: 'Record Breaker', cls: 'badge--purple', icon: '&#9670;', title: 'Holds the most machine high scores in the league' }));

  const improved = selectedPlayers.map(n => {
    const key = playerKeyFromName(n);
    let count = 0;
    machines.forEach(m => {
      const evs = m[key]?.events;
      if (evs && evs.length >= 2 && evs[evs.length - 1].score > evs[0].score) count++;
    });
    return { name: n, count };
  });
  const maxImproved = Math.max(...improved.map(x => x.count));
  if (maxImproved > 0) improved.filter(x => x.count === maxImproved)
    .forEach(x => badges.get(x.name).push({ label: 'Most Improved', cls: 'badge--orange', icon: '&#8679;', title: 'Has improved their score on the most machines over time' }));

  return badges;
}

// ── H2H ───────────────────────────────────────────────────────────────────────

function computeH2H(machines, playerA, playerB, year) {
  const keyA = playerKeyFromName(playerA), keyB = playerKeyFromName(playerB);
  let winsA = 0, winsB = 0, ties = 0;
  machines.forEach(m => {
    const bA = getYearBest(m, keyA, year), bB = getYearBest(m, keyB, year);
    if (!bA || !bB) return;
    if (bA > bB) winsA++; else if (bB > bA) winsB++; else ties++;
  });
  return { winsA, winsB, ties };
}

// ── Counters ──────────────────────────────────────────────────────────────────

function animateCounters(container) {
  const dur = 800;
  container.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseInt(el.dataset.counter, 10);
    if (isNaN(target) || target === 0) return;
    const start = performance.now();
    (function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = Math.round(target * ease).toLocaleString();
      if (t < 1) requestAnimationFrame(step); else el.textContent = target.toLocaleString();
    })(performance.now());
  });
  container.querySelectorAll('[data-bar-width]').forEach(el => {
    setTimeout(() => { el.style.width = el.dataset.barWidth + '%'; }, 50);
  });
}

// ── Main dashboard render ─────────────────────────────────────────────────────

function renderDashboard(container, machines, stats, selectedPlayers, year) {
  const activeStats = year ? computeYearStats(machines, selectedPlayers, year) : stats;
  const byWins = [...selectedPlayers].sort((a, b) => activeStats[b].wins - activeStats[a].wins);
  const rankMap = new Map(byWins.map((name, i) => [name, i + 1]));
  const badges = computeBadges(machines, selectedPlayers, activeStats);
  const allYears = computeAllYears(machines, selectedPlayers);

  const totalMachinesPlayed = machines.filter(m =>
    selectedPlayers.some(n => playerPlayedYear(m, playerKeyFromName(n), year))
  ).length;

  const totalPlays = year
    ? selectedPlayers.reduce((sum, n) => sum + machines.reduce((s, m) =>
        s + (m[playerKeyFromName(n)]?.events || []).filter(e => e.year === year).length, 0), 0)
    : selectedPlayers.reduce((sum, n) => sum + machines.reduce((s, m) => s + (m[playerKeyFromName(n)]?.plays || 0), 0), 0);

  const leader = byWins[0];
  const maxWins = activeStats[leader]?.wins || 0;

  // Group overview
  const compBars = byWins.map((name, idx) => {
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const w = maxWins > 0 ? ((activeStats[name].wins / maxWins) * 100).toFixed(1) : 0;
    return `<div class="comparison-row">
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
          <a href="index.html?player=${encodeURIComponent(leader)}" class="stat-value" style="font-size:16px;text-decoration:none;color:inherit">${leader}</a>
          <span class="stat-label">current leader</span>
        </div>
      </div>
      <div class="comparison-section">
        <div class="comparison-section-title">Wins comparison</div>
        ${compBars}
      </div>
    </div>`;

  // Player cards
  const playerCardsHtml = byWins.map((name, idx) => {
    const p = { name, ...activeStats[name] };
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const rank = rankMap.get(name);
    const key = playerKeyFromName(name);
    const playerBadges = badges.get(name) || [];
    const winRate = computeWinRate(machines, name, selectedPlayers, p.wins, year);
    const avgPctNum = parseFloat(p.avgPer) || 0;
    const rankStr = rank.toString().padStart(2, '0');
    const meetsAttended = computeMeetsAttended(machines, name, year);

    // Sparkline
    const yearlyWins = computeYearlyWins(machines, name, selectedPlayers, allYears);
    const sparkline = allYears.length >= 2 ? renderSparkline(allYears, yearlyWins, color.main) : '';

    // Recent form
    const form = computeRecentForm(machines, name);
    const formTitles = { hot: 'Last meet scores were above their lifetime average', cold: 'Last meet scores were below their lifetime average', neutral: 'Last meet scores were close to their lifetime average' };
    const formHtml = form ? `<span class="form-badge form-badge--${form.form}" title="${formTitles[form.form]} — Meet ${form.latestMeet} (${form.latestYear}), ${form.count} machines">${form.label}</span>` : '';

    const badgesHtml = (playerBadges.length || formHtml) ? `
      <div class="badge-row">
        ${playerBadges.map(b => `<span class="badge ${b.cls}" title="${b.title || ''}">${b.icon} ${b.label}</span>`).join('')}
        ${formHtml}
      </div>` : '';

    const standouts = machines.filter(m => {
      const best = getYearBest(m, key, year);
      return best > 0 && m.avgScore && best > m.avgScore && m.highScore;
    }).map(m => ({
      machine: m.machine,
      best: getYearBest(m, key, year),
      pct: (getYearBest(m, key, year) / m.highScore) * 100
    })).sort((a, b) => b.pct - a.pct).slice(0, 3);

    const toughest = machines.filter(m => {
      const best = getYearBest(m, key, year);
      return best > 0 && m.avgScore && best < m.avgScore && m.highScore;
    }).map(m => ({
      machine: m.machine,
      best: getYearBest(m, key, year),
      pct: (getYearBest(m, key, year) / m.highScore) * 100
    })).sort((a, b) => a.pct - b.pct).slice(0, 3);

    const revisit = machines.filter(m => {
      const best = getYearBest(m, key, year);
      return best > 0 && m.avgScore && best > m.avgScore;
    }).sort((a, b) => {
      const pA = year ? (a[key]?.events || []).filter(e => e.year === year).length : (a[key]?.plays || 0);
      const pB = year ? (b[key]?.events || []).filter(e => e.year === year).length : (b[key]?.plays || 0);
      return pA - pB;
    }).slice(0, 3);

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
          const plays = year ? (m[key]?.events || []).filter(e => e.year === year).length : (m[key]?.plays || 0);
          return `<div class="revisit-item">
            <div class="revisit-machine"><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></div>
            <div class="revisit-detail">${plays} play${plays !== 1 ? 's' : ''} · best score above machine average</div>
          </div>`;
        }).join('')}
      </div>` : '';

    return `
      <div class="player-section">
        <div class="home-card player-card" style="border-top:3px solid ${color.main}">
          <div class="pc-header">
            <a href="index.html?player=${encodeURIComponent(name)}" class="pc-name">${name}</a>
            <span class="pc-rank" style="color:${color.main}">${rankStr} / GROUP</span>
          </div>
          ${badgesHtml}
          <div class="pc-wins">
            <span class="pc-wins-num" style="color:${color.main}" data-counter="${p.wins}">${p.wins}</span>
            <span class="pc-wins-label">group wins</span>
          </div>
          ${sparkline}
          <div class="pc-divider"></div>
          <div class="player-stats-row">
            <div><span class="stat-value" data-counter="${meetsAttended}">${meetsAttended}</span><span class="stat-label">meets attended</span></div>
            <div><span class="stat-value" data-counter="${p.machinesPlayed}">${p.machinesPlayed}</span><span class="stat-label">machines played</span></div>
            <div><span class="stat-value" data-counter="${p.aboveAvg}">${p.aboveAvg}</span><span class="stat-label">above average</span></div>
            <div><span class="stat-value" data-counter="${p.lifetimeHighs}">${p.lifetimeHighs}</span><span class="stat-label">high scores</span></div>
            <div><span class="stat-value">${p.avgPer}</span><span class="stat-label">avg performance</span></div>
            <div><span class="stat-value">${winRate}</span><span class="stat-label">win rate</span></div>
          </div>
          <a href="index.html?player=${encodeURIComponent(name)}" class="explore-link" style="color:${color.main}">Explore ${name}'s scores →</a>
        </div>
        ${standoutsHtml}${toughestHtml}${revisitHtml}
      </div>`;
  }).join('');

  // H2H
  let h2hHtml = '';
  if (selectedPlayers.length >= 2) {
    const pairRows = [];
    for (let i = 0; i < byWins.length; i++) {
      for (let j = i + 1; j < byWins.length; j++) {
        const pA = byWins[i], pB = byWins[j];
        const cA = PLAYER_COLORS[i % PLAYER_COLORS.length], cB = PLAYER_COLORS[j % PLAYER_COLORS.length];
        const { winsA, winsB, ties } = computeH2H(machines, pA, pB, year);
        const total = winsA + winsB + ties;
        if (total === 0) {
          pairRows.push(`<div class="h2h-row">
            <div class="h2h-names">
              <a href="index.html?player=${encodeURIComponent(pA)}" class="h2h-name" style="color:${cA.main}">${pA}</a>
              <span class="h2h-vs">vs</span>
              <a href="index.html?player=${encodeURIComponent(pB)}" class="h2h-name" style="color:${cB.main}">${pB}</a>
            </div>
            <span class="h2h-no-data">No shared machines yet</span>
          </div>`);
          continue;
        }
        const pctA = ((winsA / total) * 100).toFixed(1);
        const pctB = ((winsB / total) * 100).toFixed(1);
        pairRows.push(`<div class="h2h-row">
          <div class="h2h-names">
            <a href="index.html?player=${encodeURIComponent(pA)}" class="h2h-name ${winsA > winsB ? 'h2h-leading' : ''}" style="color:${cA.main}">${pA}</a>
            <span class="h2h-vs">vs</span>
            <a href="index.html?player=${encodeURIComponent(pB)}" class="h2h-name ${winsB > winsA ? 'h2h-leading' : ''}" style="color:${cB.main}">${pB}</a>
          </div>
          <div class="h2h-bars">
            <div class="h2h-bar-wrap"><div class="h2h-bar" data-bar-width="${pctA}" style="background:${cA.main};width:0%"></div></div>
            <div class="h2h-counts">
              <span style="color:${cA.main}">${winsA}</span>
              ${ties > 0 ? `<span class="h2h-ties">${ties} tied</span>` : '<span class="h2h-ties">&ndash;</span>'}
              <span style="color:${cB.main}">${winsB}</span>
            </div>
            <div class="h2h-bar-wrap"><div class="h2h-bar" data-bar-width="${pctB}" style="background:${cB.main};width:0%"></div></div>
          </div>
          <div class="h2h-detail">${total} shared machine${total !== 1 ? 's' : ''}</div>
        </div>`);
      }
    }
    h2hHtml = `<div class="home-card h2h-section">
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

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderHomePage(machines, stats) {
  const container = document.getElementById('home-dashboard');
  if (!container) return;

  const selectedPlayers = getSelectedPlayers().filter(name => stats[name]);
  if (!selectedPlayers.length) {
    container.innerHTML = '<p class="note">No players selected. Visit <a href="players.html">Settings</a> to choose players.</p>';
    return;
  }

  const currentSeason = detectCurrentSeason(machines, selectedPlayers);
  const heroHtml = buildHeroCard(machines, selectedPlayers, currentSeason);

  const toggleHtml = currentSeason ? `
    <div class="season-toggle">
      <button class="stoggle-btn stoggle-btn--active" data-year="">All time</button>
      <button class="stoggle-btn" data-year="${currentSeason}">${seasonLabel(currentSeason, true)}</button>
    </div>` : '';

  container.innerHTML = heroHtml + toggleHtml + '<div id="dashboard-content"></div>';

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
