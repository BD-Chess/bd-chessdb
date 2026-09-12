function initAll() {
  const STORAGE_KEY_SETTINGS = 'chessNewSettings-v7';
  const STORAGE_KEY_GAME     = 'chessNewGame-v7';
  const ENABLE_COACH         = false;

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
    bg: '#151a19',
    notation: 'score',
    font: '14px',
    pieceSize: 'medium',
    /* historySize: 'small', */
    historySize: window.innerWidth <= 600 ? 'smallest' : 'small',
    nextDot: true,     // show next‑move preview by default
    ioFormat: 'fen',   // NEW  (fen | pgn)  for Format / Input / Copy row
    /* DCC Lookahead settings */
    dccEnabled: true,
    dccDepth: 5,         // half-moves of lookahead (1-10)
    dccTopCandidates: 3, // how many top moves DCC evaluates (1-10)
    dccEvalFloor: 80,    // ignore moves more than this many cp below best
    dccTieThreshold: 10, // centipawns — below this = "tied"
    dccOnly: false,      // hide raw ChessDB scores, show only DCC view
    simSpeed: 1000,      // ms per move (0 = max speed, no board update)
    simGames: 5,         // games per simulation run
    dccTakeover: 'auto',  // when DCC takes over: 'auto' or number of half-moves
    opponentModel: 'realistic', // v0.6.0: 'perfect', 'realistic', 'weak'
    coachMode: 'silent',
    coachOpen: false
  };

  // DCC view toggle state
  let dccViewActive = false;
  // Store latest DCC results for the analysis panel
  let latestDCCResults = [];
  // v0.6.1: Per-move DCC annotations for PGN export
  // Keyed by half-move index → best DCC result at that position
  let dccMoveAnnotations = {};


	// ─── display the PGN “Opening” tag under the moves ─────────────────
	function showOpening() {
	  const hdrs = game.header();            // get all headers as an object
	  const name = hdrs && hdrs.Opening       // pull the Opening field
				   ? hdrs.Opening
				   : '';
	  document.getElementById('openingName')
			  .textContent = name;
	}
	// ────────────────────────────────────────────────────────────────────



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
  if (!ENABLE_COACH) {
    settings.coachMode = 'silent';
    settings.coachOpen = false;
  }
  function saveSettings() {
    invalidateDCCAnalysis();
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }
  const LICHESS_TOKEN_KEY   = 'chessBestLichessToken';
  const LICHESS_PUBLIC_TOKEN_URL = 'Lichess-API.txt';
  const ANTHROPIC_TOKEN_KEY = 'chessBestAnthropicKey';

  const DEFAULT_BOTS_CONFIG = {
    lichess_bots: [
      { label: 'Easy (~1000)', username: 'turochamp-2ply' },
      { label: 'Medium (~1600)', username: 'sargon-3ply' },
      { label: 'Strong (~2200)', username: 'CatrieverBot' },
      { label: 'Expert (~2600)', username: 'bot913' },
      { label: 'Elite (~3000+)', username: 'SF_Bot1nok' }
    ],
    time_controls: [
      { label: 'Bullet 1+0', clock: { limit: 60, increment: 0 } },
      { label: 'Bullet 2+1', clock: { limit: 120, increment: 1 } },
      { label: 'Blitz 3+0', clock: { limit: 180, increment: 0 } },
      { label: 'Blitz 5+0', clock: { limit: 300, increment: 0 } },
      { label: 'Rapid 10+0', clock: { limit: 600, increment: 0 } }
    ]
  };

  const DEFAULT_COACH_CONFIG = {
    coach_modes: [
      { value: 'silent', label: 'Silent', description: 'No coaching — just play' },
      { value: 'key-moments', label: 'Key moments', description: 'Coach speaks only when it matters' },
      { value: 'every-move', label: 'Every move', description: 'Coach comments on every move' },
      { value: 'ask-mode', label: 'Ask mode', description: 'Coach only speaks when you ask' }
    ]
  };

  let botsConfig = JSON.parse(JSON.stringify(DEFAULT_BOTS_CONFIG));
  let coachConfig = JSON.parse(JSON.stringify(DEFAULT_COACH_CONFIG));

  const playState = {
    active: false,
    mode: 'idle',
    userColor: 'w',
    waiting: false,
    startFen: null,
    preSessionFen: null,
    preSessionPgn: null,
    assistanceLocked: false,
    coachWarningShown: false,
    lichess: {
      token: '',
      gameId: null,
      botUsername: '',
      selectedColor: 'random',
      timeLabel: '',
      streamAbort: null,
      eventAbort: null,
      lastMoves: '',
      challengeId: null,
      ready: false,
      openingRetryCount: 0,
      preparedOpeningUci: '',
      preparedOpeningSan: '',
      preparedOpeningApplied: false,
      preparedOpeningSent: false
    },
    autoPilot: false,
    autoMoveBusy: false,
    launchMode: 'sim'
  };

  async function loadPlayConfig(url, fallback) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      return data && typeof data === 'object' ? data : fallback;
    } catch (err) {
      console.warn('Config fallback for', url, err);
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  async function bootPlayConfigs() {
    botsConfig = await loadPlayConfig('config/bots.json', DEFAULT_BOTS_CONFIG);
    if (ENABLE_COACH) {
      coachConfig = await loadPlayConfig('config/coach.json', DEFAULT_COACH_CONFIG);
    }
    hydrateSimModal();
    if (ENABLE_COACH) hydrateCoachModes();
    disableCoachUi();
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

function cleanOpeningTitle(value) {
  return String(value || '')
    .replace(/\s*\(Top\s*line\)\s*$/i, '')
    .trim();
}

function cleanEventTitle(value) {
  return String(value || '')
    .replace(/^\(([^,]+),\s*\d+\s*moves?\)\s*/i, '')
    .trim();
}

function parseTopLineFileMeta(fileStem) {
  const m = String(fileStem || '').match(/^([A-Za-z0-9+#-]+)_top_(\d+)_moves$/i);
  return m ? { seed: m[1], moveCount: m[2] } : null;
}

function buildPrettyGameTitle(tags, bucket, file, fallbackCoreTitle) {
  const fileStem = String(file || '').split('/').pop().replace(/\.pgn$/i, '');
  const topMeta = parseTopLineFileMeta(fileStem);
  const openingTitle = cleanOpeningTitle(tags.Opening || '');
  const eventTitle = cleanEventTitle(tags.Event || '');

  if (Array.isArray(bucket.files) && topMeta) {
    const parts = [];
    if (topMeta.seed) parts.push(topMeta.seed);
    if (openingTitle) parts.push(openingTitle);
    else if (eventTitle) parts.push(eventTitle);
    if (topMeta.moveCount) parts.push(`${topMeta.moveCount} moves`);
    return parts.join(' · ');
  }

  return openingTitle || eventTitle || fallbackCoreTitle;
}


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

  const placeholder = new Option(`${bucket.name} — Select a game`, '');
  placeholder.disabled = true;
  placeholder.selected = true;
  sel.appendChild(placeholder);

  panel.appendChild(sel);

  // 2) Fetch and populate options into the already‑appended select
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
          const coreTitle = (tags.Opening && (!tags.White || tags.White === 'Book'))
            ? `${cleanOpeningTitle(tags.Opening)}${tags.Mode ? ` (${tags.Mode})` : ''}`
            : `${tags.Result||''} ${tags.White||''} vs. ${tags.Black||''} (${tags.Site||''}, ${tags.Date||''})`;

          const title = buildPrettyGameTitle(tags, bucket, file, coreTitle);
          const opt = new Option(title, gt);
          opt.title = title;
          sel.appendChild(opt);
        });
      });
    })
    .catch(console.error);

	// 3) Wire up load-on-change
	sel.onchange = e => {
	  if (!e.target.value) return;

	  // Remember this PGN string and reset
	  lastLoadedPGN = e.target.value;
	  divergedIndex = -1;
	  const title = e.target.selectedOptions[0].text;

	  // Reset board/game state
	  game.reset();

	  // Extract “in-book” flags, strip all comments, then load clean PGN
	  bookFlags = extractBookFlags(e.target.value);
	  const cleanPgn = makeLoadablePgn(e.target.value);
	  game.load_pgn(cleanPgn);

	  // Update UI
	  document.getElementById('gameTitle').innerHTML = title;
	  updateBoard(true);
	  showOpening();
	  lastMoveIndex = game.history().length - 1;
	  fetchAnnotations();

	  // Close panel and scroll into view
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

  function stripRAV(pgn) {
    let out = '';
    let depth = 0;
    for (const ch of String(pgn || '')) {
      if (ch === '(') { depth++; continue; }
      if (ch === ')') { if (depth > 0) depth--; continue; }
      if (depth === 0) out += ch;
    }
    return out;
  }

  function makeLoadablePgn(pgn) {
    return stripRAV(String(pgn || '')).replace(/\{[^}]*\}/g, '');
  }

  const savedGame = localStorage.getItem(STORAGE_KEY_GAME);
  if (savedGame) {
    try { game.load_pgn(savedGame); }
    catch (e) { console.error('Bad saved PGN', e); }
  }

  /* ------------------------------------------------------------------
     6. CHESSBOARD.JS
  ------------------------------------------------------------------*/
  let resizeFrame = 0;
  window.addEventListener('8zc:resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { board.resize(); });
  });
  const board = Chessboard('board', {
    draggable: true,
    position : game.fen(),
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
	
	onDrop: (src, dst) => {
      if (simRunning || replayRunning) return 'snapback';
      if (playState.active && playState.mode === 'lichess' && (!playState.lichess.ready || playState.lichess.pendingMove)) return 'snapback';
	  if (playState.active && (playState.mode === 'dccbot' || playState.mode === 'lichess')) {
	    if (playState.autoPilot) return 'snapback';
	    if (playState.waiting) return 'snapback';
	    if (game.turn() !== playState.userColor) return 'snapback';
	  }

	  // Check before the move is made
	  const fenBeforeMove = game.fen();
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

	  if (playState.active && (playState.mode === 'dccbot' || playState.mode === 'lichess')) {
	    Promise.resolve(handleLiveUserMove(m, fenBeforeMove)).catch(err => {
	      console.error('Live move handler failed:', err);
	      reportSessionIssue('Move relay failed', err);
	    });
	  }

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
  // per‐move “in book” flags parsed from PGN comments
  let bookFlags = [];
  let evalRetries = 0;
  let evalRetryTimer = null;


  function persistGame() {
    if (game.history().length || game.fen() !== new Chess().fen())
      localStorage.setItem(STORAGE_KEY_GAME, game.pgn());
    else
      localStorage.removeItem(STORAGE_KEY_GAME);
  }


	/**
	 * Given raw PGN with {Book} comments,
	 * return a Boolean[] aligned to each half-move.
    */
	function extractBookFlags(pgn) {
	  const mainline = stripRAV(pgn);
	  // 1) Pull out every comment, note which are “Book”
	  const rawFlags = [];
	  mainline.replace(/\{([^}]*)\}/g, (_, comment) => {
		rawFlags.push(comment.includes('Book'));
		return '';
	  });

	  // 2) Strip comments & move-numbers, split into SAN tokens
	  const moves = mainline
		.replace(/\{[^}]*\}/g, '')          // remove comments
		.replace(/\d+\.(\.\.)?\s*/g, '')    // remove move numbers
		.trim()
		.split(/\s+/)                       // split on whitespace
		.filter(tok => tok && !/^\d+$/.test(tok) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok));

	  // 3) Map each SAN to its flag (default false)
	  return moves.map((_, i) => Boolean(rawFlags[i]));
	}

  /* ------------------------------------------------------------------
     8a. MDL+DCC EVAL LAYER — Core Functions
  ------------------------------------------------------------------*/

  const DCC = window.ChessDCC;
  let analysisGeneration = 0;
  let activeLookaheadId = 0;
  let latestDCCReceipt = null;
  const analysisMemo = new Map();
  const analysisPending = new Map();
  const requestPending = new Map();
  const CACHE_KEY = 'chessNewEvalCache-v7';
  let evalCache = {};
  try { evalCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (_) {}
  const ADSR_SHAPES = {
    sustained: { color: '#75e3b2', desc: 'Sustained: small evaluation changes' },
    building: { color: '#8cddff', desc: 'Building: evaluation improves along the line' },
    spike: { color: '#ffd58a', desc: 'Spike: a gain then a retreat' },
    collapse: { color: '#ff9da7', desc: 'Declining evaluation along the line' },
    volatile: { color: '#d3b8ff', desc: 'Volatile: large evaluation changes' },
    mixed: { color: '#bfccd9', desc: 'Mixed trajectory' },
    unknown: { color: '#a4b6c8', desc: 'Insufficient measured samples' }
  };
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function invalidateDCCAnalysis() {
    analysisGeneration++;
    activeLookaheadId++;
    latestDCCResults = [];
    latestDCCReceipt = null;
  }
  function evalTrend(seq) { return DCC.sensors(seq, game.fen()).trend; }
  function trendArrow(trend) { return { rising: '↑', falling: '↓', stable: '→' }[trend] || '—'; }
  function persistEvalCache() {
    const keys = Object.keys(evalCache);
    if (keys.length > 1500) keys.slice(0, keys.length - 1200).forEach(k => delete evalCache[k]);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(evalCache)); } catch (_) {}
  }
  async function fetchChessText(action, fen) {
    const source = settings.evalMode;
    const key = `${DCC.VERSION}:${source}:${action}:${fen}`;
    const cached = evalCache[key];
    if (cached && Date.now() - cached.time < 300000) return cached.text;
    if (requestPending.has(key)) return requestPending.get(key);
    const pending = (async () => {
      await sleep(150);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const base = source === 'proxy' && action === 'queryall'
          ? '/.netlify/functions/queryall?'
          : `https://www.chessdb.cn/cdb.php?action=${action}&`;
        const response = await fetch(`${base}board=${encodeURIComponent(fen)}&learn=0&showall=1`, { signal: controller.signal });
        if (!response.ok) throw new Error(`ChessDB HTTP ${response.status}`);
        const text = (await response.text()).trim();
        // Unknown, rate limited and error responses are deliberately not persisted.
        if (/^(move:|score:|eval:|checkmate|stalemate)/.test(text)) {
          evalCache[key] = { time: Date.now(), text };
          persistEvalCache();
        }
        return text;
      } catch (err) {
        console.warn(`ChessDB ${action} unavailable:`, err.name);
        return '';
      } finally { clearTimeout(timer); requestPending.delete(key); }
    })();
    requestPending.set(key, pending);
    return pending;
  }
  async function cachedFetchChessDB(fen) {
    const text = await fetchChessText('queryall', fen);
    const moves = text.split('|').map(line => {
      const m = line.match(/move:([a-h][1-8][a-h][1-8][qrbn]?),score:(-?\d+),rank:(\d+)/);
      return m ? { move: m[1], score: Number(m[2]), rank: Number(m[3]) } : null;
    }).filter(Boolean);
    return { fen, moves: DCC.legalMoves(Chess, fen, moves) };
  }
  async function fetchPV(fen) {
    const text = await fetchChessText('querypv', fen);
    const score = text.match(/score:(-?\d+)/), depth = text.match(/depth:(\d+)/), pv = text.match(/pv:([^\r\n]+)/);
    return { score: score ? Number(score[1]) : null, depth: depth ? Number(depth[1]) : 0, pv: pv ? pv[1].split('|').filter(Boolean) : [] };
  }
  async function fetchScore(fen) {
    const text = await fetchChessText('queryscore', fen);
    const score = text.match(/eval:(-?\d+)/);
    return score ? Number(score[1]) : null;
  }
  function updateDCCProgress(done, total) {
    const el = document.getElementById('dccProgress');
    if (!el) return;
    el.textContent = total > 0 ? `DCC ${done}/${total}` : '';
    el.style.color = '#8cddff';
  }
  async function runDCCLookahead(moveList, baseFen) {
    const id = ++activeLookaheadId;
    latestDCCResults = [];
    latestDCCReceipt = { status: 'pending' };
    renderDCCView();
    const result = await analyzePosition(baseFen, moveList);
    if (!result || id !== activeLookaheadId || game.fen() !== baseFen || !showEval) return;
    latestDCCResults = result.candidates.map(c => c.data);
    latestDCCReceipt = result.receipt;
    latestDCCResults.forEach(data => updateDCCBadge(data.move, data, 'done'));
    dccMoveAnnotations[baseFen] = latestDCCResults.slice();
    const progress = document.getElementById('dccProgress');
    if (progress) progress.textContent = `${result.receipt.completed || 0}/${result.receipt.total || 0} measured`;
    renderDCCView();
    if (settings.dccOnly) applyDCCOnlyBadges();
  }
  function updateDCCBadge(move, data, status) {
    const cell = document.querySelector(`.square-${move.slice(2, 4)}`);
    const ov = cell && cell.querySelector('.overlay');
    if (!ov || ov.dataset.move !== move) return;
    ov.querySelectorAll('.dcc-arrow,.dcc-loading,.dcc-adsr-label,.dcc-mdl-star,.dcc-tunnel-label').forEach(e => e.remove());
    ov.classList.remove('dcc-stable', 'dcc-unstable', 'dcc-mdl-pick');
    if (status !== 'done' || !data) return;
    ov.dataset.dccMove = move;
    ov.dataset.dccTrend = data.trend;
    ov.dataset.dccStability = Number.isFinite(data.stability) ? data.stability.toFixed(2) : '';
    ov.dataset.dccRank = String(latestDCCResults.findIndex(r => r.move === move) + 1);
    const mark = document.createElement('span');
    mark.className = 'dcc-arrow';
    mark.textContent = ' ' + (data.arrow || '—');
    ov.appendChild(mark);
    if (data.isMdlPick) {
      ov.classList.add('dcc-mdl-pick');
      const star = document.createElement('span'); star.className = 'dcc-mdl-star'; star.textContent = ' ★';
      star.title = 'Shared DCC policy choice (see DCC panel for reason)'; ov.appendChild(star);
    }
    if (Number.isFinite(data.stability)) ov.classList.add(data.stability > 0.6 ? 'dcc-stable' : 'dcc-unstable');
    ov.title = `${move}: raw ${data.raw ?? data.score} cp; ${data.status || 'partial'} DCC; mover perspective`;
  }
  function showDCCInfoPanel(ov) {
    const data = latestDCCResults.find(r => r.move === (ov.dataset.dccMove || ov.dataset.move));
    if (data) showDCCDetails(data);
  }
  function formatDCCScore(value) { return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${Math.round(value)}` : '—'; }
  function showDCCDetails(r) {
    const panel = document.getElementById('dccInfoPanel');
    if (!panel) return;
    const samples = (r.samples || []).map(s => `<span class="dcc-path-move">${s.move} <small>p${s.ply}: ${formatDCCScore(s.score)}</small></span>`).join(' <span aria-hidden="true">→</span> ');
    panel.innerHTML = `<strong>${r.move} · ${r.status}</strong><div class="dcc-info-path">${samples || 'No measured line available.'}</div><div class="dcc-info-summary">Mover POV · floor ${formatDCCScore(r.floor)} cp · variation ${formatDCCScore(r.volatility)} cp · recovery ${formatDCCScore(r.recovery)} cp<br>Observed ${r.observedPlies}/${r.targetPlies} plies · requested ${r.requestedPlies} · source PV depth ${r.pvDepth || '—'}</div>`;
    panel.style.display = 'block';
  }
  function renderDCCView() {
    const panel = document.getElementById('dccAnalysisPanel');
    if (!panel) return;
    panel.style.display = dccViewActive ? 'block' : 'none';
    if (!dccViewActive) return;
    if (!latestDCCResults.length) {
      panel.innerHTML = `<div class="dcc-analysis-empty">${latestDCCReceipt?.status === 'pending' ? 'Measuring candidate lines…' : 'No evaluated candidates yet. Show Eval or try another position.'}</div>`;
      return;
    }
    const rows = latestDCCResults.map((r, i) => `<tr class="dcc-analysis-row" data-move="${r.move}"><td>${r.isMdlPick ? '★' : i + 1}</td><td><button class="dcc-details-button" type="button" data-move="${r.move}" aria-label="Inspect ${r.move}">${r.move}</button></td><td>${formatDCCScore(r.raw)}</td><td>${formatDCCScore(r.endEval)}</td><td>${Number.isFinite(r.stability) ? Math.round(r.stability * 100) + '%' : '—'}</td><td>${r.observedPlies}/${r.targetPlies}${r.complete ? '' : ' · ?'}</td></tr>`).join('');
    panel.innerHTML = `<div class="dcc-policy-note">★ Shared DCC choice · scores in cp, mover POV</div><table class="dcc-analysis-table"><thead><tr><th>Pick</th><th>Move</th><th title="ChessDB candidate evaluation">Raw</th><th title="Last measured evaluation, mover perspective">End</th><th title="Stability requires at least 3 samples">Stable</th><th title="Observed / funded half-moves; ? means incomplete scores">Plies</th></tr></thead><tbody>${rows}</tbody></table><div class="dcc-analysis-pv">${latestDCCReceipt?.reason || ''}<br>${latestDCCReceipt?.completed || 0}/${latestDCCReceipt?.total || latestDCCResults.length} complete · ${latestDCCReceipt?.calls || 0} probes${latestDCCReceipt?.limited ? ' · time limit reached' : ''}. DCC rank is a heuristic, not an engine evaluation.</div>`;
    panel.querySelectorAll('.dcc-details-button').forEach(button => button.addEventListener('click', () => showDCCDetails(latestDCCResults.find(r => r.move === button.dataset.move))));
  }
  function applyDCCOnlyBadges() {
    if (!settings.dccOnly) return;
    document.querySelectorAll('.overlay').forEach(ov => {
      const index = latestDCCResults.findIndex(r => r.move === ov.dataset.move);
      if (index < 0) { ov.style.opacity = '0.45'; return; }
      const r = latestDCCResults[index];
      ov.style.opacity = '1';
      ov.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = ''; });
      let label = ov.querySelector('.dcc-only-label');
      if (!label) { label = document.createElement('span'); label.className = 'dcc-only-label'; ov.prepend(label); }
      label.textContent = `${index + 1}${r.complete ? '' : '?'}`;
    });
  }

  // ── Match Accuracy Tracker ──────────────────────────────────────
  let matchStats = { chessdbMatch: 0, dccMatch: 0, totalMoves: 0 };

  function updateMatchAccuracy() {
    const el = document.getElementById('dccAccuracyPanel');
    if (!el) return;
    if (matchStats.totalMoves === 0) {
      el.style.display = 'none';
      return;
    }
    const cdbPct = Math.round(100 * matchStats.chessdbMatch / matchStats.totalMoves);
    const dccPct = Math.round(100 * matchStats.dccMatch / matchStats.totalMoves);
    el.innerHTML = `
      <span class="acc-label">ChessDB accuracy:</span> <span class="acc-val">${cdbPct}%</span>
      &nbsp;|&nbsp;
      <span class="acc-label">DCC accuracy:</span> <span class="acc-val ${dccPct > cdbPct ? 'acc-better' : ''}">${dccPct}%</span>
      <span class="acc-count">(${matchStats.totalMoves} moves)</span>
    `;
    el.style.display = 'block';
  }

  // Track accuracy when user navigates through a loaded PGN
  function trackMoveAccuracy(playedMoveSan, allMoves, dccData) {
    if (!lastLoadedPGN || allMoves.length === 0) return;
    // Convert SAN to UCI-ish for comparison
    const probe = new Chess(game.fen());
    // allMoves[0] is chessdb best
    const chessdbBest = allMoves[0]?.move;
    // Find the played move's UCI
    const hist = game.history({ verbose: true });
    const lastPlayed = hist[hist.length - 1];
    if (!lastPlayed) return;
    const playedUCI = lastPlayed.from + lastPlayed.to;

    matchStats.totalMoves++;
    if (chessdbBest && playedUCI.startsWith(chessdbBest.slice(0, 4))) {
      matchStats.chessdbMatch++;
    }
    // DCC: check if the played move matches the DCC-preferred move
    // (highest stability + trend among top moves with lookahead data)
    if (dccData && dccData.bestMove) {
      if (playedUCI.startsWith(dccData.bestMove.slice(0, 4))) {
        matchStats.dccMatch++;
      }
    }
    updateMatchAccuracy();
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
    const histHeight = { smallest: '60px', small:'140px', medium:'300px', big:'450px' }[settings.historySize];
    document.getElementById('moves').style.height = histHeight;
    // v0.6.1: DCC panel matches history height
    const dccPanel = document.getElementById('dccAnalysisPanel');
    if (dccPanel) { dccPanel.style.maxHeight = histHeight; dccPanel.style.overflowY = 'auto'; }

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

    // ─── NEW: sync “Double Size” setting & apply it ────────────────
    document.getElementById('settingDoubleBoard').checked = settings.doubleBoard;
    // reuse the boardEl you declared above; no const here
    if (settings.doubleBoard) boardEl.classList.add('scaled');
    else boardEl.classList.remove('scaled');
    board.resize(); // tell chessboard.js to recalculate dimensions

    // ─── DCC Lookahead settings sync ─────────────────────────────────
    const dccEl = document.getElementById('settingDccEnabled');
    if (dccEl) dccEl.checked = settings.dccEnabled;
    const dccDepthEl = document.getElementById('settingDccDepth');
    if (dccDepthEl) dccDepthEl.value = settings.dccDepth;
    const dccTopEl = document.getElementById('settingDccTopCandidates');
    if (dccTopEl) dccTopEl.value = settings.dccTopCandidates;
    const dccFloorEl = document.getElementById('settingDccEvalFloor');
    if (dccFloorEl) dccFloorEl.value = settings.dccEvalFloor;
    const dccOnlyEl = document.getElementById('settingDccOnly');
    if (dccOnlyEl) dccOnlyEl.checked = settings.dccOnly;
    const simSpeedEl = document.getElementById('settingSimSpeed');
    if (simSpeedEl) simSpeedEl.value = settings.simSpeed;
    const simGamesEl = document.getElementById('settingSimGames');
    if (simGamesEl) simGamesEl.value = settings.simGames;
    const takeoverEl = document.getElementById('settingDccTakeover');
    if (takeoverEl) takeoverEl.value = settings.dccTakeover;
    const dccInfoPanel = document.getElementById('dccInfoPanel');
    if (dccInfoPanel && !settings.dccEnabled) dccInfoPanel.style.display = 'none';
    const dccAccPanel = document.getElementById('dccAccuracyPanel');
    if (dccAccPanel && !settings.dccEnabled) dccAccPanel.style.display = 'none';
    // v0.6.0: Opponent model sync
    const oppModelEl = document.getElementById('settingOpponentModel');
    if (oppModelEl) oppModelEl.value = settings.opponentModel;
    const coachModeEl = document.getElementById('coachModeSelect');
    if (coachModeEl) coachModeEl.value = settings.coachMode || 'key-moments';
    setCoachPanelOpen(!!settings.coachOpen);
    // ─────────────────────────────────────────────────────────────────
	
  }

  /* ------------------------------------------------------------------
     9. FETCH ANNOTATIONS (ChessDB.cn)
  ------------------------------------------------------------------*/
  async function fetchAnnotations() {
    if (!showEval || simRunning || replayRunning || (playState.active && playState.assistanceLocked)) return;
    const baseFen = game.fen(), generation = analysisGeneration;
    const response = await cachedFetchChessDB(baseFen);
    if (generation !== analysisGeneration || game.fen() !== baseFen || !showEval || simRunning || replayRunning) return;
    const allMoves = response.moves;
    const list = Number.isFinite(settings.topN) ? allMoves.slice(0, settings.topN) : allMoves;
    if (list.length) {
      clearInterval(evalRetryTimer); evalRetryTimer = null;
      const btn = document.getElementById('btnHideEval'); btn.innerText = 'Hide Eval'; btn.style.background = '';
    }
    list.forEach((move, i) => annotateMove(move.move, move.score, i === 0));
    if (settings.dccEnabled && allMoves.length) await runDCCLookahead(allMoves, baseFen);
    else { latestDCCResults = []; latestDCCReceipt = { status: 'unknown' }; renderDCCView(); }
  }

  /* ------------------------------------------------------------------
     10. BOARD OVERLAYS / HISTORY RENDER (unchanged logic)
  ------------------------------------------------------------------*/
  function annotateMove(move, score, best) {
    const sq   = move.slice(2, 4);
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
	
	// create the badge and tag it with its raw move string
	const ov  = document.createElement('div');
	ov.dataset.move = move;
	const num = parseInt(score, 10);
	ov.innerText = settings.notation==='dot' ? '•' : num>0?`+${num}`:num;

	const badgeClass = Math.abs(num) <= 20 ? 'zero'
					: num > 0 ? 'positive'
					: 'negative';

	ov.className = best ? 'overlay best' : `overlay ${badgeClass}`;

	ov.onclick = e => {
	  e.stopPropagation();
      if (playState.active || simRunning || replayRunning) return;
	  // Capture the position before branching
	  const curBefore = game.history().map(x => x.san);
	  const refBefore = fullHistory.map(x => x.san).slice(0, curBefore.length + 1);

	  // Execute the move
	  const m = game.move({ from: move.slice(0,2), to: sq, promotion: move[4] || 'q' });
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

	// ── DCC: click to show eval path in info panel ──────────────
	ov.addEventListener('click', (e) => {
	  if (ov.dataset.dccMove) {
	    showDCCInfoPanel(ov);
	  }
	}, true);
		// hover preview disabled intentionally; click remains active

	// clear preview highlights on mousedown (before your existing click logic runs)
	ov.addEventListener('mousedown', () => {
      document.querySelector(`.square-${move.slice(0, 2)}`)?.classList.remove('preview-square');
	  cell.classList.remove('preview-square');
	});
	// ──────────────────────────────────────────────────────────────────────────


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
	  // Cancel any running DCC lookahead
	  invalidateDCCAnalysis();
	  renderDCCView();
	  updateDCCProgress(0, 0); // clear progress indicator
	  // Hide DCC info panel on board change
	  const dccPanel = document.getElementById('dccInfoPanel');
	  if (dccPanel) dccPanel.style.display = 'none';
	  
		if (reset) {
		  // only reload original PGN on a true reset
		  if (!window._skipDivergedReset) {
			fullHistory = game.history({ verbose: true });
			// apply our parsed “in-book” flags
			fullHistory.forEach((mv,i) => {
			  mv.book = Boolean(bookFlags[i]);
			});			
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
      // if (JSON.stringify(cur) !== JSON.stringify(ref) && divergedIndex < 0) {
      if (fullHistory.length > cur.length
          && JSON.stringify(cur) !== JSON.stringify(ref)
          && divergedIndex < 0) {
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
        const count = game.in_threefold_repetition() ? 3 : 0;
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

		// ─── Next-move dot ──────────────────────────────────────────────
		if (settings.nextDot && showEval) {
		  const idx = game.history().length;
		  if (idx < fullHistory.length) {
			const nm = fullHistory[idx];
			['to','from'].forEach(k => {
			  const cell = document.querySelector(`.square-${nm[k]}`);
			  if (cell) {
				const d = document.createElement('div');
				// light-green for in-book moves
				const isBook = nm.book === true;
				d.className = isBook
				  ? 'next-dot book-dot'
				  : 'next-dot';
				d.style.bottom = '4px';
				d.style.left   = '4px';
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
  if (playState.active || simRunning || replayRunning) return;
  const headers = game.header();
  game.load(headers.FEN || new Chess().fen());
  Object.entries(headers).forEach(([k,v]) => game.header(k,v));
  fullHistory.forEach((m,idx)=>{ if(idx<=i) game.move(m.san); });
  lastAction = 'history';
  updateBoard(false);
}

  ['first','prev','next','last'].forEach(id=>{
    document.getElementById(id).onclick=()=>{
      if (playState.active || simRunning || replayRunning) return;
      if(id==='first') jumpTo(-1);
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
    if (playState.active || simRunning || replayRunning) return;
    const value = prompt(settings.ioFormat === 'fen' ? 'FEN (optionally followed by moves in UCI)' : 'Paste PGN');
    if (!value) return;
    const probe = new Chess();
    try {
      if (settings.ioFormat === 'fen') {
        const [fen, line] = value.trim().split(/\s+moves\s+/);
        if (!probe.load(fen)) throw new Error('Invalid FEN');
        for (const uci of (line || '').split(/\s+/).filter(Boolean)) if (!DCC.play(probe, uci)) throw new Error('Illegal move: ' + uci);
        lastLoadedPGN = null; bookFlags = [];
      } else {
        if (!probe.load_pgn(makeLoadablePgn(value))) throw new Error('Invalid PGN');
        lastLoadedPGN = value; bookFlags = extractBookFlags(value);
      }
      game.load_pgn(probe.pgn());
      if (!probe.history().length) game.load(probe.fen());
      window._skipDivergedReset = false;
      updateBoard(true); showOpening();
    } catch (err) { alert(err.message + '. The current game was kept.'); }
  };

  // ── v0.6.1: Generate PGN with DCC comments ────────────────────
  function generateDCCPgn() {
    const replay = new Chess(game.header().FEN || undefined);
    const hist = game.history({ verbose: true });
    const headers = game.header();
    let pgn = '';

    // PGN headers
    for (const [k, v] of Object.entries(headers)) {
      pgn += `[${k} "${v}"]\n`;
    }
    if (Object.keys(headers).length > 0) pgn += '\n';

    for (let i = 0; i < hist.length; i++) {
      const fenKey = replay.fen();
      const mv = hist[i];

      // Move number
      const moveNumber = Number(replay.fen().split(' ')[5]);
      if (replay.turn() === 'w') pgn += `${moveNumber}. `;
      else if (i === 0) pgn += `${moveNumber}... `;

      pgn += mv.san + ' ';

      // Look up DCC data for this position → this move
      const dccResults = dccMoveAnnotations[fenKey];
      if (dccResults) {
        const uci = mv.from + mv.to + (mv.promotion || '');
        const match = dccResults.find(r =>
          r.move === uci
        );
        if (match) {
          const parts = [`Raw cp: ${match.score > 0 ? '+' : ''}${match.score}`, `DCC rank-score: ${match.dccScore?.toFixed(1) ?? '?'}`, `coverage:${match.status || 'partial'}`, `plies:${match.observedPlies}/${match.targetPlies}`, 'POV:mover'];
          parts.push(match.arrow + (match.adsr ? match.adsr.label : ''));
          if (Number.isFinite(match.stability))
            parts.push(`stab:${match.stability.toFixed(2)}`);
          if (match.momentum !== undefined && Math.abs(match.momentum) > 0.1)
            parts.push(`momentum:${match.momentum > 0 ? '+' : ''}${match.momentum.toFixed(0)}`);
          if (match.adsr && match.adsr.shape !== 'unknown')
            parts.push(`ADSR:${match.adsr.shape}`);
          if (match.tunnel) parts.push('⛏tunnel');
          pgn += `{${parts.join(' ')}} `;
        }
      }

      replay.move(mv.san);
    }

    // Result
    if (game.in_checkmate()) pgn += game.turn() === 'w' ? '0-1' : '1-0';
    else if (game.in_draw() || game.in_stalemate()) pgn += '1/2-1/2';
    else pgn += '*';

    return pgn;
  }

	// FEN + moves
	document.getElementById('btnCopy').onclick = () => {
	  if (settings.ioFormat === 'fen') {
		// ChessDB style: initial position + full move list
		const initialFen = game.header().FEN || new Chess().fen();
		const moves = game.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')).join(' ');
		copyText(`${initialFen} moves ${moves}`);
	  } else {
		copyText(generateDCCPgn());
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
    if (playState.active || simRunning || replayRunning) return;
    lastLoadedPGN = null; bookFlags = []; dccMoveAnnotations = {}; window._skipDivergedReset = false;
	divergedIndex = -1;
    game.reset();
    updateBoard(true);
    document.getElementById('openingName').textContent = '';
    // reset title to the original placeholder
    document.getElementById('gameTitle').innerHTML = 'Analyse moves with ChessDB';
  };


  document.getElementById('btnSave').onclick = () => {
    const blob=new Blob([generateDCCPgn()],{type:'text/plain'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='chessbest_dcc_game.pgn';
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
		  //game.load_pgn(evt.target.result);
		  // parse out “{Book}” flags, then strip comments before loading
		  bookFlags = extractBookFlags(evt.target.result);
		  const clean = makeLoadablePgn(evt.target.result);
		  game.load_pgn(clean);
		  document.getElementById('gameTitle').innerText = file.name;
		  updateBoard(true);
		  showOpening();
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
	   17. Thresholds collapse/expand in Settings panel
	  ------------------------------------------------------------------*/
	const btnThresh = document.getElementById('toggleThresholds');
	const grpThresh = document.getElementById('thresholdSettings');
	btnThresh.addEventListener('click', e => {
	  e.preventDefault();
	  grpThresh.classList.toggle('hidden');
	  btnThresh.innerText = grpThresh.classList.contains('hidden')
		? 'Thresholds ▼'
		: 'Thresholds ▲';
	});
	/* ─────────────────────────────────────────────────────────────────── */

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
	  'settingDoubleBoard',
	  'settingTheme',
	  'settingDrawDelay',
	  'settingBadgeInitialDelay',
	  'settingRetryInterval',
	  'settingTryLaterDuration',
	  'settingDccEnabled',
	  'settingDccDepth',
	  'settingDccTopCandidates',
	  'settingDccEvalFloor',
	  'settingDccOnly',
	  'settingSimSpeed',
	  'settingSimGames',
	  'settingDccTakeover',
	  'settingOpponentModel'
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
		  // ─── NEW case for Double Size ───
		  case 'settingDoubleBoard':
			settings.doubleBoard = e.target.checked;
			break;
		  case 'settingTheme':
			settings.theme = e.target.checked ? 'light' : 'dark';
			// auto-sync Main background to theme default
			if (settings.theme === 'light') {
			  settings.bg = '#ffffff';
			  document.getElementById('settingBg').value = '#ffffff';
			} else {
			  settings.bg = '#151a19';
			  document.getElementById('settingBg').value = '#151a19';
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
		  // ─── DCC Lookahead settings ───
		  case 'settingDccEnabled':
			settings.dccEnabled = e.target.checked;
			break;
		  case 'settingDccDepth':
			settings.dccDepth = parseInt(e.target.value, 10) || 5;
			break;
		  case 'settingDccTopCandidates':
			settings.dccTopCandidates = parseInt(e.target.value, 10) || 3;
			break;
		  case 'settingDccEvalFloor':
			settings.dccEvalFloor = parseInt(e.target.value, 10) || 80;
			break;
		  case 'settingDccOnly':
			settings.dccOnly = e.target.checked;
			break;
		  case 'settingSimSpeed':
			settings.simSpeed = parseInt(e.target.value, 10);
			break;
		  case 'settingSimGames':
			settings.simGames = parseInt(e.target.value, 10) || 5;
			break;
		  case 'settingDccTakeover':
			settings.dccTakeover = e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10);
			break;
		  // v0.6.0: Opponent model
		  case 'settingOpponentModel':
			settings.opponentModel = e.target.value;
			break;
		  // ────────────────────────────
		}
		saveSettings();
		applySettings();
		updateBoard(false);
	  };
	});
	
	// ─── DISABLE “Double Size” ON MOBILE ────────────────────────────────
	const isMobile = /Mobi|Android/i.test(navigator.userAgent);
	const dblCB    = document.getElementById('settingDoubleBoard');
	if (isMobile && dblCB) {
	  dblCB.disabled = true;                          // make the checkbox inert
	  dblCB.parentNode.classList.add('disabled-setting'); // gray out its label
	}
	// ─────────────────────────────────────────────────────────────────────


  /* ------------------------------------------------------------------
     19. KEYBOARD NAVIGATION  (unchanged)
  ------------------------------------------------------------------*/
  document.addEventListener('keydown',e=>{
    if (playState.active || simRunning || replayRunning || e.target.closest('[role=dialog], dialog')) return;
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
	const btn = document.getElementById('btnHideEval');
	btn.innerText = 'Hide Eval';
	btn.style.background = '';
    if(e.key==='ArrowLeft'){ game.undo(); updateBoard(false); }
    else if(e.key==='ArrowRight'){
      const m=fullHistory[game.history().length];
      if(m){ game.move(m.san); updateBoard(false); }
    } else if(e.key==='Home') jumpTo(-1);
    else if(e.key==='End')  jumpTo(fullHistory.length-1);
  });

  /* ------------------------------------------------------------------
     INIT
  ------------------------------------------------------------------*/
  applySettings();
  updateBoard(true);
  showOpening();
  refreshPlayUi();
  disableCoachUi();
  bootPlayConfigs().catch(err => console.warn('Play config boot failed:', err));

  document.querySelectorAll('input[name="simOpponent"]').forEach(el => {
    el.addEventListener('change', syncSimModalState);
  });
  const simStartBtn = document.getElementById('simStartBtn');
  if (simStartBtn) simStartBtn.addEventListener('click', () => {
    launchFromSimModal().catch(err => {
      const msg = String(err?.message || err || 'unknown error');
      console.warn('Play start failed:', err);
      updateSimStatus(`Start failed: ${msg}`);
      leaveActiveSession('');
    });
  });
  const simCancelBtn = document.getElementById('simCancelBtn');
  if (simCancelBtn) simCancelBtn.addEventListener('click', closeSimModal);
  const simModal = document.getElementById('simModal');
  if (simModal) simModal.addEventListener('click', e => {
    if (e.target === simModal) closeSimModal();
  });

  const coachModeSelect = document.getElementById('coachModeSelect');
  if (coachModeSelect) coachModeSelect.addEventListener('change', e => {
    settings.coachMode = e.target.value;
    saveSettings();
  });
  const coachCloseBtn = document.getElementById('btnCoachClose');
  if (coachCloseBtn) coachCloseBtn.addEventListener('click', () => setCoachPanelOpen(false));
  const coachClearBtn = document.getElementById('btnCoachClear');
  if (coachClearBtn) coachClearBtn.addEventListener('click', clearCoachMessages);
  const coachAskBtn = document.getElementById('btnCoachAsk');
  if (coachAskBtn) coachAskBtn.addEventListener('click', () => askCoachQuestion());
  const coachAskInput = document.getElementById('coachAskInput');
  if (coachAskInput) coachAskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      askCoachQuestion();
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // SIMULATION ENGINE — DCC vs Raw ChessDB
  // ═══════════════════════════════════════════════════════════════════

  let simRunning = false;
  let simAbort = false;
  let preSimFen = null;      // saved before sim starts
  let preSimMoveIndex = -1;  // where we were in the game

  // Pick move using DCC: eval floor + candidates + PV+ADSR ranking
  async function pickDCCMove(simGame, overrideCandidates) {
    const fen = simGame.fen();
    const analysis = await analyzePosition(fen, undefined, { settings: overrideCandidates ? { dccTopCandidates: overrideCandidates } : {} });
    if (!analysis || simGame.fen() !== fen || !analysis.dcc1Move) return null;
    const selected = analysis.allMoves.find(m => m.move === analysis.dcc1Move);
    if (!selected) return null;
    const detail = analysis.candidates.find(c => c.move === selected.move)?.data;
    dccMoveAnnotations[fen] = analysis.candidates.map(c => c.data);
    return { ...selected, _dccScore: detail?.dccScore, _stability: detail?.stability,
      _adsrShape: detail?.adsr.shape, _momentum: detail?.momentum, _tunnel: detail?.tunnel,
      _receipt: analysis.receipt };
  }

  // Pick move using raw ChessDB: opponent model governs selection
  // v0.6.0: supports 'perfect', 'realistic', 'weak' models
  async function pickRawMove(simGame) {
    const result = await cachedFetchChessDB(simGame.fen());
    if (!result.moves || result.moves.length === 0) return null;
    
    const model = settings.opponentModel || 'realistic';
    
    if (model === 'perfect') {
      return result.moves[0]; // always top-1
    } else if (model === 'weak') {
      // Uniform random from top-5
      const pool = result.moves.slice(0, Math.min(5, result.moves.length));
      return pool[Math.floor(Math.random() * pool.length)];
    } else {
      // Realistic: weighted random from top-3 (60/30/10)
      const pool = result.moves.slice(0, Math.min(3, result.moves.length));
      const weights = [0.6, 0.3, 0.1];
      let r = Math.random(), cum = 0;
      for (let i = 0; i < pool.length; i++) {
        cum += weights[Math.min(i, weights.length - 1)];
        if (r < cum) return pool[i];
      }
      return pool[0];
    }
  }

  // Update sim status bar
  function updateSimStatus(msg) {
    const bar = document.getElementById('simStatusBar');
    if (bar) { bar.textContent = msg; bar.style.display = 'block'; }
  }

  // v0.6.1: Export sim results as CSV for Python analysis
  function exportSimCSV(stats) {
    const header = 'game,move_num,fen,move,raw_score,dcc_score,stability,adsr_shape,momentum,tunnel,picked_by\n';
    let csv = header;
    stats.games.forEach((g, gi) => {
      (g.moveLog || []).forEach(row => {
        csv += `${gi+1},${row.move_num},"${row.fen}",${row.move},${row.raw_score},${row.dcc_score},${row.stability},${row.adsr_shape},${row.momentum},${row.tunnel},${row.picked_by}\n`;
      });
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chessdcc_sim_results.csv';
    a.click(); URL.revokeObjectURL(a.href);
  }

  // Render sim stats dashboard
  function renderSimStats(stats) {
    const panel = document.getElementById('simStatsPanel');
    if (!panel) return;
    const both = stats.dccColor === 'both';
    const first = stats.games.filter(g => g.winner === (both ? 'white' : 'dcc')).length;
    const second = stats.games.filter(g => g.winner === (both ? 'black' : 'raw')).length;
    const draws = stats.games.filter(g => g.winner === 'draw').length;
    const incomplete = stats.games.filter(g => g.winner === 'incomplete').length;
    const title = both ? 'DCC self-play' : 'DCC vs Raw ChessDB';
    panel.innerHTML = `<div class="sim-stats-header"><span class="sim-title">${title} · ${stats.games.length} games</span></div>
      <div class="sim-stats-grid"><div class="sim-stat"><strong class="sim-num">${first}</strong><div>${both ? 'White' : 'DCC'} wins</div></div><div class="sim-stat"><strong class="sim-num">${second}</strong><div>${both ? 'Black' : 'Raw'} wins</div></div><div class="sim-stat"><strong class="sim-num">${draws}</strong><div>Draws</div></div><div class="sim-stat"><strong class="sim-num">${incomplete}</strong><div>Incomplete</div></div></div>
      <div class="sim-games-list">${stats.games.map((g,i) => `<div class="sim-game-row"><span>Game ${i+1}</span><span>${g.moves} plies</span><span>${g.result}</span></div>`).join('')}</div>
      <p class="dcc-policy-note">${both ? 'Both colors use the same DCC policy.' : 'Exploratory games with the selected opponent model.'} Interrupted or unknown positions are not counted as draws. This is not an Elo benchmark.</p>
      ${stats.games.some(g => g.moveLog?.length) ? '<button id="btnExportCSV" class="btn">Export CSV</button>' : ''}`;
    panel.style.display = 'block';
    const button = document.getElementById('btnExportCSV');
    if (button) button.onclick = () => exportSimCSV(stats);
  }

  // Run one simulated game
  async function runOneGame(dccColor, gameNum, totalGames, visualize, startFen) {
    const generation = analysisGeneration;
    const simGame = new Chess(startFen || undefined);
    let moveCount = 0;
    const maxMoves = 200;
    const bothDCC = (dccColor === 'both');
    let dccActive = false; // DCC hasn't taken over yet
    const moveLog = []; // v0.6.1: per-move data for CSV export

    // Book phase: play from ChessDB top moves until DCC takeover
    // Skip if starting from a custom position (user navigated there)
    const isStartPos = !startFen || startFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const takeoverSetting = settings.dccTakeover;
    const maxBookMoves = (takeoverSetting === 'auto') ? 30 : parseInt(takeoverSetting, 10);

    if (isStartPos) {
      for (let i = 0; i < maxBookMoves && !simGame.game_over(); i++) {
        if (simAbort || generation !== analysisGeneration) return { winner: 'abort', moves: 0, result: 'aborted' };
        const result = await cachedFetchChessDB(simGame.fen());
        if (simAbort || generation !== analysisGeneration) return { winner: 'abort', moves: moveCount, result: 'aborted' };
        if (!result.moves || result.moves.length === 0) break;

        // Auto mode: DCC takes over when DB coverage thins out (< 3 candidates)
        if (takeoverSetting === 'auto' && result.moves.length < 3) {
          dccActive = true;
          break;
        }

        // Book move: pick randomly from top 3 (creates variety between games)
        const pool = result.moves.slice(0, Math.min(3, result.moves.length));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const m = simGame.move({
          from: pick.move.slice(0, 2), to: pick.move.slice(2, 4),
          promotion: pick.move.length > 4 ? pick.move[4] : 'q'
        });
        if (!m) break;
        moveCount++;

        updateSimStatus(`Game ${gameNum}/${totalGames} · Book move ${moveCount}: ${pick.move} (${result.moves.length} candidates)`);

        if (visualize && settings.simSpeed > 0) {
          board.position(simGame.fen());
          await sleep(Math.max(100, settings.simSpeed / 3));
        }
      }
    }
    dccActive = true; // DCC always active after book phase

    // Main game loop
    while (!simGame.game_over() && moveCount < maxMoves) {
      if (simAbort || generation !== analysisGeneration) return { winner: 'abort', moves: moveCount, result: 'aborted' };

      const turn = simGame.turn(); // 'w' or 'b'
      // In 'both' mode: both sides use DCC. Otherwise: DCC vs Raw.
      const useDCC = bothDCC || (turn === dccColor);
      let pick = useDCC ? await pickDCCMove(simGame) : await pickRawMove(simGame);

      if (simAbort || generation !== analysisGeneration) return { winner: 'abort', moves: moveCount, result: 'aborted' };
      // Fallback: try querybest if queryall returned nothing
      if (!pick) {
        await sleep(200);
        try {
          const fbUrl = `https://www.chessdb.cn/cdb.php?action=querybest&board=${encodeURIComponent(simGame.fen())}&learn=0`;
          const fbTxt = await fetchChessText('querybest', simGame.fen());
          const fbm = fbTxt.match(/move:(\w+)/);
          if (fbm) pick = { move: fbm[1], score: null };
        } catch(e) {}
      }

      if (simAbort || generation !== analysisGeneration) return { winner: 'abort', moves: moveCount, result: 'aborted' };
      if (!pick) break; // truly unknown position

      const decisionFen = simGame.fen();
      const m = simGame.move({
        from: pick.move.slice(0, 2), to: pick.move.slice(2, 4),
        promotion: pick.move.length > 4 ? pick.move[4] : 'q'
      });
      if (!m) break;
      moveCount++;

      // v0.6.1: Log move data for CSV export
      moveLog.push({
        move_num: moveCount,
        fen: decisionFen,
        move: pick.move,
        raw_score: pick.score,
        dcc_score: pick._dccScore !== undefined ? pick._dccScore.toFixed(1) : '',
        stability: Number.isFinite(pick._stability) ? pick._stability.toFixed(2) : '',
        adsr_shape: pick._adsrShape || '',
        momentum: pick._momentum !== undefined ? pick._momentum.toFixed(1) : '',
        tunnel: pick._tunnel ? 'true' : 'false',
        picked_by: useDCC && pick._receipt ? 'dcc' : 'raw-fallback'
      });

      const sideLabel = bothDCC ? (turn === 'w' ? 'W' : 'B') : (useDCC ? 'DCC' : 'Raw');
      updateSimStatus(`Game ${gameNum}/${totalGames} · Move ${moveCount} · ${sideLabel}: ${pick.move} (${pick.score > 0 ? '+' : ''}${pick.score})`);

      if (visualize && settings.simSpeed > 0) {
        board.position(simGame.fen());
        await sleep(settings.simSpeed);
      }
    }

    // Determine winner
    let winner = 'incomplete', result = '* incomplete';
    if (simGame.in_checkmate()) {
      const loser = simGame.turn(); // side that's in checkmate
      if (bothDCC) {
        // Both sides DCC: report which color won
        winner = loser === 'w' ? 'black' : 'white';
      } else {
        winner = (loser === dccColor) ? 'raw' : 'dcc';
      }
      result = loser === 'w' ? '0-1' : '1-0';
    } else if (simGame.in_stalemate()) {
      winner = 'draw'; result = '½-½ stalemate';
    } else if (simGame.in_draw()) {
      winner = 'draw'; result = '½-½ draw';
    } else if (moveCount >= maxMoves) {
      result = '* move limit reached';
    } else {
      result = '* incomplete: no evaluated move';
    }

    if (visualize && settings.simSpeed > 0) {
      board.position(simGame.fen());
    }

    return { winner, moves: moveCount, result, moveLog };
  }

  // Main simulation orchestrator
  async function runSimulation(dccColor, startFen) {
    if (simRunning) { simAbort = true; invalidateDCCAnalysis(); return; }
    if (replayRunning || playState.active) return;
    invalidateDCCAnalysis();
    simRunning = true;
    simAbort = false;

    const isBoth = (dccColor === 'both');
    const numGames = settings.simGames;
    const visualize = settings.simSpeed > 0;
    const statsPanel = document.getElementById('simStatsPanel');
    const statusBar = document.getElementById('simStatusBar');
    const btnW = document.getElementById('btnSimW');
    const btnB = document.getElementById('btnSimB');
    const btnS = document.getElementById('btnSim');

    // Update button states
    if (isBoth) {
      btnS.textContent = 'Stop';
      btnS.style.background = '#ff4c4c';
      btnS.style.color = '#fff';
    } else {
      const activeBtn = dccColor === 'w' ? btnW : btnB;
      activeBtn.textContent = 'Stop';
      activeBtn.style.background = '#ff4c4c';
      activeBtn.style.color = '#fff';
    }

    // Disable eval badges during simulation — they can't keep up
    showEval = false;
    document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
    document.getElementById('btnHideEval').innerHTML = 'Sim…';
    document.getElementById('btnHideEval').style.background = '#34d399';

    // Save pre-sim position for title-click restore
    preSimFen = game.fen();
    preSimMoveIndex = game.history().length - 1;

    if (!visualize) {
      document.getElementById('board-container').style.opacity = '0.2';
      document.getElementById('moves').style.display = 'none';
    } else {
      document.getElementById('moves').style.display = 'none';
    }

    statusBar.style.display = 'block';

    const colorLabel = isBoth ? 'both' : dccColor;
    const stats = { dccColor: colorLabel, games: [] };

    // Show stats panel immediately (don't wait for first game to finish)
    renderSimStats(stats);

    // Build schedule
    const schedule = [];
    if (isBoth) {
      // Sim mode: both sides DCC, N games from current position
      for (let i = 0; i < numGames; i++) {
        schedule.push({ color: 'both', label: `${i+1}` });
      }
    } else {
      // SimW/SimB: DCC vs Raw, N games from current position
      for (let i = 0; i < numGames; i++) {
        schedule.push({ color: dccColor, label: `${i+1}` });
      }
    }

    try {
    for (let i = 0; i < schedule.length; i++) {
      if (simAbort) break;
      const s = schedule[i];
      const modeLabel = s.color === 'both' ? 'DCC vs DCC' : `DCC=${s.color === 'w' ? 'White' : 'Black'}`;
      updateSimStatus(`Game ${s.label} (${modeLabel}) ${i+1}/${schedule.length}…`);
      const result = await runOneGame(s.color, i + 1, schedule.length, visualize, startFen);
      if (result.winner === 'abort') break;
      result.dccSide = s.color;
      stats.games.push(result);
      renderSimStats(stats);
    }

    } catch (err) { updateSimStatus('Simulation stopped: ' + err.message); } finally {
    // Restore UI fully
    simRunning = false;
    simAbort = false;
    btnW.textContent = 'SimW'; btnW.style.background = '#2a3020'; btnW.style.color = '#34d399';
    btnB.textContent = 'SimB'; btnB.style.background = '#2a2030'; btnB.style.color = '#a78bfa';
    btnS.textContent = 'Sim'; btnS.style.background = '#2a2520'; btnS.style.color = '#f59e0b';
    statusBar.style.display = 'none';
    document.getElementById('board-container').style.opacity = '1';
    document.getElementById('moves').style.display = '';

    // Restore eval badges
    showEval = true;
    const hideBtn = document.getElementById('btnHideEval');
    hideBtn.innerHTML = 'Hide<br>Eval';
    hideBtn.style.background = '';

    // Restore board to the real game position
    board.position(game.fen());
    updateBoard(false);

    }
    // Show final stats
    renderSimStats(stats);
    updateSimStatus(`Done: ${stats.games.length} games`);
    setTimeout(() => { statusBar.style.display = 'none'; }, 3000);
  }


  // ═══════════════════════════════════════════════════════════════════
  // PLAY MODAL + LIVE PLAY + COACH (v0.7.0 experimental)
  // ═══════════════════════════════════════════════════════════════════

  function getStartFen() {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  function normalizeUci(moveObj) {
    if (!moveObj) return '';
    if (typeof moveObj === 'string') return moveObj;
    return (moveObj.from || '') + (moveObj.to || '') + (moveObj.promotion || '');
  }

  function setBoardThinking(on) {
    const el = document.getElementById('board-container');
    if (!el) return;
    el.classList.toggle('live-thinking', !!on);
  }

  function disableCoachUi() {
    if (ENABLE_COACH) return;
    settings.coachMode = 'silent';
    settings.coachOpen = false;
    const panel = document.getElementById('coachPanel');
    const btn = document.getElementById('btnCoach');
    const askInput = document.getElementById('coachAskInput');
    const askBtn = document.getElementById('btnCoachAsk');
    if (panel) {
      panel.style.display = 'none';
      panel.hidden = true;
    }
    if (btn) btn.style.display = 'none';
    if (askInput) askInput.disabled = true;
    if (askBtn) askBtn.disabled = true;
  }

  function setCoachNotice(text) {
    if (!ENABLE_COACH) return;
    const el = document.getElementById('coachNotice');
    if (!el) return;
    if (!text) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = text;
  }

  function queueCoachMessage(kind, text, meta='') {
    if (!ENABLE_COACH) return;
    const box = document.getElementById('coachMessages');
    if (!box || !text) return;
    const div = document.createElement('div');
    div.className = `coach-msg ${kind}`;
    if (meta) {
      const metaEl = document.createElement('span');
      metaEl.className = 'coach-msg-meta';
      metaEl.textContent = meta;
      div.appendChild(metaEl);
    }
    const body = document.createElement('div');
    body.textContent = text;
    div.appendChild(body);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function clearCoachMessages() {
    if (!ENABLE_COACH) return;
    const box = document.getElementById('coachMessages');
    if (box) box.innerHTML = '';
  }

  function setCoachPanelOpen(open) {
    if (!ENABLE_COACH) {
      disableCoachUi();
      return;
    }
    settings.coachOpen = !!open;
    saveSettings();
    const panel = document.getElementById('coachPanel');
    const btn = document.getElementById('btnCoach');
    if (panel) panel.style.display = open ? 'block' : 'none';
    if (btn) btn.classList.toggle('coach-active', !!open);
  }

  function hydrateCoachModes() {
    if (!ENABLE_COACH) return;
    const sel = document.getElementById('coachModeSelect');
    if (!sel) return;
    sel.innerHTML = '';
    (coachConfig.coach_modes || []).forEach(mode => {
      const opt = document.createElement('option');
      opt.value = mode.value;
      opt.textContent = mode.label;
      sel.appendChild(opt);
    });
    sel.value = settings.coachMode || 'key-moments';
  }

  function hydrateSimModal() {
    const botSel = document.getElementById('lichessBotLevel');
    const timeSel = document.getElementById('simTimeSelect');
    const lichessRadio = document.querySelector('input[name="simOpponent"][value="lichess"]');
    if (!botSel || !timeSel) return;
    botSel.innerHTML = '';
    timeSel.innerHTML = '';
    const botList = Array.isArray(botsConfig.lichess_bots) ? botsConfig.lichess_bots : [];
    const defaultBotIdx = Math.max(0, botList.length - 2);
    botList.forEach((bot, idx) => {
      const opt = document.createElement('option');
      opt.value = bot.username;
      opt.textContent = bot.label;
      if (idx === defaultBotIdx) opt.selected = true;
      botSel.appendChild(opt);
    });
    const timeList = Array.isArray(botsConfig.time_controls) ? botsConfig.time_controls : [];
    let defaultTimeMatched = false;
    timeList.forEach(tc => {
      const clock = tc.clock || {};
      const opt = document.createElement('option');
      opt.value = JSON.stringify(clock);
      opt.textContent = tc.label;
      const isRapid10 = ((tc.label || '').includes('10+0')) || (Number(clock.limit || 0) === 600 && Number(clock.increment || 0) === 0);
      if (isRapid10 && !defaultTimeMatched) {
        opt.selected = true;
        defaultTimeMatched = true;
      }
      timeSel.appendChild(opt);
    });
    if (!defaultTimeMatched && timeSel.options.length) timeSel.options[0].selected = true;
    if (lichessRadio) lichessRadio.checked = true;
    syncSimModalState();
  }

  function currentSimMode() {
    const checked = document.querySelector('input[name="simOpponent"]:checked');
    return checked ? checked.value : 'self';
  }

  
function syncSimModalState() {
  const mode = currentSimMode();
  const launchMode = playState.launchMode || 'sim';
  const lichessControls = document.getElementById('lichessControls');
  const note = document.getElementById('simFairPlayNote');
  const title = document.getElementById('simModalTitle');
  const hint = document.getElementById('simModeHint');
  const colorSel = document.getElementById('simColorSelect');
  const colorLabel = document.getElementById('simColorLabel');

  if (lichessControls) lichessControls.style.display = mode === 'lichess' ? 'grid' : 'none';

  if (launchMode === 'simw') {
    if (title) title.textContent = 'SimW — White engine, Black human';
    if (hint) hint.textContent = 'White is the engine side you choose here. Black is human. DCC stays on for both sides and will be saved into the PGN.';
    if (colorLabel) colorLabel.textContent = 'Engine color';
    if (colorSel) { colorSel.value = 'white'; colorSel.disabled = true; }
  } else if (launchMode === 'simb') {
    if (title) title.textContent = 'SimB — Black engine, White human';
    if (hint) hint.textContent = 'Black is the engine side you choose here. White is human. DCC stays on for both sides and will be saved into the PGN.';
    if (colorLabel) colorLabel.textContent = 'Engine color';
    if (colorSel) { colorSel.value = 'black'; colorSel.disabled = true; }
  } else {
    if (title) title.textContent = 'Sim — 8Z DCC research';
    if (hint) hint.textContent = 'Automatic research mode. 8Z plays the chosen side, DCC stays on, both sides are analyzed, and DCC data is kept for PGN export.';
    if (colorLabel) colorLabel.textContent = '8Z color';
    if (colorSel) { colorSel.disabled = false; }
  }

  if (note) {
    note.style.display = 'block';
    if (mode === 'lichess') {
      note.textContent = launchMode === 'sim'
        ? 'Lichess bot research mode. 8Z will challenge the selected Lichess bot and auto-play the chosen color.'
        : 'Lichess bot + human mode. The selected engine color is played by the Lichess bot. The opposite color is human. DCC remains on for both sides.';
    } else if (mode === 'dccbot') {
      note.textContent = launchMode === 'sim'
        ? '8Z local bot mode. Use this for browser-side training and debugging without Lichess.'
        : 'Local browser bot mode. The selected engine color is played automatically by 8Z-CDB-DCC. The other color is human.';
    } else {
      note.textContent = 'Self mode keeps the current local simulation path. DCC remains active and PGN comments stay enabled.';
    }
  }
}


  
function openSimModal(launchMode = 'sim') {
  if (replayRunning) { stopReplay(); return; }
  if (simRunning) { simAbort = true; invalidateDCCAnalysis(); return; }
  if (playState.active) {
    leaveActiveSession(playState.mode === 'lichess'
      ? 'Local live session stopped. The Lichess game may still be running.'
      : '8Z session stopped.');
    return;
  }
  playState.launchMode = launchMode || 'sim';
  const modal = document.getElementById('simModal');
  if (modal) modal.style.display = 'flex';
  syncSimModalState();
}

  function closeSimModal() {
    const modal = document.getElementById('simModal');
    if (modal) modal.style.display = 'none';
  }

  
function refreshPlayUi() {
  const busy = playState.active || !!playState.replaying;
  const btnSim = document.getElementById('btnSim');
  const btnSimW = document.getElementById('btnSimW');
  const btnSimB = document.getElementById('btnSimB');
  const btnReplay = document.getElementById('btnReplay');
  const btnView = document.getElementById('btnViewToggle');
  const btnHide = document.getElementById('btnHideEval');
  if (btnSim) {
    btnSim.textContent = playState.active ? 'Stop' : 'Sim';
    btnSim.style.background = playState.active ? '#ff4c4c' : '#2a2520';
    btnSim.style.color = playState.active ? '#fff' : '#f59e0b';
    btnSim.disabled = !!playState.replaying;
  }
  if (btnSimW) btnSimW.disabled = busy;
  if (btnSimB) btnSimB.disabled = busy;
  if (btnReplay) btnReplay.disabled = playState.active;
  if (btnView) btnView.disabled = false;
  if (btnHide) btnHide.disabled = false;
  const askInput = document.getElementById('coachAskInput');
  const askBtn = document.getElementById('btnCoachAsk');
  if (askInput) askInput.disabled = !ENABLE_COACH;
  if (askBtn) askBtn.disabled = !ENABLE_COACH;
  if (!playState.active) setCoachNotice('');
  if (btnHide) btnHide.innerHTML = showEval ? 'Hide<br>Eval' : 'Show<br>Eval';
}

function enterActiveSession(mode, opts = {}) {
  if (playState.active || replayRunning || simRunning) throw new Error('Stop the current activity before starting a game.');
  invalidateDCCAnalysis();
  clearLichessStreams();
  playState.sessionId = (playState.sessionId || 0) + 1;
  playState.sessionAbort = new AbortController();
  playState.active = true;
  playState.mode = mode;
  playState.userColor = opts.userColor || 'w';
  playState.waiting = mode === 'lichess';
  playState.startFen = opts.startFen || game.fen();
  playState.preSessionFen = game.fen();
  playState.preSessionPgn = game.pgn();
  playState.assistanceLocked = false;
  playState.prevShowEval = showEval;
  playState.autoPilot = !!opts.autoPilot;
  playState.autoMoveBusy = false;
  const live = playState.lichess;
  live.botUsername = opts.botUsername || '';
  live.selectedColor = opts.selectedColor || 'random';
  live.timeLabel = opts.timeLabel || '';
  live.lastMoves = null;
  live.initialFen = getStartFen();
  live.gameId = null;
  live.challengeId = null;
  live.ready = false;
  live.pendingMove = null;
  live.headers = null;
  live.apiKind = 'board';
  live.clocks = null;
  clearCoachMessages();
  if (mode === 'dccbot') {
    setCoachPanelOpen(true);
    setPlayTitle('8Z-CDB-DCC Training');
    queueCoachMessage('system', 'Local training started.', `You are ${playState.userColor === 'w' ? 'White' : 'Black'}`);
  } else if (mode === 'lichess') {
    setCoachPanelOpen(true);
    setPlayTitle(`${playState.autoPilot ? '8Z' : 'Human'} vs ${opts.botUsername || 'Bot'}`);
    game.reset();
    window._skipDivergedReset = false;
    updateBoard(true);
    renderLichessClocks();
  }
  board.orientation(playState.userColor === 'b' ? 'black' : 'white');
  refreshPlayUi();
  return playState.sessionId;
}

  function setPlayTitle(text) {
    const el = document.getElementById('gameTitle');
    if (el) el.innerHTML = text;
  }

function clearLichessStreams() {
  try { playState.lichess.streamAbort?.abort(); } catch (_) {}
  try { playState.lichess.eventAbort?.abort(); } catch (_) {}
  playState.lichess.streamAbort = null;
  playState.lichess.eventAbort = null;
}

function leaveActiveSession(message = '') {
  invalidateDCCAnalysis();
  playState.sessionId = (playState.sessionId || 0) + 1;
  try { playState.sessionAbort?.abort(); } catch (_) {}
  playState.sessionAbort = null;
  clearLichessStreams();
  clearTimeout(playState.lichess.autoTimer);
  clearInterval(playState.lichess.clockTimer);
  playState.lichess.autoTimer = null;
  playState.lichess.clockTimer = null;
  const clocks = playState.lichess.clocks;
  if (clocks) clocks.running = false;
  renderLichessClocks();
  setBoardThinking(false);
  const wasLocked = playState.assistanceLocked;
  playState.active = false;
  playState.mode = 'idle';
  playState.waiting = false;
  playState.assistanceLocked = false;
  playState.lichess.gameId = null;
  playState.lichess.challengeId = null;
  playState.lichess.ready = false;
  playState.lichess.pendingMove = null;
  playState.autoPilot = false;
  playState.autoMoveBusy = false;
  if (typeof playState.prevShowEval === 'boolean') showEval = playState.prevShowEval;
  applySettings();
  refreshPlayUi();
  if (message) {
    updateSimStatus(message);
    queueCoachMessage('system', message);
  }
  if (wasLocked) updateBoard(false);
}

  function applyUciMove(targetGame, uci) {
    if (!uci || uci.length < 4) return null;
    return targetGame.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined
    });
  }

  function uciToSan(fen, uci) {
    try {
      const probe = new Chess(fen);
      const m = applyUciMove(probe, uci);
      return m?.san || uci;
    } catch (_) {
      return uci;
    }
  }

  function clearStoredLichessToken() {
    try { localStorage.removeItem(LICHESS_TOKEN_KEY); } catch (_) {}
    playState.lichess.token = '';
  }

function describeErr(err) {
  return String(err?.message || err || 'unknown error').replace(/\s+/g, ' ').trim();
}

function sessionIsCurrent(sessionId, mode, gameId) {
  return playState.active && playState.sessionId === sessionId &&
    (!mode || playState.mode === mode) &&
    (!gameId || playState.lichess.gameId === gameId);
}

function sessionAbortError() {
  return new DOMException('Session stopped or replaced.', 'AbortError');
}

function renderLichessClocks() {
  const host = document.getElementById('board-container');
  if (!host) return;
  let row = document.getElementById('liveClocks');
  if (!row) {
    row = document.createElement('div');
    row.id = 'liveClocks';
    row.className = 'live-clocks';
    row.setAttribute('aria-label', 'Lichess clocks');
    row.innerHTML = '<span class="live-clock" data-side="w"></span><span class="live-clock" data-side="b"></span>';
    host.appendChild(row);
  }
  const clocks = playState.lichess.clocks;
  row.hidden = !clocks;
  if (!clocks) return;
  const elapsed = clocks.running && playState.lichess.ready ? Math.max(0, Date.now() - clocks.receivedAt) : 0;
  row.classList.toggle('stale', !playState.lichess.ready && clocks.running);
  for (const side of ['w', 'b']) {
    const node = row.querySelector(`[data-side="${side}"]`);
    const active = clocks.running && clocks.turn === side;
    const remaining = Math.max(0, clocks[side] - (active ? elapsed : 0));
    const seconds = Math.ceil(remaining / 1000);
    node.textContent = `${side === 'w' ? 'White' : 'Black'} ${active && elapsed > 0 ? '~' : ''}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    node.classList.toggle('is-running', active);
    node.title = playState.lichess.ready ? 'Server clock, interpolated between updates' : 'Last server clock; reconnecting';
  }
}

function updateLichessClocks(state) {
  if (Number.isFinite(state?.wtime) && Number.isFinite(state?.btime)) {
    playState.lichess.clocks = {
      w: state.wtime, b: state.btime, turn: game.turn(), receivedAt: Date.now(),
      running: state.status === 'started'
    };
    if (!playState.lichess.clockTimer) {
      playState.lichess.clockTimer = setInterval(renderLichessClocks, 250);
    }
  }
  renderLichessClocks();
}

  function reportSessionIssue(prefix, err, opts = {}) {
    let msg = `${prefix}: ${describeErr(err)}`;
    if (opts.clearToken) {
      clearStoredLichessToken();
      msg += ' Stored Lichess token was cleared. Enter a fresh token and try again.';
    }
    console.warn(prefix, err);
    updateSimStatus(msg);
    queueCoachMessage('system', msg);
    return msg;
  }

function syncGameFromMoves(movesStr, initialFen) {
  const live = playState.lichess;
  const normalized = String(movesStr || '').trim().split(/\s+/).filter(Boolean).join(' ');
  const moves = normalized ? normalized.split(' ') : [];
  const startFen = initialFen === 'startpos' ? getStartFen() : (initialFen || live.initialFen || getStartFen());
  // Validate the entire server snapshot before touching the visible game.
  const authoritative = new Chess(startFen);
  for (const uci of moves) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || !applyUciMove(authoritative, uci)) {
      throw new Error('Lichess sent a move list that cannot be reconstructed.');
    }
  }
  const changed = normalized !== live.lastMoves || startFen !== live.initialFen || game.fen() !== authoritative.fen();
  live.initialFen = startFen;
  live.lastMoves = normalized;
  const pending = live.pendingMove;
  if (pending && moves.length > pending.ply) {
    pending.confirmed = moves[pending.ply] === pending.uci;
    live.pendingMove = null;
  }
  if (changed) {
    game.load(startFen);
    for (const uci of moves) applyUciMove(game, uci);
    if (live.headers) for (const [key, value] of Object.entries(live.headers)) game.header(key, String(value));
    lastAction = 'move';
    window._skipDivergedReset = false;
    updateBoard(true);
  }
  return changed;
}

async function readNdjsonStream(response, onEvent, signal) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('Lichess streaming response has no body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) throw sessionAbortError();
      const { value, done } = await reader.read();
      if (signal?.aborted) throw sessionAbortError();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const result = await onEvent(JSON.parse(line));
        if (result !== null && result !== undefined && result !== false) return result;
      }
      if (done) break;
    }
    return buffer.trim() ? await onEvent(JSON.parse(buffer)) : null;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

  function unmaskLichessTokenText(text) {
    const raw = String(text || '');
    const match = raw.match(/8ZC-LICHESS-V1\s*:\s*([\s\S]*)/i);
    if (!match) return '';
    try {
      const packed = match[1].replace(/[^A-Za-z0-9_-]/g, '');
      if (!packed) return '';
      let b64 = packed.split('').reverse().join('');
      while (b64.length % 4) b64 += '=';
      b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      let seed = (0x4D444C58 ^ bin.length) >>> 0;
      for (let i = 0; i < bin.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223 + i * 97) >>> 0;
        const k = ((seed >>> 16) & 255) ^ ((i * 73 + 41) & 255) ^ 0xA5;
        out[i] = bin.charCodeAt(i) ^ k;
      }
      const decoded = new TextDecoder().decode(out).trim();
      const prefix = 'LICHESS_TOKEN_V1:';
      if (!decoded.startsWith(prefix)) return '';
      return decoded.slice(prefix.length).trim();
    } catch (_) {
      return '';
    }
  }

  function cleanLichessTokenText(text) {
    const masked = unmaskLichessTokenText(text);
    if (masked) return masked;

    // Backward-compatible fallback: a plain token file still works if needed.
    const lines = String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
    if (!lines.length) return '';
    let token = lines[0]
      .replace(/^Bearer\s+/i, '')
      .replace(/^token\s*[:=]\s*/i, '')
      .trim();
    return token;
  }

  async function fetchPublicLichessToken() {
    try {
      const url = new URL(LICHESS_PUBLIC_TOKEN_URL, window.location.href);
      url.searchParams.set('_', String(Date.now()));
      const res = await fetch(url.href, { cache: 'no-store' });
      if (!res.ok) return '';
      return cleanLichessTokenText(await res.text());
    } catch (_) {
      return '';
    }
  }

  async function ensureLichessToken() {
    // First try the public site token file next to chess.html.
    // Fallback keeps the older manual/localStorage mode working.
    let token = await fetchPublicLichessToken();
    if (token) {
      try { localStorage.setItem(LICHESS_TOKEN_KEY, token); } catch (_) {}
      return token;
    }
    token = localStorage.getItem(LICHESS_TOKEN_KEY) || '';
    if (!token) {
      token = prompt('Enter your Lichess API token.');
      if (token) localStorage.setItem(LICHESS_TOKEN_KEY, token.trim());
    }
    return (token || '').trim();
  }

  async function ensureAnthropicKey(promptIfMissing = false) {
    if (!ENABLE_COACH) return '';
    let key = localStorage.getItem(ANTHROPIC_TOKEN_KEY) || '';
    if (!key && promptIfMissing) {
      key = prompt('Enter your Anthropic API key for Claude coach replies.');
      if (key) localStorage.setItem(ANTHROPIC_TOKEN_KEY, key.trim());
    }
    return (key || '').trim();
  }

function guessUserColorFromGameFull(payload, botUsername, selectedColor) {
  const account = (playState.lichess.accountId || '').toLowerCase();
  const white = String(payload?.white?.id || payload?.white?.name || '').toLowerCase();
  const black = String(payload?.black?.id || payload?.black?.name || '').toLowerCase();
  if (account && white === account) return 'w';
  if (account && black === account) return 'b';
  const bot = String(botUsername || '').toLowerCase();
  if (bot && white === bot) return 'b';
  if (bot && black === bot) return 'w';
  return selectedColor === 'black' ? 'b' : 'w';
}

async function startLichessEventWait(token, sessionId, challengeReady) {
  const ctrl = new AbortController();
  playState.lichess.eventAbort = ctrl;
  const res = await fetch('https://lichess.org/api/stream/event', {
    headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Lichess event stream failed (${res.status})`);
  }
  return readNdjsonStream(res, async evt => {
    const challengeId = await challengeReady;
    if (!sessionIsCurrent(sessionId, 'lichess') || !challengeId) throw sessionAbortError();
    const id = evt?.game?.gameId || evt?.game?.id || evt?.gameId;
    if (evt?.type === 'gameStart' && id === challengeId) return id;
    if ((evt?.type === 'challengeDeclined' || evt?.type === 'challengeCanceled') && evt.challenge?.id === challengeId) {
      throw new Error(`Lichess challenge ${evt.type === 'challengeDeclined' ? 'declined' : 'canceled'}.`);
    }
    return null;
  }, ctrl.signal);
}

async function challengeLichessBot(botUsername, selectedColor, clock, sessionId) {
  const token = await ensureLichessToken();
  if (!sessionIsCurrent(sessionId, 'lichess')) throw sessionAbortError();
  if (!token) throw new Error('Missing Lichess token.');
  const live = playState.lichess;
  live.token = token;
  const signal = playState.sessionAbort.signal;
  const profileResponse = await fetch('https://lichess.org/api/account', {
    headers: { Authorization: `Bearer ${token}` }, signal
  });
  if (!profileResponse.ok) throw new Error(`Lichess account lookup failed (${profileResponse.status}).`);
  const profile = await profileResponse.json();
  if (!sessionIsCurrent(sessionId, 'lichess')) throw sessionAbortError();
  live.accountId = profile.id || profile.username || '';
  live.apiKind = profile.title === 'BOT' ? 'bot' : 'board';
  if (playState.autoPilot && live.apiKind !== 'bot') {
    throw new Error('Automated Sim requires a Lichess BOT account with bot:play access. Use SimW or SimB for human play.');
  }
  const body = new URLSearchParams();
  body.set('rated', 'false');
  body.set('clock.limit', String(Math.max(15, Number(clock.limit) || 180)));
  body.set('clock.increment', String(Math.max(0, Number(clock.increment) || 0)));
  body.set('color', selectedColor || 'random');
  let resolveChallenge;
  const challengeReady = new Promise(resolve => { resolveChallenge = resolve; });
  const startPromise = startLichessEventWait(token, sessionId, challengeReady);
  // Attach a rejection handler immediately, including while the challenge POST is pending.
  startPromise.catch(() => {});
  let timeout;
  try {
    const resp = await fetch(`https://lichess.org/api/challenge/${encodeURIComponent(botUsername)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body, signal
    });
    if (!resp.ok) throw new Error(await resp.text().catch(() => '') || `Challenge failed (${resp.status})`);
    const data = await resp.json();
    if (!sessionIsCurrent(sessionId, 'lichess')) throw sessionAbortError();
    live.challengeId = data?.challenge?.id || data?.id || null;
    if (!live.challengeId) throw new Error('Lichess did not return a challenge ID.');
    resolveChallenge(live.challengeId);
    const gameId = await Promise.race([
      startPromise,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Timed out waiting for this Lichess challenge to start.')), 30000); })
    ]);
    if (!sessionIsCurrent(sessionId, 'lichess')) throw sessionAbortError();
    if (!gameId) throw new Error('Lichess event stream closed before the challenge started.');
    return gameId;
  } finally {
    clearTimeout(timeout);
    resolveChallenge(null);
    // This per-challenge event stream is no longer needed after matching a game.
    if (playState.sessionId === sessionId) {
      live.eventAbort?.abort();
      live.eventAbort = null;
    }
  }
}

async function startLichessGameStream(gameId, sessionId) {
  if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return;
  const live = playState.lichess;
  const ctrl = new AbortController();
  live.streamAbort = ctrl;
  live.ready = false;
  playState.waiting = true;
  renderLichessClocks();
  const res = await fetch(`https://lichess.org/api/${live.apiKind || 'board'}/game/stream/${encodeURIComponent(gameId)}`, {
    headers: { Authorization: `Bearer ${live.token}` }, signal: ctrl.signal
  });
  if (!res.ok) {
    const error = new Error(await res.text().catch(() => '') || `Game stream failed (${res.status})`);
    error.httpStatus = res.status;
    throw error;
  }
  await readNdjsonStream(res, async payload => {
    if (!sessionIsCurrent(sessionId, 'lichess', gameId) || ctrl.signal.aborted) return true;
    const isFull = payload?.type === 'gameFull';
    if (!isFull && payload?.type !== 'gameState') return null;
    if (isFull) {
      playState.userColor = guessUserColorFromGameFull(payload, live.botUsername, live.selectedColor);
      board.orientation(playState.userColor === 'b' ? 'black' : 'white');
      live.headers = {
        Event: 'Lichess casual game', Site: `https://lichess.org/${gameId}`,
        White: payload.white?.name || payload.white?.id || 'White',
        Black: payload.black?.name || payload.black?.id || 'Black', Result: '*'
      };
    }
    const state = isFull ? payload.state || {} : payload;
    syncGameFromMoves(state.moves || '', isFull ? payload.initialFen || 'startpos' : undefined);
    live.ready = true;
    // A failed network send is retried only after a fresh full server snapshot.
    if (isFull && live.pendingMove?.uncertain && !live.pendingMove.inflight) live.pendingMove = null;
    updateLichessClocks(state);
    if (state.status && state.status !== 'started' && state.status !== 'created') {
      const result = state.winner === 'white' ? '1-0' : state.winner === 'black' ? '0-1'
        : ['draw', 'stalemate'].includes(state.status) ? '1/2-1/2' : '*';
      game.header('Result', result);
      leaveActiveSession(`Lichess game finished: ${state.status}${result !== '*' ? ` (${result})` : ''}.`);
      return true;
    }
    playState.waiting = !!live.pendingMove || game.turn() !== playState.userColor;
    if (live.pendingMove) updateSimStatus('Move sent · awaiting Lichess confirmation…');
    else if (game.turn() !== playState.userColor) updateSimStatus(`Waiting for ${live.botUsername}…`);
    else if (playState.autoPilot) {
      updateSimStatus('8Z-DCC is preparing a move…');
      scheduleLichessOpeningKick(gameId, 1, 80);
    } else updateSimStatus('Your move.');
    return null;
  }, ctrl.signal);
}

async function startLichessGameStreamLoop(gameId, sessionId = playState.sessionId) {
  let attempt = 0;
  while (sessionIsCurrent(sessionId, 'lichess', gameId)) {
    try {
      await startLichessGameStream(gameId, sessionId);
    } catch (err) {
      if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return;
      if (err.httpStatus === 401 || err.httpStatus === 403 || err.httpStatus === 404) {
        leaveActiveSession(`Lichess stream unavailable: ${describeErr(err)}`);
        return;
      }
      if (err.name !== 'AbortError') console.warn('Lichess stream error:', err);
    }
    if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return;
    playState.lichess.ready = false;
    playState.waiting = true;
    renderLichessClocks();
    updateSimStatus(`Lichess reconnecting… (${++attempt})`);
    await sleep(Math.min(5000, 500 * attempt));
  }
}

function scheduleLichessOpeningKick(gameId, tries = 1, delayMs = 120) {
  const live = playState.lichess;
  const sessionId = playState.sessionId;
  clearTimeout(live.autoTimer);
  live.autoTimer = setTimeout(() => {
    live.autoTimer = null;
    if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return;
    runLichessAutoMove().catch(err => {
      if (sessionIsCurrent(sessionId, 'lichess', gameId)) reportSessionIssue('8Z move failed', err);
    });
  }, delayMs);
}

async function sendLichessMove(uci, expectedFen = game.fen(), sessionId = playState.sessionId) {
  const live = playState.lichess;
  const gameId = live.gameId;
  if (!sessionIsCurrent(sessionId, 'lichess', gameId) || !live.ready || game.fen() !== expectedFen) return false;
  if (live.pendingMove) return false;
  if (!applyUciMove(new Chess(expectedFen), uci)) throw new Error('Move is illegal in the confirmed Lichess position.');
  const pending = {
    uci, ply: (live.lastMoves || '').split(/\s+/).filter(Boolean).length,
    fen: expectedFen, inflight: true, uncertain: false, confirmed: false
  };
  live.pendingMove = pending;
  playState.waiting = true;
  try {
    const resp = await fetch(`https://lichess.org/api/${live.apiKind || 'board'}/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(uci)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${live.token}` }, signal: playState.sessionAbort.signal
    });
    if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return false;
    if (!resp.ok) {
      const error = new Error(await resp.text().catch(() => '') || `Move rejected (${resp.status})`);
      error.httpStatus = resp.status;
      throw error;
    }
    // The board advances only when the server move stream confirms the move.
    pending.accepted = true;
    return true;
  } catch (err) {
    if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return false;
    if (pending.confirmed) return true;
    if (live.pendingMove === pending) {
      if (err.httpStatus && err.httpStatus < 500) live.pendingMove = null;
      else pending.uncertain = true;
      live.ready = false;
      playState.waiting = true;
      live.streamAbort?.abort();
    }
    throw err;
  } finally {
    pending.inflight = false;
  }
}

  async function buildCoachSnapshot(preFen, moveObj, actorLabel) {
    const analysis = await analyzePosition(preFen);
    const uci = normalizeUci(moveObj);
    const sorted = (analysis?.candidates || []).slice().sort((a, b) => b.dcc - a.dcc);
    const played = sorted.find(c => c.move === uci) || null;
    const dccRank = played ? (sorted.findIndex(c => c === played) + 1) : null;
    const best = sorted[0] || null;
    return {
      actorLabel,
      fen: preFen,
      move: moveObj,
      uci,
      san: moveObj?.san || uci,
      played,
      dccRank,
      best,
      bestSan: best ? uciToSan(preFen, best.move) : null,
      gap: played && best ? Math.max(0, best.dcc - played.dcc) : null,
      candidates: sorted
    };
  }

  function shouldSpeakCoach(snapshot) {
    const mode = settings.coachMode || 'key-moments';
    if (mode === 'silent' || mode === 'ask-mode') return false;
    if (mode === 'every-move') return true;
    if (!snapshot) return false;
    if (snapshot.dccRank && snapshot.dccRank > 1 && (snapshot.gap || 0) >= 15) return true;
    if (snapshot.played?.adsr === 'collapse' || snapshot.played?.adsr === 'spike') return true;
    if (snapshot.played?.tunnel) return true;
    return snapshot.dccRank === 1;
  }

  function fallbackCoachComment(snapshot) {
    if (!snapshot) return 'No coach signal yet.';
    const played = snapshot.played;
    const best = snapshot.best;
    const san = snapshot.san;
    if (snapshot.dccRank === 1 && played) {
      return `Good move. ${san} was the steadiest continuation here, and the position keeps a healthier shape over the next replies.`;
    }
    if (!played && best) {
      return `${san} was outside the main DCC pool here. ${snapshot.bestSan || best.move} looked structurally safer over the next few replies.`;
    }
    if (played && best) {
      const shape = played.adsr === 'collapse' ? 'It loses shape quickly under best play.'
        : played.adsr === 'spike' ? 'It looks sharp at first but the line fades.'
        : 'It is playable, but there was a steadier option.';
      return `${san} is playable. ${snapshot.bestSan || best.move} was the cleaner DCC continuation. ${shape}`;
    }
    return `Played ${san}. The coach needs a little more data for a sharper comment here.`;
  }

  async function requestCoachComment(snapshot, question = '') {
    if (!ENABLE_COACH) return '';
    const key = await ensureAnthropicKey(false);
    if (!key) {
      return question
        ? 'Ask mode needs your Claude API key. Automatic built-in coach comments still work without it.'
        : fallbackCoachComment(snapshot);
    }

    const recent = game.history({ verbose: true }).slice(-8).map(m => m.san).join(' ');
    const systemPrompt = question
      ? 'You are a warm chess coach. Keep answers short, concrete, and practical. Prefer structure, king safety, piece activity, and plans over jargon.'
      : 'You are a warm chess coach. Keep comments to at most 3 sentences. Praise briefly when the move is best, otherwise explain the more stable option without scolding.';
    const userPrompt = question
      ? `Position: ${game.fen()}\nRecent moves: ${recent}\nQuestion: ${question}\nAnswer in at most 4 short sentences.`
      : `Position before move: ${snapshot?.fen || ''}\nMove played: ${snapshot?.san || ''}\nDCC rank: #${snapshot?.dccRank || 'n/a'}\nBest DCC move: ${snapshot?.bestSan || snapshot?.best?.move || 'n/a'}\nPlayed ADSR: ${snapshot?.played?.adsr || 'n/a'}\nBest ADSR: ${snapshot?.best?.adsr || 'n/a'}\nGap: ${snapshot?.gap || 0}\nGive one short coaching comment.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 180,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `Claude API error (${resp.status})`);
    }
    const data = await resp.json();
    return data?.content?.[0]?.text || fallbackCoachComment(snapshot);
  }

  async function maybeEmitCoach(actorLabel, preFen, moveObj) {
    if (!ENABLE_COACH) return;
    if (!settings.coachOpen) return;
    if (playState.active && playState.assistanceLocked) return;
    const snapshot = await buildCoachSnapshot(preFen, moveObj, actorLabel);
    if (!shouldSpeakCoach(snapshot)) return;
    let text = '';
    try {
      text = await requestCoachComment(snapshot, '');
    } catch (err) {
      console.warn('Coach API failed, using fallback:', err);
      text = fallbackCoachComment(snapshot);
    }
    queueCoachMessage('coach', text, `${actorLabel} played ${snapshot.san}${snapshot.dccRank ? ` · DCC #${snapshot.dccRank}` : ''}`);
  }

  async function askCoachQuestion() {
    if (!ENABLE_COACH) return;
    const input = document.getElementById('coachAskInput');
    if (!input) return;
    const question = (input.value || '').trim();
    if (!question) return;
    input.value = '';
    queueCoachMessage('user', question, 'You');
    if (playState.active && playState.assistanceLocked) {
      queueCoachMessage('system', 'Live help is off during an ongoing Lichess game. Finish the game first, then review it here.');
      return;
    }
    try {
      const text = await requestCoachComment(null, question);
      queueCoachMessage('coach', text, 'Coach');
    } catch (err) {
      queueCoachMessage('system', `Coach request failed: ${err.message || err}`);
    }
  }

async function runDccBotTurn() {
  const sessionId = playState.sessionId;
  if (!sessionIsCurrent(sessionId, 'dccbot') || playState.autoMoveBusy || game.turn() === playState.userColor) return;
  if (game.game_over()) { leaveActiveSession('Game over. Training session finished.'); return; }
  playState.autoMoveBusy = true;
  playState.waiting = true;
  setBoardThinking(true);
  updateSimStatus('8Z-CDB-DCC is thinking…');
  const fenBefore = game.fen();
  try {
    const pick = await pickDCCMove(new Chess(fenBefore));
    if (!sessionIsCurrent(sessionId, 'dccbot') || game.fen() !== fenBefore) return;
    if (!pick?.move) throw new Error('No DCC move is available for this position.');
    const move = applyUciMove(game, pick.move);
    if (!move) throw new Error('DCC move became illegal in the current position.');
    lastAction = 'move';
    window._skipDivergedReset = true;
    updateBoard(false);
    updateSimStatus(`8Z played ${move.san}`);
    await maybeEmitCoach('8Z', fenBefore, move);
    if (!sessionIsCurrent(sessionId, 'dccbot')) return;
    if (game.game_over()) leaveActiveSession('Game over. Training session finished.');
    else updateSimStatus('Your move.');
  } catch (err) {
    if (sessionIsCurrent(sessionId, 'dccbot')) leaveActiveSession(`Training stopped: ${describeErr(err)}`);
  } finally {
    if (sessionIsCurrent(sessionId, 'dccbot')) {
      setBoardThinking(false);
      playState.autoMoveBusy = false;
      playState.waiting = game.turn() !== playState.userColor;
    }
  }
}

async function prepareLocalLichessOpeningPreview() {
  // Opening selection starts from the first authoritative gameFull snapshot.
  return null;
}

async function runLichessAutoMove() {
  const sessionId = playState.sessionId;
  const live = playState.lichess;
  const gameId = live.gameId;
  if (!sessionIsCurrent(sessionId, 'lichess', gameId) || !playState.autoPilot) return;
  if (playState.autoMoveBusy || !live.ready || live.pendingMove || game.turn() !== playState.userColor || game.game_over()) return;
  playState.autoMoveBusy = true;
  playState.waiting = true;
  setBoardThinking(true);
  updateSimStatus('8Z-DCC is thinking…');
  const fenBefore = game.fen();
  try {
    const pick = await pickDCCMove(new Chess(fenBefore));
    if (!sessionIsCurrent(sessionId, 'lichess', gameId) || !live.ready || game.fen() !== fenBefore) return;
    if (!pick?.move) throw new Error('No DCC move is available for this position.');
    const sent = await sendLichessMove(pick.move, fenBefore, sessionId);
    if (sent && sessionIsCurrent(sessionId, 'lichess', gameId) && game.fen() === fenBefore) {
      updateSimStatus(`8Z submitted ${uciToSan(fenBefore, pick.move)} · awaiting Lichess confirmation…`);
    }
  } catch (err) {
    if (!sessionIsCurrent(sessionId, 'lichess', gameId)) return;
    reportSessionIssue('8Z move paused', err);
  } finally {
    if (sessionIsCurrent(sessionId, 'lichess', gameId)) {
      setBoardThinking(false);
      playState.autoMoveBusy = false;
      playState.waiting = !live.ready || !!live.pendingMove || game.turn() !== playState.userColor;
      if (game.fen() !== fenBefore && live.ready && !live.pendingMove && game.turn() === playState.userColor) {
        scheduleLichessOpeningKick(gameId);
      }
    }
  }
}

async function handleLiveUserMove(moveObj, fenBeforeMove) {
  const sessionId = playState.sessionId;
  if (!playState.active) return;
  if (playState.mode === 'dccbot') {
    playState.waiting = true;
    await maybeEmitCoach('You', fenBeforeMove, moveObj);
    if (!sessionIsCurrent(sessionId, 'dccbot')) return;
    if (game.game_over()) { leaveActiveSession('Game over. Training session finished.'); return; }
    await sleep(180);
    if (sessionIsCurrent(sessionId, 'dccbot')) await runDccBotTurn();
    return;
  }
  if (playState.mode === 'lichess') {
    // onDrop may have applied the human move locally. Undo it synchronously,
    // preserving history, and relay from the latest confirmed server position.
    syncGameFromMoves(playState.lichess.lastMoves || '');
    if (game.fen() !== fenBeforeMove) return;
    playState.waiting = true;
    updateSimStatus('Sending move to Lichess…');
    try {
      const sent = await sendLichessMove(normalizeUci(moveObj), fenBeforeMove, sessionId);
      if (sent && sessionIsCurrent(sessionId, 'lichess') && game.fen() === fenBeforeMove) {
        updateSimStatus('Move submitted · awaiting Lichess confirmation…');
      }
    } catch (err) {
      if (sessionIsCurrent(sessionId, 'lichess')) reportSessionIssue('Move relay paused; reconnecting', err);
    }
  }
}

async function startDccBotSession(selectedColor) {
  const userColor = selectedColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : (selectedColor === 'black' ? 'b' : 'w');
  const sessionId = enterActiveSession('dccbot', { userColor, startFen: game.fen(), selectedColor });
  updateSimStatus(`8Z-CDB-DCC live · You are ${userColor === 'w' ? 'White' : 'Black'}`);
  if (game.turn() !== userColor) {
    playState.waiting = true;
    await sleep(180);
    if (sessionIsCurrent(sessionId, 'dccbot')) await runDccBotTurn();
  }
}

async function startLichessSession(botUsername, selectedColor, clock, timeLabel, opts = {}) {
  if (!String(botUsername || '').trim()) throw new Error('Choose a Lichess opponent first.');
  const sessionId = enterActiveSession('lichess', {
    userColor: selectedColor === 'black' ? 'b' : 'w', botUsername, selectedColor,
    timeLabel, startFen: getStartFen(), autoPilot: !!opts.autoPilot
  });
  updateSimStatus(`Challenging ${botUsername} on Lichess…`);
  try {
    const gameId = await challengeLichessBot(botUsername, selectedColor, clock, sessionId);
    if (!sessionIsCurrent(sessionId, 'lichess')) return;
    playState.lichess.gameId = gameId;
    updateSimStatus(`Lichess game ${gameId} started · synchronizing board…`);
    startLichessGameStreamLoop(gameId, sessionId).catch(err => {
      if (sessionIsCurrent(sessionId, 'lichess', gameId)) leaveActiveSession(`Lichess connection stopped: ${describeErr(err)}`);
    });
  } catch (err) {
    if (!sessionIsCurrent(sessionId, 'lichess')) return;
    leaveActiveSession(`Lichess start failed: ${describeErr(err)}`);
  }
}

async function launchFromSimModal() {
  if (playState.active || simRunning || replayRunning) {
    closeSimModal();
    updateSimStatus('Stop the current activity before starting another.');
    return;
  }
  const mode = currentSimMode();
  const launchMode = playState.launchMode || 'sim';
  const selectedColor = document.getElementById('simColorSelect')?.value || 'random';
  const timeSel = document.getElementById('simTimeSelect');
  const timeLabel = timeSel?.selectedOptions?.[0]?.textContent || 'Blitz 3+0';
  let clock = { limit: 180, increment: 0 };
  try { clock = { ...clock, ...JSON.parse(timeSel?.value || '{}') }; } catch (_) {}
  closeSimModal();
  if (launchMode === 'sim' && (mode === 'self' || mode === 'dccbot')) {
    await runSimulation('both', game.fen());
    return;
  }
  const engineColor = launchMode === 'simw' ? 'white' : 'black';
  const humanColor = engineColor === 'white' ? 'black' : 'white';
  if (mode === 'self' || mode === 'dccbot') {
    await startDccBotSession(humanColor);
    return;
  }
  if (mode === 'lichess') {
    const botUsername = document.getElementById('lichessBotLevel')?.value || botsConfig.lichess_bots?.[0]?.username || '';
    await startLichessSession(botUsername, launchMode === 'sim' ? selectedColor : humanColor,
      clock, timeLabel, { autoPilot: launchMode === 'sim' });
  }
}

  // ─── Sim button handlers ───────────────────────────────────────────
  const btnSimW = document.getElementById('btnSimW');
  if (btnSimW) btnSimW.onclick = () => openSimModal('simw');
  const btnSimB = document.getElementById('btnSimB');
  if (btnSimB) btnSimB.onclick = () => openSimModal('simb');
  const btnSimMain = document.getElementById('btnSim');
  if (btnSimMain) btnSimMain.onclick = () => openSimModal('sim');
  const btnCoach = document.getElementById('btnCoach');
  if (btnCoach) {
    if (!ENABLE_COACH) btnCoach.style.display = 'none';
    btnCoach.onclick = () => setCoachPanelOpen(!settings.coachOpen);
  }
  // TopC: quick input for Top Candidates
  const btnTopC = document.getElementById('btnTopC');
  if (btnTopC) {
    btnTopC.textContent = 'TopC:' + settings.dccTopCandidates;
    btnTopC.onclick = () => {
      const val = prompt('Top Candidates (1-10):', settings.dccTopCandidates);
      if (val !== null) {
        const n = Math.max(1, Math.min(10, parseInt(val, 10) || 3));
        settings.dccTopCandidates = n;
        saveSettings();
        btnTopC.textContent = 'TopC:' + n;
        const sel = document.getElementById('settingDccTopCandidates');
        if (sel) sel.value = n;
      }
    };
  }
  // ────────────────────────────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════
  // DCC REPLAY — Analyze loaded game with DCC eval (v0.6.1)
  // ═══════════════════════════════════════════════════════════════════

  let replayRunning = false;
  let replayAbort = false;

  // Analyze a single position: return DCC data for all candidates + identify DCC #1
  async function analyzePosition(fen, suppliedMoves, options = {}) {
    const generation = analysisGeneration;
    const snapshot = { ...settings, ...(options.settings || {}) };
    const signature = JSON.stringify(DCC.config(snapshot));
    const key = `${fen}|${signature}`;
    const stale = () => generation !== analysisGeneration || JSON.stringify(DCC.config({ ...settings, ...(options.settings || {}) })) !== signature;
    const cached = analysisMemo.get(key);
    if (cached && Date.now() - cached.time < 120000) return cached.result;
    const pendingKey = generation + '|' + key;
    if (analysisPending.has(pendingKey)) return analysisPending.get(pendingKey);
    const pending = DCC.analyze({ Chess, fen, settings: snapshot, moves: suppliedMoves,
      getMoves: cachedFetchChessDB, getPV: fetchPV, getScore: fetchScore,
      cancelled: stale, progress: (done, total) => { if (!stale()) updateDCCProgress(done, total); }
    }).then(result => {
      if (stale()) return null;
      if (result.receipt.status === 'complete') {
        if (analysisMemo.size > 100) analysisMemo.delete(analysisMemo.keys().next().value);
        analysisMemo.set(key, { time: Date.now(), result });
      }
      return result;
    }).catch(err => {
      if (err.name !== 'AbortError') console.warn('DCC analysis unavailable:', err.message);
      return null;
    }).finally(() => analysisPending.delete(pendingKey));
    analysisPending.set(pendingKey, pending);
    return pending;
  }

  // Main replay function. Raw database evaluations and DCC preference scores
  // remain separate; matching DCC #1 is agreement, not engine accuracy.
  function stopReplay() {
    if (!replayRunning) return;
    replayAbort = true;
    invalidateDCCAnalysis();
    updateSimStatus('Stopping Replay…');
  }

  function replayAgreement(annotations, side) {
    const known = annotations.filter(a => a.side === side && a.isDCC1 !== null);
    const matched = known.filter(a => a.isDCC1).length;
    return { known: known.length, matched, pct: known.length ? Math.round(100 * matched / known.length) : null };
  }

  function renderReplayProgress(annotations, total, phase = 'Reviewing', headers = {}) {
    const panel = document.getElementById('simStatsPanel');
    if (!panel) return;
    const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const processed = annotations.length;
    const pct = total ? Math.round(100 * processed / total) : 0;
    const scored = annotations.filter(a => a.isDCC1 !== null).length;
    const row = side => {
      const stats = replayAgreement(annotations, side);
      const label = side === 'w' ? 'White' : 'Black';
      const player = headers[label] || label;
      const sampled = annotations.filter(a => a.side === side && Number.isFinite(a.stability));
      const stability = sampled.length ? (sampled.reduce((sum, a) => sum + a.stability, 0) / sampled.length).toFixed(2) : 'unknown';
      return `<div class="replay-side"><strong>${escape(player)} (${label})</strong><br>DCC #1 agreement: <strong>${stats.pct === null ? '—' : `${stats.pct}%`}</strong> (${stats.matched}/${stats.known} comparable plies)<br>Mean sampled stability: ${stability}</div>`;
    };
    panel.innerHTML = `<div class="sim-stats-header"><span class="sim-title">DCC Replay · ${escape(phase)}</span></div>
      <div class="replay-summary" style="padding:10px;line-height:1.7">
        <div>${processed}/${total} plies reviewed (${pct}%) · ${scored} with DCC comparison · ${processed - scored} unavailable</div>
        <progress value="${processed}" max="${Math.max(1, total)}" aria-label="Replay progress" style="width:100%"></progress>
        ${row('w')}${row('b')}
        <div class="replay-method-note">Agreement measures the sampled DCC preference, not engine accuracy. Raw centipawn evaluation and DCC rank score are separate values; missing samples remain unknown.</div>
      </div>`;
    panel.style.display = 'block';
  }

  async function replayGame() {
    if (replayRunning) { stopReplay(); return; }
    if (playState.active || simRunning) { updateSimStatus('Stop the current game or simulation before Replay.'); return; }
    if (fullHistory.length === 0) { alert('Load a PGN game first.'); return; }
    invalidateDCCAnalysis();
    const generation = analysisGeneration;
    replayRunning = true;
    replayAbort = false;
    playState.replaying = true;
    refreshPlayUi();
    const btn = document.getElementById('btnReplay');
    if (btn) {
      btn.textContent = 'Stop';
      btn.style.background = '#ff4c4c';
      btn.style.color = '#fff';
    }
    const moves = fullHistory.map(move => ({ ...move }));
    const headers = { ...game.header() };
    const annotations = [];
    const replaySettings = {
      depth: settings.dccDepth, candidates: settings.dccTopCandidates, floor: settings.dccEvalFloor
    };
    let state = 'stopped';
    let failure = '';
    let initialFen;
    try {
      while (game.history().length > 0) game.undo();
      initialFen = game.fen();
      board.position(initialFen);
      document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
      renderReplayProgress(annotations, moves.length, 'Reviewing', headers);
      for (let i = 0; i < moves.length; i++) {
        if (replayAbort || analysisGeneration !== generation) break;
        const fen = game.fen();
        const side = game.turn();
        const mv = moves[i];
        const moveUci = normalizeUci(mv);
        document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
        updateSimStatus(`Replay ${i + 1}/${moves.length}: analyzing ${mv.san}…`);
        const analysis = await analyzePosition(fen);
        // Stop/navigation/settings changes may happen while requests are pending.
        if (replayAbort || analysisGeneration !== generation || game.fen() !== fen || playState.active || simRunning) break;
        const ann = {
          ply: i + 1, side, san: mv.san, uci: moveUci, raw: null, dcc: null,
          stability: null, adsr: null, trend: '', momentum: null, tunnel: false,
          isDCC1: null, observedPlies: null, samplePlies: null, coverage: 'unknown'
        };
        if (analysis) {
          latestDCCResults = analysis.candidates.map(candidate => candidate.data).filter(Boolean);
          latestDCCReceipt = analysis.receipt;
          renderDCCView();
          if (settings.simSpeed > 0) {
            analysis.allMoves.slice(0, settings.topN || 5).forEach((m, idx) => annotateMove(m.move, m.score, idx === 0));
            for (const candidate of analysis.candidates) {
              if (candidate.data) updateDCCBadge(candidate.move, candidate.data, 'done');
            }
          }
          // Full UCI matching is required: queen and knight promotions differ.
          const played = analysis.candidates.find(c => c.move === moveUci);
          const rawMatch = analysis.allMoves.find(m => m.move === moveUci);
          ann.raw = played?.raw ?? rawMatch?.score ?? null;
          if (played) {
            ann.dcc = played.dcc;
            ann.stability = played.stability;
            ann.adsr = played.adsr;
            ann.trend = played.trend;
            ann.momentum = played.momentum;
            ann.tunnel = played.tunnel;
            ann.observedPlies = played.data?.observedPlies ?? null;
            ann.samplePlies = played.data?.targetPlies ?? null;
          }
          ann.coverage = analysis.receipt?.status || 'unknown';
          ann.isDCC1 = analysis.dcc1Move && ann.coverage === 'complete' ? analysis.dcc1Move === moveUci : null;
        }
        const playedMove = applyUciMove(game, moveUci);
        if (!playedMove) throw new Error(`PGN move ${i + 1} (${mv.san}) is illegal at the replay position.`);
        annotations.push(ann);
        board.position(game.fen());
        renderHistory();
        renderReplayProgress(annotations, moves.length, 'Reviewing', headers);
        if (settings.simSpeed > 0) await sleep(Math.max(80, settings.simSpeed));
      }
      if (annotations.length === moves.length && !replayAbort && analysisGeneration === generation) {
        state = annotations.every(a => a.isDCC1 !== null) ? 'complete' : 'finished with gaps';
      }
    } catch (err) {
      state = 'failed';
      failure = describeErr(err);
      console.warn('Replay failed:', err);
    } finally {
      replayRunning = false;
      replayAbort = false;
      playState.replaying = false;
      invalidateDCCAnalysis();
      if (btn) {
        btn.textContent = 'Replay';
        btn.style.background = '#203030';
        btn.style.color = '#00e5ff';
      }
      refreshPlayUi();
      document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
      board.position(game.fen());
      renderHistory();
      renderReplayProgress(annotations, moves.length, state, headers);
      const white = replayAgreement(annotations, 'w');
      const black = replayAgreement(annotations, 'b');
      const annotatedPGN = generateAnnotatedPGN(headers, moves, annotations, white.pct, black.pct,
        { state, initialFen, settings: replaySettings });
      const panel = document.getElementById('simStatsPanel');
      if (panel) {
        const save = document.createElement('button');
        save.id = 'btnSaveAnnotatedPGN';
        save.textContent = state === 'complete' ? 'Save Annotated PGN' : 'Save Partial Review PGN';
        save.onclick = () => {
          const blob = new Blob([annotatedPGN], { type: 'application/x-chess-pgn' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'chessdcc_replay.pgn';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        panel.appendChild(save);
      }
      updateSimStatus(`Replay ${state}: ${annotations.length}/${moves.length} plies reviewed.${failure ? ` ${failure}` : ''}`);
    }
  }

  function generateAnnotatedPGN(headers, moves, annotations, wPct, bPct, meta = {}) {
    const escapeTag = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
    const tags = { ...headers };
    // Replace old ambiguous accuracy tags when re-reviewing an earlier export.
    delete tags.DCC_WhiteAccuracy;
    delete tags.DCC_BlackAccuracy;
    if (meta.initialFen && meta.initialFen !== getStartFen()) {
      tags.SetUp = '1';
      tags.FEN = meta.initialFen;
    }
    const used = meta.settings || { depth: settings.dccDepth, candidates: settings.dccTopCandidates, floor: settings.dccEvalFloor };
    Object.assign(tags, {
      DCC_Version: 'new', DCC_Depth: used.depth, DCC_TopCandidates: used.candidates,
      DCC_EvalFloor: used.floor, DCC_Completion: meta.state || 'partial',
      DCC_ReviewedPlies: annotations.length, DCC_TotalPlies: moves.length,
      DCC_WhiteAgreement: wPct === null ? 'unknown' : `${wPct}%`,
      DCC_BlackAgreement: bPct === null ? 'unknown' : `${bPct}%`,
      DCC_RawPerspective: 'side to move before played move',
      DCC_ScoreMeaning: 'raw_cp is database evaluation; dcc_rank is a preference score, not an engine evaluation'
    });
    let pgn = Object.entries(tags).filter(([key]) => /^[A-Za-z0-9_]+$/.test(key))
      .map(([key, value]) => `[${key} "${escapeTag(value)}"]`).join('\n') + '\n\n';
    const start = (meta.initialFen || headers.FEN || getStartFen()).split(/\s+/);
    let side = start[1] === 'b' ? 'b' : 'w';
    let number = Number(start[5]) || 1;
    for (let i = 0; i < moves.length; i++) {
      if (side === 'w') pgn += `${number}. `;
      else if (i === 0) pgn += `${number}... `;
      pgn += `${moves[i].san} `;
      const ann = annotations[i];
      if (ann) {
        const parts = [`coverage=${ann.coverage || 'unknown'}`];
        if (Number.isFinite(ann.raw)) parts.push(`raw_cp=${ann.raw}`);
        if (Number.isFinite(ann.dcc)) parts.push(`dcc_rank=${ann.dcc}`);
        if (Number.isFinite(ann.stability)) parts.push(`stability=${ann.stability.toFixed(2)}`);
        if (ann.adsr) parts.push(`ADSR=${ann.adsr}`);
        if (ann.isDCC1 !== null) parts.push(`DCC#1=${ann.isDCC1 ? 'yes' : 'no'}`);
        if (Number.isFinite(ann.observedPlies)) parts.push(`observed_plies=${ann.observedPlies}`);
        if (Number.isFinite(ann.samplePlies)) parts.push(`sample_plies=${ann.samplePlies}`);
        pgn += `{DCC: ${parts.length ? parts.join(' ') : 'unavailable'}} `;
      } else if (i === annotations.length) pgn += '{DCC: remaining plies not reviewed} ';
      if (side === 'b') { pgn += '\n'; number++; }
      side = side === 'w' ? 'b' : 'w';
    }
    return pgn + (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(headers.Result || '') ? headers.Result : '*') + '\n';
  }

  const btnReplay = document.getElementById('btnReplay');
  const replayModal = document.getElementById('replayModal');
  if (btnReplay && replayModal) {
    btnReplay.onclick = () => {
      if (replayRunning) { stopReplay(); return; }
      if (playState.active || simRunning) { updateSimStatus('Stop the current game or simulation before Replay.'); return; }
      replayModal.style.display = 'flex';
    };
    document.getElementById('replayCancel').onclick = () => { replayModal.style.display = 'none'; };
    replayModal.onclick = event => { if (event.target === replayModal) replayModal.style.display = 'none'; };
    document.getElementById('replayStart').onclick = async () => {
      replayModal.style.display = 'none';
      if (playState.active || simRunning || replayRunning) return;
      const number = (id, fallback, min, max) => {
        const value = Number(document.getElementById(id)?.value);
        return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
      };
      const saved = {
        dccDepth: settings.dccDepth, dccTopCandidates: settings.dccTopCandidates,
        dccEvalFloor: settings.dccEvalFloor, simSpeed: settings.simSpeed
      };
      const overrides = {
        dccDepth: number('replayDepth', saved.dccDepth, 1, 30),
        dccTopCandidates: number('replayTopC', saved.dccTopCandidates, 1, 10),
        dccEvalFloor: number('replayFloor', saved.dccEvalFloor, 0, 1000),
        simSpeed: number('replaySpeed', saved.simSpeed, 0, 10000)
      };
      Object.assign(settings, overrides);
      try { await replayGame(); }
      finally {
        // Preserve any deliberate setting change made while Replay was pending.
        for (const key of Object.keys(saved)) if (settings[key] === overrides[key]) settings[key] = saved[key];
        invalidateDCCAnalysis();
      }
    };
  }

  // ─── DCC View toggle button ────────────────────────────────────────
  const btnToggle = document.getElementById('btnViewToggle');
  if (btnToggle) {
    btnToggle.onclick = () => {
      dccViewActive = !dccViewActive;
      const movesEl = document.getElementById('moves');
      const dccPanel = document.getElementById('dccAnalysisPanel');
      if (dccViewActive) {
        movesEl.style.display = 'none';
        dccPanel.style.display = 'block';
        btnToggle.textContent = 'Moves';
        btnToggle.style.background = '#00e5ff';
        btnToggle.style.color = '#000';
        renderDCCView();
      } else {
        movesEl.style.display = '';
        dccPanel.style.display = 'none';
        btnToggle.textContent = 'DCC';
        btnToggle.style.background = '#2a3540';
        btnToggle.style.color = '#fff';
      }
    };
  }
  // ────────────────────────────────────────────────────────────────────

  
  // ─── Clickable title: reload or jump back to orange move (and clear highlight) ───
  const titleEl = document.getElementById('gameTitle');
  titleEl.style.cursor = 'pointer';
  titleEl.onclick = () => {
    if (playState.active || replayRunning) return;
    // If sim is running → stop it
    if (simRunning) {
      simAbort = true;
      return; // restore happens in runSimulation cleanup
    }

    // If we just returned from a sim → restore pre-sim position
    if (preSimFen) {
      game.load(preSimFen);
      board.position(game.fen());
      updateBoard(false);
      preSimFen = null;
      preSimMoveIndex = -1;
      return;
    }

    const branchPoint = divergedIndex;
    // nothing to do if no PGN loaded and no branch point
    if (branchPoint < 0 && !lastLoadedPGN) return;

    // clear the orange highlight
    divergedIndex = -1;

    if (lastLoadedPGN) {
      game.reset();
      bookFlags = extractBookFlags(lastLoadedPGN);
      game.load_pgn(makeLoadablePgn(lastLoadedPGN));
      window._skipDivergedReset = false;
      updateBoard(true);
      if (branchPoint >= 0) {
        jumpTo(branchPoint - 1);
      } else if (lastMoveIndex >= 0) {
        jumpTo(lastMoveIndex);
      }
    } else {
      // pure “scratch” game: just jump back to that move
      jumpTo(branchPoint);
    }
  };

  // ─── “ChessBest.org” link replays the best (blue) move ────────────────
document.getElementById('bestMoveLink').addEventListener('click', e => {
  e.preventDefault();
  if (playState.active || simRunning || replayRunning) return;
  const bestOv = document.querySelector('.overlay.best');
  if (!bestOv) return;
  const mv   = bestOv.dataset.move;
  const from = mv.slice(0,2), to = mv.slice(2,4);
  const m    = game.move({ from, to, promotion: mv[4] || 'q' });
  if (!m) return;
  lastAction = 'move';
  window._skipDivergedReset = true;
  updateBoard(false);
});
// ────────────────────────────────────────────────────────────────────────

// ─── Background-click (non-interactive) also replays best move ─────────
const mainEl = document.getElementById('main');
mainEl.addEventListener('click', e => {
  if (e.target.closest(
    '#board-container, #controls, #gameTitle, #pageSubtitle, a, button, input, select, label'
  )) return;
  document.getElementById('bestMoveLink').click();
});
// ────────────────────────────────────────────────────────────────────────
  
  // Hidden “Author” link toggles board size—desktop only
  (function() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) return;  // no-op on mobile

    const authorLink = document.getElementById("authorLink");
    const boardEl    = document.getElementById("board");

	authorLink.addEventListener("click", e => {
	  e.preventDefault();
	  boardEl.classList.toggle("scaled");
	  board.resize(); // recalculate click coordinates

	  settings.doubleBoard = boardEl.classList.contains("scaled");
	  document.getElementById('settingDoubleBoard').checked = settings.doubleBoard;

	  saveSettings();
	});

  })();
  // ────────────────────────────────────────────────────────────────────────

}

/* ------------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------------*/
window.addEventListener('load', initAll);
