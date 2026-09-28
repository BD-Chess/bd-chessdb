'use strict';

// BEGIN GENERATED RELEASE
const RELEASE = {
  "id": "60aca82fead4df9b6ce24afe085659581118c535e5fab9134b7753f9493f69d2",
  "channel": "LAB",
  "engine": "0.3.0",
  "assets": {
    "index.html": "1dfee06444cf10ca6e077f88b51e01cad2b495aaeae2a05abf3685cc492e5cb0",
    "manifest.webmanifest": "d7c7f785f2e80cedf1d39e666729d0693587c282a43ce17de6d95ba004d31cfb",
    "../_pwa/client.js": "8d8213622b67fd5b8d8f0819466df6c397036e803ed5414ba6b8555e9065672d",
    "../_pwa/i18n.js": "a72594e73f198bd46b7b3d347ebcff57506436c7e63fab29244b0fcea87c31cb",
    "../_pwa/shell.css": "c2c4f904e9ddd3558aad392e1a76d75efbd380e20a8e9eb270ffac85955216f9",
    "../_pwa/icon-180.png": "7b37fd37188cdabb964280c0894731403609d361fe84ee86e23d4a9132e5b2aa",
    "../_pwa/icon-192.png": "3b1c7cbba4868a6dcbf32fb0d50475185445950a1cafa11ab2d556aa894d2cfb",
    "../_pwa/icon-512.png": "85649c7a4201e274818dbc808530794ffacb3828195b04d01e69b6686769fdbc",
    "app.html": "cb3d4c18ee8c89018a21da498501bb02818531e2b85e8af3e8025fe6c3718bbc"
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
