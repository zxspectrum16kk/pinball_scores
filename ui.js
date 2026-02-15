// ui.js
// Global UI helpers shared across all pages

import { getSelectedPlayers, DATA_LAST_UPDATED } from './data.js';

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
