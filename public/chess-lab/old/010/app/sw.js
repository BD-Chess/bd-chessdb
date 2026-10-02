/* Retirement worker: the former separate ChessBest APP is now the mobile/native mode of LAB. */
'use strict';
const ROOT=new URL('./',self.registration.scope);
const TARGET=new URL("../../chess-lab/",ROOT);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const name of await caches.keys())if(name.startsWith('chessbest-chess-app-'))await caches.delete(name);for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){const url=new URL(client.url);if(url.pathname.startsWith(ROOT.pathname))try{await client.navigate(TARGET.href)}catch(_){}}await self.registration.unregister();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname))event.respondWith(Response.redirect(TARGET.href,302));});
