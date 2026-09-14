/* BD/O medication page session bridge.
   Reuses the same unlocked BD/O session and derives the medication API token
   from the already-unwrapped vault master key. No separate password gate. */
(function(){
'use strict';
const ROOT='/BD/O/';
const SESSION='bd-o-v2-session';
const API='/api/bd-o-medication-state';
const LABEL='BD/O:med-api:v1';
const TE=new TextEncoder();
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=u=>[...new Uint8Array(u)].map(x=>x.toString(16).padStart(2,'0')).join('');
let session;
try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch(_){session=null}
if(!session||typeof session.key!=='string'){
  document.documentElement.style.visibility='hidden';
  location.replace(ROOT+'index.html?next=tablete.html');
  return;
}
let raw;
try{raw=from64(session.key)}catch(_){raw=null}
if(!raw||raw.length!==32){
  sessionStorage.removeItem(SESSION);
  document.documentElement.style.visibility='hidden';
  location.replace(ROOT+'index.html?next=tablete.html');
  return;
}
const merged=new Uint8Array(raw.length+TE.encode(LABEL).length);
merged.set(raw,0);merged.set(TE.encode(LABEL),raw.length);raw.fill(0);
const tokenPromise=crypto.subtle.digest('SHA-256',merged).then(buf=>{merged.fill(0);return hex(buf)});
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const requestUrl=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
  if(requestUrl.origin===location.origin&&requestUrl.pathname===API){
    const token=await tokenPromise;
    const headers=new Headers((init&&init.headers)||((typeof Request!=='undefined'&&input instanceof Request)?input.headers:undefined));
    headers.set('X-BD-Med-Token',token);
    return nativeFetch(input,{...(init||{}),headers});
  }
  return nativeFetch(input,init);
};
})();
