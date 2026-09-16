/* WL observatory loader. Keeps the verified core intact and adds the read-only content projection. */
(()=>{'use strict';
const BASE=new URL('./',document.currentScript?.src||location.href);
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(src,BASE).href;s.async=false;s.onload=resolve;s.onerror=()=>reject(Error('Ni mogoče naložiti '+src));document.head.append(s)});
(async()=>{await load('cockpit-core.js?v=20260915R1');await load('content.js?v=20260915R1')})().catch(e=>console.error('WL loader:',e));
})();
