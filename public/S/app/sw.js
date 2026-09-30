'use strict';

// BEGIN GENERATED RELEASE
const RELEASE = {
  "id": "c645c70f03d08cdb7180047ce719e1dba37880c1b51dca21b0804a660f6e97ff",
  "channel": "APP",
  "engine": "0.3.0",
  "assets": {
    "index.html": "36b865c16d277b533446cf336dd308834f66add974c3613991516e6ca13f507b",
    "app.html": "a011c61a06b8aeb00b66fc985bf79f174718cbe6b3997019c4389fb9785c6698",
    "pwa.js": "d2feeb0c3bd1f84cf152c855ce65fe54c7546c14da5da11ece44fda37db33e05",
    "manifest.webmanifest": "70b2d00def17d5a622eabc4e9589c5b81105863f4523ff89d2d4fe14ee9c00fb",
    "icon-180.png": "7b37fd37188cdabb964280c0894731403609d361fe84ee86e23d4a9132e5b2aa",
    "icon-192.png": "3b1c7cbba4868a6dcbf32fb0d50475185445950a1cafa11ab2d556aa894d2cfb",
    "icon-512.png": "85649c7a4201e274818dbc808530794ffacb3828195b04d01e69b6686769fdbc"
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
