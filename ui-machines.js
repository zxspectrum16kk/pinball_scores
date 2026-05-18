// ui-machines.js
// Machines scorecard page

import { fmtNumber, playerKeyFromName, makeTableSortable, getScoreClass } from './utils.js';
import { getSelectedPlayers } from './data.js';

export function renderMachinesPage(machines) {
  const tbody = document.querySelector('#league-table tbody');
  const headerRow = document.getElementById('league-header-row');
  const searchInput = document.getElementById('machine-filter');
  const resetBtn = document.getElementById('reset-sort');
  const showUnplayedCheckbox = document.getElementById('show-unplayed');

  if (!tbody || !headerRow) return;

  const selectedPlayers = getSelectedPlayers();
  const selectedKeys = selectedPlayers.map(playerKeyFromName);

  // Setup Header
  headerRow.innerHTML = '';
  function createHeaderCell(labelHtml, title = '') {
    const th = document.createElement('th');
    th.innerHTML = `<span>${labelHtml}</span><span class="arrow"></span>`;
    if (title) th.title = title;
    return th;
  }

  headerRow.appendChild(createHeaderCell('Machine', 'Machine name — click to view detail'));
  selectedPlayers.forEach(name => {
    const labelHtml = `<a href="index.html?player=${encodeURIComponent(name)}">${name}</a>`;
    headerRow.appendChild(createHeaderCell(labelHtml, `${name} — best score on this machine`));
  });
  headerRow.appendChild(createHeaderCell('Avg Score', 'Average Score — mean score across all recorded plays'));
  headerRow.appendChild(createHeaderCell('High Score', 'High Score — best score ever recorded on this machine'));
  headerRow.appendChild(createHeaderCell('Apps', 'Appearances — number of league nights this machine has featured'));

  function getFiltered() {
    const term = searchInput?.value.toLowerCase() || '';
    return term ? machines.filter(m => m.machine.toLowerCase().includes(term)) : machines;
  }

  function renderTableBody(machinesToRender) {
    tbody.innerHTML = '';
    const showUnplayed = showUnplayedCheckbox?.checked || false;
    const trophy = ' 🏆';

    machinesToRender.forEach(m => {
      const totalPlays = selectedKeys.reduce((sum, key) => sum + (m[key]?.plays || 0), 0);
      if (!showUnplayed && totalPlays === 0) return;

      const scoresForSelected = selectedPlayers.map(name => {
        const key = playerKeyFromName(name);
        return { name, key, best: m[key]?.best || 0, plays: m[key]?.plays || 0 };
      });

      const winnerObj = scoresForSelected.reduce(
        (best, cur) => (cur.best > best.best ? cur : best),
        { name: '', key: '', best: 0 }
      );
      const winnerName = winnerObj.best > 0 ? winnerObj.name : '';

      const tr = document.createElement('tr');
      if (totalPlays === 0) tr.classList.add('unplayed-row');

      let html = `
        <td title="${m.machine}">
          <a href="machine.html?machine=${encodeURIComponent(m.machine)}">
            ${m.machine}
          </a>
        </td>
      `;

      scoresForSelected.forEach(p => {
        const isWinner = p.name === winnerName && p.best > 0;
        const cls = getScoreClass(p.best, m.avgScore, m.highScore);
        const classes = [cls, isWinner ? 'winner-cell' : ''].filter(Boolean).join(' ');
        const scoreAttr = classes ? `class="${classes}"` : '';
        const showTrophy = isWinner ? trophy : '';
        const playsHtml = p.plays > 0
          ? `<small class="plays-count">${p.plays} play${p.plays !== 1 ? 's' : ''}</small>`
          : '';
        html += `<td ${scoreAttr}>${p.best ? fmtNumber(p.best) : ''}${showTrophy}${playsHtml}</td>`;
      });

      html += `
        <td>${m.avgScore != null ? fmtNumber(m.avgScore) : ''}</td>
        <td>${m.highScore != null ? fmtNumber(m.highScore) : ''}</td>
        <td>${m.appearances || ''}</td>
      `;

      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => renderTableBody(getFiltered()));
  }

  if (showUnplayedCheckbox) {
    showUnplayedCheckbox.addEventListener('change', () => renderTableBody(getFiltered()));
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (searchInput) searchInput.value = '';
      if (showUnplayedCheckbox) showUnplayedCheckbox.checked = false;
      renderTableBody(machines);
      headerRow.querySelectorAll('th').forEach(th => {
        delete th.dataset.sortDir;
        th.removeAttribute('aria-sort');
        const arrow = th.querySelector('.arrow');
        if (arrow) arrow.textContent = '';
      });
    };
  }

  renderTableBody(machines);

  const numericCols = [];
  for (let i = 1; i <= selectedPlayers.length + 3; i++) numericCols.push(i);
  makeTableSortable('league-table', numericCols);
}
