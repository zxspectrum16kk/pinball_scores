// main.js
// Application Entry Point

import {
    fetchJson,
    PLAYER_CONFIG,
    ALL_PLAYERS,
    DEFAULT_PLAYERS,
    setPlayerConfig,
    setAllPlayers,
    setDefaultPlayers,
    setDataLastUpdated,
    getSelectedPlayers
} from './data.js';

import {
    buildMachineData,
    computeStatsFromMachines
} from './stats.js';

import { renderSelectedPlayersSummary, renderLastUpdated, renderDataWarning } from './ui.js';
import { renderMachinesPage } from './ui-machines.js';
import { renderOverallPage } from './ui-leaderboard.js';
import { renderMachineDetailPage } from './ui-machine-detail.js';
import { renderCustomListPage } from './ui-custom-list.js';
import { renderPlayerProfilePage } from './ui-player-profile.js';
import { initPlayerSelectionPage } from './ui-players.js';
import { renderPlayerHeatmapPage } from './ui-heatmap.js';


function loadAllData() {
    const playerPromises = PLAYER_CONFIG.map(p => fetchJson(p.file));
    const machineStatsPromise = fetchJson('data/MachineStats_static.json');

    return Promise.allSettled([...playerPromises, machineStatsPromise])
        .then(results => {
            const machineStatsResult = results[PLAYER_CONFIG.length];
            if (machineStatsResult.status === 'rejected') {
                throw new Error('Failed to load machine stats: ' + machineStatsResult.reason);
            }
            const machineStats = machineStatsResult.value;

            const playerDataById = {};
            const failedPlayers = [];
            PLAYER_CONFIG.forEach((p, idx) => {
                const result = results[idx];
                if (result.status === 'fulfilled') {
                    playerDataById[p.id] = result.value;
                } else {
                    failedPlayers.push(p.label);
                    console.warn(`Failed to load data for ${p.label}:`, result.reason);
                }
            });

            const machines = buildMachineData(playerDataById, machineStats);
            const { stats } = computeStatsFromMachines(machines, getSelectedPlayers());
            return { machines, stats, failedPlayers };
        });
}

// ===== Bootstrapping =====
document.addEventListener('DOMContentLoaded', () => {
    const hasLeague = document.getElementById('league-table');
    const hasOverall = document.getElementById('overall-table');
    const hasMachine = document.getElementById('machine-detail');
    const hasProfile = document.getElementById('player-profile');

    const hasSelector = document.getElementById('players-list');
    const hasCustomList = document.getElementById('machine-selector');
    const hasHeatmap = document.getElementById('heatmap-container');

    // Load player config first
    fetchJson('data/players.json')
        .then(config => {
            const players = config.players;
            setDataLastUpdated(config.lastUpdated);
            setPlayerConfig(players);
            const all = players.map(p => p.label);
            setAllPlayers(all);

            // Default to first 3, or all if fewer than 3
            let defaults = all.slice(0, 3);
            if (defaults.length === 0) defaults = all;
            setDefaultPlayers(defaults);

            renderSelectedPlayersSummary();
            renderLastUpdated();

            if (hasSelector) {
                initPlayerSelectionPage();
            }

            if (hasLeague || hasOverall || hasMachine || hasProfile || hasCustomList || hasHeatmap) {
                return loadAllData()
                    .then(({ machines, stats, failedPlayers }) => {
                        if (failedPlayers.length > 0) renderDataWarning(failedPlayers);
                        if (hasLeague) renderMachinesPage(machines);
                        if (hasOverall) renderOverallPage(machines, stats);
                        if (hasMachine) renderMachineDetailPage(machines);
                        if (hasProfile) renderPlayerProfilePage(machines, stats);
                        if (hasCustomList) renderCustomListPage(machines, stats);
                        if (hasHeatmap) renderPlayerHeatmapPage(machines, stats);
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
