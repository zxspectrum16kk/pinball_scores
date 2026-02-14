// main.js
// Application Entry Point

import {
    fetchJson,
    PLAYER_CONFIG,
    ALL_PLAYERS,
    DEFAULT_PLAYERS,
    setPlayerConfig,
    setAllPlayers,
    setDefaultPlayers
} from './data.js';

import {
    buildMachineData,
    computeStatsFromMachines
} from './stats.js';

import {
    renderSelectedPlayersSummary,
    renderLastUpdated,
    initPlayerSelectionPage,
    renderMachinesPage,
    renderOverallPage,
    renderMachineDetailPage,
    renderPlayerProfilePage,

    renderCustomListPage
} from './ui.js';

import {
    renderPlayerHeatmapPage
} from './ui-heatmap.js';


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
        .then(players => {
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
                    .then(({ machines, stats }) => {
                        if (hasLeague) renderMachinesPage(machines);
                        if (hasOverall) renderOverallPage(machines, stats);
                        if (hasMachine) renderMachineDetailPage(machines);
                        if (hasProfile) renderPlayerProfilePage(machines, stats);
                        if (hasProfile) renderPlayerProfilePage(machines, stats);
                        if (hasCustomList) renderCustomListPage(machines, stats);
                        if (hasHeatmap) renderPlayerHeatmapPage(machines, stats);

                        // DEBUG: Inspect data quality
                        console.log('DEBUG: Machines loaded:', machines.length);
                        if (machines.length > 0) {
                            console.log('DEBUG: First machine:', machines[0]);
                        }
                        console.log('DEBUG: Stats computed:', stats);
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
