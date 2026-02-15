// ui-machines.js
// Machines scorecard page

import { fmtNumber, playerKeyFromName, makeTableSortable, getScoreClass } from './utils.js';
import { getSelectedPlayers } from './data.js';

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
        const cls = getScoreClass(p.best, m.avgScore, m.highScore);
        const scoreAttr = cls ? `class="${cls}"` : '';
        html += `<td ${scoreAttr}>${p.best ? fmtNumber(p.best) : ''}${showTrophy}</td>`;
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
