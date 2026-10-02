const RELEASE="cw-lab-d54cfda56bf06e5d";
const CACHE='8zCrosswords:LAB:'+RELEASE;
const CORE=["./","./index.html","./manifest.webmanifest","./release.json","./pwa.js","./icon.svg","../cw_puzzles_pack.js","../cw_puzzles_pack.json","../lex/cw_en.json"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('8zCrosswords:LAB:')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()});
const LAB_PATH=new URL('./',self.registration.scope).pathname;
const SHARED_PATH=new URL('../',self.registration.scope).pathname;
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==location.origin)return;const allowed=u.pathname.startsWith(LAB_PATH)||u.pathname===SHARED_PATH+'cw_puzzles_pack.js'||u.pathname===SHARED_PATH+'cw_puzzles_pack.json'||u.pathname===SHARED_PATH+'lex/cw_en.json';if(!allowed)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(resp=>{if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return resp;})))});
