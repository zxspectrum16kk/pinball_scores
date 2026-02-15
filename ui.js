// ui.js
// DOM manipulation and Rendering

import {
  fmtNumber,
  playerKeyFromName,
  makeTableSortable,
  findMachineByName
} from './utils.js';

import {
  getSelectedPlayers,
  setSelectedPlayers,
  getCustomMachineSelection,
  setCustomMachineSelection,
  ALL_PLAYERS,
  DEFAULT_PLAYERS,
  DATA_LAST_UPDATED
} from './data.js';


// Global selected-players summary
export function renderSelectedPlayersSummary() {
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
export function renderLastUpdated() {
  const els = document.querySelectorAll('.data-last-updated');
  els.forEach(el => {
    el.textContent = DATA_LAST_UPDATED;
  });
}

export function renderDataWarning(failedPlayers) {
  const main = document.querySelector('main');
  if (!main) return;
  const banner = document.createElement('p');
  banner.className = 'error';
  banner.textContent = `Could not load data for: ${failedPlayers.join(', ')}. Their scores will be missing.`;
  main.insertBefore(banner, main.firstChild);
}


// ===== Page-specific rendering =====

// Machines page (no filters; only machines with plays for selected players)
// Machines page (no filters; only machines with plays for selected players)
export function renderMachinesPage(machines) {
  const tbody = document.querySelector('#league-table tbody');
  const headerRow = document.getElementById('league-header-row');
  const searchInput = document.getElementById('machine-filter');
  const resetBtn = document.getElementById('reset-sort');

  if (!tbody || !headerRow) return;

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (searchInput) searchInput.value = '';
      renderTableBody(machines);
      // clear sort indicators
      headerRow.querySelectorAll('th').forEach(th => {
        delete th.dataset.sortDir;
        th.removeAttribute('aria-sort');
        const arrow = th.querySelector('.arrow');
        if (arrow) arrow.textContent = '';
      });
    };
  }

  const selectedPlayers = getSelectedPlayers();
  const selectedKeys = selectedPlayers.map(playerKeyFromName);

  // Setup Header
  headerRow.innerHTML = '';
  function createHeaderCell(labelHtml) {
    const th = document.createElement('th');
    th.innerHTML = `<span>${labelHtml}</span><span class="arrow"></span>`;
    return th;
  }

  headerRow.appendChild(createHeaderCell('Machine'));
  selectedPlayers.forEach(name => {
    const labelHtml = `<a href="index.html?player=${encodeURIComponent(name)}">${name}</a>`;
    headerRow.appendChild(createHeaderCell(labelHtml));
  });
  headerRow.appendChild(createHeaderCell('Average Score'));
  headerRow.appendChild(createHeaderCell('High Score'));

  // Setup Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = machines.filter(m => m.machine.toLowerCase().includes(term));
      renderTableBody(filtered);
    });
  }

  // Render Table Logic
  function renderTableBody(machinesToRender) {
    tbody.innerHTML = '';
    const trophy = ' 🏆';

    machinesToRender.forEach(m => {
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
        let scoreClass = '';
        if (m.highScore && p.best) {
          if (p.best >= m.highScore) scoreClass = 'class="text-success"';
          else if (m.avgScore && p.best >= m.avgScore) scoreClass = 'class="text-warning"';
        }
        html += `<td ${scoreClass}>${p.best ? fmtNumber(p.best) : ''}${showTrophy}</td>`;
      });

      html += `
        <td>${m.avgScore != null ? fmtNumber(m.avgScore) : ''}</td>
        <td>${m.highScore != null ? fmtNumber(m.highScore) : ''}</td>
      `;

      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  // Initial Render
  renderTableBody(machines);

  const numericCols = [];
  const totalNumeric = selectedPlayers.length + 2;
  for (let i = 0; i < totalNumeric; i++) numericCols.push(i + 1);

  makeTableSortable('league-table', numericCols);
}

// Multi-metric leaderboard chart: Wins, Above Avg, Machines Played
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

// Leaderboard page – dynamic Wins & Win% based on selected players
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

  // Calculate max values for highlighting
  let maxMachines = 0;
  let maxWins = 0;
  let maxWinPct = 0;
  let maxAvgPer = 0;
  let maxAbove = 0;
  let maxHighs = 0;

  selectedPlayers.forEach(name => {
    const s = stats[name];
    if (!s) return;

    // Parse numeric values for comparison
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

// Machine detail page
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

    // Filter by SELECTED players only
    const selectedPlayers = getSelectedPlayers();

    // Build stats for selected players
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

      let scoreClass = '';
      if (highScore && best) {
        if (best >= highScore) scoreClass = 'class="text-success"';
        else if (avgScore && best >= avgScore) scoreClass = 'class="text-warning"';
      }

      return `
        <tr>
          <td>${p.name}</td>
          <td>${plays}</td>
          <td ${scoreClass}>${best ? fmtNumber(best) : ''}${isLifetimeHigh ? trophy : ''}</td>
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


// Custom List Page
export function renderCustomListPage(machines, stats) {
  const container = document.getElementById('machine-selector');
  const tableBody = document.querySelector('#custom-table tbody');
  const summaryEl = document.getElementById('selection-summary');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnSave = document.getElementById('btn-save');
  const searchInput = document.getElementById('machine-filter');

  if (!container || !tableBody) return;

  let currentSelection = getCustomMachineSelection();

  // 1. Render Selector
  const allMachineNames = machines.map(m => m.machine).sort((a, b) => a.localeCompare(b));

  function renderCheckboxes(filterText = '') {
    container.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();

    allMachineNames.forEach(name => {
      if (!name) return;
      if (filterText && !name.toLowerCase().includes(lowerFilter)) return;

      const div = document.createElement('div');
      div.className = 'check-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `chk-${name}`;
      checkbox.value = name;
      checkbox.checked = currentSelection.includes(name);

      if (checkbox.checked) {
        div.classList.add('selected');
      }

      // Toggle class on checking
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) div.classList.add('selected');
        else div.classList.remove('selected');
      });

      // Allow clicking the row to toggle
      div.addEventListener('click', (e) => {
        if (e.target !== checkbox && e.target.tagName !== 'LABEL') {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });

      const label = document.createElement('label');
      label.htmlFor = `chk-${name}`;
      label.textContent = name;
      label.style.marginLeft = '8px';

      div.appendChild(checkbox);
      div.appendChild(label);
      container.appendChild(div);
    });
  }

  renderCheckboxes();

  // Search filter
  searchInput.addEventListener('input', (e) => {
    // Preserve checking state (though UI is rebuilt, logic below uses live DOM if we were complex,
    // but here we might lose unsaved checks if we re-render.
    // Better approach: Hide/Show instead of re-render to preserve state.
    const term = e.target.value.toLowerCase();
    const items = container.querySelectorAll('.check-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.classList.toggle('hidden', !text.includes(term));
    });
  });

  // Select/Deselect All
  btnSelectAll.onclick = () => {
    container.querySelectorAll('input[type="checkbox"]').forEach(c => {
      if (!c.closest('.check-item').classList.contains('hidden')) {
        c.checked = true;
        c.closest('.check-item').classList.add('selected');
      }
    });
  };

  btnDeselectAll.onclick = () => {
    container.querySelectorAll('input[type="checkbox"]').forEach(c => {
      if (!c.closest('.check-item').classList.contains('hidden')) {
        c.checked = false;
        c.closest('.check-item').classList.remove('selected');
      }
    });
  };

  // Save & View
  btnSave.onclick = () => {
    const checked = [];
    container.querySelectorAll('input[type="checkbox"]').forEach(c => {
      if (c.checked) checked.push(c.value);
    });
    currentSelection = checked;
    setCustomMachineSelection(currentSelection);
    // Fix: renderTable is undefined if we don't define it outside or hoist it.
    // Call the inner function? No, need to restructure.
    // Calling renderTable here is tricky if it's defined below.
    // JS hoisting for functions works, but let's be safe.
    renderTable();
  };

  // 2. Render Table
  function renderTable() {
    tableBody.innerHTML = '';
    const headerRow = document.getElementById('custom-header-row');

    if (currentSelection.length === 0) {
      summaryEl.textContent = 'No machines selected.';
      return;
    }

    summaryEl.textContent = `Showing ${currentSelection.length} machine(s).`;

    const selectedPlayers = getSelectedPlayers();

    // Update Header
    if (headerRow) {
      // Keep first 3 static columns
      headerRow.innerHTML = `
        <th>Machine</th>
        <th>Avg Score</th>
        <th>High Score</th>
      `;
      selectedPlayers.forEach(p => {
        const th = document.createElement('th');
        th.innerHTML = `<a href="index.html?player=${encodeURIComponent(p)}">${p}</a>`;
        headerRow.appendChild(th);
      });
    }

    // Sort selection alphabetically for table
    const sortedSelection = [...currentSelection].sort((a, b) => a.localeCompare(b));

    sortedSelection.forEach(machineName => {
      const m = findMachineByName(machines, machineName);
      if (!m) return;

      const avgScore = m.avgScore;
      const highScore = m.highScore;

      // Find best score among SELECTED players
      let teamBest = 0;
      selectedPlayers.forEach(pName => {
        const key = playerKeyFromName(pName);
        const pBest = m[key]?.best || 0;
        if (pBest > teamBest) teamBest = pBest;
      });

      const tr = document.createElement('tr');
      let html = `
        <td><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></td>
        <td>${avgScore ? fmtNumber(avgScore) : '-'}</td>
        <td>${highScore ? fmtNumber(highScore) : '-'}</td>
      `;

      // Add player columns
      selectedPlayers.forEach(pName => {
        const key = playerKeyFromName(pName);
        const best = m[key]?.best || 0;
        const trophy = ' <span class="trophy-icon">🏆</span>';
        // Show trophy if this player has the best score among the selected group
        const isTeamBest = teamBest > 0 && best === teamBest;

        let scoreClass = '';
        if (highScore && best) {
          if (best >= highScore) scoreClass = 'class="text-success"';
          else if (avgScore && best >= avgScore) scoreClass = 'class="text-warning"';
        }

        html += `<td ${scoreClass}>${best ? fmtNumber(best) : '-'}${isTeamBest ? trophy : ''}</td>`;
      });

      tr.innerHTML = html;
      tableBody.appendChild(tr);
    });

    // Make sortable (dynamic columns)
    const numericCols = [1, 2]; // Avg, High
    // Add player columns (indices 3, 4, ...)
    selectedPlayers.forEach((_, i) => numericCols.push(3 + i));

    makeTableSortable('custom-table', numericCols);
  }

  // Initial render of table
  renderTable();
}

// Player profile page
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
export function initPlayerSelectionPage() {
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
