/* Offline shell for the public Trip PWA only. Bump CACHE with every PWA asset change.
   No API, road response, or encrypted payload is persisted. */
const CACHE = '8z-trip-pwa-public-20260926-4';
const ROOT = new URL('./', self.location.href);
const SHELL = [
  'index.html', 'travel.html', 'travel.css', 'travel.js',
  'help.html', 'demo.html', 'demo.js',
  'style.css', 'locale.js', 'ui-text.js', 'tsp-catalog.js',
  'tsp-metric.js', 'tsp-library.js', 'tsp-optima.json', 'trips.js',
  'help.js', 'road-matrix.js', 'brute-force.js', 'shield-codec.js',
  'private-client.js', 'app.js', 'lab.js', 'worker.js',
  'air-distance.js', 'deep-search.js', 'diagnostics-export.js',
  'manifest.webmanifest', 'pwa.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'tsp/wi29.json', 'tsp/wi29.tsp', 'tsp/dj38.json', 'tsp/dj38.tsp',
  'tsp/qa194.json', 'tsp/qa194.tsp', 'tsp/uy734.json', 'tsp/uy734.tsp',
  'tsp/zi929.json', 'tsp/zi929.tsp', 'tsp/lu980.json', 'tsp/lu980.tsp',
  'tsp/rw1621.json', 'tsp/rw1621.tsp', 'tsp/mu1979.json', 'tsp/mu1979.tsp',
  'tsp/nu3496.json', 'tsp/nu3496.tsp'
];
const ALLOWED = new Set(SHELL.map(path => new URL(path, ROOT).pathname));
ALLOWED.add(ROOT.pathname);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(path => new Request(new URL(path, ROOT), {cache:'reload'})));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('8z-trip-pwa-public-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !ALLOWED.has(url.pathname)) return;
  // A shared trip may be carried in ?trip=. Never put query URLs in Cache Storage.
  const cacheKey = new URL(url.pathname === ROOT.pathname ? 'index.html' : url.pathname, ROOT);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(request);
      if (fresh.ok) return fresh;
      // Keep query/API responses out of storage, including failed HTTP responses.
      const fallback = await cache.match(cacheKey);
      return fallback && fallback.ok ? fallback : fresh;
    } catch (error) {
      const fallback = await cache.match(cacheKey);
      if (fallback && fallback.ok) return fallback;
      throw error;
    }
  })());
});
