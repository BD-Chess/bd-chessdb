function initAll() {
  const STORAGE_KEY_SETTINGS = 'chessBestSettings';
  const STORAGE_KEY_GAME     = 'chessBestGame';
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
    bg: '#2e2e2e',
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
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }
  const LICHESS_TOKEN_KEY   = 'chessBestLichessToken';
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
      challengeId: null
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

	  // Remember this PGN string and reset
	  lastLoadedPGN = e.target.value;
	  divergedIndex = -1;
	  const title = e.target.selectedOptions[0].text;

	  // Reset board/game state
	  game.reset();

	  // Extract “in-book” flags, strip all comments, then load clean PGN
	  bookFlags = extractBookFlags(e.target.value);
	  const cleanPgn = e.target.value.replace(/\{[^}]*\}/g, '');
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
	      queueCoachMessage('system', 'Move relay failed. The board was restored to the local position when possible.');
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
    if (game.history().length)
      localStorage.setItem(STORAGE_KEY_GAME, game.pgn());
    else
      localStorage.removeItem(STORAGE_KEY_GAME);
  }


	/**
	 * Given raw PGN with {Book} comments,
	 * return a Boolean[] aligned to each half-move.
    */
	function extractBookFlags(pgn) {
	  // 1) Pull out every comment, note which are “Book”
	  const rawFlags = [];
	  pgn.replace(/\{([^}]*)\}/g, (_, comment) => {
		rawFlags.push(comment.includes('Book'));
		return '';
	  });

	  // 2) Strip comments & move-numbers, split into SAN tokens
	  const moves = pgn
		.replace(/\{[^}]*\}/g, '')          // remove comments
		.replace(/\d+\.\s*/g, '')           // remove “1. ”, “2. ”, etc.
		.trim()
		.split(/\s+/)                       // split on whitespace
		.filter(tok => tok && !/^\d+$/.test(tok)); // drop stray numbers

	  // 3) Map each SAN to its flag (default false)
	  return moves.map((_, i) => Boolean(rawFlags[i]));
	}

  /* ------------------------------------------------------------------
     8a. MDL+DCC EVAL LAYER — Core Functions
  ------------------------------------------------------------------*/

  // ── LZ76 Complexity ─────────────────────────────────────────────
  function lz76(str) {
    if (str.length <= 1) return str.length;
    let c = 1, l = 1, i = 0, k = 1, kmax = 1;
    while (true) {
      if (str[i + k - 1] === str[l + k - 1]) {
        k++;
        if (l + k > str.length) { c++; break; }
      } else {
        if (k > kmax) kmax = k;
        i++;
        if (i === l) { c++; l += kmax; if (l >= str.length) break; i = 0; k = 1; kmax = 1; }
        else k = 1;
      }
    }
    return c;
  }

  function fenComplexity(fen) {
    const placement = fen.split(' ')[0];
    return lz76(placement) / placement.length;
  }

  // ── Eval sequence stability via LZ76 ────────────────────────────
  function evalSeqStability(evalSeq) {
    if (evalSeq.length < 3) return 0.5; // v0.6.0: neutral default for short seqs (was 1.0 for <2)
    // Encode deltas as characters for LZ analysis
    const deltas = evalSeq.slice(1).map((v, i) => {
      const d = v - evalSeq[i];
      if (d > 15) return 'A';       // strong rise
      if (d > 5)  return 'B';       // mild rise
      if (d > -5) return 'C';       // flat
      if (d > -15) return 'D';      // mild drop
      return 'E';                    // strong drop
    }).join('');
    const raw = lz76(deltas) / Math.max(deltas.length, 1);
    // Invert: low LZ = compressible = stable → high stability score
    return Math.max(0, Math.min(1, 1 - raw));
  }

  // ── Trend calculation ───────────────────────────────────────────
  function evalTrend(evalSeq) {
    if (evalSeq.length < 2) return 'stable';
    const first = evalSeq[0], last = evalSeq[evalSeq.length - 1];
    const diff = last - first;
    if (diff > 15) return 'rising';
    if (diff < -15) return 'falling';
    return 'stable';
  }

  function trendArrow(trend) {
    return { rising: '↑', falling: '↓', stable: '→' }[trend] || '→';
  }

  // ── ADSR Analysis on eval sequence ──────────────────────────────
  // Attack-Decay-Sustain-Release shape signature
  // Same sensor that achieved ρ = −0.50 on Sudoku, confirmed across TSP and F4M
  function adsrAnalysis(evalSeq) {
    if (evalSeq.length < 2) {
      return { attack: 0, decay: 0, sustain: 0, release: 0, shape: 'unknown', label: '?' };
    }

    const baseline = evalSeq[0];
    const deltas = evalSeq.map(v => v - baseline); // normalize to start

    // Attack: maximum positive excursion from baseline
    const peak = Math.max(...deltas);
    const peakIdx = deltas.indexOf(peak);
    const attack = peak; // how much we gain at best

    // Decay: drop from peak to subsequent minimum (before release)
    const afterPeak = deltas.slice(peakIdx);
    const valley = Math.min(...afterPeak);
    const decay = peak - valley; // how much we lose after peak

    // Sustain: average level in the middle 60% of the sequence
    const startIdx = Math.max(1, Math.floor(deltas.length * 0.2));
    const endIdx = Math.max(startIdx + 2, Math.floor(deltas.length * 0.8));
    // ^^ v0.6.0 fix: minimum 2 elements in midSlice (was startIdx+1)
    const midSlice = deltas.slice(startIdx, endIdx);
    const sustain = midSlice.length > 0
      ? midSlice.reduce((a, b) => a + b, 0) / midSlice.length
      : 0;

    // Release: final value relative to sustain
    const release = deltas[deltas.length - 1] - sustain;

    // Shape classification
    const absAttack = Math.abs(attack);
    const absDecay = Math.abs(decay);
    const range = Math.max(...evalSeq) - Math.min(...evalSeq);
    const normalized = range > 0 ? absDecay / range : 0;

    let shape, label;
    // v0.6.0 order: sustained → spike → building → collapse → volatile → mixed
    if (absAttack < 10 && absDecay < 10) {
      shape = 'sustained'; label = '▬';  // flat line, solid
    } else if (absAttack > 20 && normalized > 0.5) {
      shape = 'spike'; label = '⚡';      // sharp gain then collapse
    } else if (attack > 10 && absDecay < 10 && release > -5) {
      shape = 'building'; label = '▲';    // steadily growing (now before collapse)
    } else if (sustain < -10) {
      shape = 'collapse'; label = '▼';    // falls below starting level
    } else if (absDecay > 15 && absAttack > 15) {
      shape = 'volatile'; label = '〜';   // wild oscillation
    } else {
      shape = 'mixed'; label = '◆';       // doesn't fit clean pattern
    }

    return { attack, decay, sustain: Math.round(sustain), release: Math.round(release), shape, label };
  }

  // ADSR shape descriptions for tooltips/display
  const ADSR_SHAPES = {
    sustained: { color: '#34d399', desc: 'Solid — holds advantage through depth' },
    building:  { color: '#00e5ff', desc: 'Building — advantage grows with depth' },
    spike:     { color: '#f59e0b', desc: 'Spike — sharp gain then fades' },
    collapse:  { color: '#ff4c4c', desc: 'Collapse — falls apart with best play' },
    volatile:  { color: '#a78bfa', desc: 'Volatile — wild swings, tactical chaos' },
    mixed:     { color: '#888',    desc: 'Mixed — no clear pattern' },
    unknown:   { color: '#555',    desc: 'Insufficient data' }
  };

  // ── v0.6.0: DCC Weight Constants ─────────────────────────────────
  // For v0.7.0: MDL arena over these weights — P17 on weights.
  const DCC_WEIGHTS = {
    stability: 20,
    adsr_sustained: 10, adsr_building: 15,
    adsr_spike: -5, adsr_collapse: -20, adsr_volatile: -10,
    momentum_max: 5,
    endgame_known: 25, endgame_unknown: -15,
    tunnel: 10,
    complexity: 10
  };

  // ── v0.6.0 Feature 1: Self-calibrating DCC Governor [P17] ──────
  let dccGovernor = {
    allDeltas: [],
    threshDrop: -15,  // initial defaults (same as v0.5.0 hardcoded)
    threshRise: 5,

    observe(evalSeq) {
      for (let i = 1; i < evalSeq.length; i++)
        this.allDeltas.push(evalSeq[i] - evalSeq[i-1]);
      // Keep bounded
      if (this.allDeltas.length > 500)
        this.allDeltas = this.allDeltas.slice(-300);
      if (this.allDeltas.length >= 10) this.recalibrate();
    },

    recalibrate() {
      const s = [...this.allDeltas].sort((a, b) => a - b);
      this.threshDrop = s[Math.floor(s.length * 0.15)];
      this.threshRise = s[Math.floor(s.length * 0.75)];
    }
  };

  // ── v0.6.0 Feature 2: Positional Momentum ──────────────────────
  function evalMomentum(evalSeq) {
    if (evalSeq.length < 3) return 0;
    let accSum = 0;
    for (let i = 2; i < evalSeq.length; i++)
      accSum += (evalSeq[i] - evalSeq[i-1]) - (evalSeq[i-1] - evalSeq[i-2]);
    return accSum / (evalSeq.length - 2);
  }

  // ── v0.6.0 Feature 3: Endgame Transition Detector ──────────────
  function materialCount(fen) {
    return fen.split(' ')[0].replace(/[/1-8]/g, '').length;
  }

  // ── v0.6.0 Feature 4: Tunneling Detector ───────────────────────
  // Moves that look bad shallow but become good deep.
  // Same principle as TSP tunneling sensor: barrier shape matters.
  function detectTunnel(evalSeq) {
    if (evalSeq.length < 4) return false;
    const start = evalSeq[0];
    const mid = evalSeq.slice(1, -1);
    const minMid = Math.min(...mid);
    const end = evalSeq[evalSeq.length - 1];
    return minMid < start - 20 && end > start + 10;
  }

  // ── DCC Governance: should we look deeper? ──────────────────────
  // v0.6.0: uses self-calibrating thresholds from dccGovernor [P17]
  function shouldGoDeeper(evalSeq) {
    if (evalSeq.length < 2) return true;
    const last = evalSeq[evalSeq.length - 1];
    const prev = evalSeq[evalSeq.length - 2];
    const trend = last - prev;
    // Falling eval → danger, look deeper
    if (trend < dccGovernor.threshDrop) return true;
    // Rising and stable → no surprises, stop
    if (trend > dccGovernor.threshRise && evalSeqStability(evalSeq) > 0.5) return false;
    // Oscillating → look deeper
    const oscillation = evalSeq.some((v, i) =>
      i > 1 && Math.sign(v - evalSeq[i-1]) !== Math.sign(evalSeq[i-1] - evalSeq[i-2])
    );
    if (oscillation) return true;
    return evalSeq.length < 3; // minimum 3 half-moves
  }

  // ── Eval Cache (localStorage) ───────────────────────────────────
  let evalCache = {};
  try {
    evalCache = JSON.parse(localStorage.getItem('dccEvalCache') || '{}');
  } catch(e) { evalCache = {}; }

  function persistEvalCache() {
    const keys = Object.keys(evalCache);
    if (keys.length > 10000) {
      // Evict oldest 2000 entries
      keys.slice(0, 2000).forEach(k => delete evalCache[k]);
    }
    try {
      localStorage.setItem('dccEvalCache', JSON.stringify(evalCache));
    } catch(e) { /* quota exceeded — silently fail */ }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Raw chessdb fetch with caching + rate limiting ──────────────
  async function cachedFetchChessDB(fen) {
    const key = fen.split(' ').slice(0, 4).join(' '); // normalize
    if (evalCache[key]) return evalCache[key];
    await sleep(200); // rate limit guard
    const useProxy = settings.evalMode === 'proxy';
    const baseURL = useProxy
      ? '/.netlify/functions/queryall?'
      : 'https://www.chessdb.cn/cdb.php?action=queryall&';
    const url = `${baseURL}board=${encodeURIComponent(fen)}&learn=0&showall=1`;
    try {
      const txt = await fetch(url).then(r => r.text());
      const moves = txt.split('|').map(line => {
        const m = line.match(/move:(\w+),score:([-\d\?]+),rank:(\d+),/);
        if (!m || m[2] === '??') return null;
        const score = parseInt(m[2], 10), rank = parseInt(m[3], 10);
        if (isNaN(score)) return null;
        return { move: m[1], score, rank };
      }).filter(Boolean).sort((a, b) => b.score - a.score || a.rank - b.rank);
      const result = { moves, fen };
      evalCache[key] = result;
      persistEvalCache();
      return result;
    } catch(e) {
      console.warn('DCC cachedFetch error:', e);
      return { moves: [], fen };
    }
  }

  // ── querypv: single call returns score + depth + full PV line ───
  async function fetchPV(fen) {
    const key = 'pv:' + fen.split(' ').slice(0, 4).join(' ');
    if (evalCache[key]) return evalCache[key];
    await sleep(200);
    const url = `https://www.chessdb.cn/cdb.php?action=querypv&board=${encodeURIComponent(fen)}&learn=0`;
    try {
      const txt = await fetch(url).then(r => r.text());
      // Format: score:SCORE,depth:DEPTH,pv:MOVE1|MOVE2|...|MOVEn
      // Or: "unknown" / "invalid board"
      if (txt === 'unknown' || txt.startsWith('invalid')) {
        const result = { score: null, depth: 0, pv: [], raw: txt };
        evalCache[key] = result;
        persistEvalCache();
        return result;
      }
      const scoreMatch = txt.match(/score:([-\d]+)/);
      const depthMatch = txt.match(/depth:(\d+)/);
      const pvMatch    = txt.match(/pv:(.+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
      const pv    = pvMatch ? pvMatch[1].split('|').filter(Boolean) : [];
      const result = { score, depth, pv, raw: txt };
      evalCache[key] = result;
      persistEvalCache();
      return result;
    } catch(e) {
      console.warn('fetchPV error:', e);
      return { score: null, depth: 0, pv: [], raw: '' };
    }
  }

  // ── queryscore: lightweight single-score probe ─────────────────
  async function fetchScore(fen) {
    const key = 'sc:' + fen.split(' ').slice(0, 4).join(' ');
    if (evalCache[key] !== undefined) return evalCache[key];
    await sleep(150); // slightly lighter rate limit
    const url = `https://www.chessdb.cn/cdb.php?action=queryscore&board=${encodeURIComponent(fen)}&learn=0`;
    try {
      const txt = await fetch(url).then(r => r.text());
      // Format: eval:SCORE or "unknown"
      const m = txt.match(/eval:([-\d]+)/);
      const score = m ? parseInt(m[1], 10) : null;
      evalCache[key] = score;
      persistEvalCache();
      return score;
    } catch(e) {
      console.warn('fetchScore error:', e);
      return null;
    }
  }

  // ── DCC Lookahead — querypv first, then selective queryscore ────
  //
  // v0.6.0 SIGN CONVENTION VERIFICATION (C1 review item):
  // Scholar's Mate FEN (Black won): querypv returns NEGATIVE score
  // when White (losing side) is to move. Both querypv and queryscore
  // return from the perspective of the side to move. The sign flipping
  // in the loop below (odd plies get negated) is CORRECT — it keeps
  // all values normalized to the root side's perspective.
  //
  // Flow per candidate move M:
  //   1. Make M on board copy → FEN_after
  //   2. fetchPV(FEN_after) → score, depth, PV line  [1 API call]
  //   3. Walk PV moves to build intermediate FENs
  //   4. fetchScore on key intermediates based on DCC governance
  //      [0-3 lightweight API calls, governed by shouldGoDeeper]
  //   5. Return evalSequence + movePath for display
  //
  // Total: ~1-4 API calls per candidate vs. old 5-10
  //
  async function dccLookahead(gameCopy, maxHalfMoves) {
    const evalSequence = [];
    const movePath = [];
    const fen = gameCopy.fen();

    // Step 1: get the full PV from this position
    const pvResult = await fetchPV(fen);
    if (pvResult.score === null || pvResult.pv.length === 0) {
      return { evalSequence, movePath };
    }

    // The PV score is from the side to move's perspective
    evalSequence.push(pvResult.score);

    // Step 2: walk the PV to build intermediate positions
    const probe = new Chess(fen);
    const pvMoves = pvResult.pv.slice(0, maxHalfMoves);

    for (let i = 0; i < pvMoves.length; i++) {
      const uci = pvMoves[i];
      const m = probe.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined
      });
      if (!m) break;
      movePath.push(uci);

      // DCC governance: only probe intermediate scores when interesting
      if (i < pvMoves.length - 1) {
        // Score every 2nd position, or always if sequence is oscillating
        const needsScore = (i % 2 === 1) || !shouldGoDeeper(evalSequence);
        if (needsScore || evalSequence.length < 3) {
          const intScore = await fetchScore(probe.fen());
          if (intScore !== null) {
            // Normalize: queryscore returns from side-to-move POV
            // Flip sign on odd plies to keep consistent perspective
            const normalized = (i % 2 === 0) ? -intScore : intScore;
            evalSequence.push(normalized);
          }
          // DCC: if stable and rising, stop probing intermediates
          if (evalSequence.length >= 3 && !shouldGoDeeper(evalSequence)) break;
        }
      }
    }

    // Always include the endpoint score (from PV)
    if (pvMoves.length > 0 && evalSequence.length === 1) {
      // We only have the root score — try to get the endpoint
      const endScore = await fetchScore(probe.fen());
      if (endScore !== null) {
        const normalized = (pvMoves.length % 2 === 0) ? endScore : -endScore;
        evalSequence.push(normalized);
      }
    }

    // v0.6.0: Feed results to self-calibrating governor
    if (evalSequence.length >= 2) {
      dccGovernor.observe(evalSequence);
    }

    return { evalSequence, movePath, pvDepth: pvResult.depth };
  }

  let activeLookaheadId = 0; // cancel stale lookaheads on board change

  // ── DCC Progress indicator ───────────────────────────────────────
  function updateDCCProgress(done, total) {
    const el = document.getElementById('dccProgress');
    if (!el) return;
    if (total <= 0) { el.textContent = ''; return; }
    if (done >= total) {
      el.textContent = 'DCC ✓';
      el.style.color = '#34d399';
      setTimeout(() => { if (el.textContent === 'DCC ✓') { el.textContent = ''; } }, 3000);
    } else {
      const pct = Math.round(100 * done / total);
      el.textContent = `DCC ${pct}%`;
      el.style.color = '#00e5ff';
    }
  }

  async function runDCCLookahead(moveList, baseFen) {
    const thisId = ++activeLookaheadId;
    const maxHalfMoves = settings.dccDepth * 2;
    latestDCCResults = []; // reset for this position

    // Smart candidate selection: eval floor + max candidates
    const bestScore = moveList.length > 0 ? moveList[0].score : 0;
    const candidates = moveList.filter(m =>
      Math.abs(bestScore - m.score) <= settings.dccEvalFloor
    ).slice(0, settings.dccTopCandidates);

    updateDCCProgress(0, candidates.length);

    for (let i = 0; i < candidates.length; i++) {
      if (thisId !== activeLookaheadId) { updateDCCProgress(0, 0); return; }

      const mv = candidates[i];
      const probe = new Chess(baseFen);
      const m = probe.move({
        from: mv.move.slice(0, 2),
        to: mv.move.slice(2, 4),
        promotion: mv.move.length > 4 ? mv.move[4] : 'q'
      });
      if (!m) continue;

      // Show loading indicator on badge
      updateDCCBadge(mv.move, null, 'loading');

      const { evalSequence, movePath, pvDepth } = await dccLookahead(probe, maxHalfMoves);
      if (thisId !== activeLookaheadId) { updateDCCProgress(0, 0); return; }

      if (evalSequence.length > 0) {
        const trend = evalTrend(evalSequence);
        const stability = evalSeqStability(evalSequence);
        const arrow = trendArrow(trend);
        const adsr = adsrAnalysis(evalSequence);
        const momentum = evalMomentum(evalSequence);  // v0.6.0
        const tunnel = detectTunnel(evalSequence);     // v0.6.0
        const data = {
          move: mv.move, trend, stability, arrow, evalSequence, movePath,
          score: mv.score, pvDepth: pvDepth || 0, adsr, momentum, tunnel,
          isMdlPick: !!document.querySelector(`.square-${mv.move.slice(-2)} .overlay.dcc-mdl-pick`)
        };
        updateDCCBadge(mv.move, data, 'done');
        latestDCCResults.push(data);
      } else {
        updateDCCBadge(mv.move, null, 'none');
      }
      // Update progress + DCC view panel
      updateDCCProgress(i + 1, candidates.length);
      renderDCCView();
      if (settings.dccOnly) applyDCCOnlyBadges();
    }

    // v0.6.1: Store results for PGN export, keyed by position FEN
    if (latestDCCResults.length > 0) {
      const fenKey = baseFen.split(' ').slice(0, 4).join(' ');
      dccMoveAnnotations[fenKey] = latestDCCResults.slice();
    }
  }

  // ── Update badge with DCC data ──────────────────────────────────
  function updateDCCBadge(move, data, status) {
    const sq = move.slice(-2);
    const cell = document.querySelector(`.square-${sq}`);
    if (!cell) return;
    const ov = cell.querySelector('.overlay');
    if (!ov) return;

    // Remove old DCC indicators
    ov.querySelectorAll('.dcc-arrow,.dcc-loading,.dcc-adsr-label').forEach(e => e.remove());
    ov.classList.remove('dcc-stable', 'dcc-unstable', 'dcc-mdl-pick');

    if (status === 'loading') {
      const dot = document.createElement('span');
      dot.className = 'dcc-loading';
      dot.textContent = '…';
      ov.appendChild(dot);
      return;
    }

    if (status === 'done' && data) {
      // Add trend arrow
      const arrowEl = document.createElement('span');
      arrowEl.className = `dcc-arrow dcc-trend-${data.trend}`;
      arrowEl.textContent = ' ' + data.arrow;
      ov.appendChild(arrowEl);

      // Add ADSR shape label
      if (data.adsr && data.adsr.shape !== 'unknown') {
        const adsrEl = document.createElement('span');
        const shapeInfo = ADSR_SHAPES[data.adsr.shape] || ADSR_SHAPES.unknown;
        adsrEl.className = 'dcc-adsr-label';
        adsrEl.textContent = data.adsr.label;
        adsrEl.style.color = shapeInfo.color;
        adsrEl.title = shapeInfo.desc;
        ov.appendChild(adsrEl);
      }

      // v0.6.0: Tunnel flag — move looks bad shallow but good deep
      if (data.tunnel) {
        const tunnelEl = document.createElement('span');
        tunnelEl.className = 'dcc-tunnel-label';
        tunnelEl.textContent = '⛏';
        tunnelEl.title = 'Tunnel move — looks bad shallow, good deep';
        tunnelEl.style.color = '#f59e0b';
        ov.appendChild(tunnelEl);
      }

      // Add stability border class
      if (data.stability > 0.6) ov.classList.add('dcc-stable');
      else if (data.stability < 0.35) ov.classList.add('dcc-unstable');

      // Store data for info panel
      ov.dataset.dccEvalSeq = JSON.stringify(data.evalSequence);
      ov.dataset.dccMovePath = JSON.stringify(data.movePath);
      ov.dataset.dccTrend = data.trend;
      ov.dataset.dccStability = data.stability.toFixed(2);
      ov.dataset.dccScore = data.score;
      ov.dataset.dccPvDepth = data.pvDepth || 0;
      ov.dataset.dccAdsrShape = data.adsr ? data.adsr.shape : '';
      ov.dataset.dccAdsrLabel = data.adsr ? data.adsr.label : '';
      ov.dataset.dccAdsr = data.adsr ? JSON.stringify(data.adsr) : '';
      ov.dataset.dccMomentum = data.momentum !== undefined ? data.momentum.toFixed(2) : '';
      ov.dataset.dccTunnel = data.tunnel ? '1' : '';

      // v0.6.1: Hover shows DCC info panel without moving pieces
      ov.addEventListener('mouseenter', () => showDCCInfoPanel(ov));
      ov.addEventListener('mouseleave', () => {
        const panel = document.getElementById('dccInfoPanel');
        if (panel) panel.style.display = 'none';
      });
    }
  }

  // ── LZ Tiebreaker — mark MDL pick among tied moves ─────────────
  function applyLZTiebreaker(moveList, baseFen) {
    if (moveList.length < 2) return;
    const threshold = settings.dccTieThreshold;
    const bestScore = moveList[0].score;

    // Find all moves within threshold of the best
    const tied = moveList.filter(m => Math.abs(m.score - bestScore) <= threshold);
    if (tied.length < 2) return;

    // Compute FEN complexity for each tied move
    let minComplexity = Infinity, mdlPick = null;
    tied.forEach(m => {
      const probe = new Chess(baseFen);
      const result = probe.move({
        from: m.move.slice(0, 2),
        to: m.move.slice(2, 4),
        promotion: m.move.length > 4 ? m.move[4] : 'q'
      });
      if (result) {
        const cx = fenComplexity(probe.fen());
        m._lzComplexity = cx;
        if (cx < minComplexity) {
          minComplexity = cx;
          mdlPick = m.move;
        }
      }
    });

    // Mark the MDL pick on the badge
    if (mdlPick) {
      const sq = mdlPick.slice(-2);
      const cell = document.querySelector(`.square-${sq}`);
      if (cell) {
        const ov = cell.querySelector('.overlay');
        if (ov) {
          ov.classList.add('dcc-mdl-pick');
          const star = document.createElement('span');
          star.className = 'dcc-mdl-star';
          star.textContent = ' ★';
          star.title = 'MDL tiebreaker: most compressible resulting position';
          ov.appendChild(star);
        }
      }
    }
  }

  // ── Info Panel — show eval path on click ────────────────────────
  function showDCCInfoPanel(ov) {
    const panel = document.getElementById('dccInfoPanel');
    if (!panel) return;
    const evalSeq = JSON.parse(ov.dataset.dccEvalSeq || '[]');
    const movePath = JSON.parse(ov.dataset.dccMovePath || '[]');
    const trend = ov.dataset.dccTrend || '?';
    const stability = parseFloat(ov.dataset.dccStability || '0');
    const pvDepth = parseInt(ov.dataset.dccPvDepth || '0', 10);

    if (evalSeq.length === 0 && movePath.length === 0) {
      panel.style.display = 'none';
      return;
    }

    // Build PV display: show all moves, scores where available
    const moveStr = movePath.map((m, i) => {
      const scoreStr = evalSeq[i + 1] !== undefined
        ? `<span class="dcc-path-eval">${evalSeq[i+1] > 0 ? '+' : ''}${evalSeq[i+1]}</span>`
        : '';
      return `<span class="dcc-path-move">${m}</span>${scoreStr}`;
    }).join('<span class="dcc-path-arrow">→</span>');

    const rootScore = evalSeq[0] !== undefined ? `${evalSeq[0] > 0 ? '+' : ''}${evalSeq[0]}` : '?';
    const stabilityPct = Math.round(stability * 100);
    const trendLabel = { rising: '↑ rising', falling: '↓ falling', stable: '→ stable' }[trend] || trend;
    const depthStr = pvDepth > 0 ? ` · d${pvDepth}` : '';

    // ADSR shape display
    let adsrStr = '';
    try {
      const adsr = JSON.parse(ov.dataset.dccAdsr || '{}');
      if (adsr.shape && adsr.shape !== 'unknown') {
        const shapeInfo = ADSR_SHAPES[adsr.shape] || ADSR_SHAPES.unknown;
        adsrStr = ` &nbsp;|&nbsp; <span class="dcc-adsr-info" style="color:${shapeInfo.color}">${adsr.label} ${shapeInfo.desc}</span>`;
      }
    } catch(e) {}

    // v0.6.1: Momentum + Tunnel
    let momStr = '';
    const mom = parseFloat(ov.dataset.dccMomentum || '0');
    if (mom !== 0) {
      const momColor = mom > 0.5 ? '#34d399' : mom < -0.5 ? '#ff4c4c' : '#888';
      const momSign = mom > 0 ? '+' : '';
      momStr = ` &nbsp;|&nbsp; <span style="color:${momColor}">Mom: ${momSign}${mom.toFixed(1)}</span>`;
    }
    const tunnelStr = ov.dataset.dccTunnel === '1'
      ? ' &nbsp;|&nbsp; <span style="color:#f59e0b">⛏ Tunnel</span>'
      : '';

    panel.innerHTML = `
      <div class="dcc-info-path"><span class="dcc-path-eval">${rootScore}</span><span class="dcc-path-arrow">→</span>${moveStr}</div>
      <div class="dcc-info-summary">
        Trend: <span class="dcc-trend-${trend}">${trendLabel}</span>
        &nbsp;|&nbsp; Stability: ${stabilityPct}%${depthStr}${adsrStr}${momStr}${tunnelStr}
      </div>
    `;
    panel.style.display = 'block';
  }

  // ── Render DCC Analysis Panel (replaces moves when toggled) ──────
  function renderDCCView() {
    const panel = document.getElementById('dccAnalysisPanel');
    if (!panel) return;
    if (!dccViewActive) { panel.style.display = 'none'; return; }

    panel.style.display = 'block';
    if (latestDCCResults.length === 0) {
      panel.innerHTML = '<div class="dcc-analysis-empty">DCC analysis loading…</div>';
      return;
    }

    // Sort by stability (highest first), then by score
    const sorted = latestDCCResults.slice().sort((a, b) => {
      const sa = a.stability || 0, sb = b.stability || 0;
      if (Math.abs(sb - sa) > 0.05) return sb - sa;
      return (b.score || 0) - (a.score || 0);
    });

    let html = '<table class="dcc-analysis-table">';
    html += '<tr class="dcc-analysis-header"><th>#</th><th>Move</th><th>Eval</th><th></th><th>Stab</th><th>Mom</th><th>ADSR</th><th></th></tr>';
    sorted.forEach((r, i) => {
      const rank = i + 1;
      const score = r.score !== undefined ? (r.score > 0 ? '+' + r.score : r.score) : '?';
      const arrow = r.arrow || '';
      const trendClass = r.trend ? 'dcc-trend-' + r.trend : '';
      const stabPct = r.stability !== undefined ? Math.round(r.stability * 100) + '%' : '—';
      const stabClass = r.stability > 0.6 ? 'dcc-stab-high' : r.stability < 0.35 ? 'dcc-stab-low' : 'dcc-stab-mid';
      const mdl = r.isMdlPick ? '<span class="star">★</span>' : '';
      const tunnelFlag = r.tunnel ? '<span style="color:#f59e0b" title="Tunnel move">⛏</span>' : '';
      const mom = r.momentum !== undefined ? (r.momentum > 0.5 ? '+' : r.momentum < -0.5 ? '−' : '·') : '·';
      const momColor = r.momentum > 0.5 ? '#34d399' : r.momentum < -0.5 ? '#ff4c4c' : '#666';
      const momTitle = r.momentum !== undefined ? `Momentum: ${r.momentum.toFixed(1)}` : '';
      const adsr = r.adsr || {};
      const adsrLabel = adsr.label || '';
      const adsrInfo = ADSR_SHAPES[adsr.shape] || ADSR_SHAPES.unknown;
      const pvStr = (r.movePath || []).join(' → ');
      html += `<tr class="dcc-analysis-row" data-move="${r.move}" title="${adsrInfo.desc} · PV: ${pvStr}">`;
      html += `<td class="dcc-rank">${rank}</td>`;
      html += `<td class="dcc-move-name">${r.move}${tunnelFlag}</td>`;
      html += `<td class="dcc-eval-cell">${score}</td>`;
      html += `<td class="${trendClass}">${arrow}</td>`;
      html += `<td class="${stabClass}">${stabPct}</td>`;
      html += `<td style="color:${momColor}" title="${momTitle}">${mom}</td>`;
      html += `<td style="color:${adsrInfo.color}" title="${adsrInfo.desc}">${adsrLabel}</td>`;
      html += `<td>${mdl}</td>`;
      html += `</tr>`;
    });
    html += '</table>';

    // Show PV of the top DCC-ranked move
    const top = sorted[0];
    if (top && top.movePath && top.movePath.length > 0) {
      const pvDisplay = top.movePath.join(' → ');
      const depthStr = top.pvDepth ? ` · d${top.pvDepth}` : '';
      html += `<div class="dcc-analysis-pv">PV: ${pvDisplay}${depthStr}</div>`;
    }

    panel.innerHTML = html;

    // Click rows to show that move's full info
    panel.querySelectorAll('.dcc-analysis-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const mv = row.dataset.move;
        const r = latestDCCResults.find(x => x.move === mv);
        if (r && r.evalSequence) {
          const infoPanel = document.getElementById('dccInfoPanel');
          if (infoPanel) {
            const moveStr = (r.movePath || []).map((m, i) => {
              const s = r.evalSequence[i + 1];
              const scoreStr = s !== undefined ? `<span class="dcc-path-eval">${s > 0 ? '+' : ''}${s}</span>` : '';
              return `<span class="dcc-path-move">${m}</span>${scoreStr}`;
            }).join('<span class="dcc-path-arrow">→</span>');
            const rootScore = r.evalSequence[0] !== undefined ? `${r.evalSequence[0] > 0 ? '+' : ''}${r.evalSequence[0]}` : '?';
            const trendLabel = { rising: '↑ rising', falling: '↓ falling', stable: '→ stable' }[r.trend] || r.trend;
            const depthStr = r.pvDepth ? ` · d${r.pvDepth}` : '';
            infoPanel.innerHTML = `
              <div class="dcc-info-path"><span class="dcc-path-eval">${rootScore}</span><span class="dcc-path-arrow">→</span>${moveStr}</div>
              <div class="dcc-info-summary">Trend: <span class="dcc-trend-${r.trend}">${trendLabel}</span> &nbsp;|&nbsp; Stability: ${Math.round((r.stability||0)*100)}%${depthStr}</div>
            `;
            infoPanel.style.display = 'block';
          }
        }
      });
    });
  }

  // ── DCC-only badge mode: replace raw score with DCC info ────────
  function applyDCCOnlyBadges() {
    if (!settings.dccOnly) return;
    // For each overlay with DCC data, replace the text content
    document.querySelectorAll('.overlay').forEach(ov => {
      if (!ov.dataset.dccTrend) {
        // No DCC data yet — dim the badge
        ov.style.opacity = '0.3';
        return;
      }
      ov.style.opacity = '1';
      const trend = ov.dataset.dccTrend;
      const stability = parseFloat(ov.dataset.dccStability || '0');
      const arrow = { rising: '↑', falling: '↓', stable: '→' }[trend] || '→';

      // Compute DCC rank by stability among visible overlays
      const allStabs = [];
      document.querySelectorAll('.overlay[data-dcc-stability]').forEach(o => {
        allStabs.push({ el: o, stab: parseFloat(o.dataset.dccStability || '0') });
      });
      allStabs.sort((a, b) => b.stab - a.stab);
      const rank = allStabs.findIndex(x => x.el === ov) + 1;

      // Replace badge text: arrow + rank
      // Keep only the arrow span, remove text nodes
      const arrowEl = ov.querySelector('.dcc-arrow');
      const starEl = ov.querySelector('.dcc-mdl-star');
      ov.childNodes.forEach(n => {
        if (n.nodeType === 3) n.textContent = ''; // clear text nodes
      });
      // Set new content
      if (!ov.querySelector('.dcc-only-label')) {
        const label = document.createElement('span');
        label.className = 'dcc-only-label';
        ov.insertBefore(label, ov.firstChild);
      }
      const label = ov.querySelector('.dcc-only-label');
      label.textContent = `${arrow}${rank}`;

      // Recolor badge by stability instead of eval sign
      ov.classList.remove('positive', 'negative', 'zero');
      if (stability > 0.6) ov.classList.add('positive');
      else if (stability < 0.35) ov.classList.add('negative');
      else ov.classList.add('zero');
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
	  if (playState.active && playState.assistanceLocked) return;
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

		//const allMoves = Array.from(moveMap.values())
		//  .sort((a, b) => b.rank - a.rank || b.score - a.score);

		//const list = isFinite(settings.topN) ? allMoves.slice(0, settings.topN) : allMoves;
		
		const allMoves = Array.from(moveMap.values())
		  // 1) highest score first, 2) lowest rank next
		  .sort((a, b) => b.score - a.score || a.rank - b.rank);

		const list = isFinite(settings.topN)
		  ? allMoves.slice(0, settings.topN)
		  : allMoves;
		
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

      // ── DCC Layer: tiebreaker + lookahead ────────────────────────
      if (settings.dccEnabled && list.length > 0) {
        const baseFen = game.fen();
        // LZ Tiebreaker for tied moves
        applyLZTiebreaker(list, baseFen);
        // Async lookahead for top N moves
        runDCCLookahead(list, baseFen);
      }
      // ─────────────────────────────────────────────────────────────

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

	// ── DCC: click to show eval path in info panel ──────────────
	ov.addEventListener('click', (e) => {
	  if (ov.dataset.dccEvalSeq) {
	    showDCCInfoPanel(ov);
	  }
	}, true);
	
	// ─── desktop-only hover preview by highlighting squares ───────────────────
	const fromSq  = move.slice(0,2);
	const fromCell = document.querySelector(`.square-${fromSq}`);

	ov.addEventListener('mouseenter', () => {
	  if (!window.matchMedia('(pointer: fine)').matches) return;
	  // preview the move
	  const preview = new Chess(game.fen());
	  preview.move({ from: fromSq, to: sq, promotion: 'q' });
	  board.position(preview.fen(), false);
	  // highlight source and target
	  fromCell.classList.add('preview-square');
	  cell.classList.add('preview-square');
	});

	ov.addEventListener('mouseleave', () => {
	  if (!window.matchMedia('(pointer: fine)').matches) return;
	  // remove highlights and restore position
	  fromCell.classList.remove('preview-square');
	  cell.classList.remove('preview-square');
	  board.position(game.fen(), false);
	});

	// clear preview highlights on mousedown (before your existing click logic runs)
	ov.addEventListener('mousedown', () => {
	  fromCell.classList.remove('preview-square');
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
	  activeLookaheadId++;
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
  if (playState.active) return;
  game.reset();
  fullHistory.forEach((m,idx)=>{ if(idx<=i) game.move(m.san); });
  lastAction = 'history';
  updateBoard(false);
}

  ['first','prev','next','last'].forEach(id=>{
    document.getElementById(id).onclick=()=>{
      if (playState.active) return;
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
	showOpening();
  };

  // ── v0.6.1: Generate PGN with DCC comments ────────────────────
  function generateDCCPgn() {
    const replay = new Chess();
    const hist = game.history({ verbose: true });
    const headers = game.header();
    let pgn = '';

    // PGN headers
    for (const [k, v] of Object.entries(headers)) {
      pgn += `[${k} "${v}"]\n`;
    }
    if (Object.keys(headers).length > 0) pgn += '\n';

    for (let i = 0; i < hist.length; i++) {
      const fenKey = replay.fen().split(' ').slice(0, 4).join(' ');
      const mv = hist[i];

      // Move number
      if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
      else if (i === 0) pgn += '1... ';

      pgn += mv.san + ' ';

      // Look up DCC data for this position → this move
      const dccResults = dccMoveAnnotations[fenKey];
      if (dccResults) {
        const uci = mv.from + mv.to;
        const match = dccResults.find(r =>
          r.move && r.move.slice(0, 4) === uci.slice(0, 4)
        );
        if (match) {
          const parts = [`DCC: ${match.score > 0 ? '+' : ''}${match.score}`];
          parts.push(match.arrow + (match.adsr ? match.adsr.label : ''));
          if (match.stability !== undefined)
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
		const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		const moves = fullHistory.map(m => m.from + m.to).join(' ');
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
		  const clean = evt.target.result.replace(/\{[^}]*\}/g,'');
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
    if (playState.active) return;
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
      queueCoachMessage('system', `Start failed: ${err.message || err}`);
      leaveActiveSession('Play start failed.');
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
    const result = await cachedFetchChessDB(fen);
    if (!result.moves || result.moves.length === 0) return null;

    // Smart candidate selection: eval floor + max candidates
    const bestRawScore = result.moves[0].score;
    const maxCandidates = overrideCandidates || settings.dccTopCandidates;
    const candidates = result.moves.filter(m =>
      Math.abs(bestRawScore - m.score) <= settings.dccEvalFloor
    ).slice(0, maxCandidates);

    let bestMove = result.moves[0]; // fallback: raw best
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const mv = candidates[i];
      const probe = new Chess(fen);
      const m = probe.move({
        from: mv.move.slice(0, 2), to: mv.move.slice(2, 4),
        promotion: mv.move.length > 4 ? mv.move[4] : 'q'
      });
      if (!m) continue;

      const pvResult = await fetchPV(probe.fen());
      if (pvResult.score === null) continue;

      const evalSeq = [pvResult.score];
      // Quick intermediate score if PV has moves
      if (pvResult.pv.length > 1) {
        const walk = new Chess(probe.fen());
        for (let j = 0; j < Math.min(4, pvResult.pv.length); j++) {
          const uci = pvResult.pv[j];
          const wm = walk.move({
            from: uci.slice(0, 2), to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined
          });
          if (!wm) break;
          if (j % 2 === 1) {
            const sc = await fetchScore(walk.fen());
            if (sc !== null) evalSeq.push((j % 2 === 0) ? -sc : sc);
          }
        }
      }

      const stability = evalSeqStability(evalSeq);
      const adsr = adsrAnalysis(evalSeq);
      // v0.6.0: Combined DCC score using DCC_WEIGHTS constants
      let dccScore = mv.score;
      dccScore += stability * DCC_WEIGHTS.stability;
      if (adsr.shape === 'sustained') dccScore += DCC_WEIGHTS.adsr_sustained;
      else if (adsr.shape === 'building') dccScore += DCC_WEIGHTS.adsr_building;
      else if (adsr.shape === 'spike') dccScore += DCC_WEIGHTS.adsr_spike;
      else if (adsr.shape === 'collapse') dccScore += DCC_WEIGHTS.adsr_collapse;
      else if (adsr.shape === 'volatile') dccScore += DCC_WEIGHTS.adsr_volatile;

      // v0.6.0 Feature 2: Positional momentum
      const momentum = evalMomentum(evalSeq);
      dccScore += Math.sign(momentum) * Math.min(Math.abs(momentum), DCC_WEIGHTS.momentum_max);

      // v0.6.0 Feature 3: Endgame transition detector
      if (materialCount(probe.fen()) <= 7) {
        const probeResult = await cachedFetchChessDB(probe.fen());
        if (probeResult.moves.length > 0) dccScore += DCC_WEIGHTS.endgame_known;
        else dccScore += DCC_WEIGHTS.endgame_unknown;
      }

      // v0.6.0 Feature 4: Tunneling bonus
      if (detectTunnel(evalSeq)) dccScore += DCC_WEIGHTS.tunnel;

      // LZ tiebreaker on resulting position
      const cx = fenComplexity(probe.fen());
      dccScore -= cx * DCC_WEIGHTS.complexity;

      if (dccScore > bestScore) {
        bestScore = dccScore;
        bestMove = mv;
        // v0.6.1: attach DCC metadata for CSV export
        bestMove._dccScore = dccScore;
        bestMove._stability = stability;
        bestMove._adsrShape = adsr.shape;
        bestMove._momentum = momentum;
        bestMove._tunnel = detectTunnel(evalSeq);
      }
    }
    return bestMove;
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

    const total = stats.games.length;
    const dccWins = stats.games.filter(g => g.winner === 'dcc').length;
    const rawWins = stats.games.filter(g => g.winner === 'raw').length;
    const draws = stats.games.filter(g => g.winner === 'draw').length;
    const avgLen = total > 0 ? Math.round(stats.games.reduce((a, g) => a + g.moves, 0) / total) : 0;
    const dccPct = total > 0 ? Math.round(100 * dccWins / total) : 0;

    const isBoth = stats.dccColor === 'both';
    const subtitle = isBoth
      ? `Both colors · ${settings.dccTopCandidates} candidates · ${settings.dccEvalFloor}cp floor`
      : `DCC plays ${stats.dccColor === 'w' ? 'White' : 'Black'}`;

    let html = `
      <div class="sim-stats-header">
        <span class="sim-title">DCC vs Raw ChessDB — ${total} game${total !== 1 ? 's' : ''}</span>
        <span class="sim-subtitle">${subtitle}</span>
      </div>
      <div class="sim-stats-grid">
        <div class="sim-stat"><div class="sim-num" style="color:#34d399">${dccWins}</div><div class="sim-label">DCC wins</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#ff4c4c">${rawWins}</div><div class="sim-label">Raw wins</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#888">${draws}</div><div class="sim-label">Draws</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#00e5ff">${dccPct}%</div><div class="sim-label">DCC rate</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#f59e0b">${avgLen}</div><div class="sim-label">Avg moves</div></div>
      </div>`;

    // Per-color breakdown for Sim mode (both sides DCC)
    if (isBoth) {
      const wGames = stats.games.filter(g => g.dccSide === 'w');
      const bGames = stats.games.filter(g => g.dccSide === 'b');
      const wWins = wGames.filter(g => g.winner === 'dcc').length;
      const bWins = bGames.filter(g => g.winner === 'dcc').length;
      const wPct = wGames.length > 0 ? Math.round(100 * wWins / wGames.length) : 0;
      const bPct = bGames.length > 0 ? Math.round(100 * bWins / bGames.length) : 0;
      html += `<div class="sim-color-breakdown">
        <span>As White: <strong style="color:#34d399">${wWins}/${wGames.length}</strong> (${wPct}%)</span>
        <span>As Black: <strong style="color:#a78bfa">${bWins}/${bGames.length}</strong> (${bPct}%)</span>
      </div>`;
    }

    html += '<div class="sim-games-list">';
    stats.games.forEach((g, i) => {
      const icon = g.winner === 'dcc' ? '✓' : g.winner === 'raw' ? '✗' : '=';
      const color = g.winner === 'dcc' ? '#34d399' : g.winner === 'raw' ? '#ff4c4c' : '#888';
      const sideTag = g.dccSide ? (g.dccSide === 'w' ? 'W' : 'B') : '';
      html += `<div class="sim-game-row" style="color:${color}">
        <span>${icon} ${sideTag ? '[' + sideTag + '] ' : ''}Game ${i + 1}</span>
        <span>${g.moves} moves</span>
        <span>${g.result}</span>
      </div>`;
    });

    html += '</div>';

    // v0.6.1: Export CSV button (only when games have data)
    const hasLogs = stats.games.some(g => g.moveLog && g.moveLog.length > 0);
    if (hasLogs) {
      html += '<div style="margin-top:8px;text-align:center"><button id="btnExportCSV" style="background:#00e5ff;color:#000;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:12px">Export CSV</button></div>';
    }

    panel.innerHTML = html;
    panel.style.display = 'block';

    // Wire up CSV export button
    const csvBtn = document.getElementById('btnExportCSV');
    if (csvBtn) csvBtn.onclick = () => exportSimCSV(stats);
  }

  // Run one simulated game
  async function runOneGame(dccColor, gameNum, totalGames, visualize, startFen) {
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
        if (simAbort) return { winner: 'abort', moves: 0, result: 'aborted' };
        const result = await cachedFetchChessDB(simGame.fen());
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
      if (simAbort) return { winner: 'abort', moves: moveCount, result: 'aborted' };

      const turn = simGame.turn(); // 'w' or 'b'
      // In 'both' mode: both sides use DCC. Otherwise: DCC vs Raw.
      const useDCC = bothDCC || (turn === dccColor);
      let pick = useDCC ? await pickDCCMove(simGame) : await pickRawMove(simGame);

      // Fallback: try querybest if queryall returned nothing
      if (!pick) {
        await sleep(200);
        try {
          const fbUrl = `https://www.chessdb.cn/cdb.php?action=querybest&board=${encodeURIComponent(simGame.fen())}&learn=0`;
          const fbTxt = await fetch(fbUrl).then(r => r.text());
          const fbm = fbTxt.match(/move:(\w+)/);
          if (fbm) pick = { move: fbm[1], score: 0 };
        } catch(e) {}
      }

      if (!pick) break; // truly unknown position

      const m = simGame.move({
        from: pick.move.slice(0, 2), to: pick.move.slice(2, 4),
        promotion: pick.move.length > 4 ? pick.move[4] : 'q'
      });
      if (!m) break;
      moveCount++;

      // v0.6.1: Log move data for CSV export
      moveLog.push({
        move_num: moveCount,
        fen: simGame.fen(),
        move: pick.move,
        raw_score: pick.score,
        dcc_score: pick._dccScore !== undefined ? pick._dccScore.toFixed(1) : '',
        stability: pick._stability !== undefined ? pick._stability.toFixed(2) : '',
        adsr_shape: pick._adsrShape || '',
        momentum: pick._momentum !== undefined ? pick._momentum.toFixed(1) : '',
        tunnel: pick._tunnel ? 'true' : 'false',
        picked_by: useDCC ? 'dcc' : 'raw'
      });

      const sideLabel = bothDCC ? (turn === 'w' ? 'W' : 'B') : (useDCC ? 'DCC' : 'Raw');
      updateSimStatus(`Game ${gameNum}/${totalGames} · Move ${moveCount} · ${sideLabel}: ${pick.move} (${pick.score > 0 ? '+' : ''}${pick.score})`);

      if (visualize && settings.simSpeed > 0) {
        board.position(simGame.fen());
        await sleep(settings.simSpeed);
      }
    }

    // Determine winner
    let winner = 'draw', result = 'draw';
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
      result = '½-½ stalemate';
    } else if (simGame.in_draw()) {
      result = '½-½ draw';
    } else if (moveCount >= maxMoves) {
      result = '½-½ (200 moves)';
    } else {
      result = '½-½ (no DB moves)';
    }

    if (visualize && settings.simSpeed > 0) {
      board.position(simGame.fen());
    }

    return { winner, moves: moveCount, result, moveLog };
  }

  // Main simulation orchestrator
  async function runSimulation(dccColor, startFen) {
    if (simRunning) { simAbort = true; return; }
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

    const colorLabel = isBoth ? 'both' : (dccColor === 'w' ? 'White' : 'Black');
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
    if (!botSel || !timeSel) return;
    botSel.innerHTML = '';
    timeSel.innerHTML = '';
    (botsConfig.lichess_bots || []).forEach((bot, idx) => {
      const opt = document.createElement('option');
      opt.value = bot.username;
      opt.textContent = bot.label;
      if (idx === 0) opt.selected = true;
      botSel.appendChild(opt);
    });
    (botsConfig.time_controls || []).forEach(tc => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify(tc.clock || {});
      opt.textContent = tc.label;
      if ((tc.label || '').includes('3+0')) opt.selected = true;
      timeSel.appendChild(opt);
    });
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
  playState.launchMode = launchMode || 'sim';
  if (simRunning) {
    simAbort = true;
    return;
  }
  if (playState.active && (playState.mode === 'dccbot' || playState.mode === 'lichess')) {
    leaveActiveSession(playState.mode === 'lichess'
      ? 'Live session stopped.'
      : '8Z session stopped.');
    return;
  }
  const modal = document.getElementById('simModal');
  if (modal) modal.style.display = 'flex';
  syncSimModalState();
}


  function closeSimModal() {
    const modal = document.getElementById('simModal');
    if (modal) modal.style.display = 'none';
  }

  
function refreshPlayUi() {
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
  }
  if (btnSimW) btnSimW.disabled = playState.active;
  if (btnSimB) btnSimB.disabled = playState.active;
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
  playState.active = true;
  playState.mode = mode;
  playState.userColor = opts.userColor || 'w';
  playState.waiting = false;
  playState.startFen = opts.startFen || game.fen();
  playState.preSessionFen = game.fen();
  playState.preSessionPgn = game.pgn();
  playState.assistanceLocked = false;
  playState.prevShowEval = showEval;
  playState.coachWarningShown = false;
  playState.autoPilot = !!opts.autoPilot;
  playState.autoMoveBusy = false;
  playState.lichess.botUsername = opts.botUsername || '';
  playState.lichess.selectedColor = opts.selectedColor || 'random';
  playState.lichess.timeLabel = opts.timeLabel || '';
  playState.lichess.lastMoves = '';

  clearCoachMessages();
  if (mode === 'dccbot') {
    setCoachPanelOpen(true);
    if (playState.autoPilot) {
      queueCoachMessage('system', 'Auto research mode started. 8Z-CDB-DCC will play the chosen side automatically.', `${playState.userColor === 'w' ? '8Z = White' : '8Z = Black'}`);
      setPlayTitle('8Z-CDB-DCC Auto Research');
      board.orientation(playState.userColor === 'b' ? 'black' : 'white');
    } else {
      queueCoachMessage('system', 'Training mode started. You are playing against 8Z-CDB-DCC locally in the browser.', `You are ${playState.userColor === 'w' ? 'White' : 'Black'}`);
      setPlayTitle('8Z-CDB-DCC Training');
      board.orientation(playState.userColor === 'b' ? 'black' : 'white');
    }
  } else if (mode === 'lichess') {
    setCoachPanelOpen(true);
    if (playState.autoPilot) {
      queueCoachMessage('system', '8Z vs Lichess bot mode started. DCC stays on and will drive the selected color automatically.', opts.botUsername || 'Lichess');
      setPlayTitle(`8Z vs ${opts.botUsername || 'Bot'}`);
    } else {
      queueCoachMessage('system', 'Human vs engine mode started. DCC stays on for both sides and the selected engine is routed through Lichess.', opts.botUsername || 'Lichess');
      setPlayTitle(`Human vs ${opts.botUsername || 'Bot'}`);
    }
    game.reset();
    updateBoard(true);
    board.orientation(playState.userColor === 'b' ? 'black' : 'white');
  }
  refreshPlayUi();
}


  function setPlayTitle(text) {
    const el = document.getElementById('gameTitle');
    if (el) el.innerHTML = text;
  }

  function clearLichessStreams() {
    try { playState.lichess.streamAbort && playState.lichess.streamAbort.abort(); } catch (_) {}
    try { playState.lichess.eventAbort && playState.lichess.eventAbort.abort(); } catch (_) {}
    playState.lichess.streamAbort = null;
    playState.lichess.eventAbort = null;
  }

  function leaveActiveSession(message = '') {
    clearLichessStreams();
    setBoardThinking(false);
    const wasLocked = playState.assistanceLocked;
    playState.active = false;
    playState.mode = 'idle';
    playState.waiting = false;
    playState.assistanceLocked = false;
    playState.lichess.gameId = null;
    playState.lichess.challengeId = null;
    playState.lichess.lastMoves = '';
    playState.autoPilot = false;
    playState.autoMoveBusy = false;
    if (typeof playState.prevShowEval === 'boolean') showEval = playState.prevShowEval;
    applySettings();
    refreshPlayUi();
    if (message) queueCoachMessage('system', message);
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

  function syncGameFromMoves(movesStr, initialFen = 'startpos') {
    const moves = (movesStr || '').trim() ? movesStr.trim().split(/\s+/) : [];
    if ((playState.lichess.lastMoves || '').trim() === (movesStr || '').trim()) return;
    if (initialFen && initialFen !== 'startpos') game.load(initialFen);
    else game.reset();
    moves.forEach(uci => applyUciMove(game, uci));
    playState.lichess.lastMoves = movesStr || '';
    updateBoard(true);
  }

  async function readNdjsonStream(response, onEvent, signal) {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const payload = JSON.parse(trimmed);
        const maybe = await onEvent(payload);
        if (maybe) return maybe;
      }
    }
    if (buffer.trim()) {
      return await onEvent(JSON.parse(buffer.trim()));
    }
    return null;
  }

  async function ensureLichessToken() {
    let token = localStorage.getItem(LICHESS_TOKEN_KEY) || '';
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
    if (selectedColor === 'white') return 'w';
    if (selectedColor === 'black') return 'b';
    const bot = (botUsername || '').toLowerCase();
    const whiteName = `${payload?.white?.id || ''} ${payload?.white?.name || ''}`.toLowerCase();
    const blackName = `${payload?.black?.id || ''} ${payload?.black?.name || ''}`.toLowerCase();
    if (bot && whiteName.includes(bot)) return 'b';
    if (bot && blackName.includes(bot)) return 'w';
    return playState.userColor || 'w';
  }

  async function startLichessEventWait(token) {
    const ctrl = new AbortController();
    playState.lichess.eventAbort = ctrl;
    const res = await fetch('https://lichess.org/api/stream/event', {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal
    });
    return readNdjsonStream(res, async evt => {
      if (evt?.type === 'gameStart') {
        return evt.game?.gameId || evt.game?.id || evt.id || evt.gameId || null;
      }
      return null;
    }, ctrl.signal);
  }

  async function challengeLichessBot(botUsername, selectedColor, clock) {
    const token = await ensureLichessToken();
    if (!token) throw new Error('Missing Lichess token.');
    playState.lichess.token = token;
    const body = new URLSearchParams();
    body.set('rated', 'false');
    body.set('clock.limit', String(clock.limit || 180));
    body.set('clock.increment', String(clock.increment || 0));
    body.set('color', selectedColor || 'random');

    const startPromise = startLichessEventWait(token);
    const resp = await fetch(`https://lichess.org/api/challenge/${encodeURIComponent(botUsername)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `Challenge failed (${resp.status})`);
    }
    const data = await resp.json().catch(() => ({}));
    playState.lichess.challengeId = data?.challenge?.id || null;
    const gameId = await Promise.race([
      startPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for Lichess gameStart event.')), 30000))
    ]);
    return gameId;
  }

  
async function startLichessGameStream(gameId) {
  const token = playState.lichess.token;
  const ctrl = new AbortController();
  playState.lichess.streamAbort = ctrl;
  const res = await fetch(`https://lichess.org/api/board/game/stream/${encodeURIComponent(gameId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: ctrl.signal
  });

  await readNdjsonStream(res, async payload => {
    if (!playState.active || playState.mode !== 'lichess') return null;
    if (payload?.type === 'gameFull') {
      playState.userColor = guessUserColorFromGameFull(payload, playState.lichess.botUsername, playState.lichess.selectedColor);
      board.orientation(playState.userColor === 'b' ? 'black' : 'white');
      syncGameFromMoves(payload?.state?.moves || '', payload?.initialFen || 'startpos');
      playState.waiting = game.turn() !== playState.userColor;
      if (playState.autoPilot) {
        updateSimStatus(`8Z live · ${playState.lichess.botUsername}`);
        if (!game.game_over() && game.turn() === playState.userColor) setTimeout(() => { runLichessAutoMove().catch(console.error); }, 180);
      } else {
        updateSimStatus(game.turn() === playState.userColor ? 'Your move.' : `Waiting for ${playState.lichess.botUsername}…`);
      }
      return null;
    }
    if (payload?.type === 'gameState' || payload?.moves !== undefined) {
      syncGameFromMoves(payload.moves || '', 'startpos');
      playState.waiting = game.turn() !== playState.userColor;
      if (payload.status && payload.status !== 'started') {
        leaveActiveSession('Lichess session closed.');
        return null;
      }
      if (playState.autoPilot) {
        if (!game.game_over() && game.turn() === playState.userColor) {
          setTimeout(() => { runLichessAutoMove().catch(console.error); }, 120);
        } else {
          updateSimStatus(`Waiting for ${playState.lichess.botUsername}…`);
        }
      } else {
        updateSimStatus(game.turn() === playState.userColor ? 'Your move.' : `Waiting for ${playState.lichess.botUsername}…`);
      }
      return null;
    }
    return null;
  }, ctrl.signal);
}


  async function sendLichessMove(uci) {
    const token = playState.lichess.token;
    const gameId = playState.lichess.gameId;
    const resp = await fetch(`https://lichess.org/api/board/game/${encodeURIComponent(gameId)}/move/${encodeURIComponent(uci)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(txt || `Move rejected (${resp.status})`);
    }
  }

  async function buildCoachSnapshot(preFen, moveObj, actorLabel) {
    const analysis = await analyzePosition(preFen);
    const uci = normalizeUci(moveObj);
    const sorted = (analysis?.candidates || []).slice().sort((a, b) => b.dcc - a.dcc);
    const played = sorted.find(c => c.move.slice(0, 4) === uci.slice(0, 4)) || null;
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
    if (!playState.active || playState.mode !== 'dccbot') return;
    if (game.game_over()) {
      leaveActiveSession('Game over. Load the PGN or use Replay for a deeper DCC review.');
      return;
    }
    setBoardThinking(true);
    playState.waiting = true;
    updateSimStatus('8Z-CDB-DCC is thinking…');
    const fenBefore = game.fen();
    try {
      const pick = await pickDCCMove(game);
      if (!pick) throw new Error('No DCC move found.');
      const move = game.move({
        from: pick.move.slice(0, 2),
        to: pick.move.slice(2, 4),
        promotion: pick.move.length > 4 ? pick.move[4] : 'q'
      });
      if (!move) throw new Error('DCC move became illegal in the current position.');
      lastAction = 'move';
      window._skipDivergedReset = true;
      updateBoard(false);
      updateSimStatus(`8Z played ${move.san}`);
      await maybeEmitCoach('8Z', fenBefore, move);
      if (game.game_over()) {
        leaveActiveSession('Game over. Training session finished.');
        return;
      }
    } catch (err) {
      queueCoachMessage('system', `8Z move failed: ${err.message || err}`);
      leaveActiveSession('Training session stopped because the local bot hit an error.');
      return;
    } finally {
      setBoardThinking(false);
      playState.waiting = false;
    }
    updateSimStatus('Your move.');
  }


async function runLichessAutoMove() {
  if (!playState.active || playState.mode !== 'lichess' || !playState.autoPilot) return;
  if (playState.autoMoveBusy) return;
  if (game.game_over()) {
    leaveActiveSession('Game over. Lichess bot session finished.');
    return;
  }
  if (game.turn() !== playState.userColor) return;

  playState.autoMoveBusy = true;
  playState.waiting = true;
  setBoardThinking(true);
  updateSimStatus('8Z-DCC is thinking…');
  const fenBefore = game.fen();
  try {
    const pick = await pickDCCMove(game);
    if (!pick || !pick.move) throw new Error('No DCC move found.');
    const san = uciToSan(fenBefore, pick.move);
    await sendLichessMove(pick.move);
    updateSimStatus(`8Z played ${san} · waiting for ${playState.lichess.botUsername || 'bot'}…`);
  } catch (err) {
    console.error('8Z auto move failed:', err);
    leaveActiveSession(`Auto 8Z move failed: ${err.message || err}`);
  } finally {
    setBoardThinking(false);
    playState.autoMoveBusy = false;
  }
}

  async function handleLiveUserMove(moveObj, fenBeforeMove) {
    if (!playState.active) return;
    if (playState.mode === 'dccbot') {
      await maybeEmitCoach('You', fenBeforeMove, moveObj);
      if (game.game_over()) {
        leaveActiveSession('Game over. Training session finished.');
        return;
      }
      await sleep(180);
      await runDccBotTurn();
      return;
    }
    if (playState.mode === 'lichess') {
      playState.waiting = true;
      updateSimStatus('Sending move to Lichess…');
      try {
        await sendLichessMove(normalizeUci(moveObj));
        updateSimStatus(`Waiting for ${playState.lichess.botUsername || 'bot'}…`);
      } catch (err) {
        game.undo();
        playState.waiting = false;
        updateBoard(false);
        throw err;
      }
    }
  }

  async function startDccBotSession(selectedColor) {
    const userColor = selectedColor === 'random'
      ? (Math.random() < 0.5 ? 'w' : 'b')
      : (selectedColor === 'black' ? 'b' : 'w');
    enterActiveSession('dccbot', { userColor, startFen: game.fen(), selectedColor });
    updateSimStatus(`8Z-CDB-DCC live · You are ${userColor === 'w' ? 'White' : 'Black'}`);
    if (game.turn() !== userColor) {
      await sleep(180);
      await runDccBotTurn();
    }
  }

  
async function startLichessSession(botUsername, selectedColor, clock, timeLabel, opts = {}) {
  const guessedColor = selectedColor === 'black' ? 'b' : 'w';
  enterActiveSession('lichess', {
    userColor: guessedColor,
    botUsername,
    selectedColor,
    timeLabel,
    startFen: getStartFen(),
    autoPilot: !!opts.autoPilot
  });
  updateSimStatus(opts.autoPilot
    ? `8Z is challenging ${botUsername} on Lichess…`
    : `Starting human vs ${botUsername}…`);
  try {
    const gameId = await challengeLichessBot(botUsername, selectedColor, clock);
    playState.lichess.gameId = gameId;
    updateSimStatus(`Lichess game ${gameId} started.`);
    await startLichessGameStream(gameId);
  } catch (err) {
    queueCoachMessage('system', `Lichess start failed: ${err.message || err}`);
    leaveActiveSession('Lichess session could not be started.');
  }
}


  
async function launchFromSimModal() {
  const mode = currentSimMode();
  const launchMode = playState.launchMode || 'sim';
  const colorSel = document.getElementById('simColorSelect');
  const selectedColor = colorSel?.value || 'random';
  const timeSel = document.getElementById('simTimeSelect');
  const timeLabel = timeSel?.selectedOptions?.[0]?.textContent || 'Blitz 3+0';
  let clock = { limit: 180, increment: 0 };
  try { clock = JSON.parse(timeSel?.value || '{}'); } catch (_) {}
  closeSimModal();

  if (launchMode === 'sim') {
    if (mode === 'self') {
      runSimulation('both', game.fen());
      return;
    }
    if (mode === 'dccbot') {
      runSimulation('both', game.fen());
      return;
    }
    if (mode === 'lichess') {
      const botUsername = document.getElementById('lichessBotLevel')?.value || (botsConfig.lichess_bots?.[0]?.username || '');
      await startLichessSession(botUsername, selectedColor, clock, timeLabel, { autoPilot: true });
      return;
    }
  }

  const engineColor = launchMode === 'simw' ? 'white' : 'black';
  const humanColor = engineColor === 'white' ? 'black' : 'white';
  if (mode === 'self' || mode === 'dccbot') {
    await startDccBotSession(humanColor);
    return;
  }
  if (mode === 'lichess') {
    const botUsername = document.getElementById('lichessBotLevel')?.value || (botsConfig.lichess_bots?.[0]?.username || '');
    await startLichessSession(botUsername, humanColor, clock, timeLabel, { autoPilot: false, engineColor, humanColor });
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
  async function analyzePosition(fen) {
    const result = await cachedFetchChessDB(fen);
    if (!result.moves || result.moves.length === 0) return null;

    const bestRawScore = result.moves[0].score;
    const candidates = result.moves.filter(m =>
      Math.abs(bestRawScore - m.score) <= settings.dccEvalFloor
    ).slice(0, settings.dccTopCandidates);

    let bestDCCMove = null, bestDCCScore = -Infinity;
    const analyzed = [];

    for (const mv of candidates) {
      const probe = new Chess(fen);
      const m = probe.move({
        from: mv.move.slice(0, 2), to: mv.move.slice(2, 4),
        promotion: mv.move.length > 4 ? mv.move[4] : 'q'
      });
      if (!m) continue;

      const pvResult = await fetchPV(probe.fen());
      if (pvResult.score === null) continue;

      const evalSeq = [pvResult.score];
      if (pvResult.pv.length > 1) {
        const walk = new Chess(probe.fen());
        const maxWalk = Math.min(settings.dccDepth || 4, pvResult.pv.length);
        for (let j = 0; j < maxWalk; j++) {
          const uci = pvResult.pv[j];
          const wm = walk.move({ from: uci.slice(0, 2), to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined });
          if (!wm) break;
          if (j % 2 === 1) {
            const sc = await fetchScore(walk.fen());
            if (sc !== null) evalSeq.push((j % 2 === 0) ? -sc : sc);
          }
        }
      }

      const stability = evalSeqStability(evalSeq);
      const adsr = adsrAnalysis(evalSeq);
      const momentum = evalMomentum(evalSeq);
      const tunnel = detectTunnel(evalSeq);
      const trend = trendArrow(evalTrend(evalSeq));

      let dccScore = mv.score;
      dccScore += stability * DCC_WEIGHTS.stability;
      if (adsr.shape === 'sustained') dccScore += DCC_WEIGHTS.adsr_sustained;
      else if (adsr.shape === 'building') dccScore += DCC_WEIGHTS.adsr_building;
      else if (adsr.shape === 'spike') dccScore += DCC_WEIGHTS.adsr_spike;
      else if (adsr.shape === 'collapse') dccScore += DCC_WEIGHTS.adsr_collapse;
      else if (adsr.shape === 'volatile') dccScore += DCC_WEIGHTS.adsr_volatile;
      dccScore += Math.sign(momentum) * Math.min(Math.abs(momentum), DCC_WEIGHTS.momentum_max);
      if (materialCount(probe.fen()) <= 7) {
        const pr = await cachedFetchChessDB(probe.fen());
        dccScore += pr.moves.length > 0 ? DCC_WEIGHTS.endgame_known : DCC_WEIGHTS.endgame_unknown;
      }
      if (tunnel) dccScore += DCC_WEIGHTS.tunnel;
      const cx = fenComplexity(probe.fen());
      dccScore -= cx * DCC_WEIGHTS.complexity;

      const entry = { move: mv.move, raw: mv.score, dcc: Math.round(dccScore),
        stability, adsr: adsr.shape, trend, momentum, tunnel };
      analyzed.push(entry);

      if (dccScore > bestDCCScore) { bestDCCScore = dccScore; bestDCCMove = mv.move; }
    }

    return { candidates: analyzed, dcc1Move: bestDCCMove, allMoves: result.moves };
  }

  // Main replay function
  async function replayGame() {
    if (replayRunning) { replayAbort = true; return; }
    if (fullHistory.length === 0) { alert('Load a PGN game first.'); return; }

    replayRunning = true;
    replayAbort = false;

    const btnReplay = document.getElementById('btnReplay');
    btnReplay.textContent = 'Stop';
    btnReplay.style.background = '#ff4c4c'; btnReplay.style.color = '#fff';

    const statusBar = document.getElementById('simStatusBar');
    statusBar.style.display = 'block';

    const moves = fullHistory.slice();
    const headers = game.header();
    const annotations = [];

    // Rewind to start
    while (game.history().length > 0) game.undo();
    board.position(game.fen());
    // Clear stale badges from pre-replay position
    document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());

    for (let i = 0; i < moves.length; i++) {
      if (replayAbort) break;

      const fen = game.fen();
      const side = game.turn();
      const mv = moves[i];
      const moveUci = mv.from + mv.to + (mv.promotion || '');

      // Clear badges from previous position
      document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());

      updateSimStatus(`Analyzing ${i + 1}/${moves.length}: ${mv.san}…`);

      const analysis = await analyzePosition(fen);
      let ann = { ply: i + 1, side, san: mv.san, uci: moveUci,
        raw: null, dcc: null, stability: null, adsr: null,
        trend: '', momentum: 0, tunnel: false, isDCC1: null };

      if (analysis) {
        // Show badges for this position's candidates
        if (settings.simSpeed > 0) {
          analysis.allMoves.slice(0, settings.topN || 5).forEach((m, idx) =>
            annotateMove(m.move, m.score, idx === 0));
          // Overlay DCC data on analyzed candidates
          for (const c of analysis.candidates) {
            updateDCCBadge(c.move, {
              trend: evalTrend([c.raw, c.dcc || c.raw]),
              stability: c.stability, arrow: c.trend,
              adsr: { shape: c.adsr, label: (ADSR_SHAPES[c.adsr] || {}).desc || '' },
              tunnel: c.tunnel, momentum: c.momentum,
              evalSequence: [], movePath: [], score: c.raw, pvDepth: 0
            }, 'done');
          }
        }

        // Find the played move in analyzed candidates
        const played = analysis.candidates.find(c =>
          c.move.slice(0, 4) === moveUci.slice(0, 4));
        if (played) {
          ann.raw = played.raw;
          ann.dcc = played.dcc;
          ann.stability = played.stability;
          ann.adsr = played.adsr;
          ann.trend = played.trend;
          ann.momentum = played.momentum;
          ann.tunnel = played.tunnel;
        } else {
          // Played move wasn't in DCC candidates — get raw score
          const rawMatch = analysis.allMoves.find(m =>
            m.move.slice(0, 4) === moveUci.slice(0, 4));
          if (rawMatch) ann.raw = rawMatch.score;
        }
        ann.isDCC1 = analysis.dcc1Move
          ? analysis.dcc1Move.slice(0, 4) === moveUci.slice(0, 4) : null;
      }

      annotations.push(ann);

      // v0.6.1: Live stats update — show running accuracy as it builds
      {
        const wA = annotations.filter(a => a.side === 'w' && a.isDCC1 !== null);
        const bA = annotations.filter(a => a.side === 'b' && a.isDCC1 !== null);
        const wM = wA.filter(a => a.isDCC1).length;
        const bM = bA.filter(a => a.isDCC1).length;
        const wP = wA.length > 0 ? Math.round(100 * wM / wA.length) : 0;
        const bP = bA.length > 0 ? Math.round(100 * bM / bA.length) : 0;
        const pct = Math.round(100 * (i + 1) / moves.length);
        const panel = document.getElementById('simStatsPanel');
        panel.innerHTML = `
          <div style="padding:10px; font-size:13px; color:#ddd; line-height:1.7;">
            <div style="color:#00e5ff; font-weight:700; margin-bottom:6px;">
              DCC Replay — ${i + 1}/${moves.length} (${pct}%)
            </div>
            <div style="display:flex; gap:24px;">
              <div>
                <span style="color:#34d399; font-weight:600;">White</span>
                DCC#1: <strong>${wP}%</strong>
                <span style="color:#666">(${wM}/${wA.length})</span>
              </div>
              <div>
                <span style="color:#a78bfa; font-weight:600;">Black</span>
                DCC#1: <strong>${bP}%</strong>
                <span style="color:#666">(${bM}/${bA.length})</span>
              </div>
            </div>
            <div style="margin-top:6px; height:4px; background:#333; border-radius:2px;">
              <div style="height:100%; width:${pct}%; background:#00e5ff; border-radius:2px; transition:width 0.2s;"></div>
            </div>
          </div>`;
        panel.style.display = 'block';
      }

      // Play the move forward
      game.move(mv.san);
      board.position(game.fen());
      // Update history panel to follow current move
      renderHistory();

      if (settings.simSpeed > 0) {
        await sleep(Math.max(80, settings.simSpeed));
      }
    }

    // Final: clear replay badges, restore clean board
    document.querySelectorAll('.overlay,.next-dot').forEach(el => el.remove());
    // Restore board
    board.position(game.fen());

    // Build summary
    const wAnns = annotations.filter(a => a.side === 'w' && a.isDCC1 !== null);
    const bAnns = annotations.filter(a => a.side === 'b' && a.isDCC1 !== null);
    const wMatch = wAnns.filter(a => a.isDCC1).length;
    const bMatch = bAnns.filter(a => a.isDCC1).length;
    const wPct = wAnns.length > 0 ? Math.round(100 * wMatch / wAnns.length) : 0;
    const bPct = bAnns.length > 0 ? Math.round(100 * bMatch / bAnns.length) : 0;

    const countShapes = anns => {
      const c = { sustained: 0, building: 0, spike: 0, collapse: 0, volatile: 0, mixed: 0 };
      anns.forEach(a => { if (a.adsr && c[a.adsr] !== undefined) c[a.adsr]++; });
      return c;
    };
    const avgStab = anns => {
      const valid = anns.filter(a => a.stability !== null);
      return valid.length > 0 ? (valid.reduce((s, a) => s + a.stability, 0) / valid.length) : 0;
    };
    const tunnelCount = anns => anns.filter(a => a.tunnel).length;

    const wShapes = countShapes(wAnns);
    const bShapes = countShapes(bAnns);
    const wName = headers.White || 'White';
    const bName = headers.Black || 'Black';
    const shapeStr = s => Object.entries(s).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');

    // Generate annotated PGN
    const annotatedPGN = generateAnnotatedPGN(headers, moves, annotations, wPct, bPct);

    // Render summary
    const panel = document.getElementById('simStatsPanel');
    panel.innerHTML = `
      <div class="sim-stats-header">
        <span class="sim-title">DCC Replay Complete — ${annotations.length} moves analyzed</span>
      </div>
      <div style="padding:8px; font-size:12px; line-height:1.6; color:#ddd;">
        <div style="margin-bottom:8px;">
          <strong style="color:#34d399">${wName} (White)</strong><br>
          DCC accuracy: <strong>${wPct}%</strong> (${wMatch}/${wAnns.length} matched DCC #1)<br>
          Avg stability: ${avgStab(wAnns).toFixed(2)} · Tunnels: ${tunnelCount(wAnns)}<br>
          <span style="color:#888">${shapeStr(wShapes)}</span>
        </div>
        <div style="margin-bottom:8px;">
          <strong style="color:#a78bfa">${bName} (Black)</strong><br>
          DCC accuracy: <strong>${bPct}%</strong> (${bMatch}/${bAnns.length} matched DCC #1)<br>
          Avg stability: ${avgStab(bAnns).toFixed(2)} · Tunnels: ${tunnelCount(bAnns)}<br>
          <span style="color:#888">${shapeStr(bShapes)}</span>
        </div>
        <div style="color:#f59e0b; font-style:italic;">
          ${bPct > wPct ? 'DCC says: Black played more aligned with DCC preferences.'
           : wPct > bPct ? 'DCC says: White played more aligned with DCC preferences.'
           : 'DCC says: Both sides equally aligned with DCC preferences.'}
        </div>
      </div>
      <div style="text-align:center; margin-top:6px;">
        <button id="btnSaveAnnotatedPGN" style="background:#00e5ff; color:#000; border:none; padding:8px 20px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600;">Save Annotated PGN</button>
      </div>`;
    panel.style.display = 'block';

    // Wire save button
    document.getElementById('btnSaveAnnotatedPGN').onclick = () => {
      const blob = new Blob([annotatedPGN], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chessdcc_replay.pgn';
      a.click(); URL.revokeObjectURL(a.href);
    };

    // Cleanup
    replayRunning = false;
    replayAbort = false;
    btnReplay.textContent = 'Replay';
    btnReplay.style.background = '#203030'; btnReplay.style.color = '#00e5ff';
    statusBar.style.display = 'none';
  }

  // Generate annotated PGN with DCC headers + per-move comments
  function generateAnnotatedPGN(headers, moves, annotations, wPct, bPct) {
    let pgn = '';
    for (const [k, v] of Object.entries(headers)) {
      pgn += `[${k} "${v}"]\n`;
    }
    pgn += `[DCC_Version "0.6.1"]\n`;
    pgn += `[DCC_Depth "${settings.dccDepth}"]\n`;
    pgn += `[DCC_TopCandidates "${settings.dccTopCandidates}"]\n`;
    pgn += `[DCC_WhiteAccuracy "${wPct}%"]\n`;
    pgn += `[DCC_BlackAccuracy "${bPct}%"]\n`;
    pgn += '\n';

    for (let i = 0; i < moves.length; i++) {
      if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
      pgn += moves[i].san + ' ';

      const ann = annotations[i];
      if (ann && ann.raw !== null) {
        const parts = [];
        parts.push(`raw=${ann.raw > 0 ? '+' : ''}${ann.raw}`);
        if (ann.dcc !== null) parts.push(`dcc=${ann.dcc > 0 ? '+' : ''}${ann.dcc}`);
        if (ann.stability !== null) parts.push(`stab=${ann.stability.toFixed(2)}`);
        if (ann.adsr) parts.push(`ADSR=${ann.adsr}`);
        if (ann.trend) parts.push(ann.trend);
        if (ann.momentum !== undefined && ann.momentum !== 0)
          parts.push(`mom=${ann.momentum > 0 ? '+' : ''}${Math.round(ann.momentum)}`);
        if (ann.isDCC1 !== null)
          parts.push(`DCC#1=${ann.isDCC1 ? 'yes' : 'NO'}`);
        if (ann.tunnel) parts.push('⛏');
        pgn += `{DCC: ${parts.join(' ')}} `;
      }
      if (i % 2 === 1) pgn += '\n';
    }

    pgn += (headers.Result || '*') + '\n';
    return pgn;
  }

  // Replay button handler — show settings modal first
  const btnReplay = document.getElementById('btnReplay');
  const replayModal = document.getElementById('replayModal');

  if (btnReplay && replayModal) {
    btnReplay.onclick = () => {
      // If replay running, act as Stop button
      if (replayRunning) { replayAbort = true; return; }
      // Show modal
      replayModal.style.display = 'flex';
    };

    document.getElementById('replayCancel').onclick = () => {
      replayModal.style.display = 'none';
    };

    // Click outside modal content to cancel
    replayModal.onclick = (e) => {
      if (e.target === replayModal) replayModal.style.display = 'none';
    };

    document.getElementById('replayStart').onclick = async () => {
      replayModal.style.display = 'none';

      // Read replay-specific settings from modal
      const rDepth = parseInt(document.getElementById('replayDepth').value, 10);
      const rTopC = parseInt(document.getElementById('replayTopC').value, 10);
      const rFloor = parseInt(document.getElementById('replayFloor').value, 10);
      const rSpeed = parseInt(document.getElementById('replaySpeed').value, 10);

      // Save current global settings
      const saved = {
        dccDepth: settings.dccDepth,
        dccTopCandidates: settings.dccTopCandidates,
        dccEvalFloor: settings.dccEvalFloor,
        simSpeed: settings.simSpeed
      };

      // Temporarily override for replay
      settings.dccDepth = rDepth;
      settings.dccTopCandidates = rTopC;
      settings.dccEvalFloor = rFloor;
      settings.simSpeed = rSpeed;

      try {
        await replayGame();
      } finally {
        // Restore global settings — always, even on abort
        settings.dccDepth = saved.dccDepth;
        settings.dccTopCandidates = saved.dccTopCandidates;
        settings.dccEvalFloor = saved.dccEvalFloor;
        settings.simSpeed = saved.simSpeed;
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────

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
    if (playState.active) return;
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
      game.load_pgn(lastLoadedPGN);
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
  if (playState.active && playState.mode === 'lichess') return;
  const bestOv = document.querySelector('.overlay.best');
  if (!bestOv) return;
  const mv   = bestOv.dataset.move;
  const from = mv.slice(0,2), to = mv.slice(2,4);
  const m    = game.move({ from, to, promotion: 'q' });
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
    '#board, #controls, #gameTitle, #pageSubtitle, a, button, input, select, label'
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
