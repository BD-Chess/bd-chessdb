/* This worker controls only /chess/PWA/. Online APIs and authentication are never cached. */
'use strict';
const PREFIX = 'chessbest-lab-pwa-';
const CACHE_NAME = PREFIX + '2026-09-24-1';
const ROOT = new URL('./', self.location.href);
const ASSETS = [
  "8zc-about.html",
  "8zc-help.html",
  "8zc-pgn.html",
  "8zc-why.html",
  "Games/AnandV_Selected.pgn",
  "Games/AronianL_Selected.pgn",
  "Games/CapablancaJ_Selected.pgn",
  "Games/CarlsenM_Selected.pgn",
  "Games/CaruanaF_Selected.pgn",
  "Games/Chess_Openings_Top_Lines.pgn",
  "Games/DingL_Selected.pgn",
  "Games/FirouzjaA_Selected.pgn",
  "Games/FischerB_Selected.pgn",
  "Games/GukeshD_Selected.pgn",
  "Games/KasparovG_Selected.pgn",
  "Games/KramnikV_Selected.pgn",
  "Games/LaskerE_Selected.pgn",
  "Games/NakamuraH_Selected.pgn",
  "Games/NepomniachtchiI_Selected.pgn",
  "Games/Openings/8zC-book_dcc.pgn",
  "Games/Openings/8zC-endeval.pgn",
  "Games/Openings/8zC-raw.pgn",
  "Games/PolgarJ_Selected.pgn",
  "Games/Stockfish_Selected.pgn",
  "Games/TCEC/TCEC_Season_27_-_Superfinal_97_clean.pgn",
  "Games/TCEC/TCEC_Season_27_-_Superfinal_97_opt.pgn",
  "Games/TCEC/TCEC_Season_27_-_Superfinal_97_org.pgn",
  "Games/TCEC/TCEC_SuFi_Gane_Collection.pgn",
  "Games/TCEC_Cup14_SF_vs_Lc0_2024.pgn",
  "Games/TCEC_Cup14_WhiteWins_2024.pgn",
  "Games/TCEC_Season27_BlackWins_2022.pgn",
  "Games/TCEC_Season27_WhiteWins_2022.pgn",
  "Games/TCEC_SuFi_and_Stockfish.pgn",
  "Games/TopLines/8zC-book_dcc_flat.pgn",
  "Games/TopLines/8zC-book_endeval_flat.pgn",
  "Games/TopLines/8zC-book_raw_flat.pgn",
  "Games/TopLines/Nf3_top_26_moves.pgn",
  "Games/TopLines/c4_top_43_moves.pgn",
  "Games/TopLines/d4_top_22_moves.pgn",
  "Games/TopLines/d4_top_27_moves.pgn",
  "Games/TopLines/e4_top_62_moves.pgn",
  "Games/Various_Games.pgn",
  "config/bots.json",
  "config/coach.json",
  "css/8zc-deep.css",
  "css/8zc-research.css",
  "css/8zc-study.css",
  "css/8zc-styles.css",
  "css/chessboard-1.0.0.min.css",
  "facts.html",
  "games-info.html",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "img/chesspieces/wikipedia/bB.png",
  "img/chesspieces/wikipedia/bK.png",
  "img/chesspieces/wikipedia/bN.png",
  "img/chesspieces/wikipedia/bP.png",
  "img/chesspieces/wikipedia/bQ.png",
  "img/chesspieces/wikipedia/bR.png",
  "img/chesspieces/wikipedia/wB.png",
  "img/chesspieces/wikipedia/wK.png",
  "img/chesspieces/wikipedia/wN.png",
  "img/chesspieces/wikipedia/wP.png",
  "img/chesspieces/wikipedia/wQ.png",
  "img/chesspieces/wikipedia/wR.png",
  "index.html",
  "js/8zc-benchmark.js",
  "js/8zc-dcc-core.js",
  "js/8zc-deep-engine.js",
  "js/8zc-deep-ui.js",
  "js/8zc-eval-bar.js",
  "js/8zc-evidence.js",
  "js/8zc-gemini.js",
  "js/8zc-lab-layout.js",
  "js/8zc-new-ui.js",
  "js/8zc-research-ui.js",
  "js/8zc-sim-core.js",
  "js/8zc-study-core.js",
  "js/8zc-study-ui.js",
  "js/8zc-time-core.js",
  "js/8zc-utils.js",
  "js/8zc-workspace.js",
  "js/boardManager.js",
  "js/chess.min.js",
  "js/chessboard-1.0.0.min.js",
  "js/evalOverlay.js",
  "js/gameLoader.js",
  "js/init.js",
  "js/jquery-3.6.0.min.js",
  "js/pgnIO.js",
  "js/state.js",
  "js/uiSettings.js",
  "manifest.webmanifest",
  "pwa.js",
  "research/benchmark-fixtures.json",
  "vendor/stockfish/AUTHORS",
  "vendor/stockfish/Copying.txt",
  "vendor/stockfish/README.md",
  "vendor/stockfish/UPSTREAM_README.md",
  "vendor/stockfish/provenance.json",
  "vendor/stockfish/stockfish-18-lite-single.js",
  "vendor/stockfish/stockfish-18-lite-single.wasm"
];
const CACHEABLE = new Set(ASSETS.map(path => new URL(path, ROOT).pathname));
CACHEABLE.add(ROOT.pathname);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Include the browser engine in the first download. "Offline ready" is shown
    // only after the entire shell, PGN library and Stockfish WASM are cached.
    await cache.addAll(ASSETS.map(path => new Request(new URL(path, ROOT), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin || !CACHEABLE.has(url.pathname)) return;
  const path = url.pathname === ROOT.pathname ? 'index.html' : url.pathname.slice(ROOT.pathname.length);
  const cacheKey = new URL(path, ROOT);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' && !url.search) {
        await cache.put(cacheKey, response.clone());
      }
      return response.ok ? response : (await cache.match(cacheKey)) || response;
    } catch (error) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      throw error;
    }
  })());
});
