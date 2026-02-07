// admin.js

const API_BASE = '/api';

const els = {
    playerName: document.getElementById('new-player-name'),
    playerId: document.getElementById('new-player-id'),
    btnAddPlayer: document.getElementById('btn-add-player'),
    playerTableBody: document.querySelector('#admin-player-table tbody'),
    scrapePlayerList: document.getElementById('scrape-player-list'),
    scrapeMachines: document.getElementById('scrape-machines'),
    btnScrapeAll: document.getElementById('btn-scrape-all'),
    btnScrapeSelected: document.getElementById('btn-scrape-selected'),
    scrapeStatus: document.getElementById('scrape-status'),
    stagedTableBody: document.querySelector('#staged-files-table tbody'),
    btnPublish: document.getElementById('btn-publish')
};

async function loadPlayers() {
    try {
        const res = await fetch(`${API_BASE}/players`);
        if (!res.ok) throw new Error("API not reachable");
        const players = await res.json();
        renderPlayers(players);
        renderScrapeList(players);
    } catch (err) {
        console.error("Failed to load players", err);
        // Show error in table?
    }
}

function renderPlayers(players) {
    els.playerTableBody.innerHTML = '';
    players.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.Name}</td>
            <td>${p.ID}</td>
            <td><button class="btn-delete" data-id="${p.ID}" style="padding: 4px 8px; background: #ffcccc; color: #cc0000;">Remove</button></td>
        `;
        els.playerTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => removePlayer(e.target.dataset.id));
    });
}

function renderScrapeList(players) {
    els.scrapePlayerList.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'check-item';
        div.innerHTML = `
            <input type="checkbox" name="scrape-target" value="${p.ID}" id="scrape-${p.ID}">
            <label for="scrape-${p.ID}">${p.Name}</label>
        `;
        els.scrapePlayerList.appendChild(div);
    });
}

async function addPlayer() {
    const name = els.playerName.value.trim();
    const id = els.playerId.value.trim();
    if (!name || !id) return alert("Name and ID required");

    try {
        await fetch(`${API_BASE}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, id })
        });
        els.playerName.value = '';
        els.playerId.value = '';
        loadPlayers();
    } catch (err) {
        alert("Failed to add player: " + err.message);
    }
}

async function removePlayer(id) {
    if (!confirm("Are you sure?")) return;
    try {
        await fetch(`${API_BASE}/players`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        loadPlayers();
    } catch (err) {
        alert("Failed to remove player");
    }
}

async function runScrape(targets) {
    els.scrapeStatus.style.display = 'block';
    els.scrapeStatus.innerText = 'Scraping started... please wait...';

    try {
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targets })
        });
        let result = await res.json();
        if (!Array.isArray(result)) result = [result];

        let msg = "Scrape Logic Complete:\n";
        result.forEach(r => {
            msg += `${r.Name}: ${r.Status} ${r.Error ? '(' + r.Error + ')' : ''}\n`;
        });
        els.scrapeStatus.innerText = msg;
        // Aggressive polling to catch filesystem lag
        loadStagedFiles();
        setTimeout(loadStagedFiles, 1000);
        setTimeout(loadStagedFiles, 3000);
    } catch (err) {
        els.scrapeStatus.innerText = "Error: " + err.message;
    }
}

async function loadStagedFiles() {
    try {
        const res = await fetch(`${API_BASE}/staged`, { cache: 'no-store' });
        if (!res.ok) return; // API might not be ready
        let files = await res.json();

        // Ensure array
        if (!Array.isArray(files)) files = [files].filter(f => f);

        els.stagedTableBody.innerHTML = '';
        console.log("Staged files:", files);

        if (files && files.length > 0) {
            els.btnPublish.disabled = false;
            // Sort by time desc
            files.sort((a, b) => new Date(b.LastWriteTime) - new Date(a.LastWriteTime));

            files.forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${f.Name}</td>
                    <td>${(f.Length / 1024).toFixed(1)} KB</td>
                    <td>${new Date(f.LastWriteTime).toLocaleString()}</td>
                `;
                els.stagedTableBody.appendChild(tr);
            });
        } else {
            els.btnPublish.disabled = true;
            els.stagedTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No files staged. Scrape some data first.</td></tr>';
        }
    } catch (err) {
        console.error("Failed to load staged files", err);
    }
}

async function publish() {
    if (!confirm("Overwrite live data with staged files?")) return;

    try {
        const res = await fetch(`${API_BASE}/publish`, { method: 'POST' });
        const result = await res.json();
        alert(result.message);
        els.stagedTableBody.innerHTML = ''; // Force clear immediately
        // Aggressive polling to catch filesystem lag
        loadStagedFiles();
        setTimeout(loadStagedFiles, 1000);
        setTimeout(loadStagedFiles, 3000);
    } catch (err) {
        alert("Publish failed: " + err.message);
    }
}

// Events
els.btnAddPlayer.addEventListener('click', addPlayer);
els.btnScrapeAll.addEventListener('click', () => runScrape(["ALL"]));
els.btnScrapeSelected.addEventListener('click', () => {
    const targets = [];
    if (els.scrapeMachines.checked) targets.push("MachineStats");
    document.querySelectorAll('input[name="scrape-target"]:checked').forEach(cb => {
        targets.push(cb.value);
    });
    if (targets.length === 0) return alert("Select at least one item.");
    runScrape(targets);
});
els.btnPublish.addEventListener('click', publish);

// Init
loadPlayers();
loadStagedFiles();
