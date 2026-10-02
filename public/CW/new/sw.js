const RELEASE="cw-lab-064a5f1ff1b7ff17";
const CACHE='8zCrosswords:LAB:'+RELEASE;
const CORE=["./","./index.html","./manifest.webmanifest","./release.json","./pwa.js","./icon.svg","../cw_puzzles_pack.js","../cw_puzzles_pack.json","../lex/cw_en.json"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('8zCrosswords:LAB:')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const u=new URL(event.request.url);if(u.origin!==location.origin)return;const allowed=u.pathname.startsWith('/CW/new/')||u.pathname==='/CW/cw_puzzles_pack.js'||u.pathname==='/CW/cw_puzzles_pack.json'||u.pathname==='/CW/lex/cw_en.json';if(!allowed)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(resp=>{if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return resp;})))});
