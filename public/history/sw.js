'use strict';
const RELEASE={
  "id": "892c1da017228f415dd4e480569fb81df44c23dbf5ff355191497812f94c0206",
  "assets": {
    "01_deep_humanity_300000_20000_bce.html": "25e3969e91f4c6596fa9baf5c615c7c5bbfd62649a60cc6c0a9b0ad92385cc42",
    "02_ice_age_transition_20000_10000_bce.html": "9cfb6d83d39241face4dd0c0a52ab3056aa5265c85f6c040e84093f1f94c5750",
    "03_agriculture_10000_3000_bce.html": "4d19af3873b8aac7e36bafd4c6eb72e7a5501f193c6e1c36cb333e1ee056eb64",
    "04_ancient_world_3000_1000_bce.html": "3949723af629f2f1af0838d9f2a678f119a8fdc25b2c8de649f52760989d8a12",
    "05_classical_world_1000_bce_500_ce.html": "e68ee86304d76c5cad83608c36d2c99c770b5e12af64834bf048d1b23e49ecdb",
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
