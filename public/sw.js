'use strict';
const RELEASE='26869037b0068bf7bce9fa6c48c2a46724ad5a42';
const PREFIX='mdlxdcc-root-pwa:';
const BASE=new URL('./',self.registration.scope);
const CACHE=PREFIX+BASE.pathname+':'+RELEASE;
const FILES=[
  "index.html",
  "manifest.webmanifest",
  "pwa.js",
  "PWA/icon-192.png",
  "PWA/icon-512.png",
  "PWA/apple-touch-icon.png",
  "assets/ai8-lab-growth-20260929.webp",
  "assets/ai8-vision/r2/vision.css",
  "assets/ai8-vision/r2/vision.js",
  "assets/ai8-vision/r2/ai8-lab-growth-en-desktop-dark.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-en-desktop-light.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-en-mobile-dark.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-en-mobile-light.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-sl-desktop-dark.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-sl-desktop-light.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-sl-mobile-dark.webp",
  "assets/ai8-vision/r2/ai8-lab-growth-sl-mobile-light.webp",
  "pwa-release.json"
];
const URLS=FILES.map(p=>new URL(p,BASE).href);
const PATHS=new Set(URLS.map(x=>new URL(x).pathname));
const INDEX=new URL('index.html',BASE).href;
function ownRootNavigation(request){
 const u=new URL(request.url);
 return request.mode==='navigate'&&(u.pathname===BASE.pathname||u.pathname===new URL('index.html',BASE).pathname);
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const existed=(await caches.keys()).includes(CACHE);
 const cache=await caches.open(CACHE);
 try{await cache.addAll(URLS.map(u=>new Request(u,{cache:'reload'})));}
 catch(err){if(!existed)await caches.delete(CACHE);throw err;}
 if(!self.registration.active)await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n.startsWith(PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const r=event.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==BASE.origin)return;
 if(ownRootNavigation(r)){
  event.respondWith((async()=>{try{
   const net=await fetch(r);
   if(net.ok){event.waitUntil(caches.open(CACHE).then(c=>c.put(INDEX,net.clone())));return net;}
   throw Error('root navigation failed');
  }catch(_){return(await caches.open(CACHE)).match(INDEX);}})());return;
 }
 if(!PATHS.has(u.pathname))return;
 event.respondWith((async()=>{
  const c=await caches.open(CACHE),hit=await c.match(r,{ignoreSearch:true});
  if(hit)return hit;
  const net=await fetch(r);if(net.ok)event.waitUntil(c.put(r,net.clone()));return net;
 })());
});
