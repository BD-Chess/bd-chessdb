function initAll() {
  const STORAGE_KEY_SETTINGS = 'chessBestSettings';
  const STORAGE_KEY_GAME     = 'chessBestGame';

  /* ------------------------------------------------------------------
     1. DEFAULT SETTINGS
  ------------------------------------------------------------------*/
  const settings = {
    theme: 'dark',
    topN: 5,
    bg: '#2e2e2e',
    notation: 'score',
    coords: true,
    font: '14px',
    pieceSize: 'medium',
    /* historySize: 'small', */
    historySize: window.innerWidth <= 600 ? 'smallest' : 'medium',
    boardSize: 'medium',
    nextDot: true,     // show next‑move preview by default
    ioFormat: 'fen'    // NEW  (fen | pgn)  for Format / Input / Copy row
  };

  /* ------------------------------------------------------------------
     2. LOAD SAVED SETTINGS
  ------------------------------------------------------------------*/
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  if (saved) {
    try { Object.assign(settings, JSON.parse(saved)); }
    catch (e) { console.error('Bad settings JSON', e); }
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }

  /* ------------------------------------------------------------------
     3. COPY‑TO‑CLIPBOARD HELPER
  ------------------------------------------------------------------*/
  function copyText(txt) {
    if (navigator.clipboard) return navigator.clipboard.writeText(txt);
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }

  /* ------------------------------------------------------------------
     4. POPULAR GAMES  (json file)
  ------------------------------------------------------------------*/

  /* ------------------------------------------------------------------
     4. POPULAR GAMES  (PGN files per category)
  ------------------------------------------------------------------*/
  const gameBuckets = [
    { name: 'Magnus Carlsen',        file: 'CarlsenM_Selected.pgn' },
    { name: 'Garry Kasparov',        file: 'KasparovG_Selected.pgn' },
    { name: 'Hikaru Nakamura',       file: 'NakamuraH_Selected.pgn' },
    { name: 'Fabiano Caruana',       file: 'CaruanaF_Selected.pgn' },
    { name: 'Dommaraju Gukesh',      file: 'GukeshD_Selected.pgn' },
    { name: 'Judit Polgár',          file: 'PolgarJ_Selected.pgn' },
    { name: 'Bobby Fischer',         file: 'FischerB_Selected.pgn' },
    { name: 'José Raúl Capablanca',  file: 'CapablancaJ_Selected.pgn' },
    { name: 'Emanuel Lasker',        file: 'LaskerE_Selected.pgn' },
    { name: 'Stockfish',             file: 'Stockfish_Selected.pgn' },
    { name: 'TCEC Cup 14 (2024)',    file: 'TCEC_Cup14_WhiteWins_2024.pgn' },
    { name: 'TCEC Season 27 (2022)', file: 'TCEC_Season27_BlackWins_2022.pgn' },
    { name: 'Various Games',         file: 'Various_Games.pgn' }
  ];

  const panel = document.getElementById('popularGamesPanel');
  panel.innerHTML = '';
  const heading = document.createElement('div');
  heading.innerText = 'Load a game:';
  heading.style.fontWeight = 'bold';
  heading.style.marginBottom = '8px';
  panel.appendChild(heading);

gameBuckets.forEach(bucket => {
  // 1) Create the <select> and placeholder up front, then append it immediately.
  const sel = document.createElement('select');
  sel.style.width  = '100%';
  sel.style.margin = '4px 0 12px';

  const placeholder = new Option(`${bucket.name} — Select a game`, '');
  placeholder.disabled = true;
  placeholder.selected = true;
  sel.appendChild(placeholder);

  panel.appendChild(sel);

  // 2) Fetch and populate options into the already‑appended select
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
        const title = `${tags.Result||''} ${tags.White||''} vs. ${tags.Black||''} (${tags.Site||''}, ${tags.Date||''})`;
        sel.appendChild(new Option(title, gt));
      });
    })
    .catch(console.error);

  // 3) Wire up load-on-change
  sel.onchange = e => {
    if (!e.target.value) return;       // ignore the disabled placeholder
    game.reset();
    game.load_pgn(e.target.value);
    updateBoard(true);
    document.getElementById('gameTitle').innerHTML =
      e.target.selectedOptions[0].text;
    panel.classList.remove('open');

    document.getElementById('main').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    // window.scrollTo({ top: 0, behavior: 'smooth' });

    sel.selectedIndex = 0;
  };
});




  /* ------------------------------------------------------------------
     5. CHESS OBJECT  +  RESTORE SAVED PGN
  ------------------------------------------------------------------*/
  const game = new Chess();
  const savedGame = localStorage.getItem(STORAGE_KEY_GAME);
  if (savedGame) {
    try { game.load_pgn(savedGame); }
    catch (e) { console.error('Bad saved PGN', e); }
  }

  /* ------------------------------------------------------------------
     6. CHESSBOARD.JS
  ------------------------------------------------------------------*/
  const board = Chessboard('board', {
    draggable: true,
    position : game.fen(),
    showCoordinates: true,
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
    onDrop: (src, dst) => {
      const m = game.move({ from: src, to: dst, promotion: 'q' });
      if (!m) return 'snapback';
      updateBoard(true);
    }
  });

  /* ------------------------------------------------------------------
     7. STATE
  ------------------------------------------------------------------*/
  let fullHistory   = [];
  let prevHighlight = [];
  let showEval      = true;

  function persistGame() {
    if (game.history().length)
      localStorage.setItem(STORAGE_KEY_GAME, game.pgn());
    else
      localStorage.removeItem(STORAGE_KEY_GAME);
  }

  /* ------------------------------------------------------------------
     8. APPLY SETTINGS  (theme, fonts, sizes, format‑label)
  ------------------------------------------------------------------*/
  function applySettings() {
    /* theme */
    document.body.classList.toggle('light-theme', settings.theme === 'light');
    document.getElementById('btnTheme').innerText =
      settings.theme === 'light' ? 'Theme D' : 'Theme L';
    document.body.style.background =
      settings.theme === 'dark' ? settings.bg : '';

    /* board coords */
    document.getElementById('board')
      .parentElement.classList.toggle('no-coords', !settings.coords);

    /* CSS vars */
    document.documentElement.style.setProperty('--overlay-font', settings.font);
    document.documentElement.style.setProperty('--moves-font',  settings.font);
    document.documentElement.style.setProperty('--piece-scale',
      { small: .6, medium: .8, big: 1 }[settings.pieceSize]);

    /* history height */
    document.getElementById('moves').style.height =
      { smallest: '60px', small:'150px', medium:'300px', big:'450px' }[settings.historySize];


    /* board size (desktop) */
    if (window.innerWidth > 600) {
      const s = { small:360, medium:480, large:600 }[settings.boardSize];
      const b = document.getElementById('board');
      b.style.width  = s + 'px';
      b.style.height = s + 'px';
    }

    /* format toggle label:  "FEN | pgn"  or  "fen | PGN" 
    document.getElementById('btnFormat').innerText =
      settings.ioFormat === 'fen' ? 'FEN|pgn' : 'fen|PGN'; */

    /* OLD labesl: format toggle label:  "FEN | pgn"  or  "fen | PGN" */
    document.getElementById('btnFormat').innerText =
      settings.ioFormat === 'fen' ? 'FEN|pgn' : 'PGN|fen';

    /* NEW labels: format toggle label: bold the active part */
    const btnFormat = document.getElementById('btnFormat');
    btnFormat.innerHTML =
      settings.ioFormat === 'fen'
        ? '<strong>FEN</strong>|pgn'
        : '<strong>PGN</strong>|fen';


  }

  /* ------------------------------------------------------------------
     9. FETCH ANNOTATIONS (ChessDB.cn)
  ------------------------------------------------------------------*/
  async function fetchAnnotations() {
    const fen = encodeURIComponent(game.fen());

    function parseResponse(text) {
      return text.split('|').map(line => {
        const m = line.match(/move:(\w+),score:([-\d\?]+),rank:(\d+),/);
        if (!m || m[2] === '??') return null;
        const score = parseInt(m[2], 10), rank = parseInt(m[3], 10);
        if (isNaN(score) || (score <= -100 && rank < 2)) return null;
        return { move: m[1], score, rank };
      }).filter(Boolean);
    }

    try {
      const [vTxt, cTxt] = await Promise.all([
        fetch(`/.netlify/functions/queryall?fen=${fen}&learn=0&showall=1`).then(r=>r.text()),
        fetch(`/.netlify/functions/queryall?fen=${fen}&learn=1&showall=1`).then(r=>r.text())
      ]);

      const moveMap = new Map();
      parseResponse(cTxt).forEach(m => moveMap.set(m.move, m)); // cloud first
      parseResponse(vTxt).forEach(m => moveMap.set(m.move, m)); // verified overrides

      const allMoves = Array.from(moveMap.values())
        .sort((a,b)=>b.rank-a.rank||b.score-a.score);

      const list = isFinite(settings.topN) ? allMoves.slice(0,settings.topN)
                                           : allMoves;
      list.forEach((m,i)=>annotateMove(m.move,m.score,i===0));
    }
    catch (err) { console.error('Failed to fetch annotations:', err); }
  }

  /* ------------------------------------------------------------------
     10. BOARD OVERLAYS / HISTORY RENDER (unchanged logic)
  ------------------------------------------------------------------*/
  function annotateMove(move, score, best) {
    const sq   = move.slice(-2);
    const cell = document.querySelector(`.square-${sq}`);
    if (!cell) return;

    const ov  = document.createElement('div');
    const num = parseInt(score, 10);
    ov.innerText = settings.notation==='dot' ? '•' : num>0?`+${num}`:num;
    ov.className = best ? 'overlay best'
                        : `overlay ${num>0?'positive':num<0?'negative':'zero'}`;
    ov.onclick = e => {
      e.stopPropagation();
      game.move({ from: move.slice(0,2), to: sq, promotion:'q' });
      updateBoard(true);
    };
    cell.appendChild(ov);
  }

  function highlightLast() {
    prevHighlight.forEach(sq=>{
      const el=document.querySelector(`.square-${sq}`);
      if(el) el.classList.remove('highlightSquare');
    });
    prevHighlight = [];

    const hist = game.history({ verbose:true });
    if (!hist.length) return;
    const last = hist[hist.length-1];
    ['from','to'].forEach(k=>{
      const el=document.querySelector(`.square-${last[k]}`);
      if(el){ el.classList.add('highlightSquare'); prevHighlight.push(last[k]); }
    });
  }

  function renderHistory() {
    const div=document.getElementById('moves'); div.innerHTML='';
    const tbl=document.createElement('table');
    const pairs=[];
    for(let i=0;i<fullHistory.length;i+=2)
      pairs.push({ w:fullHistory[i], b:fullHistory[i+1], iW:i, iB:i+1 });

    const rev=pairs.slice().reverse(), total=rev.length, cur=game.history().length-1;
    rev.forEach((p,idx)=>{
      const tr=document.createElement('tr');
      if(p.iW===cur||p.iB===cur) tr.classList.add('selected');
      const tdNum=document.createElement('td');
      tdNum.textContent=`${total-idx}.`; tr.appendChild(tdNum);

      ['W','B'].forEach(col=>{
        const mv=p[`i${col}`]>=0 ? p[col.toLowerCase()] : null;
        const td=document.createElement('td');
        td.textContent=mv?mv.san:'';
        td.className='move';
        if(mv){
          td.onclick=()=>jumpTo(p[`i${col}`]);
          if(p[`i${col}`]===cur) td.classList.add('current');
        }
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    div.appendChild(tbl);

    // Auto-scroll to show current move row
    const selected = tbl.querySelector('tr.selected');
    if (selected) {
      selected.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
    }

  }

  /* ------------------------------------------------------------------
     11. UPDATE BOARD
  ------------------------------------------------------------------*/
  function updateBoard(reset) {
    board.position(game.fen());
    document.querySelectorAll('.overlay,.next-dot').forEach(el=>el.remove());

    if (reset) fullHistory = game.history({ verbose:true });
    persistGame();

    setTimeout(fetchAnnotations,0);
    renderHistory();
    highlightLast();

    document.querySelectorAll('.overlay')
      .forEach(o=>o.style.display=showEval?'block':'none');

    if (settings.nextDot) {
      const idx = game.history().length;
      if (idx < fullHistory.length) {
        const nm = fullHistory[idx];
        ['to','from'].forEach(k=>{
          const cell=document.querySelector(`.square-${nm[k]}`);
          if(cell){
            const d=document.createElement('div');
            d.className='next-dot';
            d.style.bottom='4px'; d.style.left='4px';
            cell.appendChild(d);
          }
        });
      }
    }
  }

  /* ------------------------------------------------------------------
     12. JUMP TO MOVE & NAV BUTTONS
  ------------------------------------------------------------------*/
  function jumpTo(i){
    game.reset();
    fullHistory.forEach((m,idx)=>{ if(idx<=i) game.move(m.san); });
    updateBoard(false);
  }

  ['first','prev','next','last'].forEach(id=>{
    document.getElementById(id).onclick=()=>{
      if(id==='first') jumpTo(0);
      else if(id==='prev'){ game.undo(); updateBoard(false); }
      else if(id==='next'){
        const m=fullHistory[game.history().length];
        if(m){ game.move(m.san); updateBoard(false); }
      }
      else jumpTo(fullHistory.length-1);
    };
  });

  /* ------------------------------------------------------------------
     13. ROW 1  (Format | Input | Copy)
  ------------------------------------------------------------------*/
  document.getElementById('btnFormat').onclick = () => {
    settings.ioFormat = settings.ioFormat==='fen' ? 'pgn' : 'fen';
    saveSettings(); applySettings();
  };

  document.getElementById('btnInput').onclick = () => {
    if (settings.ioFormat==='fen') {
      const inp=prompt('FEN & moves');
      if(!inp) return;
      const [fen,mvs]=inp.split(' moves ');
      game.load(fen);
      mvs?.split(' ').forEach(m=>
        game.move({from:m.slice(0,2), to:m.slice(2,4) })
      );
    } else {
      const p=prompt('Paste PGN');
      if(p) game.load_pgn(p);
    }
    updateBoard(true);
  };

  document.getElementById('btnCopy').onclick = () => {
    copyText(settings.ioFormat==='fen' ? game.fen() : game.pgn());
  };

  /* ------------------------------------------------------------------
     14. ROW 2  (New | Save | Load)
  ------------------------------------------------------------------*/

  document.getElementById('btnNew').onclick = () => {
    game.reset();
    updateBoard(true);
    // reset title to the original placeholder
    document.getElementById('gameTitle').innerHTML = 'Analyse moves with ChessDB';
  };


  document.getElementById('btnSave').onclick = () => {
    const blob=new Blob([game.pgn()],{type:'text/plain'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='chessbest_game.pgn';
    a.click(); URL.revokeObjectURL(a.href);
  };

  document.getElementById('btnLoad').onclick = () =>
    document.getElementById('filePGN').click();

  document.getElementById('filePGN').onchange = e => {
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=evt=>{
      game.load_pgn(evt.target.result);
      updateBoard(true);
      document.getElementById('gameTitle').innerText = file.name;
    };
    reader.readAsText(file);
    e.target.value='';
  };

  /* ------------------------------------------------------------------
     15. ROW 3  (Games | Theme | Settings)
  ------------------------------------------------------------------*/
  document.getElementById('btnGames').onclick = () =>
    document.getElementById('popularGamesPanel')
      .classList.toggle('open');

  document.getElementById('btnTheme').onclick = () => {
    settings.theme=settings.theme==='light'?'dark':'light';
    saveSettings(); applySettings();
  };

  document.getElementById('btnSettings').onclick = () =>
    document.getElementById('settingsPanel')
      .classList.toggle('open');

  /* ------------------------------------------------------------------
     16. HIDE / SHOW EVAL
  ------------------------------------------------------------------*/
  document.getElementById('btnHideEval').onclick = () => {
    showEval=!showEval;
    document.getElementById('btnHideEval').innerText=
      showEval?'Hide Eval':'Show Eval';
    document.querySelectorAll('.overlay')
      .forEach(o=>o.style.display=showEval?'block':'none');
  };

  /* ------------------------------------------------------------------
     17. POPULAR GAME SELECT  (unchanged)
  ------------------------------------------------------------------*/


  /* ------------------------------------------------------------------
     18. SETTINGS PANEL HANDLERS  (unchanged)
  ------------------------------------------------------------------*/
  [
    'settingTopN','settingHistorySize','settingBg','settingFont',
    'settingNotation','settingPieceSize','settingBoardSize',
    'settingCoords','settingNextDot'
  ].forEach(id=>{
    document.getElementById(id).onchange=e=>{
      switch(id){
        case 'settingTopN':
          settings.topN = e.target.value==='all'
            ? Infinity : parseInt(e.target.value,10); break;
        case 'settingHistorySize': settings.historySize=e.target.value; break;
        case 'settingBg':          settings.bg=e.target.value; break;
        case 'settingFont':        settings.font=e.target.value; break;
        case 'settingNotation':    settings.notation=e.target.value; break;
        case 'settingPieceSize':   settings.pieceSize=e.target.value; break;
        case 'settingBoardSize':   settings.boardSize=e.target.value; break;
        case 'settingCoords':      settings.coords=e.target.checked; break;
        case 'settingNextDot':     settings.nextDot=e.target.checked; break;
      }
      saveSettings();
      applySettings();
      updateBoard(false);
    };
  });

  /* ------------------------------------------------------------------
     19. KEYBOARD NAVIGATION  (unchanged)
  ------------------------------------------------------------------*/
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    if(e.key==='ArrowLeft'){ game.undo(); updateBoard(false); }
    else if(e.key==='ArrowRight'){
      const m=fullHistory[game.history().length];
      if(m){ game.move(m.san); updateBoard(false); }
    } else if(e.key==='Home') jumpTo(0);
    else if(e.key==='End')  jumpTo(fullHistory.length-1);
  });

  /* ------------------------------------------------------------------
     INIT
  ------------------------------------------------------------------*/
  applySettings();
  updateBoard(true);
}

/* ------------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------------*/
window.addEventListener('load', initAll);
