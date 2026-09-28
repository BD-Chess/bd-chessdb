'use strict';

// BEGIN GENERATED RELEASE
const RELEASE = {
  "id": "a05440801b3ac954d92c4ab0b36575a1e68b0912ddf40fe062a4688134dfeb6e",
  "channel": "CURRENT",
  "engine": "frozen-proof-coach",
  "assets": {
    "index.html": "0af5b2293e8765f60f7bfef4066e07f853e432dc0104436659f87c9341c51357",
    "manifest.webmanifest": "9c2f843e6e1ea992d951944ca665b575494bb8ecf1dc16572dbe3723608f8efe",
    "_pwa/client.js": "14379d71aad8a0c97a5b739499e94cab83bbf19e2d880cd10adb39ef0f792ffc",
    "_pwa/i18n.js": "e1ea2357fd866c2376b3ab9b423b6bf08a7783c28bb76c4407d56aa6827be5c6",
    "_pwa/shell.css": "c2c4f904e9ddd3558aad392e1a76d75efbd380e20a8e9eb270ffac85955216f9",
    "_pwa/icon-180.png": "7b37fd37188cdabb964280c0894731403609d361fe84ee86e23d4a9132e5b2aa",
    "_pwa/icon-192.png": "3b1c7cbba4868a6dcbf32fb0d50475185445950a1cafa11ab2d556aa894d2cfb",
    "_pwa/icon-512.png": "85649c7a4201e274818dbc808530794ffacb3828195b04d01e69b6686769fdbc",
    "_pwa/current-ui.js": "0d0987025d612582cfcf2884b1751039f5e3b08486e961dcf4e48e8395ae5afd",
    "current/index.html": "2ba29dd1d45315edfad5d526a44bd10db904f4ca8bed28ca0394c634b07c7662",
    "current/pwa-bridge.js": "1d528a3c5c71d2021e8e84b5558de370134ee99dbc6109a444f36b9e108679c6",
    "current/payload/part-01.txt": "a85ab17f1200ff02557cfb0752ef59ace7abb456512ab3c52f758ed53335811f",
    "current/payload/part-02.txt": "f64cd2f29bae51fc648c0b99d1e8a6b5cad8c31e045cde8d68cb884ee0a6057a",
    "current/payload/part-03.txt": "c7b45837837d993ab66f4c8334ced8576be11fef5c795e1b0b2b7d3c2e3769dc",
    "current/payload/part-04.txt": "208943c3b661de84cb299961645be525a629ee9a3ab2b9d1cd34f908bcdd29a1",
    "current/payload/part-05.txt": "1d5c94b86daaf48d033003b797dc3390fa8eba9e06ddf5c034fb0a5c2c65df45",
    "current/payload/part-06.txt": "e3b1d2dc0e5e7ceac2434f8b58911e8967cc2982f39f2d182b5ccadbe604e56f",
    "current/payload/part-07.txt": "eee29e91fbc844335efd43af37939749a1f08187389c0ded096c5bfd762b9ddc",
    "current/payload/part-08.txt": "c9aa869eb7be9109c6841813da593dff9e0e1ae7276c1a9685d0c4d11205df87"
  }
};
// END GENERATED RELEASE

// Each worker serves one complete, hash-verified release in its own scope.
const BASE = new URL(self.registration.scope);
const CACHE_PREFIX = `8zsudoku-pwa-${encodeURIComponent(BASE.pathname)}-`;
const CACHE_NAME = CACHE_PREFIX + RELEASE.id;
const FILES = new Map(Object.keys(RELEASE.assets).map(name => [new URL(name, BASE).pathname, name]));
for (const name of Object.keys(RELEASE.assets)) if (name.endsWith('index.html')) FILES.set(new URL(name.slice(0, -10), BASE).pathname, name);
const assetURL = name => new URL(name, BASE).href;
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Verify the whole new release before opening its cache. A stale or partial
    // deployment cannot replace the already installed offline release.
    const verified = await Promise.all(Object.entries(RELEASE.assets).map(async ([name, digest]) => {
      const response = await fetch(new Request(assetURL(name), { cache: 'reload' }));
      if (!response.ok || response.type === 'opaque') throw Error(`PWA asset unavailable: ${name}`);
      if (await sha256(await response.clone().arrayBuffer()) !== digest) throw Error(`PWA asset hash mismatch: ${name}`);
      return [name, response];
    }));
    const existed = (await caches.keys()).includes(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try { await Promise.all(verified.map(([name, response]) => cache.put(assetURL(name), response))); }
    catch (error) { if (!existed) await caches.delete(CACHE_NAME); throw error; }
    // No skipWaiting: update after a deliberate click, or after old clients close.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    // v1 used a global name. Delete only a cache wholly owned by this scope.
    if (names.includes('8zsudoku-pwa-v1')) {
      const legacy = await caches.open('8zsudoku-pwa-v1');
      if (await legacy.match(assetURL('app.html'))) {
        const keys = await legacy.keys();
        if (keys.every(request => { const url = new URL(request.url); return url.origin === BASE.origin && url.pathname.startsWith(BASE.pathname); })) await caches.delete('8zsudoku-pwa-v1');
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'GET_RELEASE') event.source?.postMessage({ type: 'PWA_RELEASE', id: RELEASE.id, engine: RELEASE.engine });
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !FILES.has(url.pathname)) return;
  const name = FILES.get(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(assetURL(name));
    if (saved) return saved;
    // Repair an evicted entry only with bytes from this exact release.
    const response = await fetch(new Request(assetURL(name), { cache: 'reload' }));
    if (!response.ok || response.type === 'opaque' || await sha256(await response.clone().arrayBuffer()) !== RELEASE.assets[name]) throw Error('PWA release unavailable; reconnect and update');
    await cache.put(assetURL(name), response.clone());
    return response;
  })());
});
