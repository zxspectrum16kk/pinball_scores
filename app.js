// app.js
// Single script for all pages (no modules)

// ==== Player config / settings ====
let PLAYER_CONFIG = [];
let ALL_PLAYERS = [];
let DEFAULT_PLAYERS = [];
const STORAGE_KEY = 'pinballSelectedPlayers';

// Update this whenever you refresh JSON exports
const DATA_LAST_UPDATED = '2025-11-23';

function playerKeyFromName(name) {
  return name.toLowerCase();
}

// ===== Shared helpers =====
function fmtNumber(v) {
  if (v == null || v === '' || isNaN(v)) return v ?? '';
  return Number(v).toLocaleString();
}

function getMachineName(row) {
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('machine') ||
      lower.includes('game') ||
      lower.includes('table')
    ) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }
  return null;
}

function getNumericField(row, patterns, defaultValue = 0) {
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return defaultValue;
}

function fetchJson(path) {
  return fetch(path).then(res => {
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  });
}

function getSelectedPlayers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map(p => String(p))
          .filter(p => ALL_PLAYERS.includes(p));
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch (e) {
    console.warn('Failed to read player selection from localStorage:', e);
  }
  return [...DEFAULT_PLAYERS];
}

function setSelectedPlayers(list) {
  const cleaned = list
    .map(p => String(p))
    .filter(p => ALL_PLAYERS.includes(p));

  const toSave = cleaned.length > 0 ? cleaned : DEFAULT_PLAYERS;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save player selection to localStorage:', e);
  }
  return toSave;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Global selected-players summary
function renderSelectedPlayersSummary() {
  const el = document.getElementById('selected-players-summary');
  if (!el) return;

  const players = getSelectedPlayers();
  if (!players || players.length === 0) {
    el.textContent = '';
    return;
  }

  el.textContent = `Selected players: ${players.join(', ')}`;
}

// Last updated footer
function renderLastUpdated() {
  const els = document.querySelectorAll('.data-last-updated');
  els.forEach(el => {
    el.textContent = DATA_LAST_UPDATED;
  });
}

// ===== Sorting helper =====
function makeTableSortable(tableId, numericCols = [], defaultSort) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = table.querySelectorAll('thead th');
  const tbody = table.querySelector('tbody');

  const parseNumericText = (text) => {
    if (!text) return 0;
    const cleaned = text.replace(/,/g, '').replace('%', '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const sortRows = (index, direction) => {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isNumeric = numericCols.includes(index);

    rows.sort((a, b) => {
      const aText = a.children[index]?.textContent.trim() || '';
      const bText = b.children[index]?.textContent.trim() || '';

      let cmp;
      if (isNumeric) {
        cmp = parseNumericText(aText) - parseNumericText(bText);
      } else {
        cmp = aText.localeCompare(bText);
      }

      return direction === 'asc' ? cmp : -cmp;
    });

    rows.forEach(r => tbody.appendChild(r));
  };

  const highlightColumn = (index) => {
    headers.forEach((h, i) => {
      if (i === index) h.classList.add('sorted-col');
      else h.classList.remove('sorted-col');
    });

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      Array.from(row.children).forEach((cell, i) => {
        if (i === index) cell.classList.add('sorted-col');
        else cell.classList.remove('sorted-col');
      });
    });
  };

  headers.forEach((th, index) => {
    if (!th.querySelector('.arrow')) {
      const label = th.innerText;
      th.innerHTML = `<span>${label}</span><span class="arrow"></span>`;
    }

    th.addEventListener('click', () => {
      const currentDir = th.dataset.sortDir === 'asc' ? 'asc' : 'desc';
      const newDir = currentDir === 'asc' ? 'desc' : 'asc';
      th.dataset.sortDir = newDir;

      headers.forEach(h => {
        if (h !== th) {
          delete h.dataset.sortDir;
          h.removeAttribute('aria-sort');
          const arrow = h.querySelector('.arrow');
          if (arrow) arrow.textContent = '';
        }
      });

      const arrow = th.querySelector('.arrow');
      if (arrow) arrow.textContent = newDir === 'asc' ? '▲' : '▼';
      th.setAttribute('aria-sort', newDir === 'asc' ? 'ascending' : 'descending');

      sortRows(index, newDir);
      highlightColumn(index);
    });
  });

  if (defaultSort && typeof defaultSort.index === 'number') {
    const th = headers[defaultSort.index];
    if (th) {
      th.dataset.sortDir = defaultSort.direction;
      const arrow = th.querySelector('.arrow');
      if (arrow) {
        arrow.textContent =
          defaultSort.direction === 'asc' ? '▲' : '▼';
      }
      th.setAttribute(
        'aria-sort',
        defaultSort.direction === 'asc' ? 'ascending' : 'descending'
      );
      sortRows(defaultSort.index, defaultSort.direction);
      highlightColumn(defaultSort.index);
    }
  }
}

// ===== Data building / stats =====
function createEmptyPlayerStats() {
  const base = {};
  PLAYER_CONFIG.forEach(p => {
    base[p.id] = { plays: 0, best: 0 };
  });
  return base;
}

function createEmptyMachine(name, ms = {}) {
  let highPlayer = '';
  for (const [key, value] of Object.entries(ms)) {
    if (key.toLowerCase().includes('player')) {
      highPlayer = String(value ?? '').trim();
      break;
    }
  }

  return {
    machine: name,
    no: ms.No ?? ms.no ?? null,
    appearances: getNumericField(ms, ['apper', 'appear'], 0),
    machinePlays: getNumericField(ms, ['play'], 0),
    avgScore: getNumericField(ms, ['average'], null),
    highScore: getNumericField(ms, ['high'], null),
    highPlayer,
    ...createEmptyPlayerStats()
  };
}

function buildMachineData(playerDataById, machineStats) {
  const machineMap = new Map();

  // Seed map from machine stats
  machineStats.forEach(ms => {
    const name = getMachineName(ms);
    if (!name) return;
    machineMap.set(name, createEmptyMachine(name, ms));
  });

  // Apply each player's data
  PLAYER_CONFIG.forEach(p => {
    const data = playerDataById[p.id] || [];
    data.forEach(row => {
      const name = getMachineName(row);
      if (!name) return;

      let m = machineMap.get(name);
      if (!m) {
        m = createEmptyMachine(name);
        machineMap.set(name, m);
      }

      m[p.id].plays = getNumericField(row, ['play'], 0);
      m[p.id].best = getNumericField(row, ['best', 'high'], 0);
    });
  });

  return Array.from(machineMap.values()).sort((a, b) => {
    if (a.no != null && b.no != null && a.no !== b.no) return a.no - b.no;
    return a.machine.localeCompare(b.machine);
  });
}

function computeStatsFromMachines(machines) {
  const stats = {};
  ALL_PLAYERS.forEach(name => {
    stats[name] = {
      machinesPlayed: 0,
      wins: 0,
      aboveAvg: 0,
      lifetimeHighs: 0
    };
  });

  machines.forEach(m => {
    const scores = PLAYER_CONFIG.map(p => {
      const d = m[p.id] || { plays: 0, best: 0 };
      return {
        name: p.label,
        plays: d.plays || 0,
        score: d.best || 0
      };
    });

    const winnerObj = scores.reduce(
      (best, cur) => (cur.score > best.score ? cur : best),
      { name: '', score: 0 }
    );
    const winner = winnerObj.score > 0 ? winnerObj.name : '';

    scores.forEach(s => {
      if (s.plays > 0) {
        stats[s.name].machinesPlayed++;
        if (m.avgScore != null && s.score > m.avgScore) {
          stats[s.name].aboveAvg++;
        }
      }
    });

    if (winner && stats[winner]) {
      stats[winner].wins++;
    }

    if (m.highScore != null && m.highScore !== 0) {
      PLAYER_CONFIG.forEach(p => {
        const d = m[p.id] || { best: 0 };
        if (d.best === m.highScore) {
          stats[p.label].lifetimeHighs++;
        }
      });
    }
  });

  return { stats };
}

function loadAllData() {
  const playerPromises = PLAYER_CONFIG.map(p => fetchJson(p.file));
  const machineStatsPromise = fetchJson('data/MachineStats_static.json');

  return Promise.all([...playerPromises, machineStatsPromise])
    .then(results => {
      const machineStats = results[PLAYER_CONFIG.length];
      const playerResults = results.slice(0, PLAYER_CONFIG.length);

      const playerDataById = {};
      PLAYER_CONFIG.forEach((p, idx) => {
        playerDataById[p.id] = playerResults[idx];
      });

      const machines = buildMachineData(playerDataById, machineStats);
      const { stats } = computeStatsFromMachines(machines);
      return { machines, stats };
    });
}

function findMachineByName(machines, name) {
  if (!name) return null;
  return machines.find(
    m => m.machine && m.machine.toLowerCase() === name.toLowerCase()
  );
}

// ===== Page-specific rendering =====

// Machines page (no filters; only machines with plays for selected players)
function renderMachinesPage(machines) {
  const tbody = document.querySelector('#league-table tbody');
  const headerRow = document.getElementById('league-header-row');
  if (!tbody || !headerRow) return;

  const resetBtn = document.getElementById('reset-sort');
  if (resetBtn) {
    resetBtn.onclick = () => window.location.reload();
  }

  const selectedPlayers = getSelectedPlayers();
  const selectedKeys = selectedPlayers.map(playerKeyFromName);

  headerRow.innerHTML = '';

  function createHeaderCell(labelHtml) {
    const th = document.createElement('th');
    th.innerHTML = `<span>${labelHtml}</span><span class="arrow"></span>`;
    return th;
  }

  headerRow.appendChild(createHeaderCell('Machine'));

  selectedPlayers.forEach(name => {
    const labelHtml = `<a href="player.html?player=${encodeURIComponent(name)}">${name}</a>`;
    headerRow.appendChild(createHeaderCell(labelHtml));
  });

  headerRow.appendChild(createHeaderCell('Average Score'));
  headerRow.appendChild(createHeaderCell('High Score'));

  tbody.innerHTML = '';
  const trophy = ' 🏆';

  machines.forEach(m => {
    const totalPlays = selectedKeys.reduce((sum, key) => {
      return sum + (m[key]?.plays || 0);
    }, 0);

    // Only show machines where at least one selected player has played
    if (totalPlays === 0) return;

    const scoresForSelected = selectedPlayers.map(name => {
      const key = playerKeyFromName(name);
      const best = m[key]?.best || 0;
      return { name, key, best };
    });

    const winnerObj = scoresForSelected.reduce(
      (best, cur) => (cur.best > best.best ? cur : best),
      { name: '', key: '', best: 0 }
    );
    const winnerName = winnerObj.best > 0 ? winnerObj.name : '';

    const tr = document.createElement('tr');
    let html = '';

    html += `
      <td>
        <a href="machine.html?machine=${encodeURIComponent(m.machine)}">
          ${m.machine}
        </a>
      </td>
    `;

    scoresForSelected.forEach(p => {
      const showTrophy = (p.name === winnerName && p.best > 0) ? trophy : '';
      html += `<td>${p.best ? fmtNumber(p.best) : ''}${showTrophy}</td>`;
    });

    html += `
      <td>${m.avgScore != null ? fmtNumber(m.avgScore) : ''}</td>
      <td>${m.highScore != null ? fmtNumber(m.highScore) : ''}</td>
    `;

    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  const numericCols = [];
  const totalNumeric = selectedPlayers.length + 2;
  for (let i = 0; i < totalNumeric; i++) numericCols.push(i + 1);

  makeTableSortable('league-table', numericCols);
}

// Multi-metric leaderboard chart: Wins, Above Avg, Machines Played
function renderLeaderboardChart(containerId, selectedPlayers, winsMap, contestedMap, stats) {
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

// Leaderboard page – dynamic Wins & Win% based on selected players
function renderOverallPage(machines, stats) {
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

  selectedPlayers.forEach(name => {
    const s = stats[name];
    if (!s) return;

    const machinesPlayed = s.machinesPlayed;
    const wins = winsMap[name] || 0;
    const contested = contestedMap[name] || 0;
    const winPct = contested > 0 ? ((wins / contested) * 100).toFixed(1) + '%' : '0%';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="player.html?player=${encodeURIComponent(name)}">
          ${name}
        </a>
      </td>
      <td>${machinesPlayed}</td>
      <td>${wins}</td>
      <td>${winPct}</td>
      <td>${s.aboveAvg}</td>
      <td>${s.lifetimeHighs}</td>
    `;
    tbody.appendChild(tr);
  });

  makeTableSortable('overall-table', [1, 2, 3, 4, 5], { index: 1, direction: 'desc' });

  renderLeaderboardChart('leaderboard-chart', selectedPlayers, winsMap, contestedMap, stats);
}

// Head-to-Head – dynamic pairs based on selected players
function renderH2HPage(machines) {
  const table = document.getElementById('h2h-table');
  const tbody = table ? table.querySelector('tbody') : null;
  if (!tbody) return;

  const selectedPlayers = getSelectedPlayers();
  tbody.innerHTML = '';

  const headerCount = table.querySelectorAll('thead th').length || 2;

  const pairs = [];
  for (let i = 0; i < selectedPlayers.length; i++) {
    for (let j = i + 1; j < selectedPlayers.length; j++) {
      pairs.push([selectedPlayers[i], selectedPlayers[j]]);
    }
  }

  if (pairs.length === 0) {
    const colSpan = headerCount > 0 ? headerCount : 2;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}">
          Select at least two players in Settings to see head-to-head stats.
        </td>
      </tr>`;
    return;
  }

  pairs.forEach(([aName, bName]) => {
    const aKey = playerKeyFromName(aName);
    const bKey = playerKeyFromName(bName);

    let aWins = 0;
    let bWins = 0;
    let contested = 0;

    machines.forEach(m => {
      const aData = m[aKey];
      const bData = m[bKey];
      if (!aData || !bData) return;
      if (aData.plays > 0 && bData.plays > 0) {
        contested++;
        const aBest = aData.best || 0;
        const bBest = bData.best || 0;
        if (aBest > bBest) aWins++;
        else if (bBest > aBest) bWins++;
      }
    });

    const winPct =
      contested > 0 ? ((aWins / contested) * 100).toFixed(1) + '%' : '0%';

    const tr = document.createElement('tr');

    if (headerCount >= 4) {
      tr.innerHTML = `
        <td>${aName} vs ${bName}</td>
        <td>${aWins}–${bWins}</td>
        <td>${contested}</td>
        <td>${winPct}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${aName} vs ${bName}</td>
        <td>${aWins}–${bWins}</td>
      `;
    }

    if (aWins > bWins) {
      tr.classList.add('h2h-ahead-a');
    } else if (bWins > aWins) {
      tr.classList.add('h2h-ahead-b');
    }

    tbody.appendChild(tr);
  });

  if (headerCount >= 4) {
    makeTableSortable('h2h-table', [1, 2, 3], { index: 2, direction: 'desc' });
  } else {
    makeTableSortable('h2h-table', [1], { index: 1, direction: 'desc' });
  }
}

// Machine detail page
function renderMachineDetailPage(machines) {
  const container = document.getElementById('machine-detail');
  if (!container) return;

  const machineParam = getQueryParam('machine');
  if (!machineParam) {
    container.innerHTML = `<p>No machine specified in the URL.</p>`;
    return;
  }

  const m = findMachineByName(machines, machineParam);
  if (!m) {
    container.innerHTML = `<p>Machine "<strong>${machineParam}</strong>" not found.</p>`;
    return;
  }

  const highScore = m.highScore || 0;
  const avgScore = m.avgScore;
  const appearances = m.appearances || 0;
  const totalPlays = m.machinePlays || 0;

  const players = PLAYER_CONFIG.map(p => ({
    name: p.label,
    stats: m[p.id] || { plays: 0, best: 0 }
  }));

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

    return `
      <tr>
        <td>${p.name}</td>
        <td>${plays}</td>
        <td>${best ? fmtNumber(best) : ''}${isLifetimeHigh ? trophy : ''}</td>
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

// Player profile page
function renderPlayerProfilePage(machines, stats) {
  const container = document.getElementById('player-profile');
  if (!container) return;

  const playerParam = getQueryParam('player') || '';
  const playerName = ALL_PLAYERS.find(
    p => p.toLowerCase() === playerParam.toLowerCase()
  );

  if (!playerName) {
    container.innerHTML = `
      <p>No or unknown player specified.</p>
      <p>Try one of:</p>
      <ul>
        ${ALL_PLAYERS.map(p => `<li><a href="player.html?player=${encodeURIComponent(p)}">${p}</a></li>`).join('')}
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
          <strong>Lifetime Highs</strong>
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

// Settings page (player selection)
function initPlayerSelectionPage() {
  const listEl = document.getElementById('players-list');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusEl = document.getElementById('status');

  if (!listEl || !saveBtn || !resetBtn || !statusEl) return;

  const current = getSelectedPlayers();

  ALL_PLAYERS.forEach(name => {
    const id = `player-${name.toLowerCase()}`;
    const label = document.createElement('label');
    label.setAttribute('for', id);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = name;
    if (current.includes(name)) cb.checked = true;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + name));
    listEl.appendChild(label);
  });

  function getCheckedPlayers() {
    const boxes = listEl.querySelectorAll('input[type="checkbox"]');
    const selected = [];
    boxes.forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });
    return selected;
  }

  function showStatus(msg) {
    statusEl.textContent = msg;
  }

  saveBtn.addEventListener('click', () => {
    let selected = getCheckedPlayers();

    if (selected.length === 0) {
      selected = [...DEFAULT_PLAYERS];
      showStatus('No players selected – reverted to default (Craig, Luke, Paul).');
    } else {
      showStatus('Selection saved. Reload the Machines or Leaderboard pages to see the change.');
    }

    const stored = setSelectedPlayers(selected);
    const boxes = listEl.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(cb => {
      cb.checked = stored.includes(cb.value);
    });

    renderSelectedPlayersSummary();
  });

  resetBtn.addEventListener('click', () => {
    const stored = setSelectedPlayers([...DEFAULT_PLAYERS]);
    const boxes = listEl.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(cb => {
      cb.checked = stored.includes(cb.value);
    });
    showStatus('Reset to default players: Craig, Luke, Paul.');
    renderSelectedPlayersSummary();
  });
}

// ===== Bootstrapping =====
document.addEventListener('DOMContentLoaded', () => {
  const hasLeague = document.getElementById('league-table');
  const hasOverall = document.getElementById('overall-table');
  const hasH2H = document.getElementById('h2h-table');
  const hasMachine = document.getElementById('machine-detail');
  const hasProfile = document.getElementById('player-profile');
  const hasSelector = document.getElementById('players-list');

  // Load player config first
  fetchJson('data/players.json')
    .then(players => {
      PLAYER_CONFIG = players;
      ALL_PLAYERS = PLAYER_CONFIG.map(p => p.label);
      // Default to first 3, or all if fewer than 3
      DEFAULT_PLAYERS = ALL_PLAYERS.slice(0, 3);
      if (DEFAULT_PLAYERS.length === 0) DEFAULT_PLAYERS = ALL_PLAYERS;

      renderSelectedPlayersSummary();
      renderLastUpdated();

      if (hasSelector) {
        initPlayerSelectionPage();
      }

      if (hasLeague || hasOverall || hasH2H || hasMachine || hasProfile) {
        return loadAllData()
          .then(({ machines, stats }) => {
            if (hasLeague) renderMachinesPage(machines);
            if (hasOverall) renderOverallPage(machines, stats);
            if (hasH2H) renderH2HPage(machines);
            if (hasMachine) renderMachineDetailPage(machines);
            if (hasProfile) renderPlayerProfilePage(machines, stats);
          });
      }
    })
    .catch(err => {
      console.error('Error initializing app:', err);
      // Fallback or user notification could go here
      const main = document.querySelector('main');
      if (main) main.innerHTML = '<p class="error">Failed to load player configuration. Please try again later.</p>';
    });
});
