// stats.js
// Statistical calculations and Data Transformation

import { getNumericField, getMachineName } from './utils.js';
import { PLAYER_CONFIG, ALL_PLAYERS } from './data.js';

// ===== Data building / stats =====
function createEmptyPlayerStats() {
    const base = {};
    PLAYER_CONFIG.forEach(p => {
        base[p.id] = { plays: 0, best: 0 };
    });
    return base;
}

export function createEmptyMachine(name, ms = {}) {
    let highPlayer = '';
    // find the "High Player" field
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

export function buildMachineData(playerDataById, machineStats) {
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

export function computeStatsFromMachines(machines, selectedPlayers = null) {
    const stats = {};
    ALL_PLAYERS.forEach(name => {
        stats[name] = {
            machinesPlayed: 0,
            wins: 0,
            aboveAvg: 0,
            lifetimeHighs: 0,
            totalPerfPercent: 0,
            perfCount: 0,
            avgPer: 0
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

        // Determine winner relative to SELECTED players (or all if none specified)
        let activeScores = scores;
        if (selectedPlayers && selectedPlayers.length > 0) {
            activeScores = scores.filter(s => selectedPlayers.includes(s.name));
        }

        // Refined Logic based on User Request:
        // A "Group Win" only counts if at least one other player in the group has played it.
        // So we need count of players with plays > 0 to be >= 2.
        const playersWithScores = activeScores.filter(s => s.plays > 0 && s.score > 0).length;

        let winner = '';
        if (playersWithScores >= 2) {
            const winnerObj = activeScores.reduce(
                (best, cur) => (cur.score > best.score ? cur : best),
                { name: '', score: 0 }
            );
            winner = winnerObj.score > 0 ? winnerObj.name : '';
        }

        scores.forEach(s => {
            if (s.plays > 0) {
                stats[s.name].machinesPlayed++;
                if (m.avgScore != null && s.score > m.avgScore) {
                    stats[s.name].aboveAvg++;
                }

                // Calculate performance % vs high score
                if (m.highScore > 0) {
                    const pct = (s.score / m.highScore) * 100;
                    stats[s.name].totalPerfPercent += pct;
                    stats[s.name].perfCount++;
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

    // Calculate final Average Performance %
    Object.values(stats).forEach(s => {
        if (s.perfCount > 0) {
            s.avgPer = (s.totalPerfPercent / s.perfCount).toFixed(1) + '%';
        } else {
            s.avgPer = '0%';
        }
    });

    return { stats };
}
