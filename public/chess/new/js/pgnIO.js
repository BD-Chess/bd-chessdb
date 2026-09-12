// File: js/pgnIO.js
// Handles user interaction for FEN/PGN input/output and clipboard/file operations

import { settings, persistGame } from './state.js';

export function setupPGNIO() {
 const btnCopy = document.getElementById('btnCopy');
 const btnInput = document.getElementById('btnInput');
 const btnLoad = document.getElementById('btnLoad');
 const btnSave = document.getElementById('btnSave');

 if (btnCopy) {
   btnCopy.onclick = () => {
     const output = (settings.ioFormat === 'fen')
       ? window._game.fen()
       : window._game.pgn();
     navigator.clipboard.writeText(output).then(() => {
       btnCopy.innerText = 'Copied!';
       setTimeout(() => btnCopy.innerText = 'Copy', 1200);
     });
   };
 }

 if (btnInput) {
   btnInput.onclick = () => {
     const raw = prompt(`Paste a ${settings.ioFormat.toUpperCase()} string:`).trim();
     if (!raw) return;
     try {
       if (settings.ioFormat === 'fen') {
         window._game.load(raw);
       } else {
         window._game.load_pgn(raw);
       }
       persistGame(window._game);
       window._chessboard.position(window._game.fen());
     } catch (e) {
       alert('Invalid input format');
     }
   };
 }

 if (btnSave) {
   btnSave.onclick = () => {
     const blob = new Blob([window._game.pgn()], { type: 'text/plain' });
     const a = document.createElement('a');
     a.href = URL.createObjectURL(blob);
     a.download = 'chessbest_game.pgn';
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
   };
 }

 if (btnLoad) {
   btnLoad.onchange = (e) => {
     const file = e.target.files[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = () => {
       try {
         window._game.load_pgn(reader.result);
         window._chessboard.position(window._game.fen());
         persistGame(window._game);
       } catch (err) {
         alert('Could not load PGN from file.');
       }
     };
     reader.readAsText(file);
   };
 }
}