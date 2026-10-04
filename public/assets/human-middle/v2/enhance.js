/* HUMAN_MIDDLE_R2_20261004
   Progressive enhancement for MDLxDCC landing:
   - A− / live % / A+ with % reset on landing and Human in the Middle dialog
   - third VELIKOST | MASA | DNA graphic mode
   Source for DNA facts: CLOVEK_NA_SREDINI_v3_CONTENT.md (Drive 1feHJzCWJQl9tdkAoQQWVJlXORkHmTVdO)
*/
(()=>{
'use strict';
const root=document.documentElement;
const q=(s,p=document)=>p.querySelector(s);
const qa=(s,p=document)=>Array.from(p.querySelectorAll(s));
const dialog=q('#human-middle-dialog');
if(!dialog)return;

const MIN=.8,MAX=1.5,STEP=.05;
let dnaActive=false;

function lang(){return root.dataset.lang==='sl'?'sl':'en'}
function tr(en,sl){return lang()==='sl'?sl:en}
function clamp(v){v=Number(v);if(!Number.isFinite(v))v=1;return Math.round(Math.max(MIN,Math.min(MAX,v))*100)/100}
function readScale(){
  try{
    const s=Number(localStorage.getItem('mdlxdcc-font'));
    if(Number.isFinite(s))return clamp(s);
  }catch(_){}
  const css=Number(getComputedStyle(root).getPropertyValue('--scale'));
  return clamp(Number.isFinite(css)?css:1);
}
function setScale(v){
  const n=clamp(v);
  root.style.setProperty('--scale',String(n));
  try{localStorage.setItem('mdlxdcc-font',String(n))}catch(_){}
  syncScaleControls();
  window.dispatchEvent(new CustomEvent('mdlxdcc:font',{detail:{scale:n}}));
}
function pct(){return Math.round(readScale()*100)+'%'}
function button(text,id,label){
  const b=document.createElement('button');
  b.type='button';b.id=id;b.textContent=text;b.setAttribute('aria-label',label);
  return b;
}
function syncScaleControls(){
  const n=readScale();
  qa('[data-mdlx-font-value]').forEach(b=>b.textContent=Math.round(n*100)+'%');
  qa('[data-mdlx-font-down]').forEach(b=>b.disabled=n<=MIN);
  qa('[data-mdlx-font-up]').forEach(b=>b.disabled=n>=MAX);
}
function labels(){
  qa('[data-mdlx-font-down]').forEach(b=>b.setAttribute('aria-label',tr('Smaller text','Manjše besedilo')));
  qa('[data-mdlx-font-up]').forEach(b=>b.setAttribute('aria-label',tr('Larger text','Večje besedilo')));
  qa('[data-mdlx-font-value]').forEach(b=>{b.setAttribute('aria-label',tr('Reset text size to 100%','Ponastavi velikost besedila na 100 %'));b.title=tr('Reset to 100%','Ponastavi na 100 %')});
}
function wireScaleControls(down,value,up){
  down.dataset.mdlxFontDown='1'; value.dataset.mdlxFontValue='1'; up.dataset.mdlxFontUp='1';
  down.addEventListener('click',()=>setScale(readScale()-STEP));
  value.addEventListener('click',()=>setScale(1));
  up.addEventListener('click',()=>setScale(readScale()+STEP));
  labels();syncScaleControls();
}
function enhanceLandingFont(){
  const group=q('.font-buttons');
  const oldDown=q('#font-down'),oldUp=q('#font-up');
  if(!group||!oldDown||!oldUp||q('#font-value'))return;
  const down=oldDown.cloneNode(true),up=oldUp.cloneNode(true);
  oldDown.replaceWith(down);oldUp.replaceWith(up);
  const value=button(pct(),'font-value',tr('Reset text size to 100%','Ponastavi velikost besedila na 100 %'));
  value.className='utility font-value';
  up.before(value);
  wireScaleControls(down,value,up);
}
function enhancePopupFont(){
  const actions=q('.hm-top-actions',dialog);
  if(!actions||q('#hm-font-value',dialog))return;
  const group=document.createElement('div');group.className='hm-font-controls';group.setAttribute('role','group');group.setAttribute('aria-label',tr('Text size','Velikost besedila'));
  const down=button('A−','hm-font-down',tr('Smaller text','Manjše besedilo'));down.className='hm-control';
  const value=button(pct(),'hm-font-value',tr('Reset text size to 100%','Ponastavi velikost besedila na 100 %'));value.className='hm-control hm-font-value';
  const up=button('A+','hm-font-up',tr('Larger text','Večje besedilo'));up.className='hm-control';
  group.append(down,value,up);actions.prepend(group);
  wireScaleControls(down,value,up);
}

const DNA={
sl:{
 hint:'DNA skozi merila: celica → človek → kri → gen → človeštvo',
 calc:'IZRAČUN',estimate:'OCENA',source:'VIR',
 cards:[
  {n:'01',title:'ENA CELICA',tag:'OCENA',kind:'bridge',a:'diploidni genom',m:'~2.2 m DNA',b:'raztegnjena nit',chips:['~6.4×10⁹ bp','~4.2×10¹¹ atomov','1 zavoj: ~3.4 nm · ~690 atomov'],note:'DNA na celico z jedrom: ~6.4×10⁹ bp × 0.34 nm ≈ 2.2 m.'},
  {n:'02',title:'EN ČLOVEK',tag:'OCENA',kind:'bridge',a:'~3×10¹² celic z jedrom',m:'~6.5×10¹² m · 44 AU',b:'Sonce–Pluton',chips:['~1.3 ha kot 2 nm trak','~20 g'],note:'Vsa DNA enega človeka ≈ razdalja Sonce–Pluton.'},
  {n:'03',title:'KRI',tag:'OCENA',kind:'lanes',rows:[['~1 dl krvi','≈ premer Sonca'],['~1 mL krvi','≈ premer Zemlje'],['kapljica 50 µL','≈ 2–5 × Slovenija']],note:'DNA belih krvničk; levkociti 4.5–11×10⁶/mL. Vrednosti so ocene reda velikosti.'},
  {n:'04',title:'GEN ↔ BELJAKOVINA',tag:'IZRAČUN',kind:'ratio',rows:[['beljakovina 50 kDa','~5 nm',0],['kodirni zapis DNA','~0.46 µm',61],['cel gen z introni','~7.9 µm',100]],note:'Logaritemski prikaz fizične dolžine. Kodirni zapis je ≈93× daljši od zložene 5 nm beljakovine; mediana gena 23 329 bp ≈ velikost celice. Z introni je zapis ~1600× daljši od izdelka.'},
  {n:'05',title:'ČLOVEŠTVO',tag:'OCENA',kind:'dual',left:['8.2×10⁹ ljudi','~5.7×10⁶ sv. let','≈ do Andromede in nazaj'],right:['~100 Slovenij','~1.46×10⁵ sv. let','≈ premer Rimske ceste'],note:'~100 Slovenij pomeni približno 212 milijonov ljudi; primerjava je ocena reda velikosti.'}
 ]
},
en:{
 hint:'DNA across scales: cell → human → blood → gene → humanity',
 calc:'CALC',estimate:'ESTIMATE',source:'SOURCE',
 cards:[
  {n:'01',title:'ONE CELL',tag:'ESTIMATE',kind:'bridge',a:'diploid genome',m:'~2.2 m DNA',b:'stretched thread',chips:['~6.4×10⁹ bp','~4.2×10¹¹ atoms','1 turn: ~3.4 nm · ~690 atoms'],note:'DNA per nucleated cell: ~6.4×10⁹ bp × 0.34 nm ≈ 2.2 m.'},
  {n:'02',title:'ONE HUMAN',tag:'ESTIMATE',kind:'bridge',a:'~3×10¹² nucleated cells',m:'~6.5×10¹² m · 44 AU',b:'Sun–Pluto',chips:['~1.3 ha as a 2 nm ribbon','~20 g'],note:'All DNA in one human ≈ the Sun–Pluto distance.'},
  {n:'03',title:'BLOOD',tag:'ESTIMATE',kind:'lanes',rows:[['~1 dL blood','≈ Sun diameter'],['~1 mL blood','≈ Earth diameter'],['50 µL drop','≈ 2–5 × Slovenia']],note:'White-cell DNA; white blood cells 4.5–11×10⁶/mL. Values are order-of-magnitude estimates.'},
  {n:'04',title:'GENE ↔ PROTEIN',tag:'CALC',kind:'ratio',rows:[['50 kDa protein','~5 nm',0],['coding DNA record','~0.46 µm',61],['whole gene with introns','~7.9 µm',100]],note:'Logarithmic display of physical length. The coding record is ≈93× longer than the folded 5 nm protein; median gene 23,329 bp ≈ cell size. With introns the record is ~1600× longer than the product.'},
  {n:'05',title:'HUMANITY',tag:'ESTIMATE',kind:'dual',left:['8.2×10⁹ people','~5.7×10⁶ light-years','≈ to Andromeda and back'],right:['~100 Slovenias','~1.46×10⁵ light-years','≈ Milky Way diameter'],note:'~100 Slovenias means about 212 million people; the comparison is an order-of-magnitude estimate.'}
 ]
}
};
function tagClass(tag){return /OCENA|ESTIMATE/.test(tag)?'estimate':/VIR|SOURCE/.test(tag)?'source':''}
function bridge(a,m,b){
 return '<div class="hm2-bridge"><span class="hm2-node"><b>'+a+'</b></span><span class="hm2-wire"><b>'+m+'</b></span><span class="hm2-node"><b>'+b+'</b></span></div>';
}
function cardHtml(c){
 let body='';
 if(c.kind==='bridge'){
   body=bridge(c.a,c.m,c.b)+'<div class="hm2-chips">'+c.chips.map(x=>'<span>'+x+'</span>').join('')+'</div>';
 }else if(c.kind==='lanes'){
   body='<div class="hm2-lanes">'+c.rows.map(r=>'<div class="hm2-lane"><span>'+r[0]+'</span><i></i><b>'+r[1]+'</b></div>').join('')+'</div>';
 }else if(c.kind==='ratio'){
   body='<div class="hm2-ratios">'+c.rows.map(r=>'<div class="hm2-ratio"><span>'+r[0]+'</span><i><em style="left:'+r[2]+'%"></em></i><b>'+r[1]+'</b></div>').join('')+'</div>';
 }else if(c.kind==='dual'){
   body='<div class="hm2-dual">'+bridge(c.left[0],c.left[1],c.left[2])+bridge(c.right[0],c.right[1],c.right[2])+'</div>';
 }
 return '<article class="hm2-card '+(c.kind==='dual'?'wide':'')+'"><header><span class="hm2-no">'+c.n+'</span><strong>'+c.title+'</strong><span class="hm-tag '+tagClass(c.tag)+'">'+c.tag+'</span></header>'+body+'<p>'+c.note+'</p></article>';
}
function renderDna(){
 const mirrors=q('.hm-mirrors',dialog),hint=q('.hm-viewhint',dialog),seg=q('.hm-segment',dialog);
 if(!mirrors||!seg)return;
 const key=lang(),d=DNA[key];
 mirrors.classList.add('hm2-dna');
 if(mirrors.dataset.hm2DnaRendered!==key){
   mirrors.innerHTML='<div class="hm2-grid">'+d.cards.map(cardHtml).join('');
   mirrors.dataset.hm2DnaRendered=key;
 }
 qa('[data-hm-mode]',seg).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hmMode==='dna')));
 if(hint)hint.textContent=d.hint;
}
function enhanceModes(){
 const seg=q('.hm-segment',dialog);
 if(!seg)return;
 let dna=q('[data-hm-mode="dna"]',seg);
 if(!dna){
   dna=document.createElement('button');dna.type='button';dna.dataset.hmMode='dna';dna.textContent='DNA';dna.setAttribute('aria-pressed','false');seg.append(dna);
   dna.addEventListener('click',()=>{dnaActive=true;renderDna()});
 }
 qa('[data-hm-mode="size"],[data-hm-mode="mass"]',seg).forEach(b=>{
   if(b.dataset.hm2Bound)return;b.dataset.hm2Bound='1';
   b.addEventListener('click',()=>{dnaActive=false});
 });
 if(dnaActive)renderDna();
}
function enhancePopup(){if(!q('.hm-shell',dialog))return;enhancePopupFont();enhanceModes();labels();syncScaleControls()}

const css=document.createElement('style');
css.id='human-middle-r2-style';
css.textContent=`
.font-buttons .font-value{min-width:50px;padding-inline:6px;font:500 .62rem/1 Consolas,monospace;color:var(--muted)}
.font-buttons .font-value:hover{color:var(--ink)}
.hm-font-controls{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:10px;padding:2px;background:var(--surface)}
.hm-font-controls .hm-control{border:0;min-width:34px;padding-inline:7px;background:transparent}
.hm-font-controls .hm-font-value{min-width:50px;color:var(--ink);font-family:Consolas,monospace}
.hm-font-controls .hm-control:disabled{opacity:.4;cursor:default}
.hm2-dna{display:block!important}
.hm2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
.hm2-card{border:1px solid var(--line);border-radius:15px;background:color-mix(in srgb,var(--surface) 91%,var(--bg));padding:16px;min-width:0;overflow:hidden}
.hm2-card.wide{grid-column:1/-1}
.hm2-card header{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:13px}
.hm2-card header strong{font-size:.82rem;font-weight:620}.hm2-no{font:600 .54rem/1 Consolas,monospace;color:var(--accent2);letter-spacing:.1em}
.hm2-card>p{margin:11px 0 0;color:var(--muted);font-size:.67rem;line-height:1.55}
.hm2-bridge{display:grid;grid-template-columns:minmax(92px,.8fr) minmax(120px,1.4fr) minmax(92px,.8fr);align-items:center;gap:10px}
.hm2-node{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:10px;text-align:center;font-size:.68rem;line-height:1.4;color:var(--muted)}
.hm2-node b{display:block;color:var(--ink);font-size:.72rem}
.hm2-wire{height:54px;position:relative;display:flex;align-items:center;justify-content:center;font:600 .66rem/1 Consolas,monospace;color:var(--accent2);isolation:isolate}
.hm2-wire:before{content:'';position:absolute;left:0;right:0;top:50%;height:2px;background:linear-gradient(90deg,var(--line),var(--accent2),var(--line));z-index:-1}
.hm2-wire:after{content:'';position:absolute;left:8%;right:8%;top:14px;height:26px;background:radial-gradient(circle at 6px 6px,var(--accent2) 0 2px,transparent 2.5px) 0 0/22px 13px repeat-x,radial-gradient(circle at 17px 6px,var(--accent) 0 2px,transparent 2.5px) 0 13px/22px 13px repeat-x;opacity:.72;z-index:-1}
.hm2-wire b{background:var(--surface);border:1px solid color-mix(in srgb,var(--accent2) 45%,var(--line));border-radius:999px;padding:5px 8px}
.hm2-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.hm2-chips span{border:1px solid var(--line);border-radius:999px;background:var(--bg);padding:5px 8px;font:500 .56rem/1.35 Consolas,monospace;color:var(--muted)}
.hm2-lanes{display:grid;gap:8px}.hm2-lane{display:grid;grid-template-columns:minmax(88px,.72fr) minmax(90px,1.2fr) minmax(110px,.9fr);align-items:center;gap:9px;border-top:1px solid var(--line);padding-top:8px}.hm2-lane:first-child{border-top:0;padding-top:0}.hm2-lane span{font-size:.67rem}.hm2-lane b{text-align:right;font-size:.67rem}.hm2-lane i{height:2px;background:linear-gradient(90deg,var(--line),var(--accent2),var(--accent));position:relative}.hm2-lane i:after{content:'';position:absolute;right:-1px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--accent2)}
.hm2-ratios{display:grid;gap:9px}.hm2-ratio{display:grid;grid-template-columns:110px 1fr 82px;align-items:center;gap:10px}.hm2-ratio span{font-size:.65rem;color:var(--muted)}.hm2-ratio>i{height:9px;border-radius:999px;background:var(--bg);border:1px solid var(--line);position:relative}.hm2-ratio em{display:block;position:absolute;top:50%;width:9px;height:9px;transform:translate(-50%,-50%);border-radius:50%;background:var(--accent2);box-shadow:0 0 0 2px var(--surface)}.hm2-ratio b{text-align:right;font:600 .58rem/1 Consolas,monospace}
.hm2-dual{display:grid;grid-template-columns:1fr 1fr;gap:9px}
@media(max-width:900px){.hm2-grid{grid-template-columns:1fr}.hm2-card.wide{grid-column:auto}.hm2-dual{grid-template-columns:1fr}}
@media(max-width:620px){.hm-top-title{flex:1 0 100%}.hm-top-actions{width:100%;justify-content:flex-end;flex-wrap:wrap}.hm-font-controls .hm-control{min-width:31px}.hm-font-controls .hm-font-value{min-width:46px}.hm2-card{padding:13px}.hm2-bridge{grid-template-columns:1fr}.hm2-wire{height:42px}.hm2-lane{grid-template-columns:84px 1fr 96px}.hm2-ratio{grid-template-columns:88px 1fr 74px}}
`;
document.head.appendChild(css);

enhanceLandingFont();
setScale(readScale());

const observer=new MutationObserver(()=>enhancePopup());
observer.observe(dialog,{childList:true,subtree:true});
dialog.addEventListener('toggle',enhancePopup);
window.addEventListener('mdlxdcc:language',()=>{labels();if(dnaActive)requestAnimationFrame(renderDna)});
window.addEventListener('storage',e=>{if(e.key==='mdlxdcc-font'){root.style.setProperty('--scale',String(clamp(e.newValue)));syncScaleControls()}});
enhancePopup();
})();