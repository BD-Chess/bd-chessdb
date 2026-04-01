#!/usr/bin/env bun
/**
 * 8Z Opening Book Generator — DCC, EndEval, or Raw optimal
 * Builds opening book from ChessDB data, scored by selected metric.
 * 
 * Usage:
 *   bun run 8z-openbook.js --mode dcc     --cache ./8zc_cache --out openbook_dcc.json
 *   bun run 8z-openbook.js --mode endeval --cache ./8zc_cache --out openbook_endeval.json
 *   bun run 8z-openbook.js --mode raw     --cache ./8zc_cache --out openbook_raw.json
 * 
 * --mode M       dcc (structural health), endeval (best long-term), raw (highest now)
 * --depth N      Max half-moves per side (default: 15 = 30 ply total)
 * --branches N   Top N moves to keep at each node (default: 3)
 * --cache dir    Cache directory (required, same as 8zc-headless)
 * --out file     Output file (default: openbook.json)
 */

import { Chess } from 'chess.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let maxDepth = 15, branches = 3, cacheDir = './8zc_cache', outFile = 'openbook.json', mode = 'dcc';
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--depth':    maxDepth = parseInt(args[++i]) || 15; break;
    case '--branches': branches = parseInt(args[++i]) || 3; break;
    case '--cache':    cacheDir = args[++i]; break;
    case '--out':      outFile = args[++i]; break;
    case '--mode':     mode = args[++i] || 'dcc'; break; // dcc, endeval, raw
  }
}

// ─── Cache ───────────────────────────────────────────────────────────
let cache = {};
let cacheFile = join(cacheDir, 'cache.json');
let cacheDirty = false;
let apiCalls = 0;

if (existsSync(cacheFile)) {
  cache = JSON.parse(readFileSync(cacheFile, 'utf-8'));
  console.log(`Cache loaded: ${Object.keys(cache).length} entries`);
} else {
  console.log('No cache found — will fetch from ChessDB (slow)');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
}

function fenKey(fen) { return fen.split(' ').slice(0, 4).join(' '); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveCache() {
  if (!cacheDirty) return;
  writeFileSync(cacheFile, JSON.stringify(cache));
  cacheDirty = false;
}

// ─── ChessDB API ────────────────────────────────────────────────────
const API = 'https://www.chessdb.cn/cdb.php';

async function queryAll(fen) {
  const key = 'qa:' + fenKey(fen);
  if (cache[key]) return cache[key];
  
  await sleep(250);
  apiCalls++;
  if (apiCalls % 10 === 0) process.stdout.write(`  [${apiCalls} API calls]\r`);
  try {
    const txt = await fetch(`${API}?action=queryall&board=${encodeURIComponent(fen)}&learn=0&showall=1`).then(r => r.text());
    const moves = txt.split('|').map(line => {
      const m = line.match(/move:(\w+),score:([-\d\?]+),rank:(\d+),/);
      if (!m || m[2] === '??') return null;
      const score = parseInt(m[2], 10), rank = parseInt(m[3], 10);
      if (isNaN(score)) return null;
      return { move: m[1], score, rank };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.rank - b.rank);
    const result = { moves, fen };
    cache[key] = result; cacheDirty = true;
    if (apiCalls % 50 === 0) saveCache();
    return result;
  } catch (e) { return { moves: [], fen }; }
}

async function queryPV(fen) {
  const key = 'pv:' + fenKey(fen);
  if (cache[key]) return cache[key];
  
  await sleep(250);
  apiCalls++;
  try {
    const txt = await fetch(`${API}?action=querypv&board=${encodeURIComponent(fen)}&learn=0`).then(r => r.text());
    if (txt === 'unknown' || txt.startsWith('invalid'))
      return (cache[key] = { score: null, depth: 0, pv: [] }, cacheDirty = true, cache[key]);
    const scoreMatch = txt.match(/score:([-\d]+)/);
    const pvMatch = txt.match(/pv:(.+)/);
    const result = {
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
      depth: 0,
      pv: pvMatch ? pvMatch[1].split('|').filter(Boolean) : []
    };
    cache[key] = result; cacheDirty = true;
    if (apiCalls % 50 === 0) saveCache();
    return result;
  } catch (e) { return { score: null, depth: 0, pv: [] }; }
}

async function queryScore(fen) {
  const key = 'sc:' + fenKey(fen);
  if (cache[key] !== undefined) return cache[key];
  
  await sleep(200);
  apiCalls++;
  try {
    const txt = await fetch(`${API}?action=queryscore&board=${encodeURIComponent(fen)}&learn=0`).then(r => r.text());
    const m = txt.match(/eval:([-\d]+)/);
    const score = m ? parseInt(m[1], 10) : null;
    cache[key] = score; cacheDirty = true;
    return score;
  } catch (e) { return null; }
}

// ─── DCC Scoring (minimal, from 8zc-headless) ───────────────────────
function lz76(str) {
  if (str.length <= 1) return str.length;
  let c = 1, l = 1, i = 0, k = 1, kmax = 1;
  while (true) {
    if (str[i + k - 1] === str[l + k - 1]) {
      k++; if (l + k > str.length) { c++; break; }
    } else {
      if (k > kmax) kmax = k; i++;
      if (i === l) { c++; l += kmax; if (l >= str.length) break; i = 0; k = 1; kmax = 1; }
      else k = 1;
    }
  }
  return c;
}

function fenComplexity(fen) { return lz76(fen.split(' ')[0]) / fen.split(' ')[0].length; }

function evalSeqStability(seq) {
  if (seq.length < 3) return 0.5;
  const deltas = seq.slice(1).map((v, i) => {
    const d = v - seq[i];
    return d > 15 ? 'A' : d > 5 ? 'B' : d > -5 ? 'C' : d > -15 ? 'D' : 'E';
  }).join('');
  return Math.max(0, Math.min(1, 1 - lz76(deltas) / Math.max(deltas.length, 1)));
}

function adsrShape(seq) {
  if (seq.length < 2) return 'unknown';
  const baseline = seq[0];
  const deltas = seq.map(v => v - baseline);
  const peak = Math.max(...deltas), peakIdx = deltas.indexOf(peak);
  const afterPeak = deltas.slice(peakIdx);
  const valley = Math.min(...afterPeak);
  const decay = peak - valley;
  const range = Math.max(...seq) - Math.min(...seq);
  const normalized = range > 0 ? Math.abs(decay) / range : 0;
  const startIdx = Math.max(1, Math.floor(deltas.length * 0.2));
  const endIdx = Math.max(startIdx + 2, Math.floor(deltas.length * 0.8));
  const sustain = deltas.slice(startIdx, endIdx).reduce((a, b) => a + b, 0) / Math.max(1, endIdx - startIdx);

  if (Math.abs(peak) < 10 && Math.abs(decay) < 10) return 'sustained';
  if (Math.abs(peak) > 20 && normalized > 0.5) return 'spike';
  if (peak > 10 && Math.abs(decay) < 10) return 'building';
  if (sustain < -10) return 'collapse';
  if (Math.abs(decay) > 15 && Math.abs(peak) > 15) return 'volatile';
  return 'mixed';
}

const W = { stability: 20, sustained: 10, building: 15, spike: -5, collapse: -20, volatile: -10, momentum_max: 5, complexity: 10 };

async function dccScore(fen, candidateMove) {
  const probe = new Chess(fen);
  const m = probe.move({ from: candidateMove.slice(0, 2), to: candidateMove.slice(2, 4),
    promotion: candidateMove.length > 4 ? candidateMove[4] : 'q' });
  if (!m) return null;

  const pv = await queryPV(probe.fen());
  if (!pv || pv.score === null) return null;

  // Build eval sequence
  const evalSeq = [pv.score];
  if (pv.pv.length > 0) {
    const walk = new Chess(probe.fen());
    const maxWalk = Math.min(40, pv.pv.length);
    for (let j = 0; j < maxWalk; j++) {
      const uci = pv.pv[j];
      const wm = walk.move({ from: uci.slice(0, 2), to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined });
      if (!wm) break;
      if (j % 2 === 1 || j === maxWalk - 1) {
        const sc = await queryScore(walk.fen());
        if (sc !== null) evalSeq.push((j % 2 === 0) ? -sc : sc);
      }
    }
  }

  const stability = evalSeqStability(evalSeq);
  const adsr = adsrShape(evalSeq);
  const momentum = evalSeq.length >= 3
    ? evalSeq.slice(2).reduce((s, v, i) => s + (v - evalSeq[i+1]) - (evalSeq[i+1] - evalSeq[i]), 0) / (evalSeq.length - 2) : 0;
  const cx = fenComplexity(probe.fen());
  const endEval = evalSeq[evalSeq.length - 1];

  let score = pv.score;
  score += stability * W.stability;
  score += W[adsr] || 0;
  score += Math.sign(momentum) * Math.min(Math.abs(momentum), W.momentum_max);
  score -= cx * W.complexity;

  return { dcc: Math.round(score), raw: pv.score, stability, adsr, endEval, evalLen: evalSeq.length };
}

// ─── Tree Builder ────────────────────────────────────────────────────
async function buildNode(fen, ply, maxPly) {
  if (ply >= maxPly) return null;

  const qa = await queryAll(fen);
  if (!qa || qa.moves.length === 0) return null;

  const side = new Chess(fen).turn() === 'w' ? 'White' : 'Black';
  const candidates = qa.moves.slice(0, Math.max(branches + 2, 5)); // score a few extra

  // DCC score each candidate
  const scored = [];
  for (const mv of candidates) {
    const dcc = await dccScore(fen, mv.move);
    if (dcc) {
      scored.push({ move: mv.move, raw: mv.score, ...dcc });
    } else {
      scored.push({ move: mv.move, raw: mv.score, dcc: mv.score, stability: 0.5, adsr: 'unknown', endEval: mv.score, evalLen: 1 });
    }
  }

  // Sort by selected mode, keep top N branches
  if (mode === 'endeval') {
    scored.sort((a, b) => b.endEval - a.endEval);
  } else if (mode === 'raw') {
    scored.sort((a, b) => b.raw - a.raw);
  } else {
    scored.sort((a, b) => b.dcc - a.dcc);
  }
  const kept = scored.slice(0, branches);
  const modeLabel = mode === 'endeval' ? 'EndEval' : mode === 'raw' ? 'Raw' : 'DCC';

  // Recursively build children
  const children = [];
  for (let i = 0; i < kept.length; i++) {
    const mv = kept[i];
    const probe = new Chess(fen);
    const m = probe.move({ from: mv.move.slice(0, 2), to: mv.move.slice(2, 4),
      promotion: mv.move.length > 4 ? mv.move[4] : 'q' });
    if (!m) continue;

    const san = m.san;
    const childFen = probe.fen();
    
    process.stdout.write(`  Ply ${ply+1}/${maxPly} ${side} ${san} (DCC:${mv.dcc} Raw:${mv.raw} End:${mv.endEval} stab:${mv.stability.toFixed(2)} ${mv.adsr})${i === 0 ? ` ★ ${modeLabel}#1` : ''}\n`);

    const subtree = await buildNode(childFen, ply + 1, maxPly);

    children.push({
      move: mv.move,
      san,
      raw: mv.raw,
      dcc: mv.dcc,
      endEval: mv.endEval,
      stability: +mv.stability.toFixed(3),
      adsr: mv.adsr,
      isTop1: i === 0,
      selectedBy: mode,
      children: subtree ? subtree.children : []
    });
  }

  return { fen, side, children };
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n  8Z Opening Book Generator`);
  console.log(`  Mode: ${mode.toUpperCase()} (${mode === 'dcc' ? 'structural health' : mode === 'endeval' ? 'best long-term eval' : 'highest immediate eval'})`);
  console.log(`  Depth: ${maxDepth} half-moves per side (${maxDepth * 2} ply total)`);
  console.log(`  Branches: ${branches} per node`);
  console.log(`  Output: ${outFile}\n`);

  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const tree = await buildNode(startFen, 0, maxDepth * 2);

  // Save
  const book = {
    format: '8z-openbook',
    version: '1.0',
    mode,
    generated: new Date().toISOString(),
    depth: maxDepth,
    branches,
    source: mode === 'dcc' ? 'ChessDB.cn + DCC governance' : mode === 'endeval' ? 'ChessDB.cn EndEval optimal' : 'ChessDB.cn Raw optimal',
    dcc_weights: mode === 'dcc' ? W : 'N/A (not used)',
    tree
  };

  writeFileSync(outFile, JSON.stringify(book, null, 2));
  saveCache();

  // Stats
  let nodes = 0, top1_count = 0;
  function countNodes(n) {
    if (!n) return;
    for (const c of n.children || []) {
      nodes++;
      if (c.isTop1) top1_count++;
      countNodes(c);
    }
  }
  countNodes(tree);

  console.log(`\n  Done!`);
  console.log(`  Mode: ${mode.toUpperCase()}`);
  console.log(`  Nodes: ${nodes}`);
  console.log(`  ${mode.toUpperCase()}#1 lines: ${top1_count}`);
  console.log(`  API calls: ${apiCalls}`);
  console.log(`  Output: ${outFile}`);
  console.log(`  Cache: ${Object.keys(cache).length} entries\n`);
}

main().catch(e => { console.error(e); saveCache(); });
