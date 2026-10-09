(()=>{'use strict';
const fail=()=>{const el=document.querySelector('.boot');if(el)el.innerHTML='<div><strong>Flip4M</strong><p>Samodejni zagon ni uspel. / Automatic launch failed.</p><p><a href="app/">Odpri igro neposredno / Open game directly</a></p></div>';};
fetch('app/index.html',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text();}).then(html=>{
 html=html.replace('<head>','<head>\n<base href="/f4m/f4m/app/">');
 html=html.replace('<a href="/f4m/new/" data-i18n="previewGame">Igra v2</a>','<a href="/f4m/old/">↔ Stara / Old</a><a href="/f4m/new/">🧪 Lab</a>');
 html=html.replace('<p class="tiny" data-i18n="longThinkNote">Velemojster: 60 s; Prvak: 120 s na odločitev. Ob dokazanem izidu lahko konča prej.</p>','<p class="tiny">Velemojster/Grandmaster: do 60 s; Prvak/Champion: do 120 s. Zgodnje in enostavne pozicije dobijo manj časa; kompleksne lahko porabijo celoten maksimum.</p>');
 document.open();document.write(html);document.close();
}).catch(e=>{console.error('Flip4M primary loader',e);fail();});
})();
