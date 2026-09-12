// File: js/uiSettings.js
// Applies visual settings: theme, fonts, sizes, and board layout

import { settings } from './state.js';

export function applySettings() {
  // Theme
  document.body.classList.toggle('light-theme', settings.theme === 'light');
  document.body.style.background = settings.theme === 'dark' ? settings.bg : '';

  // Sync Settings Panel (if needed)
  const themeCheckbox = document.getElementById('settingTheme');
  if (themeCheckbox) {
    themeCheckbox.checked = (settings.theme === 'light');
  }

  // Board orientation
  const board = window._chessboard;
  if (board) {
    board.orientation(settings.flipBoard ? 'black' : 'white');
  }

  // CSS variables for font and piece size
  document.documentElement.style.setProperty('--overlay-font', settings.font);
  document.documentElement.style.setProperty('--moves-font', settings.font);
  document.documentElement.style.setProperty('--piece-scale',
    { small: .6, medium: .8, big: 1 }[settings.pieceSize]);

  // Adjust piece transforms on board (center pieces based on scale)
  const boardEl = document.getElementById('board');
  if (boardEl) {
    const squareW = boardEl.clientWidth / 8;
    const scale = { small: .6, medium: .8, big: 1 }[settings.pieceSize];
    const offset = (squareW * (1 - scale)) / 2;

    document.querySelectorAll('#board img').forEach(img => {
      const m = img.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      if (!m) return;
      const tx = parseFloat(m[1]) + offset;
      const ty = parseFloat(m[2]) + offset;
      img.style.transform = `translate(${tx}px, ${ty}px)`;
    });
  }

  // Move history height
  const heightMap = {
    smallest: '60px',
    small: '140px',
    medium: '300px',
    big: '450px'
  };
  const moveDiv = document.getElementById('moves');
  if (moveDiv) {
    moveDiv.style.height = heightMap[settings.historySize];
  }
}
