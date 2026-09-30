'use strict';
const RELEASE={
  "id": "9d8c1b709617a1ec266d6ee83dfed38e7b3db25343b38043d8dad8525d1a5fbe",
  "assets": {
    "01_deep_humanity_300000_20000_bce.html": "251aa7a41a6a039a0143c3dc5fcb69a766f69ed67ef0edea53e2409b83a79244",
    "02_ice_age_transition_20000_10000_bce.html": "74e6feabfb94e66e0fa16f586133fe4e8e8338c5c3b889d218d8a473cb0ab9fb",
    "03_agriculture_10000_3000_bce.html": "d1bdee8d193856e6bc3f410e6d6c89267e3ec226dce634d5e49a3dca42e4dbc1",
    "04_ancient_world_3000_1000_bce.html": "93ebb8c399d087c4163ba2c9615ab04b8818c5510d7516ec467622a0dd800696",
    "05_classical_world_1000_bce_500_ce.html": "70862a61ca47437ceb41ac597f35abe0819f184e4393b32cdce562068c5660f7",
    "06_medieval_world_500_1500.html": "27a3395fa19631607dec96f74756d3f99266c39c08a3230aea8dbce618b68356",
    "07_early_modern_1500_1800.html": "a383207ac9e811ab965c08714022fa7e9acd1e7844373b3173d67e0dd1ca7adc",
    "08_industrial_age_1800_1900.html": "d923641417a046a30458ac1d29c65a2d8c47e8a191d766e36b421c7d0376b045",
    "09_machine_age_1900_2000.html": "edd1fd394f25414829c3c08ee52bccf2aeca9429e40f7b0437c955f159129e52",
    "10_digital_ai_age_2000_2026.html": "f7137de0007d0ae197e2954e3d43cf09552ea0857bdf8ea71dbf5ffec73e5909",
    "11_one_possible_branch_2026_2036.html": "b6bc0a65d21a9cee4c077d861fc69f55dda756e10012070f8ebd6a8621c167e1",
    "about.html": "5b4a1b7b8d55145b64b46b81cfe4ae455ea4f2d03a2462b57b38e321b67f6f51",
    "changelog.html": "d6e0dc340835f13eded348c0f37ddf3d179957f139afbfaa6bbf2fd28b1c9b2f",
    "glossary.html": "2a607f18ddae1b8176df042ecccdebeb6291e0bf7c1158040a5419a16458e239",
    "index.html": "b876f916a7b68a7287529c6e5a81bf1710b4a56e0619a5421f6412b26781d54a",
    "methodology.html": "aab1605fbb731858a73c39178861e6ddcc52b766cb29645659aba320b1332c14",
    "timeline.html": "e58439c0e6f07640c9f1a27229543bc26a7a90de27f35dc2c91cdd057d569121",
    "manifest.webmanifest": "f87e184a6429d469747ef11a6bfc1e55d490abce0e07102b417e6f326bfa26cc",
    "pwa.css": "18582fea6bd9d3b27f63708f2f23e658b11b365778cdf2dda308e7ef463176ee",
    "pwa.js": "48af6349b1269e0d5bb2bfd9541a09304f2726655837bc55fc4ddd0165fac502",
    "icon-180.png": "9c8747c55c8409bcdf63c880f4ac4d3db4657798431056bd6ac9df95798f8bf5",
    "icon-192.png": "c5ce9c4ff78f1085c1b923d9632c071d4d8bf31511739a233d1c939ad6b8c4a7",
    "icon-512.png": "342f83eb4bcfc0e6415a71b37f9b5c0d25bad0647d3a6b69032a4641df2d01ed"
  }
};
const BASE=new URL(self.registration.scope),PREFIX='humanity-history-pwa-',CACHE=PREFIX+RELEASE.id,FILES=new Map(Object.keys(RELEASE.assets).map(function(n){return[new URL(n,BASE).pathname,n]}));FILES.set(BASE.pathname,'index.html');FILES.set(new URL('index.html',BASE).pathname,'index.html');
const au=function(n){return new URL(n,BASE).href},digest=async function(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),function(x){return x.toString(16).padStart(2,'0')}).join('')};
async function vf(n){const r=await fetch(new Request(au(n),{cache:'reload'}));if(!r.ok||r.type==='opaque')throw Error('History asset unavailable: '+n);if(await digest(await r.clone().arrayBuffer())!==RELEASE.assets[n])throw Error('History asset hash mismatch: '+n);return r}
self.addEventListener('install',function(e){e.waitUntil((async function(){const all=await Promise.all(Object.keys(RELEASE.assets).map(async function(n){return[n,await vf(n)]})),had=(await caches.keys()).includes(CACHE),c=await caches.open(CACHE);try{await Promise.all(all.map(function(x){return c.put(au(x[0]),x[1])}))}catch(err){if(!had)await caches.delete(CACHE);throw err}if(!self.registration.active)await self.skipWaiting()})())});
self.addEventListener('activate',function(e){e.waitUntil((async function(){const ns=await caches.keys();await Promise.all(ns.filter(function(n){return n.startsWith(PREFIX)&&n!==CACHE}).map(function(n){return caches.delete(n)}));await self.clients.claim()})())});
self.addEventListener('fetch',function(e){const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==BASE.origin)return;const n=FILES.get(u.pathname);if(!n)return;e.respondWith((async function(){const c=await caches.open(CACHE),s=await c.match(au(n));if(s)return s;const x=await vf(n);await c.put(au(n),x.clone());return x})())});
