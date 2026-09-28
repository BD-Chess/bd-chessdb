/* Retirement worker for browsers that previously cached /chess/PWA/. */
'use strict';
const ROOT = new URL('./', self.location.href);
const LAB = new URL('../new/', ROOT);

self.addEventListener('install', event => {
  // The old cached page can serve itself forever without reaching the redirect.
  // Take over this retired scope so its next navigation reaches LAB.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const path = new URL(client.url).pathname;
      if (path === ROOT.pathname || path === new URL('index.html', ROOT).pathname) {
        try { await client.navigate(LAB.href); } catch (_) { /* Link works on next visit. */ }
      }
    }
    for (const name of await caches.keys()) {
      if (!name.startsWith('chessbest-lab-pwa-')) continue;
      const old = await caches.open(name);
      if (await old.match(new URL('index.html', ROOT))) await caches.delete(name);
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.mode !== 'navigate' || url.origin !== ROOT.origin ||
      (url.pathname !== ROOT.pathname && url.pathname !== new URL('index.html', ROOT).pathname)) return;
  event.respondWith(Response.redirect(LAB.href, 302));
});
