
const fs = require('fs');

console.log('--- START DEBUG ---');

try {
    const msRaw = fs.readFileSync('c:/pinball_scores/data/MachineStats_static.json', 'utf8').replace(/^\uFEFF/, '');
    const msData = JSON.parse(msRaw);
    console.log(`MachineStats loaded. Entries: ${msData.length}`);

    const lukeRaw = fs.readFileSync('c:/pinball_scores/data/Luke_static.json', 'utf8').replace(/^\uFEFF/, '');
    const lukeData = JSON.parse(lukeRaw);
    console.log(`LukeData loaded. Entries: ${lukeData.length}`);

    // Helpers locally defined
    function getMachineName(row) {
        for (const key of Object.keys(row)) {
            const lower = key.toLowerCase();
            if (lower.includes('machine') || lower.includes('game')) {
                const val = row[key];
                if (val && String(val).trim() !== '') return String(val).trim();
            }
        }
        return null;
    }

    function getNumeric(row, pat) {
        for (const key of Object.keys(row)) {
            if (key.toLowerCase().includes(pat)) {
                return Number(row[key]);
            }
        }
        return null;
    }

    // Find Twilight Zone in MachineStats
    const tzStats = msData.find(row => getMachineName(row) === 'Twilight Zone');
    if (!tzStats) {
        console.log('CRITICAL: Twilight Zone NOT FOUND in MachineStats');
    } else {
        console.log('Found TZ in Stats:', JSON.stringify(tzStats));
        console.log('TZ Name:', getMachineName(tzStats));
        console.log('TZ Average:', getNumeric(tzStats, 'average'));
        console.log('TZ High:', getNumeric(tzStats, 'high'));
    }

    // Find Twilight Zone in Luke
    const tzLuke = lukeData.find(row => getMachineName(row) === 'Twilight Zone');
    if (!tzLuke) {
        console.log('CRITICAL: Twilight Zone NOT FOUND in Luke Data');
        // List some names to see what's wrong
        console.log('First 5 Luke Games:', lukeData.slice(0, 5).map(r => getMachineName(r)));
    } else {
        console.log('Found TZ in Luke:', JSON.stringify(tzLuke));
        console.log('TZ Name Luke:', getMachineName(tzLuke));
        console.log('TZ Best Luke:', getNumeric(tzLuke, 'best'));
    }

    if (tzStats && tzLuke) {
        const name1 = getMachineName(tzStats);
        const name2 = getMachineName(tzLuke);
        console.log(`Comparing names: '${name1}' vs '${name2}'`);
        console.log(`Match? ${name1 === name2}`);

        const avg = getNumeric(tzStats, 'average');
        const score = getNumeric(tzLuke, 'best');
        console.log(`Score > Avg? ${score} > ${avg} = ${score > avg}`);
    }

} catch (e) {
    console.error('ERROR:', e.message);
}

console.log('--- END DEBUG ---');
