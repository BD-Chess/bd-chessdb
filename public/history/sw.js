'use strict';
const RELEASE={
  "id": "556116db7541b703f751216c3c0eb5ae0b9c37d01d1dfe72a464c9a0eab40454",
  "assets": {
    "01_deep_humanity_300000_20000_bce.html": "25e3969e91f4c6596fa9baf5c615c7c5bbfd62649a60cc6c0a9b0ad92385cc42",
    "02_ice_age_transition_20000_10000_bce.html": "9cfb6d83d39241face4dd0c0a52ab3056aa5265c85f6c040e84093f1f94c5750",
    "03_agriculture_10000_3000_bce.html": "4d19af3873b8aac7e36bafd4c6eb72e7a5501f193c6e1c36cb333e1ee056eb64",
    "04_ancient_world_3000_1000_bce.html": "3949723af629f2f1af0838d9f2a678f119a8fdc25b2c8de649f52760989d8a12",
    "05_classical_world_1000_bce_500_ce.html": "e68ee86304d76c5cad83608c36d2c99c770b5e12af64834bf048d1b23e49ecdb",
    "06_medieval_world_500_1500.html": "863da2c762e1d41a8f3a05db13cf9d637364a74e53c83a23d63c52d4673a4ac7",
    "07_early_modern_1500_1800.html": "ea84fc904a835ee413ae6baa2cdb5ed2240ed9e8f28975869c102ef61b430281",
    "08_industrial_age_1800_1900.html": "ed4fc194d514e01818672d8f7146ef221e3b53a01715bc515ddf282b7a99deec",
    "09_machine_age_1900_2000.html": "cc48da5b3f15fe9d477890e8ce4f249cd18de9d27b5df08caeab844ccf338f0e",
    "10_digital_ai_age_2000_2026.html": "6376f22e6963314cf7fc2a21d9454946974a29179248301b62ef5cb5bb118a7d",
    "11_one_possible_branch_2026_2036.html": "0cbbccd3274ffdde8750f7c75c07b0c6ad46f85998ed4b99ee36ad0cfc549f0a",
    "about.html": "a0b35fb2c935bc1cdbf080852f3d416834939d18f6a91677350a67ab71071433",
    "changelog.html": "ace4fabfb100630bb5a7ff22a8f24427008f4c8ae666fc7f773ab397809bc97f",
    "glossary.html": "f11f07344643334dce3c936aa97bd0fb30512b61ad9f0e7731b0f180d60e70a1",
    "index.html": "e9f38d648fb25bf42f98fbd5e7dbf1665879c46d49dd240d39d84bf877368fe2",
    "methodology.html": "a8f6ddc55572232daa6d3a6ccb771d127176454ba8fbdcddafadc175f892b494",
    "timeline.html": "aef9dfec90d2b3b44b495cfee06f75bd212637dea65f782f58918e48d82f94e0",
    "manifest.webmanifest": "f87e184a6429d469747ef11a6bfc1e55d490abce0e07102b417e6f326bfa26cc",
    "pwa.css": "7ac0db2bc68c26ce10029ee65d3cef70fd1b37677d6cc24a33d13043f4260a42",
    "pwa.js": "d6ccacdccbd7384a8af8045bdaffe2d3b7eca731ba4cca9f7b370adec67ab0c4",
    "icon-180.png": "9c8747c55c8409bcdf63c880f4ac4d3db4657798431056bd6ac9df95798f8bf5",
    "icon-192.png": "c5ce9c4ff78f1085c1b923d9632c071d4d8bf31511739a233d1c939ad6b8c4a7",
    "icon-512.png": "342f83eb4bcfc0e6415a71b37f9b5c0d25bad0647d3a6b69032a4641df2d01ed",
    "sl-translations.json": "63ad5b353da4fcd589f6ab0cd22d3e7fcead0f8682bb0451de3bba26285877db"
  }
};
const BASE=new URL(self.registration.scope),PREFIX='humanity-history-pwa-',CACHE=PREFIX+RELEASE.id,FILES=new Map(Object.keys(RELEASE.assets).map(function(n){return[new URL(n,BASE).pathname,n]}));FILES.set(BASE.pathname,'index.html');FILES.set(new URL('index.html',BASE).pathname,'index.html');
const au=function(n){return new URL(n,BASE).href},digest=async function(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),function(x){return x.toString(16).padStart(2,'0')}).join('')};
async function vf(n){const r=await fetch(new Request(au(n),{cache:'reload'}));if(!r.ok||r.type==='opaque')throw Error('History asset unavailable: '+n);if(await digest(await r.clone().arrayBuffer())!==RELEASE.assets[n])throw Error('History asset hash mismatch: '+n);return r}
self.addEventListener('install',function(e){e.waitUntil((async function(){const all=await Promise.all(Object.keys(RELEASE.assets).map(async function(n){return[n,await vf(n)]})),had=(await caches.keys()).includes(CACHE),c=await caches.open(CACHE);try{await Promise.all(all.map(function(x){return c.put(au(x[0]),x[1])}))}catch(err){if(!had)await caches.delete(CACHE);throw err}if(!self.registration.active)await self.skipWaiting()})())});
self.addEventListener('activate',function(e){e.waitUntil((async function(){const ns=await caches.keys();await Promise.all(ns.filter(function(n){return n.startsWith(PREFIX)&&n!==CACHE}).map(function(n){return caches.delete(n)}));await self.clients.claim()})())});
self.addEventListener('fetch',function(e){const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==BASE.origin)return;const n=FILES.get(u.pathname);if(!n)return;e.respondWith((async function(){const c=await caches.open(CACHE),s=await c.match(au(n));if(s)return s;const x=await vf(n);await c.put(au(n),x.clone());return x})())});
