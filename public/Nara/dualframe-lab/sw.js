/* Path-scoped installable DualFrame package. Only the public app shell is cached. */
const BUILD_LABEL='2026-10-14-r4.6';
const PACKAGE_SHA='506a330546556292973cfdaa11fdd70252d537236542a4b7490f53b75af62f63';
const ASSETS=["./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png","./styles.css?v=3.0-r5.4","./app.mjs?v=3.0-r4.6","./image-cache.mjs?v=3.0-r1","./api-client.mjs?v=3.0-r4","./core.mjs?v=3.0-r4","./store.mjs?v=3.0-r4.3","./settings.mjs?v=3.0-r2","./mock.mjs?v=3.0-r4","./models.mjs?v=3.0-r4","./showcase.mjs?v=3.0-r4","./jobs.mjs?v=3.0-r4","./zip-store.mjs?v=3.0-r4.1","./pair.schema.json","./release.json"];
const BASE=new URL('./',self.location.href);
const PREFIX='dualframe:'+BASE.pathname+':';
const CACHE=PREFIX+BUILD_LABEL+':'+PACKAGE_SHA;
const INDEX=new URL('./index.html',BASE).href;
const URLS=ASSETS.map(path=>new URL(path,BASE).href);
const URL_SET=new Set(URLS);
async function complete(cache){for(const url of URLS)if(!await cache.match(url))return false;return true;}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 if(await complete(cache))return;
 await caches.delete(CACHE);
 const fresh=await caches.open(CACHE);
 try{
  for(const url of URLS){
   const response=await fetch(url,{cache:'reload',credentials:'omit'});
   if(!response.ok||response.type==='opaque')throw Error('Incomplete DualFrame offline package: '+url);
   await fresh.put(url,response);
  }
 }catch(error){await caches.delete(CACHE);throw error;}
})()));
async function activeBuilds(){
 const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>new URL(client.url).pathname.startsWith(BASE.pathname));
 const builds=await Promise.all(clients.map(client=>new Promise(resolve=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1500);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(typeof event.data?.build==='string'?event.data.build:null);};
  client.postMessage({type:'PAGE_BUILD'},[channel.port2]);
 })));
 return {clients,builds};
}
async function clearOldPackages(){
 const {builds}=await activeBuilds();
 if(builds.some(build=>build===null))return;
 const keep=new Set([CACHE,...builds.map(build=>PREFIX+build)]);
 const old=(await caches.keys()).filter(name=>name.startsWith(PREFIX)&&!keep.has(name)).sort();
 if(old.length)keep.add(old[old.length-1]);
 await Promise.all((await caches.keys()).filter(name=>name.startsWith(PREFIX)&&!keep.has(name)).map(name=>caches.delete(name)));
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();await clearOldPackages();})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_SAVED')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='VERIFY_PACKAGE')event.waitUntil((async()=>{const cache=await caches.open(CACHE),ready=await complete(cache);event.ports[0]?.postMessage({ready,build:BUILD_LABEL+':'+PACKAGE_SHA,scope:BASE.pathname});if(ready)await clearOldPackages();})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||request.headers.has('authorization'))return;
 if(url.pathname.startsWith('/api/df/')||url.pathname.startsWith('/.netlify/functions/'))return;
 if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(URL_SET.has(url.href)){
  event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(url.href);return saved||fetch(request);})());
  return;
 }
 if(request.mode==='navigate'){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(INDEX)||fetch(request);})());
 }
});
