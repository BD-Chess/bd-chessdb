// File: js/state.js
// Holds global state and handles settings persistence

export const STORAGE_KEY_SETTINGS = 'chessBestSettings';
export const STORAGE_KEY_GAME     = 'chessBestGame';

export const settings = {
  drawDelay: 5000,
  badgeInitialDelay: 4000,
  retryInterval: 6000,
  tryLaterDuration: 3000,
  evalMode: 'direct',
  flipBoard: false,
  theme: 'dark',
  topN: 5,
  bg: '#2e2e2e',
  notation: 'score',
  font: '14px',
  pieceSize: 'medium',
  historySize: window.innerWidth <= 600 ? 'smallest' : 'small',
  nextDot: true,
  ioFormat: 'fen'
};

// Global runtime state
export let fullHistory   = [];
export let branchIndex   = -1;
export let divergedIndex = -1;
export let prevHighlight = [];
export let lastMoveIndex = -1;
export let lastLoadedPGN = null;
export let lastAction    = null;
export let bookFlags     = [];
export let evalRetries   = 0;
export let evalRetryTimer = null;

export function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  if (saved) {
    try {
      Object.assign(settings, JSON.parse(saved));
    } catch (e) {
      console.error('Bad settings JSON', e);
    }
  }
}

export function saveSettings() {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

export function persistGame(game) {
  if (game.history().length)
    localStorage.setItem(STORAGE_KEY_GAME, game.pgn());
  else
    localStorage.removeItem(STORAGE_KEY_GAME);
}
