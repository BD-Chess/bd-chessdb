// File: js/evalOverlay.js
// Handles evaluation badge display and next-move previews

import { settings, evalRetries, evalRetryTimer } from './state.js';

// This function will be called after each move or board update
export function updateBoard(isInitial) {
  // Clear existing overlays and preview dots
  clearOverlays();

  if (!settings.nextDot) return;

  // Add yellow rings for preview (next move in PGN)
  showNextMoveRings();
  
  // Add evaluation badges (placeholder)
  // TODO: Connect to eval service or local eval data
  if (settings.evalMode === 'direct') {
    fetchDirectEval();
  } else {
    fetchProxyEval();
  }
}

// Clears all visual badges and previews
function clearOverlays() {
  document.querySelectorAll('.overlay').forEach(el => el.remove());
  document.querySelectorAll('.dot-preview').forEach(el => el.remove());
}

// Shows yellow rings for the next move in game history (if any)
function showNextMoveRings() {
  // Placeholder logic — actual move detection depends on PGN state
  const ring = document.createElement('div');
  ring.className = 'dot-preview';
  ring.style.position = 'absolute';
  ring.style.width = '20px';
  ring.style.height = '20px';
  ring.style.border = '2px solid yellow';
  ring.style.borderRadius = '50%';
  ring.style.pointerEvents = 'none';
  ring.style.zIndex = 200;

  // Position mock example — replace with real logic
  ring.style.left = '40px';
  ring.style.top = '40px';
  document.getElementById('board').appendChild(ring);
}

// Example: Fetch eval data directly
function fetchDirectEval() {
  console.log('[evalOverlay] Direct evaluation requested.');
  // TODO: Replace with actual fetch call to ChessDB
}

// Example: Fetch eval data via proxy relay
function fetchProxyEval() {
  console.log('[evalOverlay] Proxy evaluation requested.');
  // TODO: Replace with fallback method or Netlify function call
}
