// File: js/gameLoader.js
// Loads PGN games from curated category files

import { settings, lastLoadedPGN } from './state.js';
import { updateBoard } from './evalOverlay.js';

export function setupGameLoader() {
 const gameBuckets = [
   { name: 'Openings - Top Lines',  files: [
     'TopLines/c4_top_43_moves.pgn',
     'TopLines/d4_top_22_moves.pgn',
     'TopLines/d4_top_27_moves.pgn',
     'TopLines/e4_top_62_moves.pgn',
     'TopLines/Nf3_top_26_moves.pgn'
   ]},
   { name: 'Book - DCC (flat)',     file: 'TopLines/8zC-book_dcc_flat.pgn' },
   { name: 'Book - Raw (flat)',     file: 'TopLines/8zC-book_raw_flat.pgn' },
   { name: 'Book - EndEval (flat)', file: 'TopLines/8zC-book_endeval_flat.pgn' },
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

   const bucketFiles = Array.isArray(bucket.files)
     ? bucket.files
     : (bucket.file ? [bucket.file] : []);

   Promise.allSettled(
     bucketFiles.map(file =>
       fetch(`Games/${file}`)
         .then(r => {
           if (!r.ok) throw new Error(`HTTP ${r.status} for ${file}`);
           return r.text();
         })
         .then(txt => ({ file, txt }))
     )
   )
     .then(results => {
       results.forEach(res => {
         if (res.status !== 'fulfilled') {
           console.error('Failed to load PGN bucket file:', res.reason);
           return;
         }

         const { file, txt } = res.value;
         const trimmed = String(txt || '').trim();
         if (!trimmed) return;

         const games = trimmed.split(/\n\s*\n(?=\[Event)/);
         games.forEach(gt => {
           const tags = {};
           gt.split('\n').forEach(l => {
             const m = l.match(/^\[(\w+)\s+"(.+)"\]$/);
             if (m) tags[m[1]] = m[2];
           });

           const fileStem = file.split('/').pop().replace(/\.pgn$/i, '');
           const sourceLabel = fileStem
             .replace(/_/g, ' ')
             .replace(/\btop\b/gi, 'Top')
             .replace(/\bmoves\b/gi, 'moves');

           const coreTitle = (tags.Opening && (!tags.White || tags.White === 'Book'))
             ? `${tags.Opening} (${tags.Mode || ''})`
             : `${tags.Result || ''} ${tags.White || ''} vs. ${tags.Black || ''} (${tags.Site || ''}, ${tags.Date || ''})`;

           const title = Array.isArray(bucket.files)
             ? `${sourceLabel} — ${coreTitle}`
             : coreTitle;

           sel.appendChild(new Option(title, gt));
         });
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
