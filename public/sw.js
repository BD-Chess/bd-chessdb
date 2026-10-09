'use strict';
// MDLxDCC root PWA v2. Scope is the site root (or its GitHub Pages project prefix).
// Only the homepage and its public assets are cached; APIs and other apps are untouched.
const VERSION='root-20261009-r3';
const FAMILY='mdlxdcc-root-pwa:';
const BASE=new URL('./',self.registration.scope);
const CACHE=FAMILY+BASE.pathname+':'+VERSION;
const HOME=new URL('index.html',BASE);
const SHELL=[
 'index.html','manifest.webmanifest','pwa.js','pwa-release.json',
 'PWA/icon-192.png','PWA/icon-512.png','PWA/apple-touch-icon.png',
 'assets/ai8-vision/r2/vision-r4.css',
 'assets/ai8-vision/r2/vision-r4.js',
 'assets/human-middle/v5/human-middle-family-r1.css',
 'assets/human-middle/v5/human-middle-series-r1.js',
 'assets/human-middle/v5/human-middle-explanations-r1.js',
 'assets/human-middle/v5/human-middle-r13-family.js'
];
const SHELL_PATHS=new Set(SHELL.map(p=>new URL(p,BASE).pathname));
const MEDIA_PREFIXES=['assets/human-middle/','assets/ai8-vision/r2/'].map(p=>new URL(p,BASE).pathname);
const AI8_HERO=new URL('assets/ai8-lab-growth-20260929.webp',BASE).pathname;
const MEDIA_LIMIT=24;
function isMedia(path){
 return (path===AI8_HERO||MEDIA_PREFIXES.some(p=>path.startsWith(p)))&&/\.(?:webp|png|jpe?g)$/i.test(path);
}
function keyFor(url){return new Request(url.origin+url.pathname)}
async function remember(key,response,media){
 try{
  const cache=await caches.open(CACHE);
  await cache.put(key,response);
  if(media){
   const keys=await cache.keys();
   const images=keys.filter(k=>isMedia(new URL(k.url).pathname));
   await Promise.all(images.slice(0,Math.max(0,images.length-MEDIA_LIMIT)).map(k=>cache.delete(k)));
  }
 }catch(_){/* Storage quota is best-effort; do not break an online response. */}
}
async function fromNetwork(event,key,media){
 try{
  // Bypass HTTP cache for both Netlify and GitHub Pages. A cached response is
  // a fallback only after an actual network failure, never the online default.
  const response=await fetch(event.request,{cache:'no-store'});
  if(response.ok)event.waitUntil(remember(key,response.clone(),media));
  return response;
 }catch(_){
  const cache=await caches.open(CACHE);
  return await cache.match(key,{ignoreSearch:true})||Response.error();
 }
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  await Promise.all(SHELL.map(async path=>{
   const url=new URL(path,BASE);
   const response=await fetch(new Request(url,{cache:'no-store'}));
   if(!response.ok)throw new Error('PWA shell unavailable: '+path+' ('+response.status+')');
   await cache.put(new Request(url),response);
  }));
 }catch(error){
  await caches.delete(CACHE);
  throw error; // Preserve the previous working worker on incomplete deployments.
 }
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n.startsWith(FAMILY)&&n!==CACHE).map(n=>caches.delete(n)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const r=event.request;
 if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.origin!==BASE.origin)return;
 if(r.mode==='navigate'){
  if(u.pathname===BASE.pathname||u.pathname===HOME.pathname){
   event.respondWith(fromNetwork(event,new Request(HOME),false));
  }
  return; // Do not take over other websites/apps under this origin.
 }
 const media=isMedia(u.pathname);
 if(!media&&!SHELL_PATHS.has(u.pathname))return;
 event.respondWith(fromNetwork(event,keyFor(u),media));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='MDLX_ROOT_PWA_VERSION')
  event.source?.postMessage({type:'MDLX_ROOT_PWA_VERSION',version:VERSION});
 if(event.data?.type==='MDLX_ROOT_PWA_ACTIVATE')self.skipWaiting();
});

