// File: js/boardManager.js
// Handles Chessboard.js setup and user move interactions

import { Chess } from './chess.min.js'; // adjust path as needed
import { settings, fullHistory, bookFlags, divergedIndex, branchIndex, lastMoveIndex, lastAction } from './state.js';
import { updateBoard } from './evalOverlay.js';

let game;

export function setupBoard() {
  game = new Chess();

  const saved = localStorage.getItem('chessBestGame');
  if (saved) {
    try { game.load_pgn(saved); } catch (e) { console.error('Bad saved PGN', e); }
  }

  window._chessboard = Chessboard('board', {
    draggable: true,
    position : game.fen(),
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
    onDrop: handleDrop
  });
}

function handleDrop(src, dst) {
  const curBefore = game.history().map(x => x.san);
  const refBefore = fullHistory.map(x => x.san).slice(0, curBefore.length + 1);

  const move = game.move({ from: src, to: dst, promotion: 'q' });
  if (!move) return 'snapback';

  const curAfter = game.history().map(x => x.san);
  const refAfter = fullHistory.map(x => x.san).slice(0, curAfter.length);

  if (JSON.stringify(curAfter) !== JSON.stringify(refAfter) && branchIndex < 0) {
    branchIndex = curBefore.length - 1;
  }

  lastAction = 'move';
  window._skipDivergedReset = true;
  updateBoard(false);
}
