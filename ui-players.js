// ui-players.js
// Settings page — player selection

import { getSelectedPlayers, setSelectedPlayers, ALL_PLAYERS, DEFAULT_PLAYERS } from './data.js';
import { renderSelectedPlayersSummary } from './ui.js';

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
