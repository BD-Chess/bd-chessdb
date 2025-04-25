// File: js/gameLoader.js
// Loads PGN games from curated category files

import { settings, lastLoadedPGN } from './state.js';
import { updateBoard } from './evalOverlay.js';

export function setupGameLoader() {
 const gameBuckets = [
   { name: 'Openings - Top Lines',  file: 'Chess_Openings_Top_Lines.pgn' },
   { name: 'Magnus Carlsen',        file: 'CarlsenM_Selected.pgn' },
   { name: 'Garry Kasparov',        file: 'KasparovG_Selected.pgn' },
   { name: 'Hikaru Nakamura',       file: 'NakamuraH_Selected.pgn' },
   { name: 'Fabiano Caruana',       file: 'CaruanaF_Selected.pgn' },
   { name: 'Dommaraju Gukesh',      file: 'GukeshD_Selected.pgn' },
   { name: 'Judit Polgár',          file: 'PolgarJ_Selected.pgn' },
   { name: 'Bobby Fischer',         file: 'FischerB_Selected.pgn' },
   { name: 'José Raúl Capablanca',  file: 'CapablancaJ_Selected.pgn' },
   { name: 'Emanuel Lasker',        file: 'LaskerE_Selected.pgn' },
   { name: 'TCEC SuFi & other engine games', file: 'TCEC_SuFi_and_Stockfish.pgn' },
   { name: 'TCEC Cup 14 SF vs Lc0 (2024)',   file: 'TCEC_Cup14_SF_vs_Lc0_2024.pgn' },
   { name: 'TCEC S27 (2022) White Wins',     file: 'TCEC_Season27_WhiteWins_2022.pgn' },
   { name: 'TCEC S27 (2022) Black Wins',     file: 'TCEC_Season27_BlackWins_2022.pgn' },
   { name: 'Various Games',                  file: 'Various_Games.pgn' }
 ];

 const panel = document.getElementById('popularGamesPanel');
 if (!panel) return;

 panel.innerHTML = '';
 const heading = document.createElement('div');
 heading.innerText = 'Load a game:';
 heading.style.fontWeight = 'bold';
 heading.style.marginBottom = '8px';
 panel.appendChild(heading);

 gameBuckets.forEach(bucket => {
   const sel = document.createElement('select');
   sel.style.width = '100%';
   sel.style.margin = '4px 0 12px';

   const placeholder = new Option(`${bucket.name} — Select a game`, '');
   placeholder.disabled = true;
   placeholder.selected = true;
   sel.appendChild(placeholder);
   panel.appendChild(sel);

   fetch(`Games/${bucket.file}`)
     .then(r => r.text())
     .then(txt => {
       const games = txt.trim().split(/\n\s*\n(?=\[Event)/);
       games.forEach(gt => {
         const tags = {};
         gt.split('\n').forEach(l => {
           const m = l.match(/^\[(\w+)\s+"(.+)"\]$/);
           if (m) tags[m[1]] = m[2];
         });
         const title = `${tags.Result || ''} ${tags.White || ''} vs. ${tags.Black || ''} (${tags.Site || ''}, ${tags.Date || ''})`;
         sel.appendChild(new Option(title, gt));
       });
     })
     .catch(console.error);

   sel.onchange = e => {
     if (!e.target.value) return;
     lastLoadedPGN = e.target.value;
     const title = e.target.selectedOptions[0].text;

     window._chessboard.reset();
     window._game.load_pgn(e.target.value.replace(/\{[^}]*\}/g, ''));
     document.getElementById('gameTitle').innerHTML = title;
     updateBoard(true);
     sel.selectedIndex = 0;
     panel.classList.remove('open');
     document.getElementById('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
   };
 });
}