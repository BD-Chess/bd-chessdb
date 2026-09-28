'use strict';

// BEGIN GENERATED RELEASE
const RELEASE = {
  "id": "b718ef65d6e90ea34c2dcf5d2bfdb18b4188b7df90700769fb5a7869e6dbc78c",
  "channel": "LAB",
  "engine": "0.3.0",
  "assets": {
    "index.html": "981b0b1b63d410c12167097100332dfcd2b0a9964c92f364e47219214e2ffc77",
    "manifest.webmanifest": "d7c7f785f2e80cedf1d39e666729d0693587c282a43ce17de6d95ba004d31cfb",
    "../_pwa/client.js": "14379d71aad8a0c97a5b739499e94cab83bbf19e2d880cd10adb39ef0f792ffc",
    "../_pwa/i18n.js": "e1ea2357fd866c2376b3ab9b423b6bf08a7783c28bb76c4407d56aa6827be5c6",
    "../_pwa/shell.css": "c2c4f904e9ddd3558aad392e1a76d75efbd380e20a8e9eb270ffac85955216f9",
    "../_pwa/icon-180.png": "7b37fd37188cdabb964280c0894731403609d361fe84ee86e23d4a9132e5b2aa",
    "../_pwa/icon-192.png": "3b1c7cbba4868a6dcbf32fb0d50475185445950a1cafa11ab2d556aa894d2cfb",
    "../_pwa/icon-512.png": "85649c7a4201e274818dbc808530794ffacb3828195b04d01e69b6686769fdbc",
    "app.html": "fbd9b29d014da85c6dba3284ae24fb49010aa03c1f63c216563710d966b0766d"
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
