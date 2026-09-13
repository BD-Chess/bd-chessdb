import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../public/Trip/new/'+name,import.meta.url),'utf8');

function setup(manual=false) {
  const nodes=new Map(),ready=[],listeners=[];
  let language='en',scroll=[17,1320];
  const el=id=>{
    if(!nodes.has(id))nodes.set(id,{
      id,dataset:{},style:{},textContent:'',innerHTML:'',open:false,events:{},
      addEventListener(name,fn){this.events[name]=fn;},
      showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
      focus(options){this.lastFocus=options;doc.activeElement=this;},blur(){doc.activeElement=null;},
      querySelectorAll(){return [];}
    });
    return nodes.get(id);
  };
  const body=el('body');body.style={position:'relative',top:'2px',left:'3px',width:'95%'};
  const doc={body,activeElement:el('btnHelp'),
    getElementById:id=>id==='manual'&&!manual?null:el(id),
    addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')ready.push(fn);},
    querySelectorAll(selector){
      if(selector==='[data-ui-text]')return [...nodes.values()].filter(n=>n.dataset.uiText!==undefined);
      if(selector==='[data-ui-title]')return [...nodes.values()].filter(n=>n.dataset.uiTitle!==undefined);
      return [];
    }
  };
  const window={MDLxDCCLocale:{current:()=>language,subscribe(fn){listeners.push(fn);fn(language);}},scrollTo(x,y){scroll=[x,y];}};
  const context=vm.createContext({document:doc,window,location:{hash:''},scrollX:17,scrollY:1320,MutationObserver:class{observe(){}},console});
  vm.runInContext(read('ui-text.js'),context);
  vm.runInContext(read('help.js'),context);
  ready.forEach(fn=>fn());
  return {el,doc,body,window,scroll:()=>scroll,choose(lang){language=lang;listeners.forEach(fn=>fn(lang));}};
}

test('changing language translates live application labels and preserves original status and user text',()=>{
  const h=setup(),ui=h.window.TripUI;
  const city=h.el('userStop');city.textContent='Running Springs';
  ui.set(h.el('status'),'Road route displayed. Distance follows the route shown on the map.');
  ui.set(h.el('progress'),'Running · 12.30% done');
  h.choose('sl');
  assert.match(h.el('status').textContent,/Cestna pot je prikazana/);
  assert.equal(h.el('progress').textContent,'Računanje · 12,30% končano');
  assert.equal(city.textContent,'Running Springs');
  h.choose('en');
  assert.equal(h.el('status').textContent,'Road route displayed. Distance follows the route shown on the map.');
  assert.equal(h.el('progress').textContent,'Running · 12.30% done');
});

test('Help locks the background and Close restores its exact scroll, styles and focus',()=>{
  const h=setup(),trigger=h.el('btnHelp');
  trigger.onclick();
  assert.equal(h.el('helpOverlay').open,true);
  assert.equal(h.body.style.top,'-1320px');
  assert.equal(h.body.style.position,'fixed');
  assert.match(h.el('helpBody').innerHTML,/About the application/);
  assert.equal(h.el('infoMore').href,'help.html?lang=en');
  h.choose('sl');
  assert.equal(h.el('infoMore').href,'help.html?lang=sl');
  assert.equal(h.el('btnCloseHelp').textContent,'Zapri');
  h.el('btnCloseHelp').onclick();
  assert.equal(h.el('helpOverlay').open,false);
  assert.deepEqual(h.scroll(),[17,1320]);
  assert.deepEqual(h.body.style,{position:'relative',top:'2px',left:'3px',width:'95%'});
  assert.equal(h.doc.activeElement,trigger);
  assert.equal(trigger.lastFocus.preventScroll,true);
});

test('Demo opens its own short content and links to the full article within LAB',()=>{
  const h=setup();h.el('btnDemo').onclick();
  assert.equal(h.el('infoLoadDemo').hidden,false);
  assert.match(h.el('helpBody').innerHTML,/87,178,291,200/);
  assert.equal(h.el('infoMore').href,'demo.html?lang=en');
  assert.doesNotMatch(h.el('helpBody').innerHTML,/<img/);
  const html=read('index.html');
  assert.match(html,/<a id="infoMore"[^>]+target="_blank"/);
  assert.doesNotMatch(html,/id="btnAbout"/);
});

test('both capital buttons close first, localize instructions, and stay hidden in Help',()=>{
  const h=setup();let expected,called=0;
  h.window.TripDemo={load(preset,options){
    called++;assert.equal(preset,expected);assert.equal(options.focus,true);
    assert.equal(h.el('helpOverlay').open,false);assert.equal(h.body.style.position,'relative');
  }};
  for(const [id,preset,label] of [['infoLoadDemo14','capitals14','Naloži 14 glavnih EU mest'],['infoLoadDemo','capitals15','Naloži 15 glavnih EU mest']]){
    expected=preset;h.el('btnDemo').onclick();h.choose('sl');
    assert.equal(h.el(id).hidden,false);assert.equal(h.el(id).textContent,label);
    assert.match(h.el('infoDemoInstructions').textContent,/Optimiziraj \(hitro\).*Optimiziraj \(poglobljeno\).*Zaženi Brute Force/);
    assert.doesNotMatch(h.el('infoDemoInstructions').textContent,/Optimize|Run Brute Force/);
    h.el(id).onclick();
  }
  assert.equal(called,2);h.el('btnHelp').onclick();
  for(const id of ['infoLoadDemo14','infoLoadDemo','infoDemoInstructions'])assert.equal(h.el(id).hidden,true);
  h.el('btnCloseHelp').onclick();assert.equal(called,2);
});

test('full Help reserves all six exact screenshot names without loading the superseded GUI images',()=>{
  const h=setup(true),html=h.el('manual').innerHTML;
  const slots=[...html.matchAll(/data-screenshot="([^"]+)" hidden/g)].map(m=>m[1]);
  assert.deepEqual(slots,['01_Route_Editor.png','02_Results_Route_Map.jpeg','03_Results_Comparison.png','04_Share_GPX_Library.png','05_AI_Chatbot.png','06_AI_Chatbot_Keyboard.png']);
  assert.doesNotMatch(html,/<img/);
});

test('resume, algorithm names, savings and live timing switch completely between SL and EN',()=>{
  const h=setup(),ui=h.window.TripUI;
  const examples={resume:'Resume Brute Force',running:'Brute Force running…',map:'Showing:',fast:'Optimize (Fast)',deep:'Optimize (Deep)',
    saving:'10,137.10 km (50.84%)',timing:'Compute time: 2.5 hours · 1 compute thread · Speed: 9,664,336 orders/s',
    region:'🇪🇺 Europe',category:'🚗 Top 10 Driving Tours'};
  for(const [id,text] of Object.entries(examples))ui.set(h.el(id),text);
  h.choose('sl');
  assert.equal(h.el('resume').textContent,'Nadaljuj Brute Force');
  assert.equal(h.el('running').textContent,'Brute Force računa …');
  assert.equal(h.el('map').textContent,'Prikaz:');
  assert.equal(h.el('fast').textContent,'Optimiziraj (hitro)');
  assert.equal(h.el('deep').textContent,'Optimiziraj (poglobljeno)');
  assert.equal(h.el('saving').textContent,'10.137,10 km (50,84%)');
  assert.equal(h.el('timing').textContent,'Čas računanja: 2,5 h · 1 računska nit · Hitrost: 9.664.336 vrstnih redov/s');
  assert.equal(h.el('region').textContent,'🇪🇺 Evropa');
  assert.equal(h.el('category').textContent,'🚗 10 izbranih cestnih poti');
  h.choose('en');for(const [id,text] of Object.entries(examples))assert.equal(h.el(id).textContent,text);
});
