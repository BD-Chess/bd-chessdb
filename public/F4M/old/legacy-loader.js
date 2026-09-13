(()=>{'use strict';
const fail=()=>{const el=document.querySelector('.boot');if(el)el.innerHTML='<div><strong>Flip4M Legacy</strong><p>Samodejni zagon ni uspel. / Automatic launch failed.</p><p><a href="F4M.html">Odpri staro igro / Open legacy game</a> · <a href="/f4m/">✨ Nova / New</a></p></div>';};
fetch('F4M.html',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text();}).then(html=>{
 const old='<a href="F4M_paper.html">About Game & Tech Paper</a>';
 const next=old+'\n    <a href="/f4m/" class="active">✨ Nova / New</a>';
 if(html.includes(old))html=html.replace(old,next);
 else html=html.replace('<body>','<body><a href="/f4m/" style="position:fixed;z-index:9999;right:12px;top:10px;padding:8px 10px;border-radius:8px;background:#26314a;color:#ffd700;text-decoration:none;font:700 12px system-ui">✨ Nova / New</a>');
 document.open();document.write(html);document.close();
}).catch(e=>{console.error('Flip4M legacy loader',e);fail();});
})();
