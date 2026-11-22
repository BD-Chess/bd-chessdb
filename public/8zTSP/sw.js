// Packager replaces BUILD; scope is deliberately limited to this application.
'use strict';
const BUILD='ee08018aeabc14d965e5';
const BASE='/8zTSP/',PREFIX='8ztsp-pwa-',CACHE=PREFIX+BUILD;
const absolute=path=>new URL(path,self.location.origin+BASE).href;
let manifestPromise;
function manifest(){return manifestPromise??=(async()=>{const c=await caches.open(CACHE),r=await c.match(absolute('precache-manifest.json'));if(!r)throw Error('Missing offline manifest');return r.json();})();}
function isolated(response){return response.headers.get('Cross-Origin-Opener-Policy')==='same-origin' && response.headers.get('Cross-Origin-Embedder-Policy')==='require-corp';}
async function protectedPage(response){
  if(!response.ok || response.type==='opaque' || !isolated(response))return false;
  const text=await response.clone().text();
  return text.includes('BD_HTML_PROTECTOR_V3') && text.includes('bdhp-page-data') && !/<script\b[^>]*id\s*=\s*["']tsp8z-wasm-key["']/i.test(text);
}
async function checkedAsset(response,entry){
  if(!response.ok || response.type==='opaque')throw Error('Offline asset unavailable');
  const hash=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
  const sha=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  if(sha!==entry.sha256)throw Error('Offline asset changed during update');
  return response;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const response=await fetch(absolute('precache-manifest.json'),{cache:'no-store'});
  if(!response.ok)throw Error('Offline manifest unavailable');
  const info=await response.clone().json();if(info.version!==BUILD)throw Error('Offline version mismatch');
  // Fetch into this version's separate cache. The active old version remains untouched on failure.
  const cache=await caches.open(CACHE);
  try {
    await Promise.all(info.files.map(async entry=>{
      const url=absolute(entry.path);if(!url.startsWith(absolute('')) || entry.path.includes('..') || /(^|\/)api\//.test(entry.path))throw Error('Invalid offline asset');
      const asset=await checkedAsset(await fetch(url,{cache:'reload'}),entry);await cache.put(url,asset);
    }));
    const page=await fetch(absolute(''),{cache:'reload'});
    if(!await protectedPage(page))throw Error('Offline requires the protected page with isolation headers');
    // Store original response headers/body, never DOM/document.write output or a key block.
    await cache.put(absolute(''),page);
    await cache.put(absolute('precache-manifest.json'),response);
  }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(PREFIX) && name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());   // R53: WebKit may stop a worker started only for this message before it is through
  if(event.data?.type==='STATUS')event.waitUntil((async()=>{const c=await caches.open(CACHE);event.ports[0]?.postMessage({version:BUILD,assets:(await c.keys()).length});})());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==self.location.origin || !url.pathname.startsWith(BASE) || /(^|\/)api(?:\/|$)/.test(url.pathname))return;
  const isPage=request.mode==='navigate' && [BASE,BASE+'index.html'].includes(url.pathname);
  if(isPage){event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const bypass=url.searchParams.has('_u');
    try {
      const response=await fetch(bypass?url.href:request,bypass?{cache:'no-store',credentials:'same-origin'}:undefined);
      if(!response.ok)throw Error('Page unavailable');
      if(await protectedPage(response)){
        if(!bypass){
          // Keep the active old HTML/assets coherent until the user accepts the waiting version.
          const info=await fetch(absolute('precache-manifest.json'),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
          if(info && info.version!==BUILD){const old=await cache.match(absolute(''));if(old)return old;}
          await cache.put(absolute(''),response.clone());
        }
      }
      return response;
    }catch{const response=await cache.match(absolute(''));if(response)return response;return new Response('Offline page unavailable. Visit once online first.',{status:503,headers:{'Content-Type':'text/plain'}});}
  })());return;}
  // Only explicit, hashed static paths may be cached. Queries/dynamic requests bypass the cache.
  if(url.search)return;
  event.respondWith((async()=>{
    const info=await manifest(),relative=url.pathname.slice(BASE.length),entry=info.files.find(item=>item.path===relative);
    if(!entry)return fetch(request);
    const cache=await caches.open(CACHE),cached=await cache.match(url.href);
    if(cached)return cached;
    const response=await checkedAsset(await fetch(request),entry);await cache.put(url.href,response.clone());return response;
  })());
});
