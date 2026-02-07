// utils.js
// Shared helper functions

export function playerKeyFromName(name) {
    return name.toLowerCase();
}

export function fmtNumber(v) {
    if (v == null || v === '' || isNaN(v)) return v ?? '';
    return Number(v).toLocaleString();
}

export function getMachineName(row) {
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

export function getNumericField(row, patterns, defaultValue = 0) {
    for (const [key, value] of Object.entries(row)) {
        const lower = key.toLowerCase();
        if (patterns.some(p => lower.includes(p))) {
            const num = Number(value);
            if (!isNaN(num)) return num;
        }
    }
    return defaultValue;
}

export function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

export function findMachineByName(machines, name) {
    if (!name) return null;
    return machines.find(
        m => m.machine && m.machine.toLowerCase() === name.toLowerCase()
    );
}

// ===== Sorting helper =====
export function makeTableSortable(tableId, numericCols = [], defaultSort) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    const tbody = table.querySelector('tbody');

    const parseNumericText = (text) => {
        if (!text) return 0;
        const cleaned = text.replace(/,/g, '').replace('%', '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const sortRows = (index, direction) => {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const isNumeric = numericCols.includes(index);

        rows.sort((a, b) => {
            const aText = a.children[index]?.textContent.trim() || '';
            const bText = b.children[index]?.textContent.trim() || '';

            let cmp;
            if (isNumeric) {
                cmp = parseNumericText(aText) - parseNumericText(bText);
            } else {
                cmp = aText.localeCompare(bText);
            }

            return direction === 'asc' ? cmp : -cmp;
        });

        rows.forEach(r => tbody.appendChild(r));
    };

    const highlightColumn = (index) => {
        headers.forEach((h, i) => {
            if (i === index) h.classList.add('sorted-col');
            else h.classList.remove('sorted-col');
        });

        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            Array.from(row.children).forEach((cell, i) => {
                if (i === index) cell.classList.add('sorted-col');
                else cell.classList.remove('sorted-col');
            });
        });
    };

    headers.forEach((th, index) => {
        if (!th.querySelector('.arrow')) {
            const label = th.innerText;
            th.innerHTML = `<span>${label}</span><span class="arrow"></span>`;
        }

        th.addEventListener('click', () => {
            const currentDir = th.dataset.sortDir === 'asc' ? 'asc' : 'desc';
            const newDir = currentDir === 'asc' ? 'desc' : 'asc';
            th.dataset.sortDir = newDir;

            headers.forEach(h => {
                if (h !== th) {
                    delete h.dataset.sortDir;
                    h.removeAttribute('aria-sort');
                    const arrow = h.querySelector('.arrow');
                    if (arrow) arrow.textContent = '';
                }
            });

            const arrow = th.querySelector('.arrow');
            if (arrow) arrow.textContent = newDir === 'asc' ? '▲' : '▼';
            th.setAttribute('aria-sort', newDir === 'asc' ? 'ascending' : 'descending');

            sortRows(index, newDir);
            highlightColumn(index);
        });
    });

    if (defaultSort && typeof defaultSort.index === 'number') {
        const th = headers[defaultSort.index];
        if (th) {
            th.dataset.sortDir = defaultSort.direction;
            const arrow = th.querySelector('.arrow');
            if (arrow) {
                arrow.textContent =
                    defaultSort.direction === 'asc' ? '▲' : '▼';
            }
            th.setAttribute(
                'aria-sort',
                defaultSort.direction === 'asc' ? 'ascending' : 'descending'
            );
            sortRows(defaultSort.index, defaultSort.direction);
            highlightColumn(defaultSort.index);
        }
    }
}
