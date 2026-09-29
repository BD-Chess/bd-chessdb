// APP waits for every controlled window to close before activating an update.
// No skipWaiting or clients.claim: an open game keeps its complete old release.
const ROOT = new URL('./', self.location.href);
const CACHE_NAME = PREFIX + RELEASE;
const CACHEABLE = new Set(ASSETS.map(path => new URL(path, ROOT).pathname));
CACHEABLE.add(ROOT.pathname);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Fetch checks integrity before any response enters this atomic batch.
      await cache.addAll(ASSETS.map(path => new Request(new URL(path, ROOT), {
        cache: 'reload', integrity: INTEGRITY[path]
      })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The same allowlist applies to navigation: never rewrite sibling channels.
  if (url.origin !== ROOT.origin || !CACHEABLE.has(url.pathname)) return;
  const path = url.pathname === ROOT.pathname ? 'index.html' : url.pathname.slice(ROOT.pathname.length);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(new URL(path, ROOT));
    // Missing release assets fail closed instead of mixing versions from PROD.
    return response || new Response('APP offline files are unavailable. Reconnect and reopen APP.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
