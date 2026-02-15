// ui-custom-list.js
// Custom machine selection page

import { fmtNumber, playerKeyFromName, makeTableSortable, findMachineByName, getScoreClass } from './utils.js';
import { getSelectedPlayers, getCustomMachineSelection, setCustomMachineSelection } from './data.js';

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

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) div.classList.add('selected');
        else div.classList.remove('selected');
      });

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
    const term = e.target.value.toLowerCase();
    const items = container.querySelectorAll('.check-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.classList.toggle('hidden', !text.includes(term));
    });
  });

  // Select/Deselect All (respects filter)
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

    if (headerRow) {
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

    const sortedSelection = [...currentSelection].sort((a, b) => a.localeCompare(b));

    sortedSelection.forEach(machineName => {
      const m = findMachineByName(machines, machineName);
      if (!m) return;

      const avgScore = m.avgScore;
      const highScore = m.highScore;

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

      selectedPlayers.forEach(pName => {
        const key = playerKeyFromName(pName);
        const best = m[key]?.best || 0;
        const trophy = ' <span class="trophy-icon">🏆</span>';
        const isTeamBest = teamBest > 0 && best === teamBest;

        const cls = getScoreClass(best, avgScore, highScore);
        const scoreAttr = cls ? `class="${cls}"` : '';

        html += `<td ${scoreAttr}>${best ? fmtNumber(best) : '-'}${isTeamBest ? trophy : ''}</td>`;
      });

      tr.innerHTML = html;
      tableBody.appendChild(tr);
    });

    const numericCols = [1, 2];
    selectedPlayers.forEach((_, i) => numericCols.push(3 + i));
    makeTableSortable('custom-table', numericCols);
  }

  // Initial render of table
  renderTable();
}
