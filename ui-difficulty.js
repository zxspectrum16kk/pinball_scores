// ui-difficulty.js
// Machine difficulty ranking page

import { fmtNumber, makeTableSortable } from './utils.js';

export function renderDifficultyPage(machines) {
    const container = document.getElementById('difficulty-ranking');
    if (!container) return;

    // Only machines that have both avgScore and highScore
    const ranked = machines
        .filter(m => m.avgScore && m.highScore)
        .map(m => ({
            machine: m.machine,
            highScore: m.highScore,
            avgScore: m.avgScore,
            plays: m.machinePlays || 0,
            diffPct: (m.avgScore / m.highScore) * 100
        }))
        .sort((a, b) => a.diffPct - b.diffPct);  // hardest first

    if (ranked.length === 0) {
        container.innerHTML = '<p>No machine data available.</p>';
        return;
    }

    const rowsHtml = ranked.map((m, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><a href="machine.html?machine=${encodeURIComponent(m.machine)}">${m.machine}</a></td>
            <td>${fmtNumber(m.highScore)}</td>
            <td>${fmtNumber(Math.round(m.avgScore))}</td>
            <td>${m.diffPct.toFixed(1)}%</td>
            <td>${m.plays}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <p class="note">
            Difficulty is calculated as the average score as a percentage of the machine high score.
            A low percentage means most scores fall far below the record — harder machine.
            A high percentage means typical scores are close to the record — more accessible machine.
        </p>
        <div class="table-wrapper">
            <table id="difficulty-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Machine</th>
                        <th>High Score</th>
                        <th>Avg Score</th>
                        <th>Avg % of High</th>
                        <th>Total Plays</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;

    // Numeric cols: Rank(0), High Score(2), Avg Score(3), Avg %(4), Plays(5)
    makeTableSortable('difficulty-table', [0, 2, 3, 4, 5]);
}
