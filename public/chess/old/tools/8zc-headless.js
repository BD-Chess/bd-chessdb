#!/usr/bin/env bun
/*
 * 8ZC Headless — Bun CLI for offline DCC analysis
 * chessbest.org/8zc · AIm³ Lab
 *
 * Modes:
 *   fetch     — download chessdb data for a PGN game → cache
 *   analyze   — offline DCC analysis from cache → annotated PGN + JSON + CSV
 *   batch     — fetch + analyze for folder of PGNs
 *   tournament — DCC vs Raw ChessDB self-play
 *
 * Build 2026-03-25 · AIF8 🌱
 */
"use strict";

import { Chess } from 'chess.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// 1. CLI PARSING
// ═══════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const mode = args[0];

function parseArgs(args) {
  const opts = {
    depth: 10,
    top: 5,
    floor: 80,
    cache: './8zc_cache',
    out: null,
    // Tournament-specific
    games: 100,
    opponent: 'perfect',
    openings: null,
    bookMoves: 8,
    dccDepth: 10,
    dccTop: 5,
    dccFloor: 80,
  };
  const positional = [];

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--depth':     opts.depth = parseInt(args[++i]) || 10; break;
      case '--top':       opts.top = parseInt(args[++i]) || 5; break;
      case '--floor':     opts.floor = parseInt(args[++i]) || 80; break;
      case '--cache':     opts.cache = args[++i]; break;
      case '--out':       opts.out = args[++i]; break;
      case '--games':     opts.games = parseInt(args[++i]) || 100; break;
      case '--opponent':  opts.opponent = args[++i] || 'perfect'; break;
      case '--openings':  opts.openings = args[++i]; break;
      case '--book-moves': opts.bookMoves = parseInt(args[++i]) || 8; break;
      case '--dcc-depth': opts.dccDepth = parseInt(args[++i]) || 10; break;
      case '--dcc-top':   opts.dccTop = parseInt(args[++i]) || 5; break;
      case '--dcc-floor': opts.dccFloor = parseInt(args[++i]) || 80; break;
      default:            positional.push(args[i]);
    }
  }
  // Sync DCC params with top-level
  opts.dccDepth = opts.dccDepth || opts.depth;
  opts.dccTop = opts.dccTop || opts.top;
  opts.dccFloor = opts.dccFloor || opts.floor;
  return { opts, positional };
}

const { opts, positional } = parseArgs(args);

function usage() {
  console.log(`
8ZC Headless — DCC Eval Layer CLI · chessbest.org/8zc

Usage:
  bun run 8zc-headless.js fetch <pgn>    [options]    Fetch chessdb data → cache
  bun run 8zc-headless.js analyze <pgn>  [options]    Offline DCC analysis → PGN/JSON/CSV
  bun run 8zc-headless.js batch <dir>    [options]    Fetch + analyze folder of PGNs
  bun run 8zc-headless.js tournament     [options]    DCC vs Raw self-play

Options:
  --depth N         Lookahead depth in half-moves (default: 10, fetch always uses 20)
  --top N           Top candidates to analyze (default: 5)
  --floor N         Eval floor in centipawns (default: 80)
  --cache dir       Cache directory (default: ./8zc_cache)
  --out file|dir    Output path (default: {input}_dcc.pgn)

Tournament options:
  --games N         Number of games (default: 100)
  --opponent model  'perfect' | 'realistic' | 'weak' (default: perfect)
  --openings file   PGN with opening positions (optional)
  --book-moves N    Random book moves before DCC takeover (default: 8)
  --dcc-depth N     DCC analysis depth (default: --depth)
  --dcc-top N       DCC candidates (default: --top)
  --dcc-floor N     DCC eval floor (default: --floor)

AIF8 · 2026 🌱
`);
  process.exit(0);
}

if (!mode || mode === '--help' || mode === '-h') usage();


// ═══════════════════════════════════════════════════════════════════
// 2. DCC CORE FUNCTIONS — copied from 8zc-utils.js v0.6.1
// ═══════════════════════════════════════════════════════════════════

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

function evalSeqStability(evalSeq) {
  if (evalSeq.length < 3) return 0.5;
  const deltas = evalSeq.slice(1).map((v, i) => {
    const d = v - evalSeq[i];
    if (d > 15) return 'A';
    if (d > 5)  return 'B';
    if (d > -5) return 'C';
    if (d > -15) return 'D';
    return 'E';
  }).join('');
  const raw = lz76(deltas) / Math.max(deltas.length, 1);
  return Math.max(0, Math.min(1, 1 - raw));
}

function evalTrend(evalSeq) {
  if (evalSeq.length < 2) return 'stable';
  const diff = evalSeq[evalSeq.length - 1] - evalSeq[0];
  if (diff > 15) return 'rising';
  if (diff < -15) return 'falling';
  return 'stable';
}

function trendArrow(trend) {
  return { rising: '↑', falling: '↓', stable: '→' }[trend] || '→';
}

function adsrAnalysis(evalSeq) {
  if (evalSeq.length < 2) {
    return { attack: 0, decay: 0, sustain: 0, release: 0, shape: 'unknown', label: '?' };
  }
  const baseline = evalSeq[0];
  const deltas = evalSeq.map(v => v - baseline);
  const peak = Math.max(...deltas);
  const peakIdx = deltas.indexOf(peak);
  const attack = peak;
  const afterPeak = deltas.slice(peakIdx);
  const valley = Math.min(...afterPeak);
  const decay = peak - valley;
  const startIdx = Math.max(1, Math.floor(deltas.length * 0.2));
  const endIdx = Math.max(startIdx + 2, Math.floor(deltas.length * 0.8));
  const midSlice = deltas.slice(startIdx, endIdx);
  const sustain = midSlice.length > 0
    ? midSlice.reduce((a, b) => a + b, 0) / midSlice.length : 0;
  const release = deltas[deltas.length - 1] - sustain;
  const absAttack = Math.abs(attack);
  const absDecay = Math.abs(decay);
  const range = Math.max(...evalSeq) - Math.min(...evalSeq);
  const normalized = range > 0 ? absDecay / range : 0;

  let shape, label;
  // v0.6.0 order: sustained → spike → building → collapse → volatile → mixed
  if (absAttack < 10 && absDecay < 10) {
    shape = 'sustained'; label = '▬';
  } else if (absAttack > 20 && normalized > 0.5) {
    shape = 'spike'; label = '⚡';
  } else if (attack > 10 && absDecay < 10 && release > -5) {
    shape = 'building'; label = '▲';
  } else if (sustain < -10) {
    shape = 'collapse'; label = '▼';
  } else if (absDecay > 15 && absAttack > 15) {
    shape = 'volatile'; label = '〜';
  } else {
    shape = 'mixed'; label = '◆';
  }
  return { attack, decay, sustain: Math.round(sustain), release: Math.round(release), shape, label };
}

const DCC_WEIGHTS = {
  stability: 20,
  adsr_sustained: 10, adsr_building: 15,
  adsr_spike: -5, adsr_collapse: -20, adsr_volatile: -10,
  momentum_max: 5,
  endgame_known: 25, endgame_unknown: -15,
  tunnel: 10,
  complexity: 10
};

function evalMomentum(evalSeq) {
  if (evalSeq.length < 3) return 0;
  let accSum = 0;
  for (let i = 2; i < evalSeq.length; i++)
    accSum += (evalSeq[i] - evalSeq[i-1]) - (evalSeq[i-1] - evalSeq[i-2]);
  return accSum / (evalSeq.length - 2);
}

function materialCount(fen) {
  return fen.split(' ')[0].replace(/[/1-8]/g, '').length;
}

function detectTunnel(evalSeq) {
  if (evalSeq.length < 4) return false;
  const start = evalSeq[0];
  const mid = evalSeq.slice(1, -1);
  const minMid = Math.min(...mid);
  const end = evalSeq[evalSeq.length - 1];
  return minMid < start - 20 && end > start + 10;
}

// Self-calibrating DCC Governor [P17]
const dccGovernor = {
  allDeltas: [],
  threshDrop: -15,
  threshRise: 5,
  observe(evalSeq) {
    for (let i = 1; i < evalSeq.length; i++)
      this.allDeltas.push(evalSeq[i] - evalSeq[i-1]);
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

function shouldGoDeeper(evalSeq) {
  if (evalSeq.length < 2) return true;
  const last = evalSeq[evalSeq.length - 1];
  const prev = evalSeq[evalSeq.length - 2];
  const trend = last - prev;
  if (trend < dccGovernor.threshDrop) return true;
  if (trend > dccGovernor.threshRise && evalSeqStability(evalSeq) > 0.5) return false;
  const oscillation = evalSeq.some((v, i) =>
    i > 1 && Math.sign(v - evalSeq[i-1]) !== Math.sign(evalSeq[i-1] - evalSeq[i-2])
  );
  if (oscillation) return true;
  return evalSeq.length < 3;
}


// ═══════════════════════════════════════════════════════════════════
// 3. CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

let cache = {};
let cacheFile = '';
let cacheDirty = false;

function fenKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function loadCache(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  cacheFile = join(dir, 'cache.json');
  if (existsSync(cacheFile)) {
    try {
      cache = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      const n = Object.keys(cache).length;
      console.log(`  Cache loaded: ${n} entries from ${cacheFile}`);
    } catch (e) {
      console.warn(`  Warning: corrupt cache file, starting fresh`);
      cache = {};
    }
  } else {
    console.log(`  Cache: new (${cacheFile})`);
  }
}

function saveCache() {
  if (!cacheDirty) return;
  try {
    writeFileSync(cacheFile, JSON.stringify(cache));
    cacheDirty = false;
  } catch (e) {
    console.error(`  Error saving cache: ${e.message}`);
  }
}

// Auto-save every 50 new entries
let cacheWriteCounter = 0;
function cacheSet(key, value) {
  cache[key] = value;
  cacheDirty = true;
  if (++cacheWriteCounter % 50 === 0) saveCache();
}


// ═══════════════════════════════════════════════════════════════════
// 4. CHESSDB API LAYER
// ═══════════════════════════════════════════════════════════════════

const API_BASE = 'https://www.chessdb.cn/cdb.php';
let apiCalls = 0;
let cacheHits = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchQueryAll(fen) {
  const key = 'qa:' + fenKey(fen);
  if (cache[key]) { cacheHits++; return cache[key]; }

  await sleep(200);
  apiCalls++;
  const url = `${API_BASE}?action=queryall&board=${encodeURIComponent(fen)}&learn=0&showall=1`;
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
    cacheSet(key, result);
    return result;
  } catch (e) {
    console.warn(`    queryall error: ${e.message}`);
    return { moves: [], fen };
  }
}

async function fetchPV(fen) {
  const key = 'pv:' + fenKey(fen);
  if (cache[key]) { cacheHits++; return cache[key]; }

  await sleep(200);
  apiCalls++;
  const url = `${API_BASE}?action=querypv&board=${encodeURIComponent(fen)}&learn=0`;
  try {
    const txt = await fetch(url).then(r => r.text());
    if (txt === 'unknown' || txt.startsWith('invalid')) {
      const result = { score: null, depth: 0, pv: [], raw: txt };
      cacheSet(key, result);
      return result;
    }
    const scoreMatch = txt.match(/score:([-\d]+)/);
    const depthMatch = txt.match(/depth:(\d+)/);
    const pvMatch    = txt.match(/pv:(.+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
    const pv    = pvMatch ? pvMatch[1].split('|').filter(Boolean) : [];
    const result = { score, depth, pv, raw: txt };
    cacheSet(key, result);
    return result;
  } catch (e) {
    console.warn(`    querypv error: ${e.message}`);
    return { score: null, depth: 0, pv: [], raw: '' };
  }
}

async function fetchScore(fen) {
  const key = 'sc:' + fenKey(fen);
  if (cache[key] !== undefined) { cacheHits++; return cache[key]; }

  await sleep(150);
  apiCalls++;
  const url = `${API_BASE}?action=queryscore&board=${encodeURIComponent(fen)}&learn=0`;
  try {
    const txt = await fetch(url).then(r => r.text());
    const m = txt.match(/eval:([-\d]+)/);
    const score = m ? parseInt(m[1], 10) : null;
    cacheSet(key, score);
    return score;
  } catch (e) {
    console.warn(`    queryscore error: ${e.message}`);
    return null;
  }
}

// Cached versions that ONLY read from cache (for analyze mode)
function cachedQueryAll(fen) {
  const key = 'qa:' + fenKey(fen);
  return cache[key] || null;
}

function cachedPV(fen) {
  const key = 'pv:' + fenKey(fen);
  return cache[key] || null;
}

function cachedScore(fen) {
  const key = 'sc:' + fenKey(fen);
  return cache[key] !== undefined ? cache[key] : null;
}


// ═══════════════════════════════════════════════════════════════════
// 5. PGN PARSING
// ═══════════════════════════════════════════════════════════════════

function loadPGN(filepath) {
  const raw = readFileSync(filepath, 'utf-8');
  // Split multi-game PGN by double newline before headers
  const games = [];
  const chunks = raw.split(/\n\n(?=\[)/);

  // Reassemble: each game = headers + movetext
  let current = '';
  for (const chunk of chunks) {
    current += (current ? '\n\n' : '') + chunk;
    // Check if this chunk has both headers and a result marker
    if (/\[(Event|White|Black)\s/.test(current) &&
        /(\s(1-0|0-1|1\/2-1\/2|\*))\s*$/.test(current.trim())) {
      games.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) games.push(current.trim());

  // If no structured games found, treat the whole file as one game
  if (games.length === 0) games.push(raw.trim());

  return games;
}

function parseSinglePGN(pgnText) {
  const game = new Chess();
  // Strip comments for loading
  const clean = pgnText.replace(/\{[^}]*\}/g, '');
  try {
    game.loadPgn(clean);
  } catch (e) {
    // Try just the movetext
    try {
      const movetext = clean.replace(/\[[^\]]*\]\s*/g, '').trim();
      game.loadPgn(movetext);
    } catch (e2) {
      return null;
    }
  }
  const headers = game.header();
  const history = game.history({ verbose: true });
  return { headers, history, pgn: pgnText };
}


// ═══════════════════════════════════════════════════════════════════
// 6. FETCH MODE — Download chessdb data for PGN positions
// ═══════════════════════════════════════════════════════════════════

async function fetchForPosition(fen, topN, maxDepth) {
  // 1. queryall — get all candidate moves
  const qa = await fetchQueryAll(fen);
  if (!qa.moves || qa.moves.length === 0) return 0;

  const bestRaw = qa.moves[0].score;
  const candidates = qa.moves.filter(m =>
    Math.abs(bestRaw - m.score) <= opts.floor
  ).slice(0, topN);

  let calls = 1; // queryall

  // 2. For each candidate: querypv + walk PV with queryscore
  for (const mv of candidates) {
    const probe = new Chess(fen);
    const m = probe.move({
      from: mv.move.slice(0, 2), to: mv.move.slice(2, 4),
      promotion: mv.move.length > 4 ? mv.move[4] : 'q'
    });
    if (!m) continue;

    const pvResult = await fetchPV(probe.fen());
    calls++;
    if (pvResult.score === null) continue;

    // Walk PV up to maxDepth, scoring intermediates
    if (pvResult.pv.length > 0) {
      const walk = new Chess(probe.fen());
      const pvMoves = pvResult.pv.slice(0, maxDepth);
      for (let j = 0; j < pvMoves.length; j++) {
        const uci = pvMoves[j];
        const wm = walk.move({
          from: uci.slice(0, 2), to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined
        });
        if (!wm) break;
        // Score every 2nd position for efficiency
        if (j % 2 === 1 || j === pvMoves.length - 1) {
          await fetchScore(walk.fen());
          calls++;
        }
      }
    }
  }
  return calls;
}

async function modeFetch(pgnPath) {
  console.log(`\n  8ZC Fetch — ${pgnPath}`);
  console.log(`  Depth: 20 (fetch always max), Top: ${opts.top}, Floor: ${opts.floor}cp`);

  loadCache(opts.cache);

  const games = loadPGN(pgnPath);
  console.log(`  Found ${games.length} game(s) in PGN\n`);

  for (let gi = 0; gi < games.length; gi++) {
    const parsed = parseSinglePGN(games[gi]);
    if (!parsed) { console.log(`  Game ${gi+1}: parse error, skipping`); continue; }

    const { headers, history } = parsed;
    const white = headers.White || '?';
    const black = headers.Black || '?';
    console.log(`  Game ${gi+1}/${games.length}: ${white} vs ${black} (${history.length} moves)`);

    // Replay moves and fetch for each position
    const replay = new Chess();
    const totalPos = history.length;
    const startApi = apiCalls;
    const startHits = cacheHits;

    for (let i = 0; i < history.length; i++) {
      const fen = replay.fen();
      await fetchForPosition(fen, opts.top, 20); // always depth 20 for fetch

      const pct = Math.round(100 * (i + 1) / totalPos);
      const hits = cacheHits - startHits;
      process.stdout.write(`\r    Fetching ${i+1}/${totalPos} positions... (cache hits: ${hits})`);

      // Play the move
      replay.move(history[i].san);
    }
    // Also fetch final position
    await fetchForPosition(replay.fen(), opts.top, 20);

    const gameCalls = apiCalls - startApi;
    const gameHits = cacheHits - startHits;
    console.log(`\n    Done: ${gameCalls} API calls, ${gameHits} cache hits`);
  }

  saveCache();
  console.log(`\n  Cached ${Object.keys(cache).length} entries → ${opts.cache}/`);
  console.log(`  Total: ${apiCalls} API calls, ${cacheHits} cache hits\n`);
}


// ═══════════════════════════════════════════════════════════════════
// 7. ANALYZE MODE — Offline DCC analysis from cache
// ═══════════════════════════════════════════════════════════════════

function analyzePositionOffline(fen, depth, topN, floor) {
  const qa = cachedQueryAll(fen);
  if (!qa || !qa.moves || qa.moves.length === 0) return null;

  const bestRaw = qa.moves[0].score;
  const candidates = qa.moves.filter(m =>
    Math.abs(bestRaw - m.score) <= floor
  ).slice(0, topN);

  let bestDCCMove = null, bestDCCScore = -Infinity;
  const analyzed = [];

  for (const mv of candidates) {
    const probe = new Chess(fen);
    const m = probe.move({
      from: mv.move.slice(0, 2), to: mv.move.slice(2, 4),
      promotion: mv.move.length > 4 ? mv.move[4] : 'q'
    });
    if (!m) continue;

    const pvResult = cachedPV(probe.fen());
    if (!pvResult || pvResult.score === null) continue;

    // Build eval sequence from cache — DEPTH controls how far we read
    const evalSeq = [pvResult.score];
    if (pvResult.pv.length > 0) {
      const walk = new Chess(probe.fen());
      const maxWalk = Math.min(depth, pvResult.pv.length);
      for (let j = 0; j < maxWalk; j++) {
        const uci = pvResult.pv[j];
        const wm = walk.move({
          from: uci.slice(0, 2), to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined
        });
        if (!wm) break;
        if (j % 2 === 1 || j === maxWalk - 1) {
          const sc = cachedScore(walk.fen());
          if (sc !== null) evalSeq.push((j % 2 === 0) ? -sc : sc);
        }
      }
    }

    // DCC scoring
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

    // Endgame
    if (materialCount(probe.fen()) <= 7) {
      const endgameQA = cachedQueryAll(probe.fen());
      if (endgameQA && endgameQA.moves.length > 0) dccScore += DCC_WEIGHTS.endgame_known;
      else dccScore += DCC_WEIGHTS.endgame_unknown;
    }
    if (tunnel) dccScore += DCC_WEIGHTS.tunnel;

    // LZ complexity tiebreaker
    const cx = fenComplexity(probe.fen());
    dccScore -= cx * DCC_WEIGHTS.complexity;

    const entry = {
      move: mv.move, raw: mv.score, dcc: Math.round(dccScore),
      stability, adsr: adsr.shape, trend, momentum, tunnel
    };
    analyzed.push(entry);

    if (dccScore > bestDCCScore) {
      bestDCCScore = dccScore;
      bestDCCMove = mv.move;
    }

    // Feed governor
    if (evalSeq.length >= 2) dccGovernor.observe(evalSeq);
  }

  return { candidates: analyzed, dcc1Move: bestDCCMove, allMoves: qa.moves };
}

function generateAnnotatedPGN(headers, moves, annotations, wPct, bPct, dccDepth, dccTop, wCov, bCov) {
  let pgn = '';
  for (const [k, v] of Object.entries(headers)) {
    if (v && v !== 'null' && v !== 'undefined') pgn += `[${k} "${v}"]\n`;
  }
  pgn += `[DCC_Version "0.6.1"]\n`;
  pgn += `[DCC_Depth "${dccDepth}"]\n`;
  pgn += `[DCC_TopCandidates "${dccTop}"]\n`;
  pgn += `[DCC_WhiteAccuracy "${wPct}%"]\n`;
  pgn += `[DCC_BlackAccuracy "${bPct}%"]\n`;
  if (wCov !== undefined) pgn += `[DCC_WhiteCoverage "${wCov}%"]\n`;
  if (bCov !== undefined) pgn += `[DCC_BlackCoverage "${bCov}%"]\n`;
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
      if (ann.tunnel) parts.push('tunnel');
      pgn += `{DCC: ${parts.join(' ')}} `;
    }
    if (i % 2 === 1) pgn += '\n';
  }

  pgn += (headers.Result || '*') + '\n';
  return pgn;
}

function analyzeGame(parsed, depth, topN, floor) {
  const { headers, history } = parsed;
  const annotations = [];
  const replay = new Chess();
  const movesData = [];

  for (let i = 0; i < history.length; i++) {
    const fen = replay.fen();
    const side = replay.turn();
    const mv = history[i];
    const moveUci = mv.from + mv.to + (mv.promotion || '');

    let ann = {
      ply: i + 1, side, san: mv.san, uci: moveUci,
      raw: null, dcc: null, stability: null, adsr: null,
      trend: '', momentum: 0, tunnel: false, isDCC1: null, dcc1Move: null
    };

    const analysis = analyzePositionOffline(fen, depth, topN, floor);
    if (analysis) {
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
        const rawMatch = analysis.allMoves.find(m =>
          m.move.slice(0, 4) === moveUci.slice(0, 4));
        if (rawMatch) ann.raw = rawMatch.score;
      }
      ann.isDCC1 = analysis.dcc1Move
        ? analysis.dcc1Move.slice(0, 4) === moveUci.slice(0, 4) : null;
      ann.dcc1Move = analysis.dcc1Move || null;
    }

    annotations.push(ann);

    // JSON move entry
    movesData.push({
      ply: i + 1, san: mv.san, uci: moveUci, side,
      raw: ann.raw, dcc: ann.dcc,
      stability: ann.stability !== null ? +ann.stability.toFixed(3) : null,
      adsr: ann.adsr, trend: ann.trend,
      momentum: ann.momentum ? +ann.momentum.toFixed(1) : 0,
      tunnel: ann.tunnel,
      dcc1: ann.isDCC1, dcc1_move: ann.dcc1Move
    });

    replay.move(mv.san);
  }

  // Summary stats
  const wAnns = annotations.filter(a => a.side === 'w' && a.isDCC1 !== null);
  const bAnns = annotations.filter(a => a.side === 'b' && a.isDCC1 !== null);
  const wMatch = wAnns.filter(a => a.isDCC1).length;
  const bMatch = bAnns.filter(a => a.isDCC1).length;
  const wPct = wAnns.length > 0 ? Math.round(100 * wMatch / wAnns.length) : 0;
  const bPct = bAnns.length > 0 ? Math.round(100 * bMatch / bAnns.length) : 0;

  const countShapes = anns => {
    const c = { sustained: 0, building: 0, spike: 0, collapse: 0, volatile: 0, mixed: 0, unknown: 0 };
    anns.forEach(a => { if (a.adsr && c[a.adsr] !== undefined) c[a.adsr]++; });
    return c;
  };
  const avgStab = anns => {
    const valid = anns.filter(a => a.stability !== null);
    return valid.length > 0 ? +(valid.reduce((s, a) => s + a.stability, 0) / valid.length).toFixed(3) : 0;
  };
  const tunnelCount = anns => anns.filter(a => a.tunnel).length;

  // Coverage: how many positions had chessdb data per side
  const wAll = annotations.filter(a => a.side === 'w');
  const bAll = annotations.filter(a => a.side === 'b');
  const wWithRaw = annotations.filter(a => a.side === 'w' && a.raw !== null).length;
  const bWithRaw = annotations.filter(a => a.side === 'b' && a.raw !== null).length;
  const wCoverage = wAll.length > 0 ? Math.round(100 * wWithRaw / wAll.length) : 0;
  const bCoverage = bAll.length > 0 ? Math.round(100 * bWithRaw / bAll.length) : 0;

  // Turning point: first ply where eval permanently favors one side
  let turningPointPly = null;
  let turningPointSan = null;
  {
    // Build normalized eval sequence (White perspective)
    const evalSeqW = [];
    for (const a of annotations) {
      if (a.raw !== null) evalSeqW.push({ ply: a.ply, san: a.san, eval: a.side === 'w' ? a.raw : -a.raw });
    }
    for (let i = 0; i < evalSeqW.length; i++) {
      if (Math.abs(evalSeqW[i].eval) > 50) {
        const sign = Math.sign(evalSeqW[i].eval);
        let stays = true;
        for (let j = i + 1; j < evalSeqW.length; j++) {
          if (Math.abs(evalSeqW[j].eval) < 30000 && Math.sign(evalSeqW[j].eval) !== sign && Math.abs(evalSeqW[j].eval) > 20) {
            stays = false; break;
          }
        }
        if (stays) { turningPointPly = evalSeqW[i].ply; turningPointSan = evalSeqW[i].san; break; }
      }
    }
  }

  // Collapse details: eval at collapse
  const collapseDetails = [];
  for (const a of annotations) {
    if (a.adsr === 'collapse') {
      collapseDetails.push({ ply: a.ply, san: a.san, side: a.side, raw: a.raw });
    }
  }

  // Gap category
  const gap = Math.abs(wPct - bPct);
  const gapCategory = gap > 30 ? 'demolition' : gap > 20 ? 'clear' : gap > 10 ? 'close' : 'tight';

  const summary = {
    w_accuracy: wPct, b_accuracy: bPct, gap,
    gap_category: gapCategory,
    w_avg_stability: avgStab(wAnns), b_avg_stability: avgStab(bAnns),
    w_collapses: countShapes(wAnns).collapse, b_collapses: countShapes(bAnns).collapse,
    w_tunnels: tunnelCount(wAnns), b_tunnels: tunnelCount(bAnns),
    w_adsr: countShapes(wAnns), b_adsr: countShapes(bAnns),
    w_coverage: wCoverage, b_coverage: bCoverage,
    turning_point_ply: turningPointPly, turning_point_san: turningPointSan,
    collapse_details: collapseDetails
  };

  const meta = {
    white: headers.White || '?', black: headers.Black || '?',
    result: headers.Result || '*', moves: history.length,
    dcc_depth: depth, dcc_top: topN, dcc_floor: floor
  };

  const annotatedPGN = generateAnnotatedPGN(headers, history, annotations, wPct, bPct, depth, topN, wCoverage, bCoverage);

  return { meta, summary, moves: movesData, annotations, annotatedPGN, wPct, bPct };
}

async function modeAnalyze(pgnPath) {
  console.log(`\n  8ZC Analyze — ${pgnPath}`);
  console.log(`  Depth: ${opts.depth}, Top: ${opts.top}, Floor: ${opts.floor}cp`);
  console.log(`  OFFLINE — zero API calls\n`);

  loadCache(opts.cache);

  const games = loadPGN(pgnPath);
  console.log(`  Found ${games.length} game(s)\n`);

  const allResults = [];

  for (let gi = 0; gi < games.length; gi++) {
    const parsed = parseSinglePGN(games[gi]);
    if (!parsed) { console.log(`  Game ${gi+1}: parse error, skipping`); continue; }

    const { headers } = parsed;
    const white = headers.White || '?';
    const black = headers.Black || '?';
    process.stdout.write(`  Analyzing ${gi+1}/${games.length}: ${white} vs ${black}...`);

    const result = analyzeGame(parsed, opts.depth, opts.top, opts.floor);
    allResults.push(result);

    console.log(` W:${result.wPct}% B:${result.bPct}% gap:${result.summary.gap} (${result.summary.gap_category}) cov:${result.summary.w_coverage}/${result.summary.b_coverage}% tp:${result.summary.turning_point_ply || '-'}`);
  }

  // Output
  const outBase = opts.out || pgnPath.replace(/\.pgn$/i, '_dcc');

  // Ensure output directory exists
  const outDir = outBase.includes('/') || outBase.includes('\\')
    ? outBase.slice(0, Math.max(outBase.lastIndexOf('/'), outBase.lastIndexOf('\\')))
    : null;
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // 1. Annotated PGN
  const pgnOut = outBase + '.pgn';
  const allPGN = allResults.map(r => r.annotatedPGN).join('\n\n');
  writeFileSync(pgnOut, allPGN);
  console.log(`\n  PGN → ${pgnOut}`);

  // 2. JSON
  const jsonOut = outBase + '.json';
  const jsonData = allResults.map(r => ({ meta: r.meta, summary: r.summary, moves: r.moves }));
  writeFileSync(jsonOut, JSON.stringify(jsonData, null, 2));
  console.log(`  JSON → ${jsonOut}`);

  // 3. Summary CSV
  const csvOut = outBase + '_summary.csv';
  let csv = 'file,white,black,result,dcc_depth,w_acc,b_acc,gap,gap_cat,w_stab,b_stab,w_collapses,b_collapses,w_tunnels,b_tunnels,w_coverage,b_coverage,turning_point_ply,w_sustained,w_building,w_spike,w_collapse,b_sustained,b_building,b_spike,b_collapse,total_moves\n';
  for (const r of allResults) {
    csv += [
      basename(pgnPath), r.meta.white, r.meta.black, r.meta.result, r.meta.dcc_depth,
      r.summary.w_accuracy, r.summary.b_accuracy, r.summary.gap, r.summary.gap_category,
      r.summary.w_avg_stability, r.summary.b_avg_stability,
      r.summary.w_collapses, r.summary.b_collapses,
      r.summary.w_tunnels, r.summary.b_tunnels,
      r.summary.w_coverage, r.summary.b_coverage,
      r.summary.turning_point_ply || '',
      r.summary.w_adsr.sustained, r.summary.w_adsr.building, r.summary.w_adsr.spike, r.summary.w_adsr.collapse,
      r.summary.b_adsr.sustained, r.summary.b_adsr.building, r.summary.b_adsr.spike, r.summary.b_adsr.collapse,
      r.meta.moves
    ].join(',') + '\n';
  }
  writeFileSync(csvOut, csv);
  console.log(`  CSV → ${csvOut}`);

  // 4. Moves CSV (per-move detail)
  const movesCsvOut = outBase + '_moves.csv';
  let mcsv = 'file,ply,side,san,raw,dcc,stability,adsr,trend,momentum,tunnel,dcc1\n';
  for (const r of allResults) {
    for (const m of r.moves) {
      mcsv += [
        basename(pgnPath), m.ply, m.side, m.san,
        m.raw ?? '', m.dcc ?? '', m.stability ?? '', m.adsr ?? '',
        m.trend ?? '', m.momentum ?? 0, m.tunnel ? 1 : 0, m.dcc1 === null ? '' : m.dcc1 ? 1 : 0
      ].join(',') + '\n';
    }
  }
  writeFileSync(movesCsvOut, mcsv);
  console.log(`  Moves CSV → ${movesCsvOut}`);

  console.log(`\n  Analysis complete — zero API calls\n`);
}


// ═══════════════════════════════════════════════════════════════════
// 8. BATCH MODE — Fetch + Analyze for folder of PGNs
// ═══════════════════════════════════════════════════════════════════

async function modeBatch(dirPath) {
  console.log(`\n  8ZC Batch — ${dirPath}`);
  console.log(`  Depth: ${opts.depth}, Top: ${opts.top}, Floor: ${opts.floor}cp`);

  loadCache(opts.cache);

  const files = readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.pgn')).sort();
  console.log(`  Found ${files.length} PGN file(s)\n`);

  const outDir = opts.out || join(dirPath, '8zc_results');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const batchSummary = [];

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const fullPath = join(dirPath, file);
    console.log(`  ── ${fi+1}/${files.length}: ${file}`);

    // Fetch
    const games = loadPGN(fullPath);
    for (let gi = 0; gi < games.length; gi++) {
      const parsed = parseSinglePGN(games[gi]);
      if (!parsed) continue;

      const { history } = parsed;
      const replay = new Chess();
      const startApi = apiCalls;
      const startHits = cacheHits;

      for (let i = 0; i < history.length; i++) {
        await fetchForPosition(replay.fen(), opts.top, 20);
        const hits = cacheHits - startHits;
        process.stdout.write(`\r    Fetch ${gi+1}/${games.length} pos ${i+1}/${history.length} (hits: ${hits})`);
        replay.move(history[i].san);
      }
      await fetchForPosition(replay.fen(), opts.top, 20);
      console.log(`  → ${apiCalls - startApi} calls`);
    }

    saveCache();

    // Analyze
    for (let gi = 0; gi < games.length; gi++) {
      const parsed = parseSinglePGN(games[gi]);
      if (!parsed) continue;

      const result = analyzeGame(parsed, opts.depth, opts.top, opts.floor);
      const outBase = join(outDir, file.replace(/\.pgn$/i, gi > 0 ? `_g${gi+1}_dcc` : '_dcc'));

      writeFileSync(outBase + '.pgn', result.annotatedPGN);
      writeFileSync(outBase + '.json', JSON.stringify({ meta: result.meta, summary: result.summary, moves: result.moves }, null, 2));

      batchSummary.push(result);
      console.log(`    Game ${gi+1}: W:${result.wPct}% B:${result.bPct}% gap:${result.summary.gap}`);
    }
  }

  // Batch summary CSV
  const summaryPath = join(outDir, 'batch_summary.csv');
  let csv = 'file,white,black,result,w_accuracy,b_accuracy,gap,collapses_w,collapses_b,avg_stab\n';
  for (let i = 0; i < batchSummary.length; i++) {
    const r = batchSummary[i];
    const avgS = +((r.summary.w_avg_stability + r.summary.b_avg_stability) / 2).toFixed(2);
    csv += [
      files[Math.min(i, files.length - 1)],
      r.meta.white, r.meta.black, r.meta.result,
      r.summary.w_accuracy, r.summary.b_accuracy, r.summary.gap,
      r.summary.w_collapses, r.summary.b_collapses, avgS
    ].join(',') + '\n';
  }
  writeFileSync(summaryPath, csv);

  console.log(`\n  Batch complete: ${files.length} files, ${batchSummary.length} games analyzed`);
  console.log(`  Summary → ${summaryPath}`);
  console.log(`  Cache: ${Object.keys(cache).length} entries`);
  console.log(`  Total: ${apiCalls} API calls, ${cacheHits} cache hits\n`);
}


// ═══════════════════════════════════════════════════════════════════
// 9. TOURNAMENT MODE — DCC vs Raw ChessDB self-play
// ═══════════════════════════════════════════════════════════════════

// Pick move: DCC governance (full scoring pipeline)
async function pickDCCMove(game, depth, topN, floor) {
  const fen = game.fen();
  const result = await fetchQueryAll(fen);
  if (!result.moves || result.moves.length === 0) return null;

  const bestRaw = result.moves[0].score;
  const candidates = result.moves.filter(m =>
    Math.abs(bestRaw - m.score) <= floor
  ).slice(0, topN);

  let bestMove = result.moves[0];
  let bestScore = -Infinity;

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
    if (pvResult.pv.length > 0) {
      const walk = new Chess(probe.fen());
      const maxWalk = Math.min(depth, pvResult.pv.length);
      for (let j = 0; j < maxWalk; j++) {
        const uci = pvResult.pv[j];
        const wm = walk.move({
          from: uci.slice(0, 2), to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined
        });
        if (!wm) break;
        if (j % 2 === 1 || j === maxWalk - 1) {
          const sc = await fetchScore(walk.fen());
          if (sc !== null) evalSeq.push((j % 2 === 0) ? -sc : sc);
        }
      }
    }

    const stability = evalSeqStability(evalSeq);
    const adsr = adsrAnalysis(evalSeq);
    const momentum = evalMomentum(evalSeq);
    const tunnel = detectTunnel(evalSeq);

    let dccScore = mv.score;
    dccScore += stability * DCC_WEIGHTS.stability;
    if (adsr.shape === 'sustained') dccScore += DCC_WEIGHTS.adsr_sustained;
    else if (adsr.shape === 'building') dccScore += DCC_WEIGHTS.adsr_building;
    else if (adsr.shape === 'spike') dccScore += DCC_WEIGHTS.adsr_spike;
    else if (adsr.shape === 'collapse') dccScore += DCC_WEIGHTS.adsr_collapse;
    else if (adsr.shape === 'volatile') dccScore += DCC_WEIGHTS.adsr_volatile;
    dccScore += Math.sign(momentum) * Math.min(Math.abs(momentum), DCC_WEIGHTS.momentum_max);
    if (materialCount(probe.fen()) <= 7) {
      const pr = await fetchQueryAll(probe.fen());
      dccScore += pr.moves.length > 0 ? DCC_WEIGHTS.endgame_known : DCC_WEIGHTS.endgame_unknown;
    }
    if (tunnel) dccScore += DCC_WEIGHTS.tunnel;
    const cx = fenComplexity(probe.fen());
    dccScore -= cx * DCC_WEIGHTS.complexity;

    if (evalSeq.length >= 2) dccGovernor.observe(evalSeq);

    if (dccScore > bestScore) {
      bestScore = dccScore;
      bestMove = mv;
    }
  }
  return bestMove;
}

// Pick move: Raw ChessDB (opponent model)
async function pickRawMove(game, model) {
  const result = await fetchQueryAll(game.fen());
  if (!result.moves || result.moves.length === 0) return null;

  if (model === 'perfect') {
    return result.moves[0];
  } else if (model === 'weak') {
    const pool = result.moves.slice(0, Math.min(5, result.moves.length));
    return pool[Math.floor(Math.random() * pool.length)];
  } else { // realistic
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

// Book move: random from top-3
async function pickBookMove(game) {
  const result = await fetchQueryAll(game.fen());
  if (!result.moves || result.moves.length === 0) return null;
  const pool = result.moves.slice(0, Math.min(3, result.moves.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyUCIMove(game, uci) {
  return game.move({
    from: uci.slice(0, 2), to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : 'q'
  });
}

function isGameOver(game) {
  return game.isGameOver() || game.history().length >= 200;
}

function getResult(game) {
  if (game.isCheckmate()) {
    // The side that just moved won
    return game.turn() === 'w' ? '0-1' : '1-0';
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() ||
      game.isInsufficientMaterial() || game.history().length >= 200) {
    return '1/2-1/2';
  }
  return '*';
}

async function playTournamentGame(gameNum, dccColor, depth, topN, floor, opponent, bookMoves) {
  const game = new Chess();
  const moveAnnotations = [];
  let bookPhase = true;
  let halfMoves = 0;

  while (!isGameOver(game)) {
    const currentSide = game.turn(); // 'w' or 'b'
    const isDCCSide = currentSide === dccColor;
    let chosenMove;

    if (bookPhase) {
      chosenMove = await pickBookMove(game);
      halfMoves++;
      if (halfMoves >= bookMoves || !chosenMove) bookPhase = false;
    }

    if (!bookPhase || !chosenMove) {
      bookPhase = false;
      if (isDCCSide) {
        chosenMove = await pickDCCMove(game, depth, topN, floor);
      } else {
        chosenMove = await pickRawMove(game, opponent);
      }
    }

    if (!chosenMove) break;

    const m = applyUCIMove(game, chosenMove.move);
    if (!m) break;

    moveAnnotations.push({
      ply: game.history().length,
      san: m.san,
      uci: chosenMove.move,
      side: currentSide,
      engine: bookPhase ? 'book' : (isDCCSide ? 'dcc' : 'raw'),
      raw: chosenMove.score
    });
  }

  const result = getResult(game);
  const history = game.history({ verbose: true });

  // Now do offline DCC analysis of the completed game for annotations
  // Reparse the game
  const headers = {
    Event: '8ZC DCC Tournament',
    Site: 'chessbest.org/8zc',
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: String(gameNum),
    White: dccColor === 'w' ? 'DCC' : `Raw_${opponent}`,
    Black: dccColor === 'b' ? 'DCC' : `Raw_${opponent}`,
    Result: result
  };

  return { headers, history, result, dccColor, moveAnnotations, game };
}

async function modeTournament() {
  const numGames = opts.games;
  const depth = opts.dccDepth;
  const topN = opts.dccTop;
  const floor = opts.dccFloor;
  const opponent = opts.opponent;
  const bookMoves = opts.bookMoves;

  console.log(`\n  8ZC Tournament — DCC vs Raw (${opponent})`);
  console.log(`  Games: ${numGames}, Depth: ${depth}, Top: ${topN}, Floor: ${floor}cp`);
  console.log(`  Book moves: ${bookMoves}, Opponent: ${opponent}\n`);

  loadCache(opts.cache);

  const outDir = opts.out || './8zc_tournament';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const results = { dccWins: 0, rawWins: 0, draws: 0 };
  const collapsesDCC = [];
  const collapsesRaw = [];
  const tournamentCSV = ['game_num,dcc_color,result,winner,moves,dcc_acc,raw_acc,dcc_collapses,raw_collapses'];
  const allPGNs = [];
  const t0 = performance.now();

  for (let gn = 0; gn < numGames; gn++) {
    // Alternate DCC color: first half white, second half black
    const dccColor = gn < numGames / 2 ? 'w' : 'b';

    const gameResult = await playTournamentGame(gn + 1, dccColor, depth, topN, floor, opponent, bookMoves);
    const { headers, history, result, game } = gameResult;

    // Analyze the game offline
    const parsed = { headers, history };
    const analysis = analyzeGame(parsed, depth, topN, floor);

    // Determine winner relative to DCC
    let winner = 'draw';
    if (result === '1-0') winner = dccColor === 'w' ? 'dcc' : 'raw';
    else if (result === '0-1') winner = dccColor === 'b' ? 'dcc' : 'raw';

    if (winner === 'dcc') results.dccWins++;
    else if (winner === 'raw') results.rawWins++;
    else results.draws++;

    const dccAcc = dccColor === 'w' ? analysis.summary.w_accuracy : analysis.summary.b_accuracy;
    const rawAcc = dccColor === 'w' ? analysis.summary.b_accuracy : analysis.summary.w_accuracy;
    const dccCol = dccColor === 'w' ? analysis.summary.w_collapses : analysis.summary.b_collapses;
    const rawCol = dccColor === 'w' ? analysis.summary.b_collapses : analysis.summary.w_collapses;

    collapsesDCC.push(dccCol);
    collapsesRaw.push(rawCol);

    tournamentCSV.push([gn + 1, dccColor, result, winner, history.length, dccAcc, rawAcc, dccCol, rawCol].join(','));

    allPGNs.push(analysis.annotatedPGN);

    // Save individual game JSON
    writeFileSync(join(outDir, `game_${String(gn + 1).padStart(3, '0')}.json`),
      JSON.stringify({ meta: analysis.meta, summary: analysis.summary, moves: analysis.moves }, null, 2));

    // Progress
    const elapsed = ((performance.now() - t0) / 1000).toFixed(0);
    const msPerGame = ((performance.now() - t0) / (gn + 1)).toFixed(0);
    const eta = ((numGames - gn - 1) * parseFloat(msPerGame) / 1000 / 60).toFixed(1);
    const wp = results.dccWins + results.rawWins > 0
      ? Math.round(100 * results.dccWins / (results.dccWins + results.rawWins)) : 0;
    process.stdout.write(`\r  [${gn + 1}/${numGames}] DCC:${results.dccWins} Raw:${results.rawWins} Draw:${results.draws} WR:${wp}% | ${elapsed}s ETA:${eta}min   `);

    // Save cache periodically
    if ((gn + 1) % 5 === 0) saveCache();
  }

  saveCache();

  // Write outputs
  const pgnPath = join(outDir, 'tournament_games.pgn');
  writeFileSync(pgnPath, allPGNs.join('\n\n'));

  const csvPath = join(outDir, 'tournament_results.csv');
  writeFileSync(csvPath, tournamentCSV.join('\n') + '\n');

  // Tournament summary
  const decisive = results.dccWins + results.rawWins;
  const dccWinRate = decisive > 0 ? Math.round(100 * results.dccWins / decisive) : 0;
  const avgDCCCol = collapsesDCC.length > 0
    ? (collapsesDCC.reduce((a, b) => a + b, 0) / collapsesDCC.length).toFixed(1) : 0;
  const avgRawCol = collapsesRaw.length > 0
    ? (collapsesRaw.reduce((a, b) => a + b, 0) / collapsesRaw.length).toFixed(1) : 0;

  // ELO estimate from win rate vs perfect
  const eloBonus = decisive > 0 ? Math.round(400 * Math.log10(results.dccWins / Math.max(1, results.rawWins))) : 0;

  const summaryText = `
Tournament Complete — ${numGames} games

DCC vs Raw ChessDB (${opponent}):
  DCC wins:  ${results.dccWins}
  Raw wins:  ${results.rawWins}
  Draws:     ${results.draws}

  DCC win rate: ${dccWinRate}% (excluding draws)

  Avg collapses — DCC moves: ${avgDCCCol}/game
  Avg collapses — Raw moves: ${avgRawCol}/game

  ELO estimate: ChessDB base + ${eloBonus}

Config: depth=${depth} top=${topN} floor=${floor}cp opponent=${opponent} book=${bookMoves}
Cache: ${Object.keys(cache).length} entries
API calls: ${apiCalls}, Cache hits: ${cacheHits}
`;

  console.log('\n\n' + '='.repeat(56));
  console.log(summaryText);
  console.log('='.repeat(56));

  const summaryPath = join(outDir, 'tournament_summary.txt');
  writeFileSync(summaryPath, summaryText);

  console.log(`  PGN → ${pgnPath}`);
  console.log(`  CSV → ${csvPath}`);
  console.log(`  Summary → ${summaryPath}\n`);
}


// ═══════════════════════════════════════════════════════════════════
// 10. MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const t0 = performance.now();

  switch (mode) {
    case 'fetch': {
      if (!positional[0]) { console.error('  Error: provide PGN file path'); usage(); }
      await modeFetch(positional[0]);
      break;
    }
    case 'analyze': {
      if (!positional[0]) { console.error('  Error: provide PGN file path'); usage(); }
      await modeAnalyze(positional[0]);
      break;
    }
    case 'batch': {
      if (!positional[0]) { console.error('  Error: provide directory path'); usage(); }
      await modeBatch(positional[0]);
      break;
    }
    case 'tournament': {
      await modeTournament();
      break;
    }
    default:
      console.error(`  Unknown mode: ${mode}`);
      usage();
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`  Wall time: ${elapsed}s`);
}

main().catch(e => {
  console.error('Fatal:', e);
  saveCache(); // save cache even on error
  process.exit(1);
});
