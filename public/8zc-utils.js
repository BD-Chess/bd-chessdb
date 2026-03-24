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
    ioFormat: 'fen',   // NEW  (fen | pgn)  for Format / Input / Copy row
    /* DCC Lookahead settings */
    dccEnabled: true,
    dccDepth: 5,         // half-moves of lookahead (1-10)
    dccTopMoves: 3,      // how many top moves get lookahead
    dccTieThreshold: 10, // centipawns — below this = "tied"
    dccOnly: false,      // hide raw ChessDB scores, show only DCC view
    simSpeed: 1000,      // ms per move (0 = max speed, no board update)
    simGames: 5          // games per simulation run
  };

  // DCC view toggle state
  let dccViewActive = false;
  // Store latest DCC results for the analysis panel
  let latestDCCResults = [];


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
    if (evalSeq.length < 2) return 1.0;
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
    const endIdx = Math.max(startIdx + 1, Math.floor(deltas.length * 0.8));
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
    if (absAttack < 10 && absDecay < 10) {
      shape = 'sustained'; label = '▬';  // flat line, solid
    } else if (absAttack > 20 && normalized > 0.5) {
      shape = 'spike'; label = '⚡';      // sharp gain then collapse
    } else if (sustain < -10) {
      shape = 'collapse'; label = '▼';    // falls below starting level
    } else if (attack > 10 && absDecay < 10 && release > -5) {
      shape = 'building'; label = '▲';    // steadily growing
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

  // ── DCC Governance: should we look deeper? ──────────────────────
  function shouldGoDeeper(evalSeq) {
    if (evalSeq.length < 2) return true;
    const last = evalSeq[evalSeq.length - 1];
    const prev = evalSeq[evalSeq.length - 2];
    const trend = last - prev;
    // Falling eval → danger, look deeper
    if (trend < -15) return true;
    // Rising and stable → no surprises, stop
    if (trend > 5 && evalSeqStability(evalSeq) > 0.5) return false;
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

    return { evalSequence, movePath, pvDepth: pvResult.depth };
  }

  // ── DCC Lookahead orchestrator for top N moves ──────────────────
  let activeLookaheadId = 0; // cancel stale lookaheads on board change

  async function runDCCLookahead(moveList, baseFen) {
    const thisId = ++activeLookaheadId;
    const topN = Math.min(settings.dccTopMoves, moveList.length);
    const maxHalfMoves = settings.dccDepth * 2;
    latestDCCResults = []; // reset for this position

    for (let i = 0; i < topN; i++) {
      if (thisId !== activeLookaheadId) return; // board changed, abort

      const mv = moveList[i];
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
      if (thisId !== activeLookaheadId) return;

      if (evalSequence.length > 0) {
        const trend = evalTrend(evalSequence);
        const stability = evalSeqStability(evalSequence);
        const arrow = trendArrow(trend);
        const adsr = adsrAnalysis(evalSequence);
        const data = {
          move: mv.move, trend, stability, arrow, evalSequence, movePath,
          score: mv.score, pvDepth: pvDepth || 0, adsr,
          isMdlPick: !!document.querySelector(`.square-${mv.move.slice(-2)} .overlay.dcc-mdl-pick`)
        };
        updateDCCBadge(mv.move, data, 'done');
        latestDCCResults.push(data);
      } else {
        updateDCCBadge(mv.move, null, 'none');
      }
      // Update DCC view panel and DCC-only badges after each result
      renderDCCView();
      if (settings.dccOnly) applyDCCOnlyBadges();
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

    panel.innerHTML = `
      <div class="dcc-info-path"><span class="dcc-path-eval">${rootScore}</span><span class="dcc-path-arrow">→</span>${moveStr}</div>
      <div class="dcc-info-summary">
        Trend: <span class="dcc-trend-${trend}">${trendLabel}</span>
        &nbsp;|&nbsp; Stability: ${stabilityPct}%${depthStr}${adsrStr}
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
    html += '<tr class="dcc-analysis-header"><th>#</th><th>Move</th><th>Eval</th><th></th><th>Stab</th><th>ADSR</th><th></th></tr>';
    sorted.forEach((r, i) => {
      const rank = i + 1;
      const score = r.score !== undefined ? (r.score > 0 ? '+' + r.score : r.score) : '?';
      const arrow = r.arrow || '';
      const trendClass = r.trend ? 'dcc-trend-' + r.trend : '';
      const stabPct = r.stability !== undefined ? Math.round(r.stability * 100) + '%' : '—';
      const stabClass = r.stability > 0.6 ? 'dcc-stab-high' : r.stability < 0.35 ? 'dcc-stab-low' : 'dcc-stab-mid';
      const mdl = r.isMdlPick ? '<span class="star">★</span>' : '';
      const adsr = r.adsr || {};
      const adsrLabel = adsr.label || '';
      const adsrInfo = ADSR_SHAPES[adsr.shape] || ADSR_SHAPES.unknown;
      const pvStr = (r.movePath || []).join(' → ');
      html += `<tr class="dcc-analysis-row" data-move="${r.move}" title="${adsrInfo.desc} · PV: ${pvStr}">`;
      html += `<td class="dcc-rank">${rank}</td>`;
      html += `<td class="dcc-move-name">${r.move}</td>`;
      html += `<td class="dcc-eval-cell">${score}</td>`;
      html += `<td class="${trendClass}">${arrow}</td>`;
      html += `<td class="${stabClass}">${stabPct}</td>`;
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

    // ─── NEW: sync “Double Size” setting & apply it ────────────────
    document.getElementById('settingDoubleBoard').checked = settings.doubleBoard;
    // reuse the boardEl you declared above; no const here
    if (settings.doubleBoard) boardEl.classList.add('scaled');
    else boardEl.classList.remove('scaled');

    // ─── DCC Lookahead settings sync ─────────────────────────────────
    const dccEl = document.getElementById('settingDccEnabled');
    if (dccEl) dccEl.checked = settings.dccEnabled;
    const dccDepthEl = document.getElementById('settingDccDepth');
    if (dccDepthEl) dccDepthEl.value = settings.dccDepth;
    const dccTopEl = document.getElementById('settingDccTopMoves');
    if (dccTopEl) dccTopEl.value = settings.dccTopMoves;
    const dccOnlyEl = document.getElementById('settingDccOnly');
    if (dccOnlyEl) dccOnlyEl.checked = settings.dccOnly;
    const simSpeedEl = document.getElementById('settingSimSpeed');
    if (simSpeedEl) simSpeedEl.value = settings.simSpeed;
    const simGamesEl = document.getElementById('settingSimGames');
    if (simGamesEl) simGamesEl.value = settings.simGames;
    const dccInfoPanel = document.getElementById('dccInfoPanel');
    if (dccInfoPanel && !settings.dccEnabled) dccInfoPanel.style.display = 'none';
    const dccAccPanel = document.getElementById('dccAccuracyPanel');
    if (dccAccPanel && !settings.dccEnabled) dccAccPanel.style.display = 'none';
    // ─────────────────────────────────────────────────────────────────
	
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
	showOpening();
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
    document.getElementById('openingName').textContent = '';
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
	  'settingDccTopMoves',
	  'settingDccOnly',
	  'settingSimSpeed',
	  'settingSimGames'
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
		  case 'settingDccTopMoves':
			settings.dccTopMoves = parseInt(e.target.value, 10) || 3;
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

  // ═══════════════════════════════════════════════════════════════════
  // SIMULATION ENGINE — DCC vs Raw ChessDB
  // ═══════════════════════════════════════════════════════════════════

  let simRunning = false;
  let simAbort = false;

  // Pick move using DCC: fetch top moves, run PV+ADSR, pick by stability+trend
  async function pickDCCMove(simGame) {
    const fen = simGame.fen();
    const result = await cachedFetchChessDB(fen);
    if (!result.moves || result.moves.length === 0) return null;

    const topN = Math.min(3, result.moves.length);
    let bestMove = result.moves[0]; // fallback: raw best
    let bestScore = -Infinity;

    for (let i = 0; i < topN; i++) {
      const mv = result.moves[i];
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
      // Combined DCC score: raw eval + stability bonus + ADSR shape bonus
      let dccScore = mv.score;
      dccScore += stability * 20;  // up to +20 for perfect stability
      if (adsr.shape === 'sustained') dccScore += 10;
      else if (adsr.shape === 'building') dccScore += 15;
      else if (adsr.shape === 'spike') dccScore -= 5;
      else if (adsr.shape === 'collapse') dccScore -= 20;
      else if (adsr.shape === 'volatile') dccScore -= 10;

      // LZ tiebreaker on resulting position
      const cx = fenComplexity(probe.fen());
      dccScore -= cx * 10; // prefer simpler (more compressible) positions

      if (dccScore > bestScore) {
        bestScore = dccScore;
        bestMove = mv;
      }
    }
    return bestMove;
  }

  // Pick move using raw ChessDB: highest score, no lookahead
  async function pickRawMove(simGame) {
    const result = await cachedFetchChessDB(simGame.fen());
    if (!result.moves || result.moves.length === 0) return null;
    return result.moves[0]; // highest score
  }

  // Update sim status bar
  function updateSimStatus(msg) {
    const bar = document.getElementById('simStatusBar');
    if (bar) { bar.textContent = msg; bar.style.display = 'block'; }
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
    const rawPct = total > 0 ? Math.round(100 * rawWins / total) : 0;

    let html = `
      <div class="sim-stats-header">
        <span class="sim-title">DCC vs Raw ChessDB — ${total} game${total !== 1 ? 's' : ''}</span>
        <span class="sim-subtitle">DCC plays ${stats.dccColor === 'w' ? 'White' : 'Black'}</span>
      </div>
      <div class="sim-stats-grid">
        <div class="sim-stat"><div class="sim-num" style="color:#34d399">${dccWins}</div><div class="sim-label">DCC wins</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#ff4c4c">${rawWins}</div><div class="sim-label">Raw wins</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#888">${draws}</div><div class="sim-label">Draws</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#00e5ff">${dccPct}%</div><div class="sim-label">DCC rate</div></div>
        <div class="sim-stat"><div class="sim-num" style="color:#f59e0b">${avgLen}</div><div class="sim-label">Avg moves</div></div>
      </div>
      <div class="sim-games-list">`;

    stats.games.forEach((g, i) => {
      const icon = g.winner === 'dcc' ? '✓' : g.winner === 'raw' ? '✗' : '=';
      const color = g.winner === 'dcc' ? '#34d399' : g.winner === 'raw' ? '#ff4c4c' : '#888';
      html += `<div class="sim-game-row" style="color:${color}">
        <span>${icon} Game ${i + 1}</span>
        <span>${g.moves} moves</span>
        <span>${g.result}</span>
      </div>`;
    });

    html += '</div>';
    panel.innerHTML = html;
    panel.style.display = 'block';
  }

  // Run one simulated game
  async function runOneGame(dccColor, gameNum, totalGames, visualize) {
    const simGame = new Chess();
    let moveCount = 0;
    const maxMoves = 200;

    // Random opening: first 6 half-moves both sides pick randomly from top-3
    for (let i = 0; i < 6 && !simGame.game_over(); i++) {
      if (simAbort) return { winner: 'abort', moves: 0, result: 'aborted' };
      const result = await cachedFetchChessDB(simGame.fen());
      if (!result.moves || result.moves.length === 0) break;
      const pool = result.moves.slice(0, Math.min(3, result.moves.length));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const m = simGame.move({
        from: pick.move.slice(0, 2), to: pick.move.slice(2, 4),
        promotion: pick.move.length > 4 ? pick.move[4] : 'q'
      });
      if (!m) break;
      moveCount++;
      if (visualize && settings.simSpeed > 0) {
        board.position(simGame.fen());
        await sleep(Math.max(100, settings.simSpeed / 3)); // faster for opening
      }
    }

    // Main game: DCC vs Raw
    while (!simGame.game_over() && moveCount < maxMoves) {
      if (simAbort) return { winner: 'abort', moves: moveCount, result: 'aborted' };

      const turn = simGame.turn(); // 'w' or 'b'
      const isDCCTurn = (turn === dccColor);
      const pick = isDCCTurn ? await pickDCCMove(simGame) : await pickRawMove(simGame);

      if (!pick) break; // no moves in DB — position unknown

      const m = simGame.move({
        from: pick.move.slice(0, 2), to: pick.move.slice(2, 4),
        promotion: pick.move.length > 4 ? pick.move[4] : 'q'
      });
      if (!m) break;
      moveCount++;

      updateSimStatus(`Game ${gameNum}/${totalGames} · Move ${moveCount} · ${isDCCTurn ? 'DCC' : 'Raw'}: ${pick.move} (${pick.score > 0 ? '+' : ''}${pick.score})`);

      if (visualize && settings.simSpeed > 0) {
        board.position(simGame.fen());
        await sleep(settings.simSpeed);
      }
    }

    // Determine winner
    let winner = 'draw', result = 'draw';
    if (simGame.in_checkmate()) {
      // The side that just moved delivered checkmate
      const loser = simGame.turn(); // side that's in checkmate
      winner = (loser === dccColor) ? 'raw' : 'dcc';
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

    return { winner, moves: moveCount, result };
  }

  // Main simulation orchestrator
  async function runSimulation(dccColor) {
    if (simRunning) { simAbort = true; return; }
    simRunning = true;
    simAbort = false;

    const numGames = settings.simGames;
    const visualize = settings.simSpeed > 0;
    const statsPanel = document.getElementById('simStatsPanel');
    const statusBar = document.getElementById('simStatusBar');
    const btnW = document.getElementById('btnSimW');
    const btnB = document.getElementById('btnSimB');

    // Update button states
    const activeBtn = dccColor === 'w' ? btnW : btnB;
    activeBtn.textContent = 'Stop';
    activeBtn.style.background = '#ff4c4c';
    activeBtn.style.color = '#fff';

    if (!visualize) {
      // Max speed: hide board, show stats panel
      document.getElementById('board-container').style.opacity = '0.2';
      document.getElementById('moves').style.display = 'none';
    }

    statusBar.style.display = 'block';

    const stats = { dccColor, games: [] };

    for (let i = 0; i < numGames; i++) {
      if (simAbort) break;
      updateSimStatus(`Starting game ${i + 1}/${numGames}…`);
      const result = await runOneGame(dccColor, i + 1, numGames, visualize);
      if (result.winner === 'abort') break;
      stats.games.push(result);
      renderSimStats(stats);
    }

    // Restore UI
    simRunning = false;
    simAbort = false;
    btnW.textContent = 'SimW'; btnW.style.background = '#2a3020'; btnW.style.color = '#34d399';
    btnB.textContent = 'SimB'; btnB.style.background = '#2a2030'; btnB.style.color = '#a78bfa';
    statusBar.style.display = 'none';
    document.getElementById('board-container').style.opacity = '1';
    document.getElementById('moves').style.display = '';

    // Show final stats
    renderSimStats(stats);
    updateSimStatus(`Done: ${stats.games.length} games`);
    setTimeout(() => { statusBar.style.display = 'none'; }, 3000);
  }

  // ─── Sim button handlers ───────────────────────────────────────────
  const btnSimW = document.getElementById('btnSimW');
  if (btnSimW) btnSimW.onclick = () => runSimulation('w');
  const btnSimB = document.getElementById('btnSimB');
  if (btnSimB) btnSimB.onclick = () => runSimulation('b');
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
        btnToggle.textContent = 'DCC View';
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
	  // 1) toggle the CSS scale
	  boardEl.classList.toggle("scaled");

	  // 2) mirror it in settings & UI
	  settings.doubleBoard = boardEl.classList.contains("scaled");
	  document.getElementById('settingDoubleBoard').checked = settings.doubleBoard;

	  // 3) persist the change
	  saveSettings();
	});

  })();
  // ────────────────────────────────────────────────────────────────────────

}

/* ------------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------------*/
window.addEventListener('load', initAll);
