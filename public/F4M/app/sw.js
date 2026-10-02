const BUILD="retired-2.6.0";
const ASSETS=["","index.html","manifest.webmanifest","release.json","retirement.js"];
/* GENERATED CONFIG above. Cache ownership never extends to another channel. */
const BASE=new URL('./',self.location.href), PREFIX='flip4m-petrol:'+BASE.pathname+':', CACHE=PREFIX+BUILD;
const URLS=ASSETS.map(p=>new URL(p,BASE).href);
const normalize=request=>{const u=new URL(request.url);u.search='';u.hash='';return u.href;};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{for(const url of URLS){const response=await fetch(url,{cache:'reload'});if(!response.ok||response.type==='opaque')throw Error('Incomplete offline package: '+url);await cache.put(url,response);}}
 catch(error){await caches.delete(CACHE);throw error;}
 // No skipWaiting: installing an update cannot interrupt an active game.
})()));
async function collectUnused(){
 const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>new URL(c.url).pathname.startsWith(BASE.pathname));
 const builds=await Promise.all(clients.map(client=>new Promise(resolve=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();resolve(null);},1800);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(typeof e.data?.build==='string'?e.data.build:null);};client.postMessage({type:'PAGE_BUILD'},[c.port2]);})));
 if(builds.some(b=>b===null))return; // An unknown active tab pins history rather than risking its data.
 const keep=new Set([CACHE,...builds.map(b=>PREFIX+b)]);
 await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&!keep.has(k)).map(k=>caches.delete(k)));
}
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_SAVED')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='VERIFY_PACKAGE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);let ready=true;for(const url of URLS)if(!await cache.match(url)){ready=false;break;}event.ports[0]?.postMessage({ready,build:BUILD,scope:BASE.pathname});if(ready)await collectUnused();})());
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const key=normalize(event.request),url=new URL(key);
 const shared=url.origin===BASE.origin&&url.pathname.startsWith(new URL('../_shared/',BASE).pathname);
 if(!URLS.includes(key)&&!shared)return;
 event.respondWith((async()=>{
  const current=await(await caches.open(CACHE)).match(key);if(current)return current;
  // Other open tabs may still execute a prior version after an opt-in update.
  for(const name of(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE)){
   const old=await(await caches.open(name)).match(key);if(old)return old;
  }
  return fetch(event.request);
 })());
});
