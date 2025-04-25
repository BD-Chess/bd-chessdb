function initAll() {
  const STORAGE_KEY_SETTINGS = 'chessBestSettings';
  const STORAGE_KEY_GAME     = 'chessBestGame';

  /* ------------------------------------------------------------------
     1. DEFAULT SETTINGS
  ------------------------------------------------------------------*/
  const settings = {
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
    /* historySize: 'small', */
    historySize: window.innerWidth <= 600 ? 'smallest' : 'small',
    nextDot: true,     // show next‑move preview by default
    ioFormat: 'fen'    // NEW  (fen | pgn)  for Format / Input / Copy row
  };

  // ─── Track the most-recently loaded PGN and current move index ───
  let lastLoadedPGN = null;
  let lastMoveIndex  = -1;

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
    { name: 'Stockfish vs. other engines',   file: 'Stockfish_Selected.pgn' },
    { name: 'TCEC Cup 14 SF vs Lc0 (2024)',  file: 'TCEC_Cup14_SF_vs_Lc0_2024.pgn' },
    { name: 'TCEC S27 (2022) White Wins',    file: 'TCEC_Season27_WhiteWins_2022.pgn' },
    { name: 'TCEC S27 (2022) Black Wins',    file: 'TCEC_Season27_BlackWins_2022.pgn' },
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
	  if (!e.target.value) return;
      // remember this PGN and reset
      lastLoadedPGN = e.target.value;	  
	  divergedIndex = -1;
	  const title = e.target.selectedOptions[0].text;
	  game.reset();
	  game.load_pgn(e.target.value);
	  // set title before update so draw banner isn’t overwritten
	  document.getElementById('gameTitle').innerHTML = title;
	  updateBoard(true);
      // record where we are now
      lastMoveIndex = game.history().length - 1;
	  fetchAnnotations();
	  panel.classList.remove('open');
	  document.getElementById('main').scrollIntoView({
		behavior: 'smooth',
		block: 'start'
	  });
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
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
	
	onDrop: (src, dst) => {
	  // Check before the move is made
	  const curBefore = game.history().map(x => x.san);
	  const refBefore = fullHistory.map(x => x.san).slice(0, curBefore.length + 1);

	  // Make the move
	  const m = game.move({ from: src, to: dst, promotion: 'q' });
	  if (!m) return 'snapback';

	  // Check if new move breaks the PGN history
	  const curAfter = game.history().map(x => x.san);
	  const refAfter = fullHistory.map(x => x.san).slice(0, curAfter.length);
		if (JSON.stringify(curAfter) !== JSON.stringify(refAfter) && branchIndex < 0) {
		  branchIndex = curBefore.length - 1;
		}

	lastAction = 'move';
	window._skipDivergedReset = true;
	updateBoard(false);

	}

  });

  /* ------------------------------------------------------------------
     7. STATE
  ------------------------------------------------------------------*/
  let fullHistory   = [];
  let branchIndex = -1;  // move number of first off-PGN branch
  let prevHighlight = [];
  let divergedIndex = -1;  // NEW: index of divergence from PGN history
  let lastAction = null;
  let showEval      = true;
  let evalRetries = 0;
  let evalRetryTimer = null;


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
	// sync the Settings-panel checkbox
	document.getElementById('settingTheme').checked = (settings.theme === 'light');
	document.body.style.background =
	  settings.theme === 'dark' ? settings.bg : '';
	  
	/* board orientation */
	board.orientation(settings.flipBoard ? 'black' : 'white');

    /* CSS vars */
    document.documentElement.style.setProperty('--overlay-font', settings.font);
    document.documentElement.style.setProperty('--moves-font',  settings.font);
    document.documentElement.style.setProperty('--piece-scale',
      { small: .6, medium: .8, big: 1 }[settings.pieceSize]);


	//— center all pieces based on the new scale
	const boardEl = document.getElementById('board');
	const squareW = boardEl.clientWidth / 8;
	const scale   = { small: .6, medium: .8, big: 1 }[settings.pieceSize];
	const offset  = (squareW * (1 - scale)) / 2;
	document.querySelectorAll('#board img').forEach(img => {
	  const m = img.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
	  if (!m) return;
	  const tx = parseFloat(m[1]) + offset;
	  const ty = parseFloat(m[2]) + offset;
	  img.style.transform = `translate(${tx}px, ${ty}px)`;
	});

    /* history height */
    document.getElementById('moves').style.height =
      { smallest: '60px', small:'140px', medium:'300px', big:'450px' }[settings.historySize];

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

    document.getElementById('settingDrawDelay').value         = settings.drawDelay;
    document.getElementById('settingBadgeInitialDelay').value = settings.badgeInitialDelay;
    document.getElementById('settingRetryInterval').value     = settings.retryInterval;
    document.getElementById('settingTryLaterDuration').value  = settings.tryLaterDuration;

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
		  if (isNaN(score) || (score <= -999 && rank < 2)) return null;
		  return { move: m[1], score, rank };
		}).filter(Boolean);
	  }

	  const useProxy = settings.evalMode === 'proxy';
	  const baseURL = useProxy
		? '/.netlify/functions/queryall?'
		: 'https://www.chessdb.cn/cdb.php?action=queryall&';

	  const vURL = `${baseURL}board=${fen}&learn=0&showall=1`;
	  const cURL = `${baseURL}board=${fen}&learn=1&showall=1`;

	  let vTxt = null, cTxt = null;

	  try {
		[vTxt, cTxt] = await Promise.all([
		  fetch(vURL).then(r => r.text()),
		  fetch(cURL).then(r => r.text())
		]);
	  } catch (e) {
		console.warn('Fetch error:', e);
	  }

	  // Retry once with fallback if direct mode failed
	  if ((!vTxt || !cTxt) && !useProxy) {
		console.warn('Switching to fallback eval mode (proxy)');
		settings.evalMode = 'proxy';
		localStorage.setItem('chessBestSettings', JSON.stringify(settings));
		return fetchAnnotations(); // retry
	  }

	  try {
		const moveMap = new Map();
		parseResponse(cTxt).forEach(m => moveMap.set(m.move, m)); // cloud first
		parseResponse(vTxt).forEach(m => moveMap.set(m.move, m)); // verified overrides

		const allMoves = Array.from(moveMap.values())
		  .sort((a, b) => b.rank - a.rank || b.score - a.score);

		const list = isFinite(settings.topN) ? allMoves.slice(0, settings.topN) : allMoves;
		
    if (list.length > 0) {
      // Cancel any pending retry loop and reset the button immediately
      if (evalRetryTimer) {
        clearInterval(evalRetryTimer);
        evalRetryTimer = null;
      }
      const btn = document.getElementById('btnHideEval');
      btn.innerText = 'Hide Eval';
      btn.style.background = '';
    }
    
    list.forEach((m, i) => annotateMove(m.move, m.score, i === 0));
	  } catch (err) {
		console.error('Failed to fetch annotations:', err);
	  }
	}


  /* ------------------------------------------------------------------
     10. BOARD OVERLAYS / HISTORY RENDER (unchanged logic)
  ------------------------------------------------------------------*/
  function annotateMove(move, score, best) {
    const sq   = move.slice(-2);
    const cell = document.querySelector(`.square-${sq}`);
    if (!cell) return;

	// if there’s already an overlay here, keep only the higher score
	const newScore = parseInt(score, 10);
	const existingOv = cell.querySelector('.overlay');
	if (existingOv) {
	  const oldScore = parseInt(existingOv.innerText.replace('+',''), 10);
	  if (oldScore >= newScore) return;  // skip this weaker/duplicate badge
	  existingOv.remove();              // remove the old, keep going to draw new
	}

    const ov  = document.createElement('div');
    const num = parseInt(score, 10);
    ov.innerText = settings.notation==='dot' ? '•' : num>0?`+${num}`:num;
    ov.className = best ? 'overlay best'
                        : `overlay ${num>0?'positive':num<0?'negative':'zero'}`;
	ov.onclick = e => {
	  e.stopPropagation();
	  // Capture the position before branching
	  const curBefore = game.history().map(x => x.san);
	  const refBefore = fullHistory.map(x => x.san).slice(0, curBefore.length + 1);

	  // Execute the move
	  const m = game.move({ from: move.slice(0,2), to: sq, promotion: 'q' });
	  if (m) {
		// Compare to the original PGN path
		const curAfter = game.history().map(x => x.san);
		const refAfter = fullHistory.map(x => x.san).slice(0, curAfter.length);
		if (JSON.stringify(curAfter) !== JSON.stringify(refAfter) && branchIndex < 0) {
		  branchIndex = curBefore.length - 1;
		}

	  }

  	  lastAction = 'move';
	  window._skipDivergedReset = true;
	  updateBoard(false);
	};

    cell.appendChild(ov);
    // if badges arrive after “Try Later”, flip the button back
    const btn = document.getElementById('btnHideEval');
    if (btn.innerText === 'Try Later') { btn.innerText = 'Hide Eval'; btn.style.background = ''; }

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
          if (p[`i${col}`] === cur) td.classList.add('current');
		  if (
		    divergedIndex >= 0 &&
		    // only highlight once current history index ≥ divergence index
		    (game.history().length - 1) >= divergedIndex &&
		    p[`i${col}`] === divergedIndex
		  ) {
		    td.classList.add('diverged');
		  }

        }
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    div.appendChild(tbl);

    // Auto-scroll to show current move row
	const selected = tbl.querySelector('tr.selected');
	if (selected) {
		const container = document.getElementById('moves');
		const offsetTop = selected.offsetTop;
		const offsetHeight = selected.offsetHeight;
		const containerHeight = container.clientHeight;

		// Scroll the container so that selected is centered inside it
		container.scrollTo({
			top: offsetTop - (containerHeight / 2) + (offsetHeight / 2),
			behavior: 'smooth'
		});
	}

  }

  /* ------------------------------------------------------------------
     11. UPDATE BOARD
  ------------------------------------------------------------------*/
	function updateBoard(reset) {
	  // — Cancel any pending draw banner if we move again —
	  if (window.drawBannerTimeoutId) {
		clearTimeout(window.drawBannerTimeoutId);
		window.drawBannerTimeoutId = null;
		if (window.prevGameTitle) {
		  document.getElementById('gameTitle').innerHTML = window.prevGameTitle;
		  window.prevGameTitle = null;
		}
	  }

	  board.position(game.fen());
	  document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
	  
		if (reset) {
		  // only reload original PGN on a true reset
		  if (!window._skipDivergedReset) {
			fullHistory = game.history({ verbose: true });
			divergedIndex = -1;
		  }
		  // clear the skip-reset flag for next time
		  window._skipDivergedReset = false;
		}

	  persistGame();
	  
	  // ─── HISTORY-CLICK REBRANCH ───────────────────────────────────────────
	  if (!reset && lastAction === 'history' && divergedIndex >= 0) {
	    const clickedIndex = game.history().length - 1;
	    if (clickedIndex < divergedIndex) {
	      divergedIndex = clickedIndex;
	      fullHistory = game.history({ verbose: true });
	    }
	  }
	  // ────────────────────────────────────────────────────────────────────────

    // ─── HISTORY-NAV RE-BRANCHING ───────────────────────────────
    if (!reset && lastAction === 'history' && divergedIndex >= 0) {
      const clickedIndex = game.history().length - 1;
      // if user jumped back before the old branch point → start a new branch there
      if (clickedIndex < divergedIndex) {
        divergedIndex = clickedIndex;
        fullHistory = game.history({ verbose: true });
      }
    }
    // ───────────────────────────────────────────────────────────────

    // ─── Combined branching & history update ───
    if (!reset && lastAction === 'move') {
      const cur = game.history().map(x => x.san);
      const ref = fullHistory.map(x => x.san).slice(0, cur.length);
      // record the first branch point
      if (JSON.stringify(cur) !== JSON.stringify(ref) && divergedIndex < 0) {
        divergedIndex = cur.length - 1;
      }
      // always rebuild history to include the new move
      fullHistory = game.history({ verbose: true });
      if (!window._skipDivergedReset) {
        branchIndex = -1;
      }
    }
    // clear the action flag
    lastAction = null;

	// always re-render history & highlight
	renderHistory();
	highlightLast();
	  
	  // record current move index for the “return to last spot” link
	  if (!reset) {
	    lastMoveIndex = game.history().length - 1;
	  }



	// ─── Draw‐detection banner (use custom threefold check) ──────────────────────────────────
	{
	  const titleEl   = document.getElementById('gameTitle');
	  const prevTitle = window.prevGameTitle || titleEl.innerHTML;
	  let   drawMsg   = null;

	  // 1) Insufficient material
	  if (game.insufficient_material && game.insufficient_material()) {
		drawMsg = 'Draw — insufficient material';
	  }
	  // 2) Stalemate
	  else if (game.in_stalemate && game.in_stalemate()) {
		drawMsg = 'Draw — stalemate';
	  }
	  // 3) Three-fold repetition (custom)
	  else {
		// build a list of FEN signatures (fields 0–3) from initial position through every move
		const hist    = game.history();              // array of SAN strings
		const clone   = new Chess();                  // fresh board
		const sigs    = [ clone.fen().split(' ').slice(0,4).join(' ') ];
		hist.forEach(move => {
		  clone.move(move);
		  sigs.push(clone.fen().split(' ').slice(0,4).join(' '));
		});
		const curSig  = sigs[sigs.length - 1];
		const count   = sigs.filter(s => s === curSig).length;
		if (count >= 3) {
		  drawMsg = 'Draw — threefold repetition';
		}
		// 4) Fifty-move rule
		else {
		  const halfmoves =
			typeof game._half_moves === 'number'
			  ? game._half_moves
			  : parseInt(game.fen().split(' ')[4], 10);
		  if (halfmoves >= 100) {
			drawMsg = 'Draw — fifty-move rule';
		  }
		}
	  }

	  if (drawMsg) {
		// clear any pending banner
		if (window.drawBannerTimeoutId) {
		  clearTimeout(window.drawBannerTimeoutId);
		  window.drawBannerTimeoutId = null;
		}
		// show the message, then restore the title
		window.prevGameTitle      = prevTitle;
		titleEl.innerHTML         = drawMsg;
		window.drawBannerTimeoutId = setTimeout(() => {
		  titleEl.innerHTML         = window.prevGameTitle;
		  window.prevGameTitle      = null;
		  window.drawBannerTimeoutId = null;
		}, settings.drawDelay);
	  }
	}
	// ───────────────────────────────────────────────────────────────────────────────────────────




	  if (showEval) {
		setTimeout(fetchAnnotations, 0);
		document.querySelectorAll('.overlay').forEach(o => o.style.display = 'block');

		const overlays = document.querySelectorAll('.overlay');
		const btn = document.getElementById('btnHideEval');
		if (overlays.length === 0 && settings.topN > 0) {
		  setTimeout(() => {
			if (document.querySelectorAll('.overlay').length === 0) {
			  evalRetries = 0;
			  btn.innerText = 'Calc... 2x 6s';
			  btn.style.background = '#9c27b0';
			  startEvalRetry();
			}
		  }, settings.badgeInitialDelay);
		}
	  } else {
		document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
	  }

	  if (settings.nextDot && showEval) {
		const idx = game.history().length;
		if (idx < fullHistory.length) {
		  const nm = fullHistory[idx];
		  ['to', 'from'].forEach(k => {
			const cell = document.querySelector(`.square-${nm[k]}`);
			if (cell) {
			  const d = document.createElement('div');
			  d.className = 'next-dot';
			  d.style.bottom = '4px';
			  d.style.left = '4px';
			  cell.appendChild(d);
			}
		  });
		}
	  }
	}
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  
    /* ------------------------------------------------------------------
     11.5 AUTO EVAL RETRY LOGIC (after badges fail to load)
  ------------------------------------------------------------------*/
function startEvalRetry() {
  evalRetryTimer = setInterval(() => {
    evalRetries++;
    fetchAnnotations();
    const overlays = document.querySelectorAll('.overlay');
    const btn = document.getElementById('btnHideEval');

    if (overlays.length > 0) {
      // Got annotations—stop retrying and reset button
      clearInterval(evalRetryTimer);
      btn.innerText = 'Hide Eval';
      btn.style.background = '';
    } else if (evalRetries >= 2) {  // Two retries exhausted
      clearInterval(evalRetryTimer);
      // Show “Try Later” for 3 seconds
      btn.innerText = 'Try Later';
      btn.style.background = '#9c27b0';
      setTimeout(() => {
        // Revert back to default
        btn.innerText = 'Hide Eval';
        btn.style.background = '';
      }, settings.tryLaterDuration);
    }
  }, settings.retryInterval);
}

  /* ------------------------------------------------------------------
     12. JUMP TO MOVE & NAV BUTTONS
  ------------------------------------------------------------------*/
function jumpTo(i){
  game.reset();
  fullHistory.forEach((m,idx)=>{ if(idx<=i) game.move(m.san); });
  lastAction = 'history';
  updateBoard(false);
}

  ['first','prev','next','last'].forEach(id=>{
    document.getElementById(id).onclick=()=>{
      if(id==='first') jumpTo(0);
      else if(id==='prev'){
        game.undo();
        updateBoard(false);
      }
      else if(id==='next'){
        const m=fullHistory[game.history().length];
        if(m){
          game.move(m.san);
          updateBoard(false);
        }
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

	// FEN + moves
	document.getElementById('btnCopy').onclick = () => {
	  if (settings.ioFormat === 'fen') {
		// ChessDB style: initial position + full move list
		const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		const moves = fullHistory.map(m => m.from + m.to).join(' ');
		copyText(`${initialFen} moves ${moves}`);
	  } else {
		copyText(game.pgn());
	  }
	};

  /*
	// keep this in utils.js, same location
	document.getElementById('btnCopy').onclick = () => {
	  if (settings.ioFormat === 'fen') {
		// serialize full move list as long-algebraic
		const moves = fullHistory.map(m => m.from + m.to).join(' ');
		copyText(`${game.fen()} moves ${moves}`);
	  } else {
		copyText(game.pgn());
	  }
	};
*/

  /* ------------------------------------------------------------------
     14. ROW 2  (New | Save | Load)
  ------------------------------------------------------------------*/

  document.getElementById('btnNew').onclick = () => {
	divergedIndex = -1;
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
	  const file = e.target.files[0];
	  if (!file) return;
	  const reader = new FileReader();
	  reader.onload = evt => {
		  // remember this PGN blob
		  lastLoadedPGN = evt.target.result;
		  divergedIndex = -1;
		  game.load_pgn(evt.target.result);
		  document.getElementById('gameTitle').innerText = file.name;
		  updateBoard(true);
		  // record which move we landed on
		  lastMoveIndex = game.history().length - 1;
		  fetchAnnotations();
	  };
	  reader.readAsText(file);
	  e.target.value = '';
	};


  /* ------------------------------------------------------------------
     15. ROW 3  (Games | Theme | Settings)
  ------------------------------------------------------------------*/
  document.getElementById('btnGames').onclick = () =>
    document.getElementById('popularGamesPanel')
      .classList.toggle('open');

  document.getElementById('btnFlip').onclick = () => {
    settings.flipBoard = !settings.flipBoard;
    saveSettings();
    applySettings();
    updateBoard(false);
  };

  document.getElementById('btnSettings').onclick = () =>
    document.getElementById('settingsPanel')
      .classList.toggle('open');

  // Reset all settings back to defaults
  document.getElementById('btnResetSettings').onclick = () => {
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    location.reload();
  };

	  

  /* ------------------------------------------------------------------
     16. HIDE / SHOW EVAL
  ------------------------------------------------------------------*/

	document.getElementById('btnHideEval').onclick = () => {
	  showEval = !showEval;
	  // cancel any pending retries when hiding
	  if (!showEval && evalRetryTimer) clearInterval(evalRetryTimer);
	  const label = showEval ? 'Hide<br>Eval' : 'Show<br>Eval';
	  document.getElementById('btnHideEval').innerHTML = label;
	  // only fetch & show badges when visible
	  if (showEval) {
		setTimeout(fetchAnnotations, 0);
		document.querySelectorAll('.overlay')
		  .forEach(o => o.style.display = 'block');
	  } else {
		document.querySelectorAll('.overlay')
		  .forEach(o => o.style.display = 'none');
	  }
	  // keep next-move dots in sync
	  if (settings.nextDot) {
		document.querySelectorAll('.next-dot')
		  .forEach(d => d.style.display = showEval ? 'block' : 'none');
	  }
	};
	
	// initialize the Hide/Show label on page load
	document.getElementById('btnHideEval').innerHTML =
		showEval ? 'Hide<br>Eval' : 'Show<br>Eval';


 /* ------------------------------------------------------------------
    18. SETTINGS PANEL HANDLERS  (updated to include delay settings)
 ------------------------------------------------------------------*/
	[
	  'settingTopN',
	  'settingHistorySize',
	  'settingBg',
	  'settingFont',
	  'settingNotation',
	  'settingPieceSize',
	  'settingNextDot',
	  'settingTheme',
	  'settingDrawDelay',
	  'settingBadgeInitialDelay',
	  'settingRetryInterval',
	  'settingTryLaterDuration'
	].forEach(id => {
	  document.getElementById(id).onchange = e => {
		switch (id) {
		  case 'settingTopN':
			settings.topN = e.target.value === 'all'
			  ? Infinity
			  : parseInt(e.target.value, 10);
			break;
		  case 'settingHistorySize':
			settings.historySize = e.target.value;
			break;
		  case 'settingBg':
			settings.bg = e.target.value;
			break;
		  case 'settingFont':
			settings.font = e.target.value;
			break;
		  case 'settingNotation':
			settings.notation = e.target.value;
			break;
		  case 'settingPieceSize':
			settings.pieceSize = e.target.value;
			break;
		  case 'settingNextDot':
			settings.nextDot = e.target.checked;
			break;
		  case 'settingTheme':
			settings.theme = e.target.checked ? 'light' : 'dark';
			// auto-sync Main background to theme default
			if (settings.theme === 'light') {
			  settings.bg = '#ffffff';
			  document.getElementById('settingBg').value = '#ffffff';
			} else {
			  settings.bg = '#2e2e2e';
			  document.getElementById('settingBg').value = '#2e2e2e';
			}
			break;
		  // ─── New delay settings ───
		  case 'settingDrawDelay':
			settings.drawDelay = parseInt(e.target.value, 10) || 0;
			break;
		  case 'settingBadgeInitialDelay':
			settings.badgeInitialDelay = parseInt(e.target.value, 10) || 0;
			break;
		  case 'settingRetryInterval':
			settings.retryInterval = parseInt(e.target.value, 10) || 0;
			break;
		  case 'settingTryLaterDuration':
			settings.tryLaterDuration = parseInt(e.target.value, 10) || 0;
			break;
		  // ────────────────────────────
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
	const btn = document.getElementById('btnHideEval');
	btn.innerText = 'Hide Eval';
	btn.style.background = '';
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
  
  // ─── Clickable title: reload last PGN and jump back ───
  //const titleEl = document.getElementById('gameTitle');
  //titleEl.style.cursor = 'pointer';
  //titleEl.onclick = () => {
  //  if (!lastLoadedPGN) return;
  //  game.reset();
  //  game.load_pgn(lastLoadedPGN);
  //  divergedIndex = -1;  // clear highlight
  //  window._skipDivergedReset = false;   // ← force the “true” reset to rebuild fullHistory
  //  updateBoard(true);
  //  if (lastMoveIndex >= 0) jumpTo(lastMoveIndex);
  //};


	// ─── Clickable title: reload last PGN and jump back ───
	const titleEl = document.getElementById('gameTitle');
	titleEl.style.cursor = 'pointer';
	titleEl.onclick = () => {
	  if (!lastLoadedPGN) return;
	  // preserve the current orange‐move index before reset
	  const branchPoint = divergedIndex;
	  game.reset();
	  game.load_pgn(lastLoadedPGN);
	  // force a full rebuild of the original PGN history
	  window._skipDivergedReset = false;
	  updateBoard(true);
	  // jump to the orange (branched) move if present, otherwise to the last move
	  if (branchPoint >= 0) {
		jumpTo(branchPoint - 1);
	  } else if (lastMoveIndex >= 0) {
		jumpTo(lastMoveIndex);
	  }
	};

}

/* ------------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------------*/
window.addEventListener('load', initAll);
