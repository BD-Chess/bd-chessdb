/* Legacy identity retained. No skipWaiting/claim; active legacy games keep running. */
const BASE=new URL('./',self.location.href),CACHE='flip4m-migration-violet-2.2.0:'+BASE.pathname;
const ASSETS=['','index.html','migration.js','f4m-store.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].map(p=>new URL(p,BASE).href);
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);try{await c.addAll(ASSETS);}catch(err){await caches.delete(CACHE);throw err;}})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);u.search='';if(!ASSETS.includes(u.href))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(u.href)||fetch(e.request);})());});
