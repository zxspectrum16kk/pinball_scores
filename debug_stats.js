
const fs = require('fs');
const path = require('path');

// Mock utils.js because we are running in node
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

const PLAYER_CONFIG = [
    { id: 'luke', label: 'Luke' } // Minimal config for testing
];
const ALL_PLAYERS = ['Luke'];

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

    const base = {
        machine: name,
        no: ms.No ?? ms.no ?? null,
        appearances: getNumericField(ms, ['apper', 'appear'], 0),
        machinePlays: getNumericField(ms, ['play'], 0),
        avgScore: getNumericField(ms, ['average'], null), // Expecting this to be populated
        highScore: getNumericField(ms, ['high'], null),   // Expecting this to be populated
        highPlayer
    };

    return Object.assign(base, createEmptyPlayerStats());
}

function buildMachineData(playerDataById, machineStats) {
    const machineMap = new Map();

    machineStats.forEach(ms => {
        const name = getMachineName(ms);
        if (!name) return;
        machineMap.set(name, createEmptyMachine(name, ms));
    });

    PLAYER_CONFIG.forEach(p => {
        const data = playerDataById[p.id] || [];
        data.forEach(row => {
            const name = getMachineName(row);
            if (!name) return;

            let m = machineMap.get(name);
            if (!m) {
                // If machine not in stats, create it (this might be where avgScore is lost if machine names mismatch)
                m = createEmptyMachine(name);
                machineMap.set(name, m);
            }

            m[p.id].plays = getNumericField(row, ['play'], 0);
            m[p.id].best = getNumericField(row, ['best', 'high'], 0);
        });
    });

    return Array.from(machineMap.values());
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

        scores.forEach(s => {
            if (s.plays > 0) {
                stats[s.name].machinesPlayed++;

                // DEBUG
                if (s.name === 'Luke' && s.score > 0) {
                    // console.log(`DEBUG Check: ${m.machine} | Player Best: ${s.score} | Avg: ${m.avgScore} | High: ${m.highScore}`);
                }

                if (m.avgScore != null && s.score > m.avgScore) {
                    stats[s.name].aboveAvg++;
                } else {
                    // console.log(`Failed Avg: ${m.machine} Score: ${s.score} Avg: ${m.avgScore}`);
                }
            }
        });

        if (m.highScore != null && m.highScore !== 0) {
            PLAYER_CONFIG.forEach(p => {
                const d = m[p.id] || { best: 0 };
                if (d.best === m.highScore) {
                    stats[p.label].lifetimeHighs++;
                } else if (p.label === 'Luke' && d.best > 0) {
                    // console.log(`Failed High: ${m.machine} Best: ${d.best} High: ${m.highScore}`);
                }
            });
        }
    });

    return { stats };
}

// MAIN EXECUTION
try {
    const machineStatsRaw = fs.readFileSync('c:/pinball_scores/data/MachineStats_static.json', 'utf8');
    const machineStats = JSON.parse(machineStatsRaw);

    const lukeRaw = fs.readFileSync('c:/pinball_scores/data/Luke_static.json', 'utf8');
    const lukeData = JSON.parse(lukeRaw);

    const playerDataById = {
        'luke': lukeData
    };

    console.log('Building machine data...');
    const machines = buildMachineData(playerDataById, machineStats);

    console.log('Computing stats...');
    const result = computeStatsFromMachines(machines);

    console.log('Resulting Stats for Luke:', result.stats['Luke']);

    // Inspect a specific machine to see if avgScore is present
    const tz = machines.find(m => m.machine === 'Twilight Zone');
    console.log('Twilight Zone Data:', JSON.stringify(tz, null, 2));

} catch (err) {
    console.error(err);
}
