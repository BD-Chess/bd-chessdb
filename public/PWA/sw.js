'use strict';
// The worker controls only /PWA/. Other pages and APIs stay on the network.
const CACHE = 'mdlxdcc-home-pwa-20260925-1';
const HOME = new URL('./', self.location.href);
const FILES = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const ALLOWED = new Set(FILES.map(file => new URL(file, HOME).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, HOME))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mdlxdcc-home-pwa-') && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !ALLOWED.has(url.pathname) && url.pathname !== HOME.pathname) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(new URL('index.html', HOME), copy)));
      }
      return response;
    }).catch(() => caches.match(new URL('index.html', HOME))));
    return;
  }
  event.respondWith(caches.match(request, {ignoreSearch: true}).then(cached => cached || fetch(request)));
});
