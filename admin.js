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
    btnPublish: document.getElementById('btn-publish'),
    diffPanel: document.getElementById('diff-panel')
};

let scrapePoller = null;

async function loadPlayers() {
    try {
        const res = await fetch(`${API_BASE}/players`);
        if (!res.ok) throw new Error("API not reachable");
        const players = await res.json();
        renderPlayers(players);
        renderScrapeList(players);
    } catch (err) {
        console.error("Failed to load players", err);
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

function statusIcon(s) {
    if (s === 'done')    return '<span class="scrape-icon scrape-icon--done">&#10003;</span>';
    if (s === 'running') return '<span class="scrape-icon scrape-icon--running">&#8635;</span>';
    if (s === 'failed')  return '<span class="scrape-icon scrape-icon--failed">&#10007;</span>';
    return '<span class="scrape-icon scrape-icon--pending">&#9675;</span>';
}

function renderScrapeProgress(data) {
    const items = data.items || [];
    const completed = data.completed || 0;
    const total = data.total || items.length || 1;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const isDone = data.status === 'complete';
    const isFailed = data.status === 'failed';

    const heading = isDone ? 'Scrape complete' : isFailed ? 'Scrape failed' : 'Scraping in progress...';

    const itemRows = items.map(item => {
        const isCurrent = data.current === item.name && item.status === 'running';
        const machineInfo = item.status === 'done'
            ? `<span class="scrape-machine-count">${item.machines} machines</span>`
            : isCurrent && item.total > 0
                ? `<span class="scrape-machine-count">${item.done} / ${item.total} machines</span>`
                : '';
        return `
          <div class="scrape-item ${isCurrent ? 'scrape-item--active' : ''}">
            ${statusIcon(item.status)}
            <span class="scrape-item-name">${item.name}</span>
            ${machineInfo}
          </div>`;
    }).join('');

    els.scrapeStatus.innerHTML = `
      <div class="scrape-heading">${heading}</div>
      <div class="scrape-bar-wrap">
        <div class="scrape-bar" style="width:${pct}%"></div>
      </div>
      <div class="scrape-bar-label">${completed} / ${total} completed</div>
      <div class="scrape-items">${itemRows}</div>
      ${isFailed && data.error ? `<div class="scrape-error">${data.error}</div>` : ''}
    `;
}

function stopScrapePolling() {
    if (scrapePoller) { clearInterval(scrapePoller); scrapePoller = null; }
}

async function pollScrapeStatus() {
    try {
        const res = await fetch(`${API_BASE}/scrape-status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'idle') { stopScrapePolling(); return; }

        renderScrapeProgress(data);

        if (data.status === 'complete' || data.status === 'failed') {
            stopScrapePolling();
            setBtnsDisabled(false);
            if (data.status === 'complete') {
                loadStagedFiles();
                setTimeout(loadStagedFiles, 1500);
            }
        }
    } catch (err) {
        console.error("Status poll failed", err);
    }
}

function setBtnsDisabled(disabled) {
    els.btnScrapeAll.disabled = disabled;
    els.btnScrapeSelected.disabled = disabled;
}

async function runScrape(targets) {
    els.scrapeStatus.style.display = 'block';
    els.scrapeStatus.innerHTML = '<div class="scrape-heading">Starting scrape...</div>';
    setBtnsDisabled(true);

    try {
        const res = await fetch(`${API_BASE}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targets })
        });
        const data = await res.json();

        if (data.status === 'already_running') {
            els.scrapeStatus.innerHTML = '<div class="scrape-heading">A scrape is already running — see progress below.</div>';
        }

        // Start polling for live progress
        stopScrapePolling();
        await pollScrapeStatus();
        scrapePoller = setInterval(pollScrapeStatus, 2000);
    } catch (err) {
        els.scrapeStatus.innerHTML = `<div class="scrape-heading scrape-error">Error: ${err.message}</div>`;
        setBtnsDisabled(false);
    }
}

async function loadDiff() {
    if (!els.diffPanel) return;
    els.diffPanel.innerHTML = '<p class="note">Loading diff...</p>';
    try {
        const res = await fetch(`${API_BASE}/diff`, { cache: 'no-store' });
        if (!res.ok) { els.diffPanel.innerHTML = ''; return; }
        const diff = await res.json();
        if (!diff || !diff.length) { els.diffPanel.innerHTML = '<p class="note">No diff data available.</p>'; return; }
        renderDiff(diff);
    } catch (err) {
        els.diffPanel.innerHTML = '';
    }
}

function renderDiff(diff) {
    const rows = diff.map(d => {
        const newTag  = d.newMachines > 0  ? `<span class="diff-tag diff-tag--new">+${d.newMachines} new</span>` : '';
        const impTag  = d.improvedScores > 0 ? `<span class="diff-tag diff-tag--improved">&#8679; ${d.improvedScores} improved</span>` : '';
        const covText = d.player !== 'MachineStats'
            ? `<span class="diff-cov" title="Machines with event history">${d.eventCoverage}/${d.totalMachines} with events${d.coverageChange > 0 ? ' (+' + d.coverageChange + ')' : ''}</span>`
            : `<span class="diff-cov">${d.totalMachines} machines</span>`;

        let details = '';
        if (d.improvedList && d.improvedList.length) {
            const detailRows = d.improvedList.slice(0, 10).map(im =>
                `<div class="diff-detail-row"><span class="diff-machine-name">${im.machine}</span><span class="diff-scores">${fmtNum(im.oldScore)} &rarr; ${fmtNum(im.newScore)}</span></div>`
            ).join('');
            const more = d.improvedList.length > 10 ? `<div class="diff-detail-more">+${d.improvedList.length - 10} more</div>` : '';
            details = `<div class="diff-details">${detailRows}${more}</div>`;
        }
        if (d.newMachineList && d.newMachineList.length) {
            const newRows = d.newMachineList.map(m => `<div class="diff-detail-row diff-detail-row--new"><span class="diff-machine-name">+ ${m}</span></div>`).join('');
            details += `<div class="diff-details">${newRows}</div>`;
        }

        return `
          <div class="diff-row">
            <div class="diff-row-top">
              <span class="diff-player">${d.player}</span>
              ${newTag}${impTag}
              ${covText}
            </div>
            ${details}
          </div>`;
    }).join('');

    els.diffPanel.innerHTML = `
      <h3 class="diff-heading">What&rsquo;s changing</h3>
      <div class="diff-list">${rows}</div>
    `;
}

function fmtNum(n) {
    if (!n && n !== 0) return '—';
    return Number(n).toLocaleString();
}

async function loadStagedFiles() {
    try {
        const res = await fetch(`${API_BASE}/staged`, { cache: 'no-store' });
        if (!res.ok) return;
        let files = await res.json();
        if (!Array.isArray(files)) files = [files].filter(f => f);

        els.stagedTableBody.innerHTML = '';

        if (files && files.length > 0) {
            els.btnPublish.disabled = false;
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
            loadDiff();
        } else {
            els.btnPublish.disabled = true;
            els.stagedTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No files staged. Scrape some data first.</td></tr>';
            if (els.diffPanel) els.diffPanel.innerHTML = '';
        }
    } catch (err) {
        console.error("Failed to load staged files", err);
    }
}

async function publish() {
    if (!confirm("Overwrite live data with staged files? A backup will be saved to data/backup/.")) return;

    try {
        const res = await fetch(`${API_BASE}/publish`, { method: 'POST' });
        const result = await res.json();
        alert(result.message);
        if (els.diffPanel) els.diffPanel.innerHTML = '';
        els.stagedTableBody.innerHTML = '';
        loadStagedFiles();
        setTimeout(loadStagedFiles, 1000);
        setTimeout(loadStagedFiles, 3000);
    } catch (err) {
        alert("Publish failed: " + err.message);
    }
}

// Check if a scrape was already running when we opened the page
async function checkExistingProgress() {
    try {
        const res = await fetch(`${API_BASE}/scrape-status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'running') {
            els.scrapeStatus.style.display = 'block';
            setBtnsDisabled(true);
            renderScrapeProgress(data);
            scrapePoller = setInterval(pollScrapeStatus, 2000);
        }
    } catch {}
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
checkExistingProgress();
