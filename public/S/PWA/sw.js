'use strict';

// This worker controls only /S/PWA/. No other Sudoku versions or API requests are cached.
const CACHE_PREFIX = '8zsudoku-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const BASE_URL = self.registration.scope;
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './pwa.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];
const PATHS = new Set(ASSETS.map(asset => new URL(asset, BASE_URL).pathname));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.map(asset => new Request(new URL(asset, BASE_URL), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !PATHS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = new URL(url.pathname, self.location.origin).href;
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!url.search && response.type === 'basic') await cache.put(key, response.clone());
      return response;
    } catch (error) {
      const saved = await cache.match(key);
      if (saved) return saved;
      throw error;
    }
  })());
});
