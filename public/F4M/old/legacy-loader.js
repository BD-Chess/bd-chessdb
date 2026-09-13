(()=>{'use strict';
const STYLE='<style id="bd-version-nav-style">.bd-version-nav{position:fixed;top:10px;right:10px;z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;border:1px solid rgba(255,215,0,.22);border-radius:999px;background:rgba(11,15,23,.90);box-shadow:0 8px 28px rgba(0,0,0,.38);backdrop-filter:blur(10px);font:700 9px/1 system-ui,sans-serif;letter-spacing:.07em}.bd-version-nav a{padding:7px 8px;border-radius:999px;color:#8fa1b8;text-decoration:none}.bd-version-nav a:hover,.bd-version-nav a:focus-visible{color:#e9eefc;background:rgba(255,255,255,.07);outline:none}.bd-version-nav a.active{color:#ffd700;background:rgba(255,215,0,.12);box-shadow:inset 0 0 0 1px rgba(255,215,0,.22)}@media(max-width:520px){.bd-version-nav{top:6px;right:6px;font-size:8px}.bd-version-nav a{padding:6px 7px}}</style>';
const SWITCH='<nav class="bd-version-nav" aria-label="Flip4M versions"><a href="/f4m/">CURRENT</a><a class="active" aria-current="page" href="/f4m/old/">PREVIOUS</a><a href="/f4m/new/">LAB</a></nav>';
const fail=()=>{const el=document.querySelector('.boot');if(el)el.innerHTML='<div><strong>Flip4M Legacy</strong><p>Samodejni zagon ni uspel. / Automatic launch failed.</p><p><a href="F4M.html">Odpri staro igro / Open legacy game</a></p>'+SWITCH+'</div>';};
fetch('F4M.html',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text();}).then(html=>{
 html=html.replaceAll('href="F4M_paper.html"','href="/f4m/f4m/"');
 html=html.replace('</head>',STYLE+'</head>').replace('</body>',SWITCH+'</body>');
 document.open();document.write(html);document.close();
}).catch(e=>{console.error('Flip4M legacy loader',e);fail();});
})();
