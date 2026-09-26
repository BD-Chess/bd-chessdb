/* Only this PWA's local game assets are cached. No other versions or API traffic. */
'use strict';
const PREFIX = 'flip4m-pwa-';
const CACHE = PREFIX + 'lab-2.1.2-v2';
const BASE = new URL('./', self.location.href);
const ASSETS = [
  '', 'index.html', 'manifest.webmanifest', 'pwa.js', 'f4m.css',
  'f4m-core.js', 'f4m-search.js', 'f4m-classical.js', 'f4m-dcc.js',
  'f4m-time.js', 'f4m-sim.js', 'f4m-store.js', 'f4m-ui.js',
  'f4m-worker.js', 'f4m-smart-time.js', 'release.json',
  'icon-192.png', 'icon-512.png', 'icon-180.png'
];
const allowed = new Set(ASSETS.map(asset => new URL(asset, BASE).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(ASSETS.map(asset => new Request(new URL(asset, BASE), { cache: 'reload' })))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !allowed.has(url.pathname)) return;
  const key = new URL(url.pathname, BASE.origin);
  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        await cache.put(key, fresh.clone());
        return fresh;
      }
      // HTTP failures resolve fetch; they need the same recovery as offline errors.
      const cached = await cache.match(key);
      return cached && cached.ok ? cached : fresh;
    } catch (error) {
      const cached = await cache.match(key);
      if (cached && cached.ok) return cached;
      throw error;
    }
  }));
});
