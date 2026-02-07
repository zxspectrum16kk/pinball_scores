// data.js
// State management and Data fetching

// ==== Global State ====
export let PLAYER_CONFIG = [];
export let ALL_PLAYERS = [];
export let DEFAULT_PLAYERS = [];

// Update this whenever you refresh JSON exports
export const DATA_LAST_UPDATED = '2026-01-12';

const STORAGE_KEY = 'pinballSelectedPlayers';
const MACHINE_SELECTION_KEY = 'pinballCustomMachineSelection';

// ==== Data Fetching ====
export function fetchJson(path) {
    return fetch(path).then(res => {
        if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
        return res.json();
    });
}

// ==== State Setters (for initialization) ====
export function setPlayerConfig(config) {
    PLAYER_CONFIG = config;
}

export function setAllPlayers(players) {
    ALL_PLAYERS = players;
}

export function setDefaultPlayers(players) {
    DEFAULT_PLAYERS = players;
}

// ==== Local Storage / Player Selection ====
export function getSelectedPlayers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Filter out any players that might not exist in current config
                const cleaned = parsed
                    .map(p => String(p))
                    .filter(p => ALL_PLAYERS.includes(p));
                if (cleaned.length > 0) return cleaned;
            }
        }
    } catch (e) {
        console.warn('Failed to read player selection from localStorage:', e);
    }
    return [...DEFAULT_PLAYERS];
}

export function setSelectedPlayers(list) {
    const cleaned = list
        .map(p => String(p))
        .filter(p => ALL_PLAYERS.includes(p));

    const toSave = cleaned.length > 0 ? cleaned : DEFAULT_PLAYERS;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('Failed to save player selection to localStorage:', e);
    }
    return toSave;
}

// ==== Local Storage / Custom List Selection ====
export function getCustomMachineSelection() {
    try {
        const raw = localStorage.getItem(MACHINE_SELECTION_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('Failed to read machine selection:', e);
        return [];
    }
}

export function setCustomMachineSelection(list) {
    try {
        localStorage.setItem(MACHINE_SELECTION_KEY, JSON.stringify(list));
    } catch (e) {
        console.error('Failed to save machine selection:', e);
    }
}
