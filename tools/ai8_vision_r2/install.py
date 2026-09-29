#!/usr/bin/env python3
"""Scoped, fail-closed R2 landing integration; backups are byte-identical."""
from pathlib import Path
import hashlib, html, json, re, sys
from build_visuals import build, CONTENT
EXPECTED = '0d5a8bb11206cc159445343b1a352aada6beaa98097a051a493799b79f7c5ab5'
CSS = r'''
/* AI8_VISION_MATRIX_R2: scoped overrides; page locale/theme remain authoritative. */
#ai8-vision-dialog{box-sizing:border-box;width:min(1640px,calc(100vw - 28px));max-height:94dvh;padding:0;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--bg);color:var(--ink)}
#ai8-vision-dialog .ai8-vision-dialog-inner{display:flex;flex-direction:column;max-height:94dvh;min-height:0}
#ai8-vision-dialog .ai8-vision-dialog-top{flex:none;padding:14px 16px 10px 20px;gap:12px}
#ai8-vision-dialog .ai8-vision-dialog-top h2{font-size:1.05rem;line-height:1.4}
#ai8-vision-dialog .ai8-vision-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 20px;border-bottom:1px solid var(--line);flex:none}
#ai8-vision-dialog .ai8-vision-controls-group{display:flex;gap:6px;align-items:center}
#ai8-vision-dialog .ai8-vision-control{min-width:42px;min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:600 .74rem/1.2 system-ui,sans-serif;padding:8px 10px}
#ai8-vision-dialog .ai8-vision-control[aria-pressed="true"]{border-color:var(--accent);color:var(--accent2)}
#ai8-vision-dialog button:focus-visible,#ai8-vision-dialog a:focus-visible,#ai8-vision-dialog summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
#ai8-vision-dialog .ai8-vision-view-label{min-width:0;color:var(--muted);font:500 .67rem/1.4 system-ui,sans-serif;text-align:right}
#ai8-vision-scroll{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;flex:1}
#ai8-vision-dialog figure{margin:0;overflow:visible;min-height:0;background:var(--bg)}
#ai8-vision-image-link{display:block;line-height:0}
#ai8-vision-image{display:block;width:100%;height:auto;max-height:none;object-fit:contain;margin:0}
#ai8-vision-image[hidden]{display:none}
#ai8-vision-status{color:var(--muted);font-size:.8rem;padding:14px 20px;margin:0}
#ai8-vision-status:empty{display:none}
#ai8-vision-dialog .ai8-vision-caption{font-size:.75rem;padding:14px 20px;line-height:1.55;align-items:flex-start;flex-wrap:wrap}
#ai8-vision-dialog .ai8-vision-caption a{white-space:normal}
#ai8-vision-transcript{border-top:1px solid var(--line);padding:14px 20px;font:400 .9rem/1.65 system-ui,sans-serif}
#ai8-vision-transcript summary{cursor:pointer;color:var(--accent2)}
#ai8-vision-transcript ol{padding-left:24px;margin:16px 0 4px;max-width:850px}
#ai8-vision-transcript li{margin:12px 0}
#ai8-vision-transcript strong{display:block}
@media(max-width:760px){
 #ai8-vision-dialog{width:calc(100vw - 12px);max-height:96dvh;border-radius:13px}
 #ai8-vision-dialog .ai8-vision-dialog-inner{max-height:96dvh}
 #ai8-vision-dialog .ai8-vision-dialog-top{padding:10px 10px 8px 14px}
 #ai8-vision-dialog .ai8-vision-dialog-top h2{font-size:.94rem}
 #ai8-vision-dialog .ai8-vision-controls{padding:6px 14px}
 #ai8-vision-dialog .ai8-vision-control{min-height:40px}
 #ai8-vision-dialog .ai8-vision-caption{gap:9px;padding:12px 14px}
 #ai8-vision-transcript{padding:12px 14px}
}
'''
JS = r'''
/* AI8_VISION_MATRIX_R2: lazy one-variant loading, exact site locale/theme, native dialog. */
(()=>{'use strict';
const ASSETS=__ASSETS__;
const words={sl:{title:'Rast skozi čas',close:'Zapri',light:'Svetla tema',dark:'Temna tema',mobile:'Pokončno · podrsaj navzdol',desktop:'Široka postavitev',loading:'Nalaganje ustrezne različice …',error:'Slike ni bilo mogoče naložiti. Poskusi znova ali odpri izvirnik spodaj.',alt:__ALT_SL__},en:{title:'Growth through time',close:'Close',light:'Light theme',dark:'Dark theme',mobile:'Portrait · scroll to explore',desktop:'Wide layout',loading:'Loading the matching version …',error:'The image could not be loaded. Try again or open the original below.',alt:__ALT_EN__}};
const root=document.documentElement,d=document.getElementById('ai8-vision-dialog'),open=document.getElementById('ai8-vision-open'),close=document.getElementById('ai8-vision-close'),img=document.getElementById('ai8-vision-image'),status=document.getElementById('ai8-vision-status'),scroll=document.getElementById('ai8-vision-scroll');
if(!d||!open||!close||!img)return;
const base=new URL('.',document.currentScript.src),mq=matchMedia('(max-width:760px)');
let generation=0,requested='',loaded='',returnFocus=null;
function choice(){const lang=root.dataset.lang==='sl'?'sl':'en',theme=root.dataset.theme==='light'?'light':'dark';return {lang,theme,key:lang+'-'+(mq.matches?'mobile':'desktop')+'-'+theme};}
function labels(c){const t=words[c.lang];close.setAttribute('aria-label',t.close);document.getElementById('ai8-vision-view-label').textContent=mq.matches?t.mobile:t.desktop;document.getElementById('ai8-vision-theme-toggle').textContent=c.theme==='dark'?'◐ '+t.dark:'◐ '+t.light;document.querySelectorAll('[data-vision-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.visionLang===c.lang)));img.alt=t.alt;}
async function refresh(){const c=choice();labels(c);if(!d.open)return;if(requested===c.key)return;requested=c.key;const turn=++generation,asset=ASSETS[c.key],url=new URL(asset.file+'?v='+asset.sha256.slice(0,12),base).href;status.textContent=words[c.lang].loading;d.dataset.state='loading';img.hidden=true;scroll.scrollTop=0;
 try{const probe=new Image();probe.decoding='async';probe.src=url;await probe.decode();if(turn!==generation||!d.open)return;img.width=asset.width;img.height=asset.height;img.src=url;await img.decode();if(turn!==generation||!d.open)return;document.getElementById('ai8-vision-image-link').href=url;document.getElementById('ai8-vision-full-link').href=url;img.hidden=false;status.textContent='';loaded=c.key;d.dataset.variant=c.key;d.dataset.state='ready';}
 catch(_){if(turn!==generation||!d.open)return;requested='';d.dataset.state='error';status.textContent=words[c.lang].error;img.hidden=true;}
}
function show(){returnFocus=document.activeElement;if(typeof d.showModal!=='function'){const c=choice();location.href=new URL(ASSETS[c.key].file,base).href;return;}d.showModal();root.classList.add('ai8-vision-open');requested='';refresh();close.focus();}
function finish(){generation++;requested='';root.classList.remove('ai8-vision-open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});}
function hide(){if(d.open)d.close();}
open.addEventListener('click',show);close.addEventListener('click',hide);d.addEventListener('close',finish);d.addEventListener('cancel',e=>{e.preventDefault();hide();});
d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)hide();});
d.querySelectorAll('[data-vision-lang]').forEach(b=>b.addEventListener('click',()=>{if(window.MDLxDCCLocale)window.MDLxDCCLocale.choose(b.dataset.visionLang);}));
document.getElementById('ai8-vision-theme-toggle').addEventListener('click',()=>document.getElementById('theme').click());
new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-lang','data-theme']});
if(mq.addEventListener)mq.addEventListener('change',refresh);else mq.addListener(refresh);
labels(choice());
})();
'''
def transcript():
 blocks=[]
 for lang,c in CONTENT.items():
  items=''.join('<li><strong>'+html.escape(t)+'</strong>'+html.escape(' '.join(b))+'</li>' for t,b,_ in c['stages'])
  blocks.append(f'<div class="{lang}" lang="{lang}"><ol>{items}</ol><p>{html.escape(c["loops"])} {html.escape(" → ".join(c["steps"]))}. {html.escape(c["project"])} ↔ {html.escape(c["lab"])}.</p></div>')
 return ''.join(blocks)
def install(repo):
 repo=Path(repo);index=repo/'public/index.html';before=index.read_bytes();sha=hashlib.sha256(before).hexdigest()
 if sha!=EXPECTED:raise SystemExit('INDEX_CHANGED_RECONCILE_BEFORE_WRITE: '+sha)
 assets=build(repo/'public/assets/ai8-vision/r2');dest=repo/'public/assets/ai8-vision/r2'
 (dest/'vision.css').write_text(CSS,encoding='utf-8')
 (dest/'vision.js').write_text(JS.replace('__ASSETS__',json.dumps(assets,separators=(',',':'))).replace('__ALT_SL__',json.dumps(CONTENT['sl']['alt'],ensure_ascii=False)).replace('__ALT_EN__',json.dumps(CONTENT['en']['alt'],ensure_ascii=False)),encoding='utf-8')
 s=before.decode('utf-8');start=s.index('<dialog class="ai8-vision-dialog"');end=s.index('</dialog>',start)+len('</dialog>')
 dialog='''<dialog class="ai8-vision-dialog" id="ai8-vision-dialog" aria-labelledby="ai8-vision-dialog-title" data-revision="20260929-r2">
<div class="ai8-vision-dialog-inner">
<div class="ai8-vision-dialog-top"><div><span class="ai8-vision-kicker">BD × AI LAB / AI8</span><h2 id="ai8-vision-dialog-title"><span class="en" lang="en">Growth through time</span><span class="sl" lang="sl">Rast skozi čas</span></h2></div><button class="ai8-vision-close" id="ai8-vision-close" type="button" aria-label="Close">×</button></div>
<div class="ai8-vision-controls"><div class="ai8-vision-controls-group" role="group" aria-label="Language / Jezik"><button class="ai8-vision-control" type="button" data-vision-lang="sl" aria-label="Slovenščina">SL</button><button class="ai8-vision-control" type="button" data-vision-lang="en" aria-label="English">EN</button><button class="ai8-vision-control" id="ai8-vision-theme-toggle" type="button">◐</button></div><span class="ai8-vision-view-label" id="ai8-vision-view-label"></span></div>
<div id="ai8-vision-scroll">
<p id="ai8-vision-status" role="status" aria-live="polite"></p>
<figure><a id="ai8-vision-image-link" href="./assets/ai8-lab-growth-20260929.webp?v=f7951a0f1596" target="_blank" rel="noopener"><img id="ai8-vision-image" hidden alt="AI8 Lab roadmap" decoding="async"></a></figure>
<div class="ai8-vision-caption"><span><span class="en" lang="en">An illustrative path and potential — not a measured growth forecast.</span><span class="sl" lang="sl">Ilustrativna razvojna pot in potencial — ne izmerjena napoved rasti.</span></span><span><a id="ai8-vision-full-link" href="./assets/ai8-lab-growth-20260929.webp?v=f7951a0f1596" target="_blank" rel="noopener"><span class="en" lang="en">Full image ↗</span><span class="sl" lang="sl">Cela slika ↗</span></a> · <a href="./AI8/"><span class="en" lang="en">Explore AI8 →</span><span class="sl" lang="sl">Razišči AI8 →</span></a> · <a href="./assets/ai8-lab-growth-20260929.webp?v=f7951a0f1596" target="_blank" rel="noopener"><span class="en" lang="en">Original · SL</span><span class="sl" lang="sl">Izvirnik · SL</span></a></span></div>
<details id="ai8-vision-transcript"><summary><span class="en" lang="en">Read as text</span><span class="sl" lang="sl">Preberi kot besedilo</span></summary>'''+transcript()+'''</details>
</div></div></dialog>'''
 s=s[:start]+dialog+s[end:]
 s,n=re.subn(r'<script id="ai8-lab-vision-script">[\s\S]*?</script>','<script id="ai8-lab-vision-script" src="./assets/ai8-vision/r2/vision.js?v=20260929-r2"></script>',s);assert n==1
 assert s.count('</head>')==1
 s=s.replace('</head>','<link rel="stylesheet" href="./assets/ai8-vision/r2/vision.css?v=20260929-r2">\n</head>')
 nums=[int(m.group(1)) for f in (repo/'public').iterdir() if (m:=re.fullmatch(r'index[.-]bck(\d+)\.html',f.name))]
 backup=repo/'public'/f'index.bck{max(nums,default=0)+1}.html'
 with backup.open('xb') as f:f.write(before)
 index.write_text(s,encoding='utf-8')
 assert backup.read_bytes()==before
 receipt={'source_sha256':sha,'backup':str(backup.relative_to(repo)),'index_sha256':hashlib.sha256(index.read_bytes()).hexdigest(),'variants':len(assets),'revision':'20260929-r2','old_artwork':'PRESERVED','mutations':'Scoped dialog/loader/style only; no authority, CLI or other app changes.'}
 (repo/'ai8-vision-r2-install.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
if __name__=='__main__':install(sys.argv[1])
