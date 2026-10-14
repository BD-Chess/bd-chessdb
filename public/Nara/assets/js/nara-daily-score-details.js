/* Nara Daily assessments, 2026-10-15 R1.
 * Authenticated edition scores: Claude peer result 1-x1DY5D6694s8rCz6fTCiwuIjkxsI4PC
 * with GPT private sealed evaluations 1Y0X-2gFO8XYqUyBSeyHHFxuZWeKb_0cX.
 * No unobserved score is inferred. Older grades: original Nara Daily log/day manifests.
 */
(()=>{
'use strict';
const scored={
'2026-10-05':[91,85,'a0637867ad84df8fa9ac875ef6e50b38d1164bc948302eed2cc048b75e1aa366','A century of negotiating time still demands real engineering.','The emotional weight of a whole century is compressed.'],
'2026-10-06':[88,79,'6243b79f5ae69199372852f352509721a63d0b2f49dc7909bcf29a68ae79306e','A powerful voice is checked by a testable voting procedure.','The engineering solution arrives conveniently fast.'],
'2026-10-07':[87,83,'eabdfb3cd2fd5bc508b7e799cc9a4e4f9aac4166f0e17862fd0aacf50ff8d55e','Atmospheric constraints and failed tests earn the solution.','Many supporting delegates remain thinly drawn.'],
'2026-10-08':[88,83,'38b7d0e8282423bba75c55896017d07885ede324a13caec750fc5c8826dba1c6','The forest has an inventive way of counting evidence.','Several supporting characters function mainly as information sources.'],
'2026-10-09-S1':[86,79,'3977c8f0b9b6d5f1deaf58ed4fd1eac3ec1010a1c5d6bfcc49f89edde55cde15','The eleven-minute delay creates exact dramatic pressure.','Procedure sometimes overshadows human relationships.'],
'2026-10-09-S2':[87,86,'3a2428400fd37d2e943fd93f8b9441bd1717886e44ae0c043d40e6bc5ec83ea9','A constitutional conflict becomes a child’s urgent problem.','Legal characters often have limited inner lives.'],
'2026-10-09-S3':[88,80,'c18bdcfc2366056983a02fff62f1982f3428f17e70c0613944f49c5791073a2e','Order-sensitive physics shapes an original hospital crisis.','Hospital-scale construction and testing are compressed.'],
'2026-10-10-S1':[87,85,'ee63dbaea679910803da63edfb30c770e952924b22bc08dbef42d9dfa9ff3b14','A distinctive feedback loop links the bells, trams and tower.','Characters speak too often as professional roles.'],
'2026-10-10-S2':[88,83,'287d83d312071c95ebea62ede1b500265324135c8b9efbf757c1aaefb428eb5c','The mystery develops through concrete falsifiable observations.','Scientific and social conflict resolves unusually cleanly.'],
'2026-10-10-S3':[88,85,'a78a05d3abbafeb711d75a53db244c544f90f937d04e5354641bf6e61d254f3e','Possible storm agency is approached as a testable hypothesis.','The final interpretation reaches beyond the tests.'],
'2026-10-11-S1':[82,82,'f29bcf6a8985aefb1994fc839f42498607c31e5639c850e44199091c3246af99','Power has bounds and other people retain decision authority.','The reported danger deadline is not causally reconciled.'],
'2026-10-11-S2':[86,82,'16c83402037a73f4688f1de41492a0077bacf39a48da286f25cf6ca4e8574a90','Empty seats mean opposing things to different communities.','A six-hour test conflicts with a shorter remaining deadline.'],
'2026-10-11-S3':[88,85,'797614393d332116c7464fdfc0ad3dd81b44e469e2c5799f4b7391c628ec28ca','The diagnosis and fallback unfold in a strong causal chain.','Illuminara’s internal development remains limited.']
};
const gptOnly={
'2026-10-12-S1':[91,'A magical rule is made falsifiable and testable.','Institutional opposition yields rapidly.'],
'2026-10-12-S2':[89,'The time-loop mystery is solved through predictions.','Character interiority is relatively sparse.'],
'2026-10-12-S3':[86,'Hydrological tests distinguish measurements from claims.','Water flow and the reported rationing need reconciliation.']
};
const originals={
'2026-10-05':[88,82.5,85.25],
'2026-10-06':[86.5,82.5,84.5],
'2026-10-07':[86,84.5,85.25],
'2026-10-08':[87,81.5,84.25],
'2026-10-09':[94,86,90],
'2026-10-10':[93,87,90],
'2026-10-11':[97,87,92],
'2026-10-12':[93,86,89.5],
'2026-10-13':[89,87,88],
'2026-10-14':[96,87,91.5]
};
const originalInstances={"2026-10-09-S1":[94,86,90],"2026-10-09-S2":[83,81,82],"2026-10-09-S3":[92,86,89],"2026-10-10-S1":[91,86,88.5],"2026-10-10-S2":[93,87,90],"2026-10-10-S3":[92,86,89],"2026-10-11-S1":[97,87,92],"2026-10-11-S2":[91,82,86.5],"2026-10-11-S3":[91,89,90],"2026-10-12-S1":[86,87,86.5],"2026-10-12-S2":[88,81,84.5],"2026-10-12-S3":[93,86,89.5],"2026-10-13-S1":[89,86,87.5],"2026-10-13-S2":[89,87,88],"2026-10-13-S3":[87,85,86],"2026-10-14-S1":[96,87,91.5],"2026-10-14-S2":[93,87,90],"2026-10-14-S3":[85,87,86]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sl=()=>document.documentElement.lang==='sl';
const words=(en,si)=>sl()?si:en;
const dec=v=>v==null?'—':String(v);
const label=(en,si)=>'<span lang="en" data-language-content="en"'+(sl()?' hidden':'')+'>'+en+'</span><span lang="sl" data-language-content="sl"'+(!sl()?' hidden':'')+'>'+si+'</span>';
const scoreKey=href=>(String(href||'').match(/Nara-AI-(2026-10-\d\d(?:-S[123])?)-(?:format-R1|story)\.html/)||[])[1]||'';
const date=key=>key.slice(0,10);
const evalRow=key=>{const p=scored[key],g=gptOnly[key];return p?{key,gpt:p[0],claude:p[1],combined:(p[0]+p[1])/2,hash:p[2],plus:p[3],minus:p[4],paired:true}:g?{key,gpt:g[0],claude:null,combined:null,plus:g[1],minus:g[2],paired:false}: {key,gpt:null,claude:null,combined:null,paired:false};};
const style=document.createElement('style');
style.textContent='.nara-grade-detail{border-top:1px solid var(--line);margin:1rem 0;padding-top:.75rem}.nara-grade-detail h3{font-size:1.08rem;margin:.9rem 0 .4rem}.nara-grade-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem}.nara-grade-kpis>div{border:1px solid var(--line);border-radius:.5rem;padding:.55rem;background:color-mix(in srgb,var(--accent) 8%,var(--panel));font-size:.82rem}.nara-grade-kpis strong{display:block;font-size:1.3rem}.nara-grade-detail table{width:100%;border-collapse:collapse;font-size:.81rem}.nara-grade-detail th,.nara-grade-detail td{text-align:left;padding:.48rem .22rem;border-bottom:1px solid var(--line);vertical-align:top}.nara-grade-detail th:last-child,.nara-grade-detail td:last-child{text-align:right}.nara-grade-detail a{text-decoration:underline;color:var(--accent)}.nara-grade-detail .muted{color:var(--muted)}.daily-index-rating .score-chip{cursor:pointer}.nara-grade-detail p{line-height:1.55}@media(max-width:540px){.nara-grade-kpis>div{padding:.35rem}.nara-grade-kpis strong{font-size:1.1rem}.nara-grade-detail table{font-size:.75rem}}';
document.head.appendChild(style);
function inner(row){
 const d=date(row.key),old=originalInstances[row.key]||originals[d];
 let s='';
 if(row.gpt!==null){
 s+='<div class="nara-grade-kpis"><div>GPT<strong>'+dec(row.gpt)+'</strong><small>7D SA1</small></div><div>Claude<strong>'+dec(row.claude)+'</strong><small>PEC-6</small></div><div>'+label('Combined','Skupaj')+'<strong>'+dec(row.combined)+'</strong><small>50 / 50</small></div></div>';
 s+='<h3>'+label('GPT: strengths and reservations','GPT: prednosti in zadržki')+'</h3><p><strong>+</strong> '+esc(row.plus)+'</p><p><strong>−</strong> '+esc(row.minus)+'</p>';
 if(row.paired)s+='<h3>'+label('Claude: independent PEC-6 review','Claude: neodvisna recenzija PEC-6')+'</h3><p>'+label('The separate Claude evaluator scored this exact edition. Its project-wide review noted residual dialogue tags in most converted stories. The complete per-story Claude prose is privately sealed; the public result provides authentic scores and hashes, not quotations.','Claude je neodvisno ocenil točno to izdajo. V skupnem pregledu je pri večini predelanih zgodb izpostavil odvečne govorne oznake. Posamezne celotne obrazložitve so zasebno zapečatene; objavljamo preverjene številke in dokaze, ne izmišljenih navedkov.')+'</p>';
 else s+='<p>'+label('Claude has not delivered a verified independent grade for this new edition. No joint score is asserted.','Claude za to novo izdajo še nima preverjene neodvisne ocene. Skupne ocene zato ne prikazujemo.')+'</p>';
 }
 if(old){
 s+='<h3>'+label('Assessment history','Zgodovina ocen')+'</h3><table><thead><tr><th>'+label('Version','Različica')+'</th><th>GPT</th><th>Claude</th><th>'+label('Mean','Skupaj')+'</th></tr></thead><tbody><tr><td>'+label('Original published final','Prvotna objavljena')+'</td><td>'+dec(old[0])+'</td><td>'+dec(old[1])+'</td><td>'+dec(old[2])+'</td></tr>';
 if(row.gpt!==null)s+='<tr><td>Format R1</td><td>'+dec(row.gpt)+'</td><td>'+dec(row.claude)+'</td><td>'+dec(row.combined)+'</td></tr>';
 s+='</tbody></table><p class="muted">'+label('Only verified scored versions appear; no unscored editorial stage receives a fictional rating.','Prikazane so samo potrjene ocenjene različice. Neocenjenim uredniškim vmesnim korakom ne pripisujemo številk.')+'</p>';
 }
 s+='<h3>'+label('The other daily stories','Preostali dnevni zgodbi')+'</h3><div class="nara-grade-compare" data-date="'+d+'"><p class="muted">…</p></div>';
 s+='<p class="muted">'+label('Scores refer to English texts; see','Ocene veljajo za angleška besedila; glej')+' <a href="Nara-AI-log.html#NARA-D-'+d+'-LOG">'+label('editorial log','uredniški dnevnik')+'</a>.</p>';
 return s;
}
async function compare(block,d){
 if(d<'2026-10-09'){block.innerHTML='<p>'+label('Only one published story on this date.','Na ta datum je bila objavljena le ena zgodba.')+'</p>';return;}
 try{
 const r=await fetch('daily/days/'+d+'.json',{cache:'force-cache'});if(!r.ok)throw Error('manifest');const day=await r.json();
 const rows=day.instances||[];if(rows.length<1)throw Error('entries');
 let s='<table><thead><tr><th>'+label('Story','Zgodba')+'</th><th>GPT</th><th>Claude</th><th>'+label('Mean','Skupaj')+'</th></tr></thead><tbody>';
 rows.forEach(st=>{
 const key=d+'-'+st.instance,p=scored[key],link='Nara-AI-'+key+(p||gptOnly[key]?'-format-R1.html':'-story.html');
 const g=p?p[0]:st.gpt,c=p?p[1]:st.claude,combined=p?(g+c)/2:st.combined;
 s+='<tr><td><a href="'+esc(link)+'">'+esc(st.instance+' · '+st.title)+'</a>'+(st.instance===day.featured_instance?' ★':'')+'</td><td>'+dec(g)+'</td><td>'+dec(c)+'</td><td>'+dec(combined)+'</td></tr>';
 });
 s+='</tbody></table><p class="muted">'+label('★ Original daily selection is preserved, even if later edition ratings change the ranking. 12 Oct format grades are GPT-only; the table retains original paired values until two new grades exist.','★ Prvotni dnevni izbor ostane nespremenjen tudi ob poznejšem ocenjevanju. Za 12. 10. so nove ocene samo GPT; tabela ohranja prvotne skupne vrednosti.')+'</p>';
 block.innerHTML=s;refreshLanguage(block);
 }catch{block.innerHTML='<p class="muted">'+label('Original-day comparison is not available offline.','Primerjava dneva trenutno ni dosegljiva.')+'</p>';}
}
function refreshLanguage(root=document){root.querySelectorAll('[data-language-content]').forEach(el=>el.hidden=(el.dataset.languageContent!==(sl()?'sl':'en')));}
function dialogFor(key,title){
 const id='nara-new-grade-'+key;
 let dlg=document.getElementById(id);
 if(!dlg){dlg=document.createElement('dialog');dlg.id=id;dlg.className='score-dialog';dlg.innerHTML='<div class="score-dialog-card"><form method="dialog" class="score-close-row"><button class="score-close" type="submit" aria-label="Close">×</button></form><div class="eyebrow">'+label('Literary assessment','Književna ocena')+'</div><h2>'+esc(title)+'</h2><section class="nara-grade-detail">'+inner(evalRow(key))+'</section></div>';document.body.appendChild(dlg);dlg.querySelectorAll('.nara-grade-compare').forEach(b=>compare(b,b.dataset.date));}
 return id;
}
function button(score,id,prior){
 const b=document.createElement('button');b.type='button';b.className=prior||'score-chip score-trend--neutral';b.textContent=score;b.dataset.scoreOpen=id;
 b.setAttribute('aria-label',words('Open literary assessment and daily comparison','Odpri književno oceno in primerjavo'));return b;
}
function page(){
 const m=location.pathname.match(/Nara-AI-(2026-10-\d\d(?:-S[123])?)-format-R1\.html$/);if(!m)return;
 const key=m[1],row=evalRow(key),p=document.querySelector('p.format-assessment');if(!p)return;
 const body=document.querySelector('article.story[data-content-sha256]');if(row.paired&&body?.dataset.contentSha256!==scored[key][2])return;
 const title=document.querySelector('h1')?.textContent.trim()||key,id=dialogFor(key,title);
 p.replaceChildren(document.createTextNode(words('New literary assessment: ','Nova književna ocena: ')),button(row.paired?dec(row.combined)+'/100':'GPT '+dec(row.gpt)+' / Claude —',id),document.createTextNode(' · '+words('original ','prvotno ')+dec((originalInstances[key]||originals[date(key)])?.[2])));
}
function index(){
 document.querySelectorAll('.daily-index-item').forEach(item=>{
 const d=(item.id.match(/^NARA-D-(2026-10-\d\d)$/)||[])[1];if(!d)return;
 const a=item.querySelector('.daily-index-title a'),score=item.querySelector('.daily-index-rating .score-chip');if(!a||!score)return;
 const key=scoreKey(a.getAttribute('href'))||(d<'2026-10-09'?d:d+'-S1');
 const title=(a.querySelector('[data-language-content="'+(sl()?'sl':'en')+'"]')||a).textContent.trim();
 const value=scored[key]?dec((scored[key][0]+scored[key][1])/2):score.textContent.trim();
 const id=dialogFor(key,title);score.replaceWith(button(value,id,score.className));
 });
}
function archive(){
 document.querySelectorAll('span.format-assessment').forEach(span=>{
 const li=span.closest('li'),a=li?.querySelector('a[href*="-format-R1.html"]');const key=scoreKey(a?.getAttribute('href'));if(!key)return;
 const row=evalRow(key),id=dialogFor(key,a.textContent.trim());
 span.replaceChildren(button(row.paired?dec(row.combined)+'/100':'GPT '+dec(row.gpt)+' / Claude —',id));
 });
 document.querySelectorAll('dialog.score-dialog[id^="score-NARA-D-"]').forEach(dlg=>{
 if(dlg.querySelector('.nara-grade-detail'))return;const m=dlg.id.match(/^score-NARA-D-(2026-10-\d\d)$/);if(!m)return;
 const container=dlg.querySelector('.score-dialog-card');if(!container)return;
 const section=document.createElement('section');section.className='nara-grade-detail';section.innerHTML=inner(evalRow(m[1]));container.appendChild(section);
 section.querySelectorAll('.nara-grade-compare').forEach(b=>compare(b,b.dataset.date));
 });
}
page();index();archive();refreshLanguage();
document.addEventListener('click',e=>{if(e.target.closest?.('[data-language],[data-story-lang]'))queueMicrotask(()=>refreshLanguage());});
})();