/* WL observatory loader. Keeps the verified core intact and adds the read-only content projection. */
(()=>{'use strict';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(Error('Ni mogoče naložiti '+src));document.head.append(s)});
(async()=>{await load('/WL/cockpit-core.js?v=20260915R1');await load('/WL/content.js?v=20260915R1')})().catch(e=>console.error('WL loader:',e));
})();
