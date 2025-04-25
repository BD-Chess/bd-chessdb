// File: js/init.js
// Entry point — initializes app and core settings

import { loadSettings, saveSettings, settings } from './state.js';
import { applySettings } from './uiSettings.js';
import { setupBoard } from './boardManager.js';
import { setupGameLoader } from './gameLoader.js';
import { setupPGNIO } from './pgnIO.js';

export function initAll() {
  loadSettings();
  applySettings();
  setupBoard();
  setupGameLoader();
  setupPGNIO();
}

window.addEventListener('DOMContentLoaded', initAll);
