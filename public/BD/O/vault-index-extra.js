/* BD/O unlocked personal cockpit. Injects only after the encrypted BD/O vault has opened. */
(function(){
'use strict';

const TOP_ID='bdoTableteTop', CENTER_ID='bdoControlCenter', STYLE_ID='bdoControlCenterStyle';
const site=path=>new URL(path,location.origin).href;
const local=path=>new URL(path,location.href).href;

const sections=[
  {
    title:'ZDAJ · NOW',
    note:'Najpogostejši vhodi v tvoj sistem.',
    cards:[
      ['⚙️','8Z Control','Kaj teče, kaj čaka in naslednji koraki.','/index-todo.html','PUBLIC'],
      ['◎','AI8 State','Izpeljano trenutno stanje AI8.','/AI8/AI8-state.html','PROTECTED'],
      ['↻','Wake Lab','Nadzor raziskovalnih linij in continuity toka.','/WL/','PROTECTED'],
      ['↗','BBSH','BB Surfing Hedge · delovni priročnik.','/BD/BBSH.html','PROTECTED'],
      ['🔐','Sef','Dostopi, skrivnosti in občutljivi zapisi.','sef.html','VAULT']
    ]
  },
  {
    title:'JAZ · OSEBNO',
    note:'Zdravje in osebni del sta v istem BD/O vaultu.',
    cards:[
      ['💊','Tablete','Dnevni načrt tablet.','tablete.html','VAULT'],
      ['♥','Zdravje','Glavni osebni zdravstveni pregled.','zdravje.html','VAULT'],
      ['＋','Kardiolog','Kardiološki zapiski in priprava.','kardiolog.html','VAULT'],
      ['⌚','Apple Health','Osebni Apple Health pregled.','apple-health.html','VAULT'],
      ['→','Napotnice','Napotnice in povezani koraki.','napotnice.html','VAULT']
    ]
  },
  {
    title:'AI · CONTINUITY',
    note:'Glavni pogledi na AI8, kontinuiteto in sodelovanje.',
    cards:[
      ['8','AI8','Javni AI8 hub.','/AI8/','PUBLIC'],
      ['◌','C_soul','Continuity / Soul Vault.','/AI8/C_soul.html','PUBLIC'],
      ['◎','AI8 State','Zaščiten state instrument.','/AI8/AI8-state.html','PROTECTED'],
      ['A','AIm3','Multi-LLM raziskovalni sistem.','/BD/BD_AIM3.html','PUBLIC'],
      ['R','RHP','Resonance Hybrid Protocol.','/BD/BD_AIM3_RHP.html','PUBLIC']
    ]
  },
  {
    title:'RESEARCH · SYSTEMS',
    note:'Kanonični vhodi namesto starih kopij.',
    cards:[
      ['⚙️','8Z Control','Aktualno delo in TODO.','/index-todo.html','PUBLIC'],
      ['M','8zMaterials','Materials raziskovalni vhod.','/8zMaterials.html','PUBLIC'],
      ['T','Trip','Trip Optimizer · current.','/Trip/','PROTECTED'],
      ['C','Research hub','CRP raziskovalni prostor.','/crp/','PUBLIC'],
      ['M','MentalArena MALm','Zaščiten MentalArena instrument.','/crp/IM3_MentalArena_MALm.html','PROTECTED']
    ]
  },
  {
    title:'TRADING',
    note:'Aktualni delovni vhodi; stare kopije niso v ospredju.',
    cards:[
      ['↗','BBSH','BB Surfing Hedge.','/BD/BBSH.html','PROTECTED'],
      ['T','BDTS','SOL BB Neutral-Lock.','/BD/BDTS.html','PROTECTED'],
      ['A','Trading Atlas','Trading research atlas.','/BD/BD_Trading_Research_Atlas.html','PROTECTED'],
      ['D','DCC Trading','MDL×DCC trading research.','/BD/BD_8Z_DCC_Trading.html','PROTECTED']
    ]
  }
];

const hidden=[
  ['AI8 State','/AI8/AI8-state.html','PROTECTED'],
  ['C_soul private','/BD/C_soul_p.html','PROTECTED'],
  ['C_soul vault','/BD/C_soul_vault.html','PROTECTED'],
  ['BD ASI Origin','/BD/BD_ASI_Origin.html','PROTECTED'],
  ['BD 8ZRP','/BD/BD_8ZRP.html','PROTECTED'],
  ['Trip Protected','/Trip/Protected/','PROTECTED'],
  ['MentalArena MALm','/crp/IM3_MentalArena_MALm.html','PROTECTED'],
  ['Sef','sef.html','VAULT']
];

function addStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;
  s.textContent=`
  #${CENTER_ID}{width:min(1160px,calc(100% - 18px));margin:18px auto 34px;padding:clamp(18px,3vw,30px);border:1px solid #2f4960;border-radius:24px;background:linear-gradient(145deg,#0c1725,#0a1320);box-shadow:0 20px 60px #0005;color:#edf6ff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  #${CENTER_ID} *{box-sizing:border-box}
  #${CENTER_ID} a{text-decoration:none}
  #${CENTER_ID} .bdocc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}
  #${CENTER_ID} .bdocc-kicker{font:800 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.14em;color:#67e0d7}
  #${CENTER_ID} h2{margin:7px 0 8px;font-size:clamp(28px,5vw,48px);line-height:1.02;letter-spacing:-.045em}
  #${CENTER_ID} .bdocc-lead{margin:0;color:#aebfd0;max-width:62ch;font-size:15px}
  #${CENTER_ID} .bdocc-home{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 13px;border:1px solid #47647c;border-radius:999px;color:#d9f7ff;background:#102335;font-weight:800;white-space:nowrap}
  #${CENTER_ID} .bdocc-section{padding:22px 0;border-top:1px solid #253b50}
  #${CENTER_ID} .bdocc-section:first-of-type{border-top:0;padding-top:0}
  #${CENTER_ID} .bdocc-titleline{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:12px}
  #${CENTER_ID} .bdocc-title{font-weight:900;letter-spacing:.08em;font-size:13px;color:#eaf4ff}
  #${CENTER_ID} .bdocc-note{color:#8fa5b9;font-size:13px}
  #${CENTER_ID} .bdocc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
  #${CENTER_ID} .bdocc-card{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;min-height:112px;padding:14px;border:1px solid #2a4358;border-radius:16px;background:#0d1b2b;color:#edf6ff;transition:.16s transform,.16s border-color,.16s background}
  #${CENTER_ID} .bdocc-card:hover{transform:translateY(-2px);border-color:#67e0d7;background:#102336}
  #${CENTER_ID} .bdocc-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#132a38;color:#79e8de;font-weight:900}
  #${CENTER_ID} .bdocc-card strong{display:block;font-size:16px;line-height:1.2}
  #${CENTER_ID} .bdocc-card small{display:block;color:#9eb0c1;margin-top:5px;line-height:1.35;font-size:12px}
  #${CENTER_ID} .bdocc-tag{display:inline-flex;margin-top:8px;padding:3px 7px;border:1px solid #36536a;border-radius:999px;color:#8bded8;font:800 10px/1.25 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em}
  #${CENTER_ID} .bdocc-map{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:6px 0 0}
  #${CENTER_ID} .bdocc-node{padding:7px 10px;border:1px solid #315169;border-radius:999px;background:#0b1928;color:#cfe4f4;font-size:12px;font-weight:800}
  #${CENTER_ID} .bdocc-arrow{color:#56758d}
  #${CENTER_ID} details{margin-top:18px;border-top:1px solid #253b50;padding-top:16px}
  #${CENTER_ID} summary{cursor:pointer;color:#78ded7;font-weight:850}
  #${CENTER_ID} .bdocc-hidden{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:13px}
  #${CENTER_ID} .bdocc-hidden a{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #294157;border-radius:12px;color:#dceaf5;background:#0a1624;font-size:13px}
  #${CENTER_ID} .bdocc-hidden span:last-child{color:#6fded5;font:800 10px ui-monospace,SFMono-Regular,Consolas,monospace}
  @media(max-width:680px){
    #${CENTER_ID}{margin-top:12px;padding:18px 14px;border-radius:18px}
    #${CENTER_ID} .bdocc-head{display:block}
    #${CENTER_ID} .bdocc-home{margin-top:14px}
    #${CENTER_ID} .bdocc-grid{grid-template-columns:1fr 1fr}
    #${CENTER_ID} .bdocc-card{min-height:105px;padding:12px}
  }
  @media(max-width:440px){#${CENTER_ID} .bdocc-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function href(path){return path.startsWith('/')?site(path):local(path)}
function card([icon,title,desc,path,tag]){
  const a=document.createElement('a');a.className='bdocc-card';a.href=href(path);
  const i=document.createElement('span');i.className='bdocc-icon';i.textContent=icon;
  const b=document.createElement('span');
  const strong=document.createElement('strong');strong.textContent=title;
  const small=document.createElement('small');small.textContent=desc;
  const t=document.createElement('span');t.className='bdocc-tag';t.textContent=tag;
  b.append(strong,small,t);a.append(i,b);return a;
}

function tablete(){
  if(document.getElementById(TOP_ID))return;
  const box=document.createElement('div');box.id=TOP_ID;
  box.style.cssText='width:min(760px,calc(100% - 18px));margin:12px auto 16px;position:relative;z-index:50';
  const a=document.createElement('a');a.href=local('tablete.html');a.textContent='💊 Tablete · dnevni načrt';
  a.style.cssText='display:flex;align-items:center;justify-content:center;min-height:62px;padding:14px 18px;border:2px solid #58d9cf;border-radius:17px;background:linear-gradient(135deg,#12313a,#0b1d2b);color:#eafffc;text-decoration:none;font:900 20px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 34px #0005;letter-spacing:.01em';
  box.appendChild(a);
  const wrap=document.querySelector('.wrap'),host=document.querySelector('main,.content');
  if(wrap)wrap.prepend(box);else if(host)host.prepend(box);else document.body.prepend(box);
}

function cockpit(){
  if(document.getElementById(CENTER_ID))return;
  addStyle();
  const root=document.createElement('section');root.id=CENTER_ID;root.setAttribute('aria-label','BD Control Center');

  const head=document.createElement('div');head.className='bdocc-head';
  const hcopy=document.createElement('div');
  hcopy.innerHTML='<div class="bdocc-kicker">BD · PRIVATE CONTROL CENTER</div><h2>Cel sistem. En pogled.</h2><p class="bdocc-lead">Osebni cockpit za aktualne sisteme, zaščitene strani in kanonične vhode. Arhivske kopije ostanejo v repozitoriju, tukaj so predvsem CURRENT poti.</p>';
  const home=document.createElement('a');home.className='bdocc-home';home.href=site('/');home.textContent='⌂ Main landing';
  head.append(hcopy,home);root.appendChild(head);

  for(const s of sections){
    const sec=document.createElement('section');sec.className='bdocc-section';
    const title=document.createElement('div');title.className='bdocc-titleline';
    const a=document.createElement('span');a.className='bdocc-title';a.textContent=s.title;
    const n=document.createElement('span');n.className='bdocc-note';n.textContent=s.note;
    title.append(a,n);
    const grid=document.createElement('div');grid.className='bdocc-grid';
    s.cards.forEach(x=>grid.appendChild(card(x)));
    sec.append(title,grid);root.appendChild(sec);
  }

  const map=document.createElement('section');map.className='bdocc-section';
  map.innerHTML='<div class="bdocc-titleline"><span class="bdocc-title">SYSTEM MAP</span><span class="bdocc-note">Kako so glavni vhodi povezani.</span></div>';
  const flow=document.createElement('div');flow.className='bdocc-map';
  ['PUBLIC','S · SEARCH','BD/O · COCKPIT','SEF · VAULT','PROTECTED TOOLS','AI8 STATE / WL / TRADING'].forEach((x,i)=>{
    if(i){const ar=document.createElement('span');ar.className='bdocc-arrow';ar.textContent='→';flow.appendChild(ar)}
    const node=document.createElement('span');node.className='bdocc-node';node.textContent=x;flow.appendChild(node);
  });
  map.appendChild(flow);root.appendChild(map);

  const more=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent='All hidden / protected handy links';
  const grid=document.createElement('div');grid.className='bdocc-hidden';
  hidden.forEach(([title,path,tag])=>{
    const a=document.createElement('a');a.href=href(path);
    const name=document.createElement('span');name.textContent=title;
    const t=document.createElement('span');t.textContent=tag;
    a.append(name,t);grid.appendChild(a);
  });
  more.append(summary,grid);root.appendChild(more);

  const top=document.getElementById(TOP_ID);
  if(top)top.insertAdjacentElement('afterend',root);
  else{
    const wrap=document.querySelector('.wrap'),host=document.querySelector('main,.content');
    if(wrap)wrap.prepend(root);else if(host)host.prepend(root);else document.body.prepend(root);
  }
}

function inject(){
  if(!document.body||document.body.dataset.bdoUnlocked!=='true')return;
  const path=location.pathname.replace(/\/+$/,'');
  if(!/\/BD\/O(?:\/index\.html)?$/i.test(path))return;
  tablete();cockpit();
}

/* vault.js replaces the login document after successful decryption.
   Hook its exported afterRender so the cockpit only exists in the unlocked view. */
let currentBDO;
try{
  Object.defineProperty(window,'BDO',{
    configurable:true,
    get(){return currentBDO;},
    set(v){
      currentBDO=v;
      if(v&&typeof v.afterRender==='function'&&!v.__cockpitHooked){
        const original=v.afterRender;
        v.afterRender=function(){
          const result=original.apply(this,arguments);
          queueMicrotask(inject);setTimeout(inject,50);return result;
        };
        v.__cockpitHooked=true;
      }
    }
  });
}catch(_){}

const t=setInterval(inject,200);setTimeout(()=>clearInterval(t),20000);
window.addEventListener('pageshow',()=>{inject();setTimeout(inject,100)});
})();