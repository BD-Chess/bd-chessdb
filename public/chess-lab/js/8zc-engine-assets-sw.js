/* Same-origin, exact immutable LAB path allowlist. No API, user content or other apps. */
(() => {
  'use strict';
  const manifest=self.ChessEngineAssetManifest,root=new URL('./',self.location.href);
  const allowed=new Map();
  for(const p of manifest.packages)for(const f of p.files){
    const u=new URL(f.path,root);
    if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname)||f.path.includes('..'))throw new Error('Invalid LAB engine allowlist');
    const candidates=allowed.get(u.pathname)||[];candidates.push({p,f,url:u.href});allowed.set(u.pathname,candidates);
  }
  self.addEventListener('fetch',event=>{
    const request=event.request,u=new URL(request.url);
    if(request.method!=='GET'||u.origin!==root.origin||request.headers.get('X-ChessBest-Engine-Save')==='1')return;
    const candidates=allowed.get(u.pathname);if(!candidates)return;
    event.respondWith((async()=>{
      for(const {p,f,url} of candidates){
        const cache=await caches.open(manifest.prefix+p.identity),marker=new URL('__engine-cache__/'+p.identity+'/ready.json',root);
        let receipt;try{receipt=await (await cache.match(marker))?.json();}catch(_){}
        if(receipt?.identity!==p.identity||receipt.bytes!==p.bytes)continue;
        const response=await cache.match(url);if(!response)continue;
        // Verify every served runtime file, including Worker entries and imported JS.
        // Bounded by the largest original part; never assemble another giant WASM.
        const bytes=await response.arrayBuffer();
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
        if(bytes.byteLength!==f.bytes||hash!==f.sha256){
          return new Response('Saved engine file is corrupted. Reconnect and Repair in Settings.',{status:502,headers:{'Content-Type':'text/plain'}});
        }
        const headers=new Headers(response.headers);headers.set('X-ChessBest-Asset-Source','verified-local');
        return new Response(bytes,{headers});
      }
      // A missing/evicted package uses the existing online path; offline fails honestly.
      return fetch(request);
    })());
  });
})();
