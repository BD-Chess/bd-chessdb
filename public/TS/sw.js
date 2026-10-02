const CACHE='ts-cpq-so-protected-r3';
const APP_SHELL=[
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-64.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;

  // Navigation: network-first so a repaired protected index is picked up immediately.
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        return resp;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Static app shell: cache-first.
  event.respondWith(
    caches.match(event.request).then(cached=>cached || fetch(event.request).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return resp;
    }))
  );
});
