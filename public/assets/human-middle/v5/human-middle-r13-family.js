/* HUMAN_MIDDLE_20261007_R12_PORTRAIT_GALLERY · BD × AI Lab · source: CLOVEK_NA_SREDINI_v3_CONTENT.md */
(()=>{
'use strict';
const style=document.createElement('style');style.id='human-middle-style';style.textContent=`/* HUMAN_MIDDLE_20261004_R1 · interactive scale popup for MDLxDCC landing */
.human-middle{border-top:1px solid var(--line);padding:18px 0 20px}
.human-middle-card{width:100%;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;text-align:left;border:1px solid var(--line);border-radius:15px;background:linear-gradient(120deg,color-mix(in srgb,var(--surface) 92%,var(--accent2) 8%),var(--surface));padding:15px 17px;min-height:82px;transition:border-color .2s,transform .2s,background .2s}
.human-middle-card:hover{border-color:var(--accent2);transform:translateY(-1px);background:linear-gradient(120deg,color-mix(in srgb,var(--surface) 86%,var(--accent2) 14%),var(--surface))}
.human-middle-icon{width:48px;height:48px;border:1px solid var(--line);border-radius:13px;display:grid;place-items:center;background:var(--bg);position:relative;color:var(--accent2)}
.human-middle-icon:before{content:'';position:absolute;left:9px;right:9px;top:23px;height:1px;background:currentColor;opacity:.72}
.human-middle-icon:after{content:'';width:8px;height:8px;border:2px solid currentColor;border-radius:50%;background:var(--bg);z-index:1}
.human-middle-icon i,.human-middle-icon i:before,.human-middle-icon i:after{position:absolute;width:5px;height:5px;border-radius:50%;background:currentColor;content:''}
.human-middle-icon i{left:8px;top:21px}.human-middle-icon i:before{left:27px;top:0}.human-middle-icon i:after{left:13px;top:0;width:3px;height:3px;opacity:.55}
.human-middle-copy{min-width:0;display:block}.human-middle-kicker{display:block;color:var(--accent2);font:500 .59rem/1.4 Consolas,monospace;letter-spacing:.12em;margin-bottom:3px;text-transform:uppercase}
.human-middle-copy strong{display:block;font-size:.91rem;font-weight:560;letter-spacing:-.015em}.human-middle-copy small{display:block;color:var(--muted);font-size:.72rem;line-height:1.5;margin-top:2px}.human-middle-arrow{color:var(--accent);font-size:1.35rem;transition:transform .2s}.human-middle-card:hover .human-middle-arrow{transform:translate(2px,-2px)}
html.hm-open{overflow:hidden}html.hm-open:before{content:'';position:fixed;inset:0;z-index:9998;background:rgba(4,10,12,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
dialog.human-middle-dialog{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;width:min(1500px,calc(100% - 24px));max-width:none;height:94dvh;max-height:94dvh;margin:0;padding:0;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:var(--ink);box-shadow:var(--shadow);overflow:hidden}
dialog.human-middle-dialog::backdrop{display:none}
.hm-shell{height:100%;display:flex;flex-direction:column;min-height:0}.hm-top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px 12px 20px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 94%,transparent);flex:none}.hm-top-title{min-width:0}.hm-top-title .human-middle-kicker{margin:0 0 2px}.hm-top h2{font-size:1rem;line-height:1.2;font-weight:570;letter-spacing:-.025em;margin:0}.hm-top-actions{display:flex;align-items:center;gap:6px;flex:none}.hm-control,.hm-close{min-width:40px;min-height:42px;border:1px solid transparent;border-radius:9px;background:none;color:var(--muted);padding:5px 9px;font:500 1rem/1 'Avenir Next','Segoe UI',Arial,sans-serif}.hm-control:hover,.hm-control[aria-pressed=true],.hm-close:hover{color:var(--ink);background:var(--surface);border-color:var(--line)}.hm-font-controls{display:inline-flex;align-items:center;gap:1px}.hm-font-controls .hm-control{min-width:38px;padding-inline:6px}.hm-font-controls .hm-font-value{min-width:52px;color:var(--muted);font:500 .82rem/1 Consolas,monospace}.hm-close{width:42px;padding:0;font-size:1.35rem;color:var(--ink)}
.hm-scroll{overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;min-height:0}.hm-hero{padding:28px 26px 18px;text-align:center;position:relative;overflow:hidden}.hm-hero:before{content:'';position:absolute;inset:-45% 12% auto;height:360px;background:radial-gradient(circle,color-mix(in srgb,var(--accent2) 12%,transparent),transparent 68%);pointer-events:none}.hm-eyebrow{font:500 .62rem/1.5 Consolas,monospace;letter-spacing:.17em;text-transform:uppercase;color:var(--accent2);position:relative}.hm-hero h3{font-size:clamp(2.1rem,5vw,4.5rem);font-weight:470;letter-spacing:-.06em;line-height:1.02;margin:10px auto 12px;position:relative}.hm-subtitle{font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:clamp(1rem,1.8vw,1.35rem);color:var(--muted);margin:0 auto;max-width:820px;position:relative}.hm-human-data{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:17px 0 0;position:relative}.hm-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:7px 11px;font-size:.69rem;color:var(--muted)}.hm-pill b{color:var(--ink);font-weight:600}.hm-pill.primary{border-color:color-mix(in srgb,var(--accent2) 55%,var(--line));color:var(--accent2)}
.hm-viewbar{display:flex;justify-content:center;align-items:center;gap:7px;padding:0 20px 21px}.hm-segment{display:inline-flex;border:1px solid var(--line);padding:3px;border-radius:999px;background:var(--surface)}.hm-segment button{min-height:35px;border:0;border-radius:999px;background:transparent;color:var(--muted);padding:6px 15px;font-size:.69rem}.hm-segment button[aria-pressed=true]{background:var(--bg);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}.hm-viewhint{font:400 .62rem/1.4 Consolas,monospace;color:var(--muted)}
.hm-mirrors{padding:0 24px 18px;display:grid;gap:10px}.hm-row{display:grid;grid-template-columns:minmax(165px,.82fr) minmax(350px,1.65fr) minmax(165px,.82fr);align-items:stretch;border:1px solid var(--line);border-radius:15px;background:color-mix(in srgb,var(--surface) 91%,var(--bg));overflow:hidden;min-height:118px}.hm-object{padding:18px 17px;display:flex;flex-direction:column;justify-content:center;min-width:0}.hm-object.left{border-right:1px solid var(--line);text-align:right}.hm-object.right{border-left:1px solid var(--line);text-align:left}.hm-object-name{font-size:1.02rem;font-weight:620;line-height:1.28}.hm-object-value{font:400 .76rem/1.5 Consolas,monospace;color:var(--muted);margin-top:6px}.hm-rowno{font:500 .64rem/1 Consolas,monospace;color:var(--accent2);letter-spacing:.1em;margin-bottom:8px}.hm-scale{position:relative;min-width:0;padding:18px 22px 16px;display:flex;align-items:center}.hm-track{position:relative;width:100%;height:80px}.hm-track-line{position:absolute;left:0;right:0;top:36px;height:1px;background:var(--line)}.hm-track-line:before,.hm-track-line:after{content:'';position:absolute;top:-3px;width:7px;height:7px;border-radius:50%;background:var(--muted);opacity:.55}.hm-track-line:before{left:-1px}.hm-track-line:after{right:-1px}.hm-midline{position:absolute;left:50%;top:5px;bottom:5px;width:1px;background:color-mix(in srgb,var(--accent) 45%,var(--line));opacity:.75}.hm-midline:after{content:'50%';position:absolute;top:-6px;left:5px;font:400 .6rem Consolas,monospace;color:var(--muted)}.hm-person{position:absolute;left:50%;top:5px;transform:translateX(-50%);transition:left .65s cubic-bezier(.2,.75,.2,1),opacity .25s;display:flex;flex-direction:column;align-items:center;z-index:2}.hm-person-head{width:9px;height:9px;border-radius:50%;background:var(--accent2);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent2) 16%,transparent)}.hm-person-body{width:2px;height:23px;background:var(--accent2);margin-top:2px;position:relative}.hm-person-body:before{content:'';position:absolute;left:-5px;top:7px;width:12px;height:1px;background:var(--accent2)}.hm-person-label{margin-top:5px;font:600 .66rem/1 Consolas,monospace;letter-spacing:.08em;color:var(--accent2);white-space:nowrap}.hm-pct{position:absolute;top:57px;transform:translateX(-50%);font:600 .8rem/1 Consolas,monospace;color:var(--ink);transition:left .65s cubic-bezier(.2,.75,.2,1),opacity .25s;white-space:nowrap}.hm-unavailable{position:absolute;inset:0;display:none;place-items:center;text-align:center;color:var(--muted);font-size:.78rem;line-height:1.45;padding:12px}.hm-track.is-unavailable .hm-person,.hm-track.is-unavailable .hm-pct{opacity:0}.hm-track.is-unavailable .hm-unavailable{display:grid}.hm-axis-label{position:absolute;bottom:-1px;font:400 .62rem Consolas,monospace;color:var(--muted);opacity:.82}.hm-axis-label.a{left:0}.hm-axis-label.b{right:0}
.hm-dna-grid{padding:0 24px 18px;display:grid;gap:10px}
.hm-dna-row{display:grid;grid-template-columns:minmax(180px,.88fr) minmax(330px,1.35fr) minmax(180px,.88fr);align-items:stretch;border:1px solid var(--line);border-radius:15px;background:color-mix(in srgb,var(--surface) 91%,var(--bg));overflow:hidden;min-height:142px}
.hm-dna-visual{padding:15px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-width:0;text-align:center;color:var(--accent2)}
.hm-dna-visual.left{border-right:1px solid var(--line)}.hm-dna-visual.right{border-left:1px solid var(--line)}
.hm-dna-icon{width:88px;height:70px;display:block;overflow:visible;color:var(--accent2);filter:drop-shadow(0 0 10px color-mix(in srgb,var(--accent2) 10%,transparent))}
.hm-dna-icon.sun,.hm-dna-icon.pluto,.hm-dna-icon.cell,.hm-dna-icon.protein,.hm-dna-icon.blood,.hm-dna-icon.dna{width:72px;height:72px}
.hm-dna-visual strong{font-size:.96rem;line-height:1.25;font-weight:620;color:var(--ink)}
.hm-dna-visual small{font-size:.72rem;line-height:1.42;color:var(--muted);max-width:26ch}
.hm-dna-center{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;text-align:center;padding:17px 22px;min-width:0}
.hm-dna-center:before{content:'';position:absolute;left:7%;right:7%;top:50%;height:1px;background:linear-gradient(90deg,var(--line),var(--accent2),var(--line));opacity:.9}
.hm-dna-center:after{content:'';position:absolute;left:12%;right:12%;top:calc(50% - 15px);height:30px;background:radial-gradient(circle at 6px 6px,var(--accent2) 0 2px,transparent 2.5px) 0 0/24px 15px repeat-x,radial-gradient(circle at 18px 6px,var(--accent) 0 2px,transparent 2.5px) 0 15px/24px 15px repeat-x;opacity:.3;z-index:-1}
.hm-dna-center-card{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;max-width:460px;padding:12px 16px;border:1px solid color-mix(in srgb,var(--accent2) 42%,var(--line));border-radius:13px;background:color-mix(in srgb,var(--surface) 94%,var(--bg))}
.hm-dna-center-card .hm-rowno{margin:0 0 1px}.hm-dna-center-card strong{font-size:1.08rem;line-height:1.25;font-weight:640;color:var(--ink)}
.hm-dna-center-card small{font:400 .76rem/1.48 Consolas,monospace;color:var(--muted)}
.hm-dna-tag{display:inline-flex;border:1px solid var(--line);border-radius:5px;padding:4px 6px;font:600 .58rem/1.2 Consolas,monospace;letter-spacing:.05em;color:var(--accent2)}
.hm-dna-target-labels{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.hm-dna-target-labels span{font:500 .56rem/1.2 Consolas,monospace;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 6px;background:var(--bg)}
.hm-thread{height:1px;background:linear-gradient(90deg,transparent,var(--accent2),transparent);opacity:.35;margin:2px 12% 18px}.hm-callout{margin:0 24px 18px;border:1px solid color-mix(in srgb,var(--accent2) 35%,var(--line));border-radius:15px;padding:15px 17px;background:linear-gradient(120deg,color-mix(in srgb,var(--surface) 88%,var(--accent2) 12%),var(--surface));display:flex;gap:14px;align-items:flex-start}.hm-callout-mark{font:600 .7rem Consolas,monospace;color:var(--accent2);border:1px solid color-mix(in srgb,var(--accent2) 45%,var(--line));border-radius:7px;padding:5px 7px;flex:none}.hm-callout p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.65}.hm-callout strong{color:var(--ink)}
.hm-details{padding:0 24px 28px;display:grid;gap:8px}.hm-details details{border:1px solid var(--line);border-radius:13px;background:var(--surface);overflow:hidden}.hm-details summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px;min-height:50px;font-size:.78rem;font-weight:580}.hm-details summary::-webkit-details-marker{display:none}.hm-details summary:after{content:'+';font:400 1.1rem Consolas,monospace;color:var(--accent2)}.hm-details details[open] summary:after{content:'−'}.hm-detail-body{border-top:1px solid var(--line);padding:15px 16px 17px;color:var(--muted);font-size:.75rem;line-height:1.72}.hm-detail-body p{margin:0 0 11px}.hm-detail-body p:last-child{margin-bottom:0}.hm-fact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.hm-fact{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:11px 12px}.hm-fact p{margin:5px 0 0}.hm-tag{display:inline-flex;border:1px solid var(--line);border-radius:5px;padding:3px 6px;font:600 .52rem/1.3 Consolas,monospace;letter-spacing:.06em;color:var(--accent2)}.hm-tag.estimate{color:var(--warm,#efc78d)}.hm-tag.source{color:var(--accent)}.hm-mono{font-family:Consolas,monospace;color:var(--ink)}.hm-provenance{font:400 .6rem/1.7 Consolas,monospace;overflow-wrap:anywhere}.hm-toe-bridge{margin:0 24px 8px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:.7rem;line-height:1.55}.hm-toe-bridge a{color:var(--accent2);font-weight:650;text-decoration:none}.hm-toe-bridge a:hover{text-decoration:underline}.hm-footer{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:12px 24px 20px;color:var(--muted);font-size:.63rem}.hm-footer strong{color:var(--ink);font-weight:580}
@media(max-width:900px){dialog.human-middle-dialog{width:min(100% - 14px,900px);height:96dvh;max-height:96dvh}.hm-mirrors{padding-inline:14px}.hm-row{grid-template-columns:1fr;min-height:0}.hm-object.left,.hm-object.right{border:0;text-align:left;padding:13px 14px}.hm-object.left{border-bottom:1px solid var(--line)}.hm-object.right{border-top:1px solid var(--line)}.hm-scale{padding:13px 18px}.hm-track{height:78px}.hm-callout,.hm-details{margin-inline:14px}.hm-details{padding:0 0 22px}.hm-hero{padding:24px 17px 16px}.hm-fact-grid{grid-template-columns:1fr}.hm-dna-grid{padding-inline:14px}.hm-dna-row{grid-template-columns:minmax(130px,.8fr) minmax(220px,1.35fr) minmax(130px,.8fr)}.hm-dna-icon{width:72px;height:60px}.hm-dna-icon.sun,.hm-dna-icon.pluto,.hm-dna-icon.cell,.hm-dna-icon.protein,.hm-dna-icon.blood,.hm-dna-icon.dna{width:60px;height:60px}}
@media(max-width:620px){.human-middle{padding:14px 0 17px}.human-middle-card{gap:11px;padding:12px;min-height:74px}.human-middle-icon{width:42px;height:42px;border-radius:11px}.human-middle-copy small{font-size:.66rem}.hm-top{padding:10px 9px 9px 13px;gap:8px;flex-wrap:wrap}.hm-top-title{flex:1 0 100%}.hm-top-title .human-middle-kicker{font-size:.5rem}.hm-top h2{font-size:.86rem}.hm-control{padding:6px 7px;min-height:36px}.hm-close{width:38px;min-height:38px}.hm-top-actions{gap:4px;width:100%;justify-content:flex-end;flex-wrap:wrap}.hm-font-controls .hm-control{min-width:31px}.hm-font-controls .hm-font-value{min-width:46px;font-size:.74rem}.hm-hero h3{font-size:clamp(2rem,12vw,3.2rem)}.hm-viewbar{flex-direction:column;gap:6px;padding-bottom:16px}.hm-mirrors,.hm-dna-grid{padding-inline:8px}.hm-row,.hm-dna-row{border-radius:12px}.hm-dna-row{grid-template-columns:82px minmax(0,1fr) 82px;min-height:126px}.hm-dna-visual{padding:9px 5px;gap:4px}.hm-dna-visual small{display:none}.hm-dna-visual strong{font-size:.68rem}.hm-dna-icon,.hm-dna-icon.sun,.hm-dna-icon.pluto,.hm-dna-icon.cell,.hm-dna-icon.protein,.hm-dna-icon.blood,.hm-dna-icon.dna{width:48px;height:48px}.hm-dna-center{padding:9px 5px}.hm-dna-center-card{padding:8px 7px;gap:4px;border-radius:10px}.hm-dna-center-card strong{font-size:.82rem}.hm-dna-center-card small{font-size:.6rem}.hm-dna-tag{font-size:.48rem;padding:3px 4px}.hm-callout{margin-inline:8px}.hm-details{margin-inline:8px}.hm-toe-bridge{margin-inline:8px}.hm-detail-body{padding-inline:13px}.hm-footer{padding-inline:12px}}
@media(prefers-reduced-motion:reduce){.human-middle-card,.human-middle-arrow,.hm-person,.hm-pct{transition:none}}
`;document.head.appendChild(style);
const root=document.documentElement;
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const dialog=$('#human-middle-dialog'), openBtn=$('#human-middle-open');
if(!dialog||!openBtn)return;
const T={
 sl:{
  title:'Človek na sredini',top:'BD × AI LAB · SCALE',eyebrow:'PET ZRCAL · LOGARITEMSKA LESTVICA',sub:'Bolj ko gledaš navznoter, bližje je zrcalo navzven.',human:'ČLOVEK',size:'VELIKOST',mass:'MASA',dna:'DNA',view:'Pogled',dnaHint:'DNA skozi merila: celica → človek → kri → gen → človeštvo',noMass:'Za ta par ni smiselne masne primerjave.',
  dnaCell:'DNA ene celice, raztegnjena',dnaHuman:'Vsa DNA enega človeka',dnaHumanV:'do Plutona · ~1.3 ha · ~20 g',
  row:[
   ['Planckova dolžina','1.6×10⁻³⁵ m','masa: —','vidno vesolje','~8.8×10²⁶ m (premer)','masa: —'],
   ['proton','~1.7×10⁻¹⁵ m','1.67×10⁻²⁷ kg','osončje','~1.18×10¹³ m (Plutonova orbita)','1.99×10³⁰ kg'],
   ['atom (vodik)','0.1 nm','1.7×10⁻²⁷ kg','Sonce','1.39×10⁹ m','1.99×10³⁰ kg'],
   ['beljakovina','~5 nm','~8.3×10⁻²³ kg (50 kDa)','Zemlja','1.27×10⁷ m','5.97×10²⁴ kg'],
   ['celica','~10 µm','~10⁻¹² kg (1 ng)','Slovenija','248 km (vzhod–zahod)','~3.0×10¹⁶ kg*']
  ],
  dnaTitle:'DNA nit',dnaSummary:'Dodatne primerjave ostanejo zložene, dokler jih ne želiš pogledati.',
  dnaFacts:[
   ['OCENA','DNA človeštva ≈ do Andromede in nazaj.'],
   ['VIR / IZRAČUN','Masa skoraj vsa v središču: atom 99.95 % v jedru, osončje 99.86 % v Soncu. To ni planetarni model atoma.'],
   ['OCENA','DNA vseh celic enega človeka ≈ razdalja Sonce–Pluton.'],
   ['IZRAČUN','DNA ene celice: ~4×10¹¹ atomov.'],
   ['OCENA','DNA belih krvničk v ~1 dl krvi ≈ premer Sonca.'],
   ['IZRAČUN','1 zavoj DNA vijačnice: ~3.4 nm, ~690 atomov.'],
   ['IZRAČUN','Zapis DNA za 50 kDa beljakovino: ~0.46 µm (~90× daljši); cel gen z introni: ~8 µm ≈ velikost celice.'],
   ['OCENA','DNA belih krvničk v ~1 mL krvi ≈ premer Zemlje.'],
   ['VIR','Vsaka celica z jedrom nosi skoraj isti zapis DNA; ~84 % celic (rdeče krvničke) nima DNA.'],
   ['OCENA','DNA v kapljici krvi ≈ 2–5 × dolžina Slovenije; DNA prebivalcev ~100 Slovenij ≈ premer Rimske ceste.']
  ],
  cosmicTitle:'Ko 57 % postane 50 %',cosmic:'Vesolje se širi. Da bo človek (1.7 m) natanko na sredini med Planckovo dolžino in premerom vidnega vesolja, mora vesolje zrasti ~2×10⁸-krat — po standardnem modelu (ΛCDM) čez ~330 milijard let.',cosmicNote:'Izračun v modelu: ~326 Gyr za 1.7 m; predpostavka je konstantna temna energija.',
  lessTitle:'Less describes more.',less1:'Lokalno slogan NE velja: zapis za beljakovino je fizično ~90×, z introni ~1600× daljši od izdelka.',less2:'Globalno velja: en zapis (~4×10¹¹ atomov) se ponovno uporabi v ~3×10¹² celicah in z alternativnim izrezovanjem en gen da več beljakovin.',less3:'Opis je relativen glede na dekoder (jajčna celica + celični stroji + fizika): K(človek | dekoder), ne K(človek). Opis se splača, ko se ponovno uporablja.',
  methodTitle:'Metode, predpostavke in viri',methodIntro:'Logaritemska lestvica. % = položaj človeka med levim in desnim objektom. Planckova dolžina je meja fizike, ne objekt; za maso ni smiselnega para. Oznake: IZRAČUN = deterministično iz navedenih vhodov · OCENA = red velikosti · VIR = zunanji podatek. Vrednosti DNA so ocene reda velikosti.',methods:[
   ['IZRAČUN','Položaj: pct = (log x − log a)/(log b − log a); človek = 1.7 m / 70 kg.'],
   ['IZRAČUN','Masa Slovenije = površina × povprečna nadmorska višina 557 m × 2700 kg/m³; dogovor: kamnina nad morsko gladino.'],
   ['OCENA','DNA na celico: diploidni genom ~6.4×10⁹ bp × 0.34 nm ≈ 2.2 m; DNA enega človeka ≈ 6.5×10¹² m ≈ 44 AU, ~1.3 ha kot 2 nm trak, ~20 g.'],
   ['OCENA','Kri: levkociti 4.5–11×10⁶/mL; premer Sonca → 58–142 mL, Zemlje → 0.53–1.3 mL, kapljica 50 µL → 2.0–4.8 × 248 km.'],
   ['VIR','Sender, Fuchs & Milo (2016), PLoS Biol 14(8):e1002533; BioNumbers 112985, 113005.'],
   ['VIR','CSHL Guide to the Human Genome: mediana človeškega gena 23 329 bp; Casanova et al. (2019), PMC7029956.'],
   ['IZRAČUN','ΛCDM: H₀ 67.7, Ωm 0.31, ΩΛ 0.69; premer vidnega vesolja danes 8.75×10²⁶ m; ~326 Gyr do 50 % pri 1.7 m.']
  ],
  provenance:'Vir resnice: CLOVEK_NA_SREDINI_v3_CONTENT.md · SHA-256 45b509967c363636ec8773a60188f830a2cf7d211af17ba80216861b07aae5be · izračun: facts_calc.py · paket SHA-256 deb4d4ff863c9c89b429570fc4704eda13d006bead37c279ada2ce951745838b.',
  toeBridge:'Ta zrcala merila in DNA odpirajo širše vprašanje: kako se med ravnmi povezujejo informacija, organizacija in generativna kontinuiteta.',toeLink:'Nadaljuj v ToE',footer:'BD × AI Lab · koncept in vsebina: BD + Claude · spletna izvedba: GPT · oktober 2026',close:'Zapri'
 },
 en:{
  title:'Human in the Middle',top:'BD × AI LAB · SCALE',eyebrow:'FIVE MIRRORS · LOGARITHMIC SCALE',sub:'The further inward you look, the nearer the outward mirror.',human:'HUMAN',size:'SIZE',mass:'MASS',dna:'DNA',view:'View',dnaHint:'DNA across scales: cell → human → blood → gene → humanity',noMass:'There is no meaningful mass pair for this mirror.',
  dnaCell:'DNA from one cell, stretched out',dnaHuman:'All DNA in one human',dnaHumanV:'to Pluto · ~1.3 ha · ~20 g',
  row:[
   ['Planck length','1.6×10⁻³⁵ m','mass: —','observable universe','~8.8×10²⁶ m (diameter)','mass: —'],
   ['proton','~1.7×10⁻¹⁵ m','1.67×10⁻²⁷ kg','Solar System','~1.18×10¹³ m (Pluto orbit)','1.99×10³⁰ kg'],
   ['atom (hydrogen)','0.1 nm','1.7×10⁻²⁷ kg','Sun','1.39×10⁹ m','1.99×10³⁰ kg'],
   ['protein','~5 nm','~8.3×10⁻²³ kg (50 kDa)','Earth','1.27×10⁷ m','5.97×10²⁴ kg'],
   ['cell','~10 µm','~10⁻¹² kg (1 ng)','Slovenia','248 km (east–west)','~3.0×10¹⁶ kg*']
  ],
  dnaTitle:'The DNA thread',dnaSummary:'The extra comparisons stay folded until you want to inspect them.',
  dnaFacts:[
   ['ESTIMATE','Humanity’s DNA ≈ to Andromeda and back.'],
   ['SOURCE / CALC','Almost all mass is central: 99.95% of a hydrogen atom’s mass is in the nucleus; the Sun holds 99.86% of Solar-System mass. This is not a planetary model of the atom.'],
   ['ESTIMATE','All DNA in one human ≈ the Sun–Pluto distance.'],
   ['CALC','DNA in one cell: ~4×10¹¹ atoms.'],
   ['ESTIMATE','DNA in white blood cells from ~1 dL of blood ≈ the Sun’s diameter.'],
   ['CALC','One DNA helix turn: ~3.4 nm, ~690 atoms.'],
   ['CALC','DNA coding for a 50 kDa protein: ~0.46 µm (~90× longer); a whole gene with introns: ~8 µm ≈ cell size.'],
   ['ESTIMATE','DNA in white blood cells from ~1 mL of blood ≈ Earth’s diameter.'],
   ['SOURCE','Each nucleated cell carries almost the same DNA record; ~84% of cells (red blood cells) contain no DNA.'],
   ['ESTIMATE','DNA in a drop of blood ≈ 2–5 × Slovenia’s length; DNA from the population of ~100 Slovenias ≈ the Milky Way’s diameter.']
  ],
  cosmicTitle:'When 57% becomes 50%',cosmic:'The universe expands. For a human (1.7 m) to sit exactly halfway between the Planck length and the diameter of the observable universe, the universe must grow by ~2×10⁸ — in the standard ΛCDM model, in ~330 billion years.',cosmicNote:'Model calculation: ~326 Gyr for 1.7 m; assumes constant dark energy.',
  lessTitle:'Less describes more.',less1:'Locally, the slogan does NOT hold: the DNA record for a protein is physically ~90× longer than the folded product, and with introns ~1600× longer.',less2:'Globally it does: one record (~4×10¹¹ atoms) is reused across ~3×10¹² cells, and alternative splicing lets one gene yield multiple proteins.',less3:'Description is relative to a decoder (egg cell + cellular machinery + physics): K(human | decoder), not K(human). A description pays when it is reused.',
  methodTitle:'Methods, assumptions & sources',methodIntro:'Logarithmic scale. % = the human position between the left and right objects. The Planck length is a boundary of physics, not an object; it has no meaningful mass pair. Labels: CALC = deterministic from stated inputs · ESTIMATE = order of magnitude · SOURCE = external datum. DNA values are order-of-magnitude estimates.',methods:[
   ['CALC','Position: pct = (log x − log a)/(log b − log a); human = 1.7 m / 70 kg.'],
   ['CALC','Slovenia mass = area × mean elevation 557 m × 2700 kg/m³; convention: rock above sea level.'],
   ['ESTIMATE','DNA per nucleated cell: diploid genome ~6.4×10⁹ bp × 0.34 nm ≈ 2.2 m; one human ≈ 6.5×10¹² m ≈ 44 AU, ~1.3 ha as a 2 nm ribbon, ~20 g.'],
   ['ESTIMATE','Blood: white cells 4.5–11×10⁶/mL; Sun diameter → 58–142 mL, Earth → 0.53–1.3 mL, 50 µL drop → 2.0–4.8 × 248 km.'],
   ['SOURCE','Sender, Fuchs & Milo (2016), PLoS Biol 14(8):e1002533; BioNumbers 112985, 113005.'],
   ['SOURCE','CSHL Guide to the Human Genome: median human gene 23,329 bp; Casanova et al. (2019), PMC7029956.'],
   ['CALC','ΛCDM: H₀ 67.7, Ωm 0.31, ΩΛ 0.69; observable-universe diameter today 8.75×10²⁶ m; ~326 Gyr to 50% at 1.7 m.']
  ],
  provenance:'Source of truth: CLOVEK_NA_SREDINI_v3_CONTENT.md · SHA-256 45b509967c363636ec8773a60188f830a2cf7d211af17ba80216861b07aae5be · calculation: facts_calc.py · package SHA-256 deb4d4ff863c9c89b429570fc4704eda13d006bead37c279ada2ce951745838b.',
  toeBridge:'These scale and DNA mirrors open a wider question: how information, organization and generative continuity connect across levels.',toeLink:'Continue in ToE',footer:'BD × AI Lab · concept and content: BD + Claude · web implementation: GPT · October 2026',close:'Close'
 }
};
const DNA={
 sl:[
  {left:'milky',leftLabel:'RIMSKA CESTA',leftText:'DNA prebivalcev ~100 Slovenij ≈ premer Rimske ceste',title:'DNA človeštva',center:'8.2×10⁹ ljudi × DNA na človeka',tag:'OCENA',right:'andromeda',rightLabel:'ANDROMEDA',rightText:'≈ do Andromede in nazaj · ~5.7×10⁶ svetlobnih let'},
  {left:'sun',leftLabel:'SONCE',leftText:'izhodišče primerjave',title:'Vsa DNA enega človeka',center:'≈ 6.5×10¹² m · ≈ 44 AU · ~1.3 ha kot 2 nm trak · ~20 g',tag:'OCENA',right:'pluto',rightLabel:'PLUTON',rightText:'≈ razdalja Sonce–Pluton'},
  {left:'cell',leftLabel:'CELICA',leftText:'celica z jedrom',title:'DNA ene celice',center:'~2.2 m · ~4×10¹¹ atomov · skoraj isti zapis v vsaki celici z jedrom',tag:'OCENA / VIR',right:'dna',rightLabel:'RAZTEGNJENA DNA',rightText:'~2.2 m'},
  {left:'protein',leftLabel:'BELJAKOVINA',leftText:'50 kDa · ~5 nm',title:'Gen ↔ beljakovina',center:'1 zavoj DNA ~3.4 nm · ~690 atomov · zapis ~0.46 µm (~90×)',tag:'IZRAČUN',right:'cell',rightLabel:'CEL GEN + CELICA',rightText:'z introni ~8 µm ≈ velikost celice'},
  {left:'blood',leftLabel:'KRI',leftText:'DNA belih krvničk',title:'DNA v krvi',center:'~1 dl → premer Sonca · ~1 mL → premer Zemlje · 50 µL → 2–5 × Slovenija',tag:'OCENA',right:'targets',rightLabel:'SONCE · ZEMLJA · SLOVENIJA',rightText:'tri merila iz istega vzorca'}
 ],
 en:[
  {left:'milky',leftLabel:'MILKY WAY',leftText:'DNA from the population of ~100 Slovenias ≈ Milky Way diameter',title:'Humanity’s DNA',center:'8.2×10⁹ people × DNA per human',tag:'ESTIMATE',right:'andromeda',rightLabel:'ANDROMEDA',rightText:'≈ to Andromeda and back · ~5.7×10⁶ light-years'},
  {left:'sun',leftLabel:'SUN',leftText:'comparison origin',title:'All DNA in one human',center:'≈ 6.5×10¹² m · ≈ 44 AU · ~1.3 ha as a 2 nm ribbon · ~20 g',tag:'ESTIMATE',right:'pluto',rightLabel:'PLUTO',rightText:'≈ Sun–Pluto distance'},
  {left:'cell',leftLabel:'CELL',leftText:'nucleated cell',title:'DNA in one cell',center:'~2.2 m · ~4×10¹¹ atoms · almost the same record in each nucleated cell',tag:'ESTIMATE / SOURCE',right:'dna',rightLabel:'STRETCHED DNA',rightText:'~2.2 m'},
  {left:'protein',leftLabel:'PROTEIN',leftText:'50 kDa · ~5 nm',title:'Gene ↔ protein',center:'1 DNA turn ~3.4 nm · ~690 atoms · coding record ~0.46 µm (~90×)',tag:'CALC',right:'cell',rightLabel:'WHOLE GENE + CELL',rightText:'with introns ~8 µm ≈ cell size'},
  {left:'blood',leftLabel:'BLOOD',leftText:'white-cell DNA',title:'DNA in blood',center:'~1 dL → Sun diameter · ~1 mL → Earth diameter · 50 µL → 2–5 × Slovenia',tag:'ESTIMATE',right:'targets',rightLabel:'SUN · EARTH · SLOVENIA',rightText:'three scales from the same pattern'}
 ]
};
const positions={size:[57,54,53,55,50],mass:[null,50,50,51,49]};
let mode='size';
function lang(){return root.dataset.lang==='sl'?'sl':'en'}
function tagClass(s){const x=s.toLowerCase();return x.includes('ocena')||x.includes('estimate')?'estimate':x.includes('vir')||x.includes('source')?'source':''}
function factCards(items){return items.map(([tag,body])=>`<article class="hm-fact"><span class="hm-tag ${tagClass(tag)}">${tag}</span><p>${body}</p></article>`).join('')}
function dnaIcon(kind){
 const common='viewBox="0 0 120 80" class="hm-dna-icon '+kind+'" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
 if(kind==='milky')return '<svg '+common+'><ellipse cx="60" cy="40" rx="48" ry="18" transform="rotate(-10 60 40)" opacity=".25"/><path d="M18 43c14-26 70-31 86-6M26 50c19-17 58-21 73-9M39 52c16-10 38-11 50-6" opacity=".8"/><circle cx="61" cy="39" r="5" fill="currentColor" opacity=".65"/><g fill="currentColor" stroke="none" opacity=".55"><circle cx="16" cy="25" r="1.5"/><circle cx="105" cy="21" r="1.3"/><circle cx="96" cy="61" r="1.2"/><circle cx="30" cy="18" r="1"/></g></svg>';
 if(kind==='andromeda')return '<svg '+common+'><ellipse cx="60" cy="40" rx="51" ry="12" transform="rotate(8 60 40)" opacity=".25"/><path d="M12 42c18-19 76-20 97-2M24 49c21-12 58-13 77-5" opacity=".8"/><ellipse cx="61" cy="40" rx="9" ry="4" fill="currentColor" opacity=".62"/><g fill="currentColor" stroke="none" opacity=".55"><circle cx="18" cy="25" r="1.3"/><circle cx="104" cy="58" r="1.4"/><circle cx="91" cy="20" r="1"/></g></svg>';
 if(kind==='sun')return '<svg '+common+' viewBox="0 0 80 80"><circle cx="40" cy="40" r="18" fill="currentColor" opacity=".25"/><circle cx="40" cy="40" r="15"/><path d="M40 5v12M40 63v12M5 40h12M63 40h12M15 15l9 9M56 56l9 9M65 15l-9 9M24 56l-9 9"/></svg>';
 if(kind==='pluto')return '<svg '+common+' viewBox="0 0 80 80"><ellipse cx="40" cy="43" rx="29" ry="10" transform="rotate(-18 40 43)" opacity=".35"/><circle cx="40" cy="40" r="17" fill="currentColor" opacity=".16"/><circle cx="40" cy="40" r="17"/><path d="M29 33c5-5 13-7 20-2M31 48c7 3 14 3 20-1" opacity=".7"/><circle cx="66" cy="30" r="3" fill="currentColor" stroke="none"/></svg>';
 if(kind==='cell')return '<svg '+common+' viewBox="0 0 80 80"><path d="M13 40c0-18 11-29 28-29 18 0 27 13 27 29S58 69 40 69C22 69 13 58 13 40Z" fill="currentColor" opacity=".08"/><path d="M13 40c0-18 11-29 28-29 18 0 27 13 27 29S58 69 40 69C22 69 13 58 13 40Z"/><circle cx="40" cy="40" r="11" fill="currentColor" opacity=".2"/><circle cx="40" cy="40" r="11"/><circle cx="31" cy="28" r="2" fill="currentColor" stroke="none"/><circle cx="54" cy="49" r="2" fill="currentColor" stroke="none"/></svg>';
 if(kind==='dna')return '<svg '+common+' viewBox="0 0 80 80"><path d="M22 8c33 16 33 48 0 64M58 8C25 24 25 56 58 72"/><path d="M27 16h26M22 28h36M22 40h36M22 52h36M27 64h26" opacity=".55"/></svg>';
 if(kind==='protein')return '<svg '+common+' viewBox="0 0 80 80"><path d="M13 42c5-23 20-29 31-14 8 11-9 13-2 25 7 11 24 5 24-10 0-18-21-31-37-22-12 7-16 29-3 38 11 8 24 0 22-10" /><g fill="currentColor" stroke="none" opacity=".45"><circle cx="18" cy="40" r="3"/><circle cx="43" cy="28" r="3"/><circle cx="43" cy="53" r="3"/><circle cx="62" cy="42" r="3"/></g></svg>';
 if(kind==='blood')return '<svg '+common+' viewBox="0 0 80 80"><path d="M40 8C31 25 18 38 18 51a22 22 0 0 0 44 0C62 38 49 25 40 8Z" fill="currentColor" opacity=".12"/><path d="M40 8C31 25 18 38 18 51a22 22 0 0 0 44 0C62 38 49 25 40 8Z"/><path d="M28 52c2 7 7 11 14 12" opacity=".65"/></svg>';
 return '<svg '+common+'><circle cx="24" cy="39" r="13"/><circle cx="60" cy="39" r="9"/><path d="M42 39h7M72 39h18"/><ellipse cx="101" cy="39" rx="11" ry="5"/><path d="M93 39c4-7 13-8 17-2" opacity=".7"/></svg>';
}
function dnaRows(l){return '<div class="hm-dna-grid">'+DNA[l].map((d,i)=>'<article class="hm-dna-row"><div class="hm-dna-visual left">'+dnaIcon(d.left)+'<strong>'+d.leftLabel+'</strong><small>'+d.leftText+'</small></div><div class="hm-dna-center"><div class="hm-dna-center-card"><span class="hm-rowno">0'+(i+1)+' · DNA</span><strong>'+d.title+'</strong><small>'+d.center+'</small><span class="hm-dna-tag">'+d.tag+'</span></div></div><div class="hm-dna-visual right">'+dnaIcon(d.right)+'<strong>'+d.rightLabel+'</strong><small>'+d.rightText+'</small></div></article>').join('')+'</div>'}
function fontScale(){let v=1;try{v=Number(localStorage.getItem('mdlxdcc-font')||1)}catch(_){}if(!Number.isFinite(v))v=1;return Math.max(.8,Math.min(1.5,v))}
function fontPct(){return Math.round(fontScale()*100)+'%'}
function syncHmFont(){const v=fontScale(),value=$('#hm-font-value',dialog),down=$('#hm-font-down',dialog),up=$('#hm-font-up',dialog);if(value)value.textContent=Math.round(v*100)+'%';if(down)down.disabled=v<=.8;if(up)up.disabled=v>=1.5}
function shell(l){const t=T[l];return `<div class="hm-shell">
 <div class="hm-top"><div class="hm-top-title"><span class="human-middle-kicker">${t.top}</span><h2 id="human-middle-title">${t.title}</h2></div><div class="hm-top-actions"><div class="hm-font-controls" role="group" aria-label="${l==='sl'?'Velikost besedila':'Text size'}"><button class="hm-control" id="hm-font-down" type="button" aria-label="${l==='sl'?'Manjše besedilo':'Smaller text'}">A−</button><button class="hm-control hm-font-value" id="hm-font-value" type="button" aria-label="${l==='sl'?'Ponastavi velikost besedila na 100 %':'Reset text size to 100%'}">${fontPct()}</button><button class="hm-control" id="hm-font-up" type="button" aria-label="${l==='sl'?'Večje besedilo':'Larger text'}">A+</button></div><button class="hm-control" type="button" data-hm-lang="sl" aria-pressed="${l==='sl'}">SL</button><button class="hm-control" type="button" data-hm-lang="en" aria-pressed="${l==='en'}">EN</button><button class="hm-control" id="hm-theme" type="button" aria-label="Theme">◐</button><button class="hm-close" id="human-middle-close" type="button" aria-label="${t.close}">×</button></div></div>
 <div class="hm-scroll" id="human-middle-scroll">
  <section class="hm-hero"><div class="hm-eyebrow">${t.eyebrow}</div><h3>${t.title}</h3><p class="hm-subtitle">${t.sub}</p><div class="hm-human-data"><span class="hm-pill primary"><b>${t.human}</b> 1.7 m · 70 kg</span><span class="hm-pill"><b>${t.dnaCell}:</b> ~2.2 m</span><span class="hm-pill"><b>${t.dnaHuman}:</b> ${t.dnaHumanV}</span></div></section>
  <div class="hm-viewbar"><div class="hm-segment" role="group" aria-label="${t.view}"><button type="button" data-hm-mode="size" aria-pressed="${mode==='size'}">${t.size}</button><button type="button" data-hm-mode="mass" aria-pressed="${mode==='mass'}">${t.mass}</button><button type="button" data-hm-mode="dna" aria-pressed="${mode==='dna'}">${t.dna}</button></div><span class="hm-viewhint">${mode==='dna'?t.dnaHint:`0% ← ${t.human} → 100%`}</span></div>
  ${mode==='dna'?dnaRows(l):`<section class="hm-mirrors" aria-label="${t.title}">${t.row.map((r,i)=>rowHtml(t,r,i)).join('')}</section>`}
  <div class="hm-thread" aria-hidden="true"></div>
  ${mode==='dna'?'':`<aside class="hm-callout"><span class="hm-callout-mark">DNA</span><p><strong>${t.dnaTitle}.</strong> ${t.dnaSummary}</p></aside>`}
  <section class="hm-details">
   <details><summary>${t.dnaTitle}</summary><div class="hm-detail-body"><div class="hm-fact-grid">${factCards(t.dnaFacts)}</div></div></details>
   <details><summary>${t.cosmicTitle}</summary><div class="hm-detail-body"><p>${t.cosmic}</p><p><span class="hm-tag">${l==='sl'?'IZRAČUN':'CALC'}</span> ${t.cosmicNote}</p></div></details>
   <details><summary>${t.lessTitle}</summary><div class="hm-detail-body"><p>${t.less1}</p><p>${t.less2}</p><p>${t.less3}</p></div></details>
   <details><summary>${t.methodTitle}</summary><div class="hm-detail-body"><p>${t.methodIntro}</p><div class="hm-fact-grid">${factCards(t.methods)}</div><p class="hm-provenance">${t.provenance}</p></div></details>
  </section>
  <aside class="hm-toe-bridge"><span>${t.toeBridge}</span><a href="./crp/ToE.html#generative-continuity">${t.toeLink} ↗</a></aside>
  <footer class="hm-footer"><span><strong>Less describes more.</strong></span><span>${t.footer}</span></footer>
 </div></div>`}
function rowHtml(t,r,i){const p=positions[mode][i],unavailable=p==null;return `<article class="hm-row" data-hm-row="${i}"><div class="hm-object left"><span class="hm-rowno">0${i+1} · ${mode==='size'?t.size:t.mass}</span><span class="hm-object-name">${r[0]}</span><span class="hm-object-value">${mode==='size'?r[1]:r[2]}</span></div><div class="hm-scale"><div class="hm-track${unavailable?' is-unavailable':''}" style="--hm-pos:${p==null?50:p}"><span class="hm-track-line"></span><span class="hm-midline"></span><span class="hm-person" style="left:${p==null?50:p}%"><span class="hm-person-head"></span><span class="hm-person-body"></span><span class="hm-person-label">${t.human}</span></span><span class="hm-pct" style="left:${p==null?50:p}%">${p==null?'—':p+' %'+(mode==='mass'&&i===4?'*':'')}</span><span class="hm-axis-label a">${r[0]}</span><span class="hm-axis-label b">${r[3]}</span><span class="hm-unavailable">${t.noMass}</span></div></div><div class="hm-object right"><span class="hm-rowno">${mode==='size'?t.size:t.mass} · ${unavailable?'—':p+' %'+(mode==='mass'&&i===4?'*':'')}</span><span class="hm-object-name">${r[3]}</span><span class="hm-object-value">${mode==='size'?r[4]:r[5]}</span></div></article>`}

/* HUMAN_MIDDLE_GALLERY_V4_20261007 · responsive overviews and expandable portrait gallery */
const galleryStyle=document.createElement('style');
galleryStyle.id='human-middle-gallery-v4-style';
galleryStyle.textContent=`
.hm-gallery-tabs{display:flex;justify-content:center;gap:6px;padding:11px 18px;border-bottom:1px solid var(--line);flex:none}
.hm-gallery-tab{min-height:40px;padding:8px 16px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font:600 .66rem/1.25 Consolas,monospace;letter-spacing:.04em}
.hm-gallery-tab[aria-pressed=true]{color:var(--ink);border-color:var(--accent2)}
.hm-gallery-pane{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden;background:#05090a}
.hm-gallery-pane[hidden],.hm-data-pane[hidden],.hm-detail-grid[hidden],.hm-detail-viewer[hidden]{display:none!important}
.hm-gallery-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;border-bottom:1px solid var(--line);background:var(--bg);flex:none}
.hm-gallery-kicker{font:600 .58rem/1.4 Consolas,monospace;letter-spacing:.08em;color:var(--accent2)}
.hm-gallery-actions{display:flex;align-items:center;gap:5px}
.hm-gallery-action{min-width:42px;min-height:42px;padding:6px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font:600 1rem/1 Arial,sans-serif}
.hm-gallery-action:hover,.hm-gallery-action:focus-visible,.hm-gallery-tab:focus-visible,.hm-detail-card:focus-visible{outline:2px solid var(--accent2);outline-offset:2px}
.hm-gallery-count{min-width:48px;text-align:center;font:600 .66rem/1.2 Consolas,monospace;color:var(--muted)}
.hm-gallery-stage{position:relative;flex:1;min-height:0;overflow:auto;display:grid;place-items:center;overscroll-behavior:contain;touch-action:pan-y pinch-zoom}
.hm-overview-frame{position:relative;width:min(100%,var(--hm-overview-fit,100%));margin:auto}
.hm-overview-frame picture,.hm-overview-image{display:block;width:100%;height:auto}
.hm-overview-image{user-select:none;-webkit-user-drag:none;cursor:zoom-in}
.hm-hotspots{display:none;position:absolute;inset:0;pointer-events:none}
.hm-hotspot{position:absolute;left:0;width:100%;border:0;background:transparent;color:#fff;pointer-events:auto;cursor:pointer;padding:0}
.hm-hotspot span{position:absolute;bottom:8px;right:8px;max-width:90%;padding:7px 10px;border:1px solid #a8e8ed;border-radius:8px;background:#06121fea;font:600 .7rem/1.35 Consolas,monospace;opacity:0;transition:opacity .15s}
.hm-hotspot:hover,.hm-hotspot:focus-visible{outline:2px solid #a8e8ed;outline-offset:-3px;background:#b5edf808}
.hm-hotspot:hover span,.hm-hotspot:focus-visible span{opacity:1}
.hm-gallery-stage.is-zoomed{display:block}.hm-gallery-stage.is-zoomed .hm-overview-frame{width:180%;max-width:none}.hm-gallery-stage.is-zoomed .hm-overview-image{cursor:zoom-out}
.hm-gallery-meta{padding:9px 15px 12px;border-top:1px solid var(--line);background:var(--bg);flex:none}
.hm-gallery-meta strong{font-size:.78rem;font-weight:620}.hm-gallery-meta small{display:block;color:var(--muted);font-size:.68rem;line-height:1.5;margin:3px 0 8px}
.hm-overview-links{display:flex;flex-wrap:wrap;gap:6px}
.hm-overview-link{border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--accent2);padding:6px 10px;min-height:34px;font-size:.65rem;cursor:pointer}
.hm-gallery-meta a{display:inline-block;color:var(--accent2);font-size:.65rem;margin-top:7px;text-decoration:underline;text-underline-offset:3px}
.hm-data-pane{flex:1;min-height:0}
.hm-detail-grid{flex:1;min-height:0;overflow:auto;padding:20px 24px 28px;overscroll-behavior:contain;background:var(--bg)}
.hm-detail-grid-intro{margin:0 0 18px;color:var(--muted);font-size:.8rem;line-height:1.6}
.hm-detail-group{max-width:1050px;margin:0 auto 28px}.hm-detail-group h3{font-size:1rem;margin:0 0 12px;color:var(--ink)}
.hm-detail-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.hm-detail-card{display:block;min-width:0;width:100%;padding:0;overflow:hidden;text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);cursor:pointer}
.hm-detail-card img{display:block;width:100%;height:auto;aspect-ratio:608/1080;object-fit:contain;background:#030609}
.hm-detail-card span{display:block;padding:11px 12px;font-size:.72rem;line-height:1.45}
.hm-detail-viewer{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;background:#030609;color:#e8f4f6}
.hm-detail-toolbar{display:flex;align-items:center;gap:5px;flex:none;padding:calc(7px + env(safe-area-inset-top)) max(7px,env(safe-area-inset-right)) 7px max(7px,env(safe-area-inset-left));background:#061014;border-bottom:1px solid #213b42}
.hm-detail-toolbar .hm-gallery-action{color:#e8f4f6;background:#102127;border-color:#29424b;flex:none}
.hm-detail-caption{flex:1;min-width:0;padding:0 5px;font:600 .7rem/1.45 Consolas,monospace;color:#b6e9eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-detail-stage{flex:1;min-height:0;overflow:auto;display:grid;place-items:center;overscroll-behavior:contain;touch-action:pan-y pinch-zoom;padding-bottom:env(safe-area-inset-bottom)}
.hm-detail-stage img{display:block;width:100%;height:100%;min-height:0;object-fit:contain;user-select:none;-webkit-user-drag:none}
.hm-detail-stage.is-zoomed{display:block}.hm-detail-stage.is-zoomed img{width:180%;height:auto;max-width:none;max-height:none;margin:auto}
.hm-detail-viewer:fullscreen{width:100%;height:100%;position:fixed}
dialog.human-middle-dialog.hm-detail-open,dialog.human-middle-dialog.hm-gallery-fallback-fullscreen{inset:0!important;left:0!important;top:0!important;transform:none!important;width:100%!important;height:100dvh!important;max-height:none!important;border:0!important;border-radius:0!important}
.hm-gallery-fallback-fullscreen .hm-overview-frame{width:min(100%,var(--hm-overview-fit,100%))}
@media(max-width:700px){
 .hm-gallery-tabs{padding:8px;gap:5px}.hm-gallery-tab{flex:1;padding:7px 5px;font-size:.6rem}
 .hm-gallery-toolbar{padding:6px 8px}.hm-gallery-kicker{font-size:.5rem;max-width:90px}.hm-gallery-action{min-width:40px;min-height:40px}
 .hm-overview-frame,.hm-gallery-fallback-fullscreen .hm-overview-frame{width:100%}.hm-hotspots{display:block}.hm-overview-image{cursor:default}
 .hm-gallery-stage.is-zoomed .hm-overview-frame{width:200%}.hm-gallery-meta{padding:8px 10px}.hm-gallery-meta small{font-size:.64rem}
 .hm-overview-link{font-size:.61rem;padding:5px 8px}.hm-detail-grid{padding:14px 12px 20px}.hm-detail-cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .hm-detail-card span{font-size:.67rem;padding:8px}.hm-detail-caption{font-size:.6rem}.hm-detail-toolbar{gap:3px}.hm-detail-toolbar .hm-gallery-action{min-width:38px;min-height:42px}.hm-detail-stage.is-zoomed img{width:220%}
}
@media(prefers-reduced-motion:reduce){.hm-hotspot span{transition:none}}
`;
document.head.appendChild(galleryStyle);

const SPACE_ASSETS='./assets/human-middle/v4/';
const SPACE_GROUPS=[
 {id:'scale',title:{en:'Scale mirrors',sl:'Zrcala meril'}},
 {id:'cosmic',title:{en:'Cosmic mirrors',sl:'Kozmična zrcala'}},
 {id:'dna',title:{en:'The DNA Thread',sl:'Nit DNA'}}
];
const SPACE_DETAILS=[
 {group:'cosmic',src:'Human_in_the_Middle_HD_MP1.webp',title:{en:'Planck length · Human · Universe',sl:'Planckova dolžina · Človek · Vesolje'}},
 {group:'cosmic',src:'Human_in_the_Middle_HD_MP2.webp',title:{en:'Quark probe · Human · Milky Way',sl:'Kvark · Človek · Rimska cesta'}},
 {group:'cosmic',src:'Human_in_the_Middle_HD_MP3.webp',title:{en:'Proton · Human · Solar System',sl:'Proton · Človek · Osončje'}},
 {group:'scale',src:'Human_in_the_Middle_HD_MP4.webp',title:{en:'Atom · Human · Sun',sl:'Atom · Človek · Sonce'}},
 {group:'scale',src:'Human_in_the_Middle_HD_MP5.webp',title:{en:'Protein · Human · Earth',sl:'Beljakovina · Človek · Zemlja'}},
 {group:'scale',src:'Human_in_the_Middle_HD_MP6.webp',title:{en:'Cell · Human · Slovenia',sl:'Celica · Človek · Slovenija'}},
 {group:'dna',src:'Human_in_the_Middle_HD_MP7.webp',title:{en:'DNA · One cell',sl:'DNA · Ena celica'}},
 {group:'dna',src:'Human_in_the_Middle_HD_MP8.webp',title:{en:'DNA · One human',sl:'DNA · En človek'}},
 {group:'dna',src:'Human_in_the_Middle_HD_MP9.webp',title:{en:'DNA · Humanity',sl:'DNA · Človeštvo'}}
];
const SPACE_GALLERY=SPACE_GROUPS.map((g,i)=>({
 src:'./assets/human-middle/v3/Human_in_the_Middle'+(i+1)+'_HD.webp',
 portrait:SPACE_ASSETS+'Human_in_the_Middle'+(i+1)+'_HD_P.webp',
 title:g.title,
 regions:i===2?[[8,12,40],[6,40,68],[7,70,88]]:i===1?[[3,7,35.2],[4,35.2,63.5],[5,63.5,91.5]]:[[0,7,36],[1,36,64.7],[2,64.7,92.5]]
}));
let currentSeries='space',lastOpener=openBtn,galleryView='gallery',galleryIndex=0,detailIndex=0,detailOpen=false,galleryController=null;
const SERIES_HASH={space:'#clovek-na-sredini',time:'#clovek-cas',information:'#clovek-informacija',questions:'#clovek-vprasanja'};
const SERIES_IDS=Object.keys(SERIES_HASH);
const galleryMedia=window.matchMedia('(max-width:700px)');
function galleryLang(){return root.dataset.lang==='sl'?'sl':'en'}
function galleryText(en,sl){return galleryLang()==='sl'?sl:en}
function hmButton(label,text,attribute){return '<button class="hm-gallery-action" type="button" '+attribute+' aria-label="'+label+'">'+text+'</button>'}

function html(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function readyImage(item){return item?.status==='published'&&typeof item.src==='string'&&/^assets\/human-middle\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g)$/.test(item.src)&&!item.src.split('/').some(x=>x==='..'||x==='.')}
function seriesSpec(id){return id==='space'?{title:{en:'Space',sl:'Prostor'},summary:{en:'From the universe to Slovenia, then DNA from a cell to humanity — nine portraits of scale and mass.',sl:'Od vesolja do Slovenije, nato DNA od celice do človeštva — devet podob meril in mase.'},items:SPACE_DETAILS}:window.MDLxDCCHumanMiddleSeries?.[id]||{title:{en:id,sl:id},summary:{en:'Images in preparation.',sl:'Slike so v pripravi.'},items:[]}}
function publishedCount(id){return id==='space'?SPACE_DETAILS.length:seriesSpec(id).items.filter(readyImage).length}
function seriesHashId(){return SERIES_IDS.find(id=>SERIES_HASH[id]===location.hash)}
function familySources(spec){return spec.items.filter(readyImage).map(item=>({item,sources:(item.sources||[]).filter(s=>typeof s.url==='string'&&/^https:\/\//.test(s.url))})).filter(x=>x.sources.length)}
function familyAbout(spec){const l=galleryLang(),sources=familySources(spec),complete=publishedCount(currentSeries)===spec.items.length&&spec.items.length>0;if(currentSeries==='questions'){const item=spec.items.find(readyImage);return '<section class="hm-family-about"><span class="human-middle-kicker">BD × AI LAB · QUESTIONS</span><h3>'+html(item?.title[l]||spec.title[l])+'</h3><p>'+html(spec.summary[l])+'</p><p>'+html(item?.explanation?.[l])+'</p><p><small>'+html(item?.credit)+'</small></p>'+(item?'<p><a href="./'+html(item.src)+'" target="_blank" rel="noopener">'+galleryText('Image with caption','Slika z napisom')+' ↗</a>'+(readyImage({...item,src:item.preview})?' · <a href="./'+html(item.preview)+'" target="_blank" rel="noopener">'+galleryText('Image without text','Slika brez besedila')+' ↗</a>':'')+'</p>':'')+'</section>'}return '<section class="hm-family-about"><span class="human-middle-kicker">BD × AI LAB · '+currentSeries.toUpperCase()+'</span><h3>'+html(spec.title[l])+'</h3><p>'+html(spec.summary[l])+'</p><h4>'+(complete?(sources.length?galleryText('Data and sources','Podatki in viri'):galleryText('About the series','O seriji')):galleryText('A series in preparation','Serija v pripravi'))+'</h4><p>'+(complete?galleryText('Explore all nine images in Gallery. Each artwork includes its own explanatory text. Additional source links will be added when verified.','V Galeriji si oglej vseh devet slik. Vsaka vsebuje svoje razlagalno besedilo. Dodatne povezave do virov bomo dodali po preverbi.'):galleryText('The preview introduces the nine planned topics. The images and final captions are being developed; the topics may still change. Each approved image will open in the shared gallery, with its supporting sources listed here.','Predogled predstavlja devet načrtovanih tem. Slike in končni napisi nastajajo; teme se lahko še spremenijo. Vsaka potrjena slika se bo odprla v skupni galeriji, njeni viri pa bodo navedeni tukaj.'))+'</p>'+sources.map(({item,sources})=>'<h4>'+html(item.title[l])+'</h4><ul>'+sources.map(s=>'<li><a href="'+html(s.url)+'" target="_blank" rel="noopener">'+html(typeof s.title==='string'?s.title:s.title?.[l]||s.url)+' ↗</a></li>').join('')+'</ul>').join('')+'</section>'}
function updateFamilyBanners(){SERIES_IDS.forEach(id=>{const el=$('[data-hm-series-status="'+id+'"]');if(!el)return;const count=publishedCount(id),total=seriesSpec(id).items.length,full=count===total&&total>0;el.dataset.pending=String(!full);const en=full?(id==='questions'?'Bonus image':total+' images'):count+' / '+total+' images · In preparation';const sl=full?(id==='questions'?'Bonus slika':total+' slik'):count+' / '+total+' slik · V pripravi';el.innerHTML='<span class="en" lang="en">'+en+'</span><span class="sl" lang="sl">'+sl+'</span>'})}
function selectSeries(id,push=true){if(!SERIES_IDS.includes(id)||id===currentSeries)return;galleryController?.closeDetail();currentSeries=id;galleryView='gallery';galleryIndex=0;detailIndex=0;detailOpen=false;render();if(push&&location.hash!==SERIES_HASH[id])history.pushState(null,'',SERIES_HASH[id]);if(id==='questions')galleryController?.openFirst();else $('[data-hm-series="'+id+'"]',dialog)?.focus({preventScroll:true})}

function installGallery(){
 const spec=seriesSpec(currentSeries),isSpace=currentSeries==='space',isQuestions=currentSeries==='questions',HM_ASSETS=isSpace?SPACE_ASSETS:'./',HM_GROUPS=isSpace?SPACE_GROUPS:[],HM_DETAILS=isSpace?SPACE_DETAILS:spec.items.filter(readyImage),HM_GALLERY=[];
 const sh=$('.hm-shell',dialog),top=$('.hm-top',dialog),data=$('#human-middle-scroll',dialog);
 if(!sh||!top||!data||$('.hm-gallery-tabs',dialog))return;
 data.classList.add('hm-data-pane');
 if(!isSpace)data.innerHTML=familyAbout(spec);
 $('.hm-top-title .human-middle-kicker',dialog).textContent='BD × AI LAB · '+(isSpace?'SPACE':currentSeries.toUpperCase());
 const familyNav=document.createElement('nav');familyNav.className='hm-family-tabs';familyNav.setAttribute('aria-label',galleryText('Conceptual image series','Serije konceptualnih slik'));
 familyNav.innerHTML=[['space',galleryText('Space','Prostor')],['time',galleryText('Time','Čas')],['information',galleryText('Information','Informacija')],['questions',galleryText('Questions','Vprašanja')]].map(([id,label])=>'<button class="hm-family-tab" type="button" data-hm-series="'+id+'" aria-pressed="'+(currentSeries===id)+'">'+label+'</button>').join('');
 familyNav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectSeries(b.dataset.hmSeries)));

 const tabs=document.createElement('div');tabs.className='hm-gallery-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label',galleryText('Human in the Middle view','Pogled Človek na sredini'));
 tabs.innerHTML=[['gallery',galleryText(HM_DETAILS.length?'Gallery':'Preview',HM_DETAILS.length?'Galerija':'Predogled')],['data',isQuestions?galleryText('About the image','O sliki'):isSpace||familySources(spec).length?galleryText('Data Sources','Podatki / Viri'):galleryText('About the series','O seriji')]].map(([v,t])=>'<button type="button" class="hm-gallery-tab" data-hm-gallery-view="'+v+'">'+t+'</button>').join('');
 const pane=document.createElement('section');pane.className='hm-gallery-pane';pane.setAttribute('aria-label',galleryText('Visual overviews','Pregledne slike'));
 pane.innerHTML='<div class="hm-gallery-toolbar"><span class="hm-gallery-kicker">BD × AI LAB · HUMAN IN THE MIDDLE</span><div class="hm-gallery-actions">'+hmButton(galleryText('Previous overview','Prejšnji pregled'),'‹','data-hm-gallery-prev')+'<span class="hm-gallery-count" aria-live="polite"></span>'+hmButton(galleryText('Next overview','Naslednji pregled'),'›','data-hm-gallery-next')+hmButton(galleryText('Zoom image','Povečaj sliko'),'＋','data-hm-gallery-zoom')+hmButton(galleryText('Fullscreen','Celozaslonsko'),'⛶','data-hm-gallery-full')+'</div></div><div class="hm-gallery-stage" tabindex="0"><div class="hm-overview-frame"><picture><source media="(max-width:700px)"><img class="hm-overview-image" decoding="async" draggable="false"></picture><div class="hm-hotspots"></div></div></div><div class="hm-gallery-meta"><strong></strong><small></small><div class="hm-overview-links"></div><a target="_blank" rel="noopener">'+galleryText('Full image ↗','Cela slika ↗')+'</a></div>';
 const grid=document.createElement('section');grid.className='hm-detail-grid';grid.setAttribute('aria-label',isQuestions?galleryText('Bonus image','Bonus slika'):isSpace?galleryText('Portrait gallery','Pokončna galerija'):galleryText(HM_DETAILS.length?'Nine images':'Nine planned scenes',HM_DETAILS.length?'Devet slik':'Devet načrtovanih prizorov'));grid.hidden=true;
 const viewer=document.createElement('section');viewer.className='hm-detail-viewer';viewer.hidden=true;viewer.setAttribute('aria-label',galleryText('Immersive image viewer','Celozaslonski ogled slike'));
 viewer.innerHTML='<div class="hm-detail-toolbar">'+hmButton(galleryText('Back to overview or gallery','Nazaj na pregled ali galerijo'),'←','data-hm-detail-back')+'<span class="hm-detail-caption" aria-live="polite"></span>'+hmButton(galleryText('Previous image','Prejšnja slika'),'‹','data-hm-detail-prev')+hmButton(galleryText('Next image','Naslednja slika'),'›','data-hm-detail-next')+hmButton(galleryText('Zoom image','Povečaj sliko'),'＋','data-hm-detail-zoom')+hmButton(galleryText('Fullscreen','Celozaslonsko'),'⛶','data-hm-detail-full')+'</div><div class="hm-detail-stage" tabindex="0"><img decoding="async" draggable="false"></div>';
 top.after(familyNav);familyNav.after(tabs);tabs.after(pane);pane.after(grid);sh.appendChild(viewer);
 if(HM_DETAILS.length<2)viewer.querySelectorAll('[data-hm-detail-prev],[data-hm-detail-next]').forEach(b=>{b.hidden=true;b.disabled=true});
 const stage=$('.hm-gallery-stage',pane),img=$('img',stage),source=$('source',stage),count=$('.hm-gallery-count',pane),title=$('.hm-gallery-meta strong',pane),note=$('.hm-gallery-meta small',pane),link=$('.hm-gallery-meta a',pane),hotspots=$('.hm-hotspots',pane),links=$('.hm-overview-links',pane);
 const detailStage=$('.hm-detail-stage',viewer),detailImg=$('img',detailStage),caption=$('.hm-detail-caption',viewer),back=$('[data-hm-detail-back]',viewer);
 let returnFocus=null,gridBuilt=false;
 const frame=$('.hm-overview-frame',stage),resize=new ResizeObserver(()=>frame.style.setProperty('--hm-overview-fit',(stage.clientHeight*16/9)+'px'));resize.observe(stage);
 function resetZoom(el,button){el.classList.remove('is-zoomed');el.scrollTo(0,0);button.textContent='＋';button.setAttribute('aria-label',galleryText('Zoom image','Povečaj sliko'));button.setAttribute('aria-pressed','false')}
 function zoom(el,button){const z=el.classList.toggle('is-zoomed');button.textContent=z?'−':'＋';button.setAttribute('aria-pressed',String(z));button.setAttribute('aria-label',galleryText(z?'Zoom out':'Zoom image',z?'Pomanjšaj sliko':'Povečaj sliko'))}
 function syncOverview(){if(!HM_GALLERY.length)return;link.href=galleryMedia.matches?HM_GALLERY[galleryIndex].portrait:HM_GALLERY[galleryIndex].src;note.textContent=galleryMedia.matches?galleryText('Tap a scene to explore it.','Dotakni se dela slike za podroben ogled.'):galleryText('Explore the individual scenes below or open Gallery.','Odpri posamezne prizore spodaj ali izberi Galerijo.')}
 function show(i){if(!HM_GALLERY.length)return;galleryIndex=(i+HM_GALLERY.length)%HM_GALLERY.length;const x=HM_GALLERY[galleryIndex],l=galleryLang();resetZoom(stage,$('[data-hm-gallery-zoom]',pane));source.srcset=x.portrait;img.src=x.src;img.alt=galleryText('Human in the Middle — ','Človek na sredini — ')+x.title[l];count.textContent=(galleryIndex+1)+' / '+HM_GALLERY.length;title.textContent=x.title[l];hotspots.replaceChildren();links.replaceChildren();x.regions.forEach(([j,start,end])=>{const d=HM_DETAILS[j],label=galleryText('Explore: ','Razišči: ')+d.title[l];const b=document.createElement('button');b.type='button';b.className='hm-hotspot';b.style.top=start+'%';b.style.height=(end-start)+'%';b.setAttribute('aria-label',label);b.dataset.hmDetail=String(j);const span=document.createElement('span');span.textContent=d.title[l]+' ↗';b.appendChild(span);b.addEventListener('click',()=>openDetail(j,b));hotspots.appendChild(b);const c=document.createElement('button');c.type='button';c.className='hm-overview-link';c.textContent=d.title[l];c.dataset.hmDetail=String(j);c.addEventListener('click',()=>openDetail(j,c));links.appendChild(c);});syncOverview()}
 function buildGrid(){if(gridBuilt)return;gridBuilt=true;buildFutureGrid()}


 function buildFutureGrid(){
  const l=galleryLang(),intro=document.createElement('header');
  intro.className='hm-future-intro';
  intro.innerHTML='<div><h3>'+html(spec.title[l])+'</h3><p>'+html(spec.summary[l])+'</p><p>'+
    (HM_DETAILS.length===spec.items.length?galleryText('Open an image for a closer view; tap its title for an explanation.','Odpri sliko za podroben ogled, za pojasnilo pa klikni njen naslov.'):
    galleryText('Working topics for the forthcoming images.','Delovne teme za prihajajoče slike.'))+
    '</p></div><span class="hm-future-status">'+
    (isQuestions&&HM_DETAILS.length?galleryText('Bonus image','Bonus slika'):HM_DETAILS.length?HM_DETAILS.length+' / '+spec.items.length+' · '+galleryText('Published','Objavljeno'):
    spec.items.length+' · '+galleryText('In preparation','V pripravi'))+'</span>';
  grid.appendChild(intro);
  const cards=document.createElement('div');cards.className='hm-future-grid'+(isQuestions?' hm-question-grid':'');
  spec.items.forEach((d,n)=>{
    const id=d.id||'space-'+String(n+1).padStart(2,'0');
    const captions=window.MDLxDCCHumanMiddleExplanations?.[id]||{};
    const shortText=captions.short?.[l]||d.summary?.[l]||'';
    const longText=captions.long?.[l]||d.explanation?.[l]||'';
    const ready=isSpace||readyImage(d);
    const card=document.createElement('article');
    card.className='hm-future-card';card.dataset.hmItem=id;
    if(ready){
      const media=document.createElement('button');media.type='button';media.className='hm-future-media';
      media.setAttribute('aria-label',galleryText('Open full image: ','Odpri celotno sliko: ')+d.title[l]);
      const im=document.createElement('img');
      im.loading='lazy';im.decoding='async';im.width=d.width||941;im.height=d.height||1672;
      im.src=HM_ASSETS+(readyImage({...d,src:d.preview})?d.preview:d.src);im.alt=d.title[l];
      media.appendChild(im);
      media.addEventListener('click',()=>openDetail(HM_DETAILS.indexOf(d),media));
      card.appendChild(media);
    }else{
      const placeholder=document.createElement('div');
      placeholder.className='hm-future-placeholder';
      placeholder.innerHTML='<span class="hm-future-number">'+String(n+1).padStart(2,'0')+'</span><small>'+galleryText('Image in preparation','Slika v pripravi')+'</small>';
      card.appendChild(placeholder);
    }
    const copy=document.createElement('div');copy.className='hm-future-copy';
    if(ready){
      const disclosure=document.createElement('details');disclosure.className='hm-future-expander';
      const summary=document.createElement('summary');
      const title=document.createElement('strong');title.textContent=d.title[l];
      const short=document.createElement('p');short.className='hm-future-short';short.textContent=shortText;
      summary.append(title,short);disclosure.appendChild(summary);
      if(longText){const full=document.createElement('p');full.className='hm-future-long';full.textContent=longText;disclosure.appendChild(full);}
      copy.appendChild(disclosure);
    }else{
      const title=document.createElement('strong');title.textContent=d.title[l];copy.appendChild(title);
      const short=document.createElement('p');short.textContent=shortText;copy.appendChild(short);
    }
    card.appendChild(copy);cards.appendChild(card);
  });
  grid.appendChild(cards);
}

 function switchView(v,focus=true){galleryView=['data','gallery'].includes(v)?v:'gallery';pane.hidden=galleryView!=='visuals';data.hidden=galleryView!=='data';grid.hidden=galleryView!=='gallery';if(galleryView==='gallery')buildGrid();tabs.querySelectorAll('[data-hm-gallery-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hmGalleryView===galleryView)));if(focus&&galleryView==='visuals')stage.focus({preventScroll:true})}
 function showDetail(i){if(!HM_DETAILS.length)return;detailIndex=(i+HM_DETAILS.length)%HM_DETAILS.length;const d=HM_DETAILS[detailIndex];resetZoom(detailStage,$('[data-hm-detail-zoom]',viewer));detailImg.src=HM_ASSETS+d.src;detailImg.alt=d.title[galleryLang()];caption.textContent=(detailIndex+1)+' / '+HM_DETAILS.length+' · '+d.title[galleryLang()];caption.title=d.title[galleryLang()]}
 function openDetail(i,trigger){if(!HM_DETAILS.length)return;returnFocus=trigger||document.activeElement;detailOpen=true;showDetail(i);viewer.hidden=false;dialog.classList.add('hm-detail-open');Array.from(sh.children).forEach(el=>{if(el!==viewer)el.inert=true});back.focus({preventScroll:true})}
 function closeDetail(){if(!detailOpen)return;detailOpen=false;if(document.fullscreenElement===viewer)document.exitFullscreen().catch(()=>{});viewer.hidden=true;dialog.classList.remove('hm-detail-open');Array.from(sh.children).forEach(el=>{el.inert=false});if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else $('[data-hm-gallery-view="'+galleryView+'"]',tabs)?.focus()}
 async function full(el){try{if(document.fullscreenElement){await document.exitFullscreen();return}if(el.requestFullscreen){await el.requestFullscreen();return}}catch(_){}if(el===pane)dialog.classList.toggle('hm-gallery-fallback-fullscreen')}
 function swipe(el,next){let start=null;el.addEventListener('touchstart',e=>{start=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null},{passive:true});el.addEventListener('touchend',e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start[0],dy=t.clientY-start[1];start=null;if(el.classList.contains('is-zoomed')||e.touches.length)return;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.25)next(dx<0?1:-1)},{passive:true});el.addEventListener('touchcancel',()=>{start=null},{passive:true})}
 tabs.querySelectorAll('[data-hm-gallery-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.hmGalleryView)));
 $('[data-hm-gallery-prev]',pane).addEventListener('click',()=>show(galleryIndex-1));$('[data-hm-gallery-next]',pane).addEventListener('click',()=>show(galleryIndex+1));
 $('[data-hm-gallery-zoom]',pane).addEventListener('click',()=>zoom(stage,$('[data-hm-gallery-zoom]',pane)));img.addEventListener('click',()=>{if(!galleryMedia.matches)zoom(stage,$('[data-hm-gallery-zoom]',pane))});
 $('[data-hm-gallery-full]',pane).addEventListener('click',()=>full(pane));
 back.addEventListener('click',closeDetail);$('[data-hm-detail-prev]',viewer).addEventListener('click',()=>showDetail(detailIndex-1));$('[data-hm-detail-next]',viewer).addEventListener('click',()=>showDetail(detailIndex+1));
 $('[data-hm-detail-zoom]',viewer).addEventListener('click',()=>zoom(detailStage,$('[data-hm-detail-zoom]',viewer)));$('[data-hm-detail-full]',viewer).addEventListener('click',()=>full(viewer));
 swipe(stage,n=>show(galleryIndex+n));swipe(detailStage,n=>showDetail(detailIndex+n));
 galleryController={closeDetail,syncOverview,openFirst(){openDetail(0,$('.hm-future-media',grid))},dispose(){resize.disconnect()},key(e){if(e.key==='Tab'){const scope=detailOpen?viewer:sh,focusable=Array.from(scope.querySelectorAll('button,a[href],summary,[tabindex="0"]')).filter(x=>!x.disabled&&x.getClientRects().length&&!x.closest('[inert]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}return}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){if(!detailOpen&&galleryView!=='visuals')return;if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();const n=e.key==='ArrowRight'?1:-1;detailOpen?showDetail(detailIndex+n):show(galleryIndex+n)}}};
 show(galleryIndex);switchView(galleryView,false);if(detailOpen)openDetail(detailIndex,null);
}
galleryMedia.addEventListener('change',()=>{if(dialog.open)galleryController?.syncOverview()});

function render(){const sc=$('#human-middle-scroll',dialog),y=sc?sc.scrollTop:0;galleryController?.dispose();dialog.innerHTML=shell(lang());bind();syncHmFont();installGallery();const next=$('#human-middle-scroll',dialog);if(next)next.scrollTop=y;}
function bind(){
 $$('#human-middle-dialog [data-hm-lang]').forEach(b=>b.addEventListener('click',()=>{const l=b.dataset.hmLang;if(window.MDLxDCCLocale?.choose)window.MDLxDCCLocale.choose(l);else{root.dataset.lang=l;root.lang=l;render();}}));
 $$('#human-middle-dialog [data-hm-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.hmMode;render();}));
 $('#hm-font-down',dialog)?.addEventListener('click',()=>{const b=document.getElementById('font-down');if(b)b.click();syncHmFont();});
 $('#hm-font-value',dialog)?.addEventListener('click',()=>{const b=document.getElementById('font-value');if(b)b.click();syncHmFont();});
 $('#hm-font-up',dialog)?.addEventListener('click',()=>{const b=document.getElementById('font-up');if(b)b.click();syncHmFont();});
 $('#human-middle-close',dialog)?.addEventListener('click',close);
 $('#hm-theme',dialog)?.addEventListener('click',()=>{const globalTheme=$('#theme');if(globalTheme){globalTheme.click();return;}const next=root.dataset.theme==='light'?'dark':'light';root.dataset.theme=next;try{localStorage.setItem('mdlxdcc-theme',next)}catch(_){}});
}
function open(push=true,id='space',trigger){if(!SERIES_IDS.includes(id))return;if(trigger)lastOpener=trigger;const changed=currentSeries!==id;if(changed){galleryController?.closeDetail();dialog.classList.remove('hm-gallery-fallback-fullscreen');currentSeries=id;galleryView='gallery';galleryIndex=0;detailIndex=0;detailOpen=false;}if(!dialog.open||changed){render();dialog.setAttribute('open','');dialog.setAttribute('aria-hidden','false');root.classList.add('hm-open');requestAnimationFrame(()=>{if(!dialog.open)return;if(currentSeries==='questions')galleryController?.openFirst();else $('#human-middle-close',dialog)?.focus()});}if(push&&location.hash!==SERIES_HASH[id])history.pushState(null,'',SERIES_HASH[id]);}
function close(fromHash=false){galleryController?.closeDetail();if(document.fullscreenElement&&dialog.contains(document.fullscreenElement))document.exitFullscreen().catch(()=>{});dialog.removeAttribute('open');dialog.setAttribute('aria-hidden','true');dialog.classList.remove('hm-gallery-fallback-fullscreen','hm-detail-open');root.classList.remove('hm-open');galleryView='gallery';galleryIndex=0;detailOpen=false;(lastOpener?.isConnected?lastOpener:openBtn).focus({preventScroll:true});if(fromHash!==true&&seriesHashId())history.pushState(null,'',location.pathname+location.search);}
$$('[data-hm-open-series]').forEach(b=>b.addEventListener('click',()=>open(true,b.dataset.hmOpenSeries,b)));
updateFamilyBanners();
dialog.addEventListener('cancel',e=>{e.preventDefault();detailOpen?galleryController?.closeDetail():close(false)});
document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='Escape'){e.preventDefault();detailOpen?galleryController?.closeDetail():close(false)}else galleryController?.key(e)});
window.addEventListener('hashchange',()=>{const id=seriesHashId();if(id)open(false,id);else if(dialog.open)close(true)});
window.addEventListener('mdlxdcc:language',()=>{if(dialog.open)render()});
if(seriesHashId())requestAnimationFrame(()=>open(false,seriesHashId()));
})();

