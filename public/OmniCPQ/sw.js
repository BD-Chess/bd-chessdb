// Only this application's reviewed, hash-verified shell. No API/auth/CPQ interception.
const RELEASE = '378d37f6da951ea62a69';
const APP_VERSION = '1.5.1-r6.2';
const ROOT = new URL('./', self.registration.scope);
const PREFIX = 'omnicpq-shell:' + ROOT.pathname + ':';
const CACHE = PREFIX + RELEASE;
const FILES = ["index.html","app.css","app.mjs","core.mjs","version.mjs","lifecycle-validation.mjs","prompts.mjs","starters.mjs","browser-bridge.mjs","browser-help.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-32.png","icons/original.png"];
const PATHS = new Map(FILES.map(name => [new URL(name, ROOT).pathname, name]));
PATHS.set(ROOT.pathname, 'index.html');
PATHS.set(new URL('browser-help',ROOT).pathname,'browser-help.html');
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
self.addEventListener('install', event => event.waitUntil((async () => {
  const manifestResponse = await fetch(new URL('shell-integrity.json', ROOT), { cache: 'no-store', credentials: 'omit' });
  if (!manifestResponse.ok) throw Error('Missing integrity manifest');
  const manifest = await manifestResponse.json();
  if (manifest.release !== RELEASE || Object.keys(manifest.files).length !== FILES.length) throw Error('Incomplete shell release');
  const prepared = await Promise.all(FILES.map(async name => {
    const url = new URL(name, ROOT), response = await fetch(url, { cache: 'reload', credentials: 'omit' });
    if (!response.ok || response.type === 'opaque' || response.redirected) throw Error('Incomplete shell');
    const bytes = await response.clone().arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== manifest.files[name]) throw Error('Invalid shell hash');
    return [url.href, response];
  }));
  try { const cache = await caches.open(CACHE); for (const [url, response] of prepared) await cache.put(url, response); }
  catch (e) { await caches.delete(CACHE); throw e; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
  if (event.data?.type === 'SHELL_STATUS') event.ports?.[0]?.postMessage({schema:'omnicpq.shell-status.v1',release:RELEASE,appVersion:APP_VERSION,files:FILES.length});
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), name = PATHS.get(url.pathname);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !name) return;
  event.respondWith((async () => (await (await caches.open(CACHE)).match(new URL(name, ROOT).href)) || fetch(event.request))());
});


