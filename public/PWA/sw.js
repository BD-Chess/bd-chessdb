'use strict';
// Retire the former /PWA/ application. The current PWA is /index.html.
const OLD_PREFIX='mdlxdcc-home-pwa-';
const LEGACY=new URL('./',self.registration.scope);
const MAIN=new URL('../',LEGACY);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n.startsWith(OLD_PREFIX)).map(n=>caches.delete(n)));
 await self.registration.unregister();
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 await Promise.all(clients.filter(c=>{
  const u=new URL(c.url);
  return u.origin===MAIN.origin&&u.pathname.startsWith(LEGACY.pathname);
 }).map(c=>c.navigate(MAIN.href).catch(()=>{})));
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||req.mode!=='navigate')return;
 const url=new URL(req.url);
 if(url.origin!==LEGACY.origin||!url.pathname.startsWith(LEGACY.pathname))return;
 // A redirect changes the document URL, so ./pwa.js resolves at the root.
 event.respondWith(Promise.resolve(Response.redirect(MAIN.href,302)));
});
