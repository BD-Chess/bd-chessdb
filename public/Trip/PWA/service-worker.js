const OWN_PREFIX='8z-trip-pwa-public-';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const keys=await caches.keys();
   await Promise.all(keys.filter(key=>key.startsWith(OWN_PREFIX)).map(key=>caches.delete(key)));
   await self.registration.unregister();
   await self.clients.claim();
 })());
});
