import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtime=fs.readFileSync(new URL('../public/Nara/assets/js/nara-daily-score-details.js',import.meta.url),'utf8');
const dailyRenderer=fs.readFileSync(new URL('../scripts/nara-daily.mjs',import.meta.url),'utf8');
const formatRenderer=fs.readFileSync(new URL('../scripts/nara-format-editions.mjs',import.meta.url),'utf8');
class Element {
 constructor(tag,doc){this.tagName=tag;this.doc=doc;this.children=[];this.attrs={};this.events={};this.parent=null;this.text='';this.open=false;}
 get className(){return this.attrs.class??''} set className(v){this.attrs.class=v}
 get textContent(){return this.text+this.children.map(x=>x.textContent).join('')}
 set textContent(v){this.children=[];this.text=v}
 setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]??null}
 matches(s){if(s.startsWith('['))return s.slice(1,-1)in this.attrs;const [tag,cl]=s.split('.');return (!tag||tag===this.tagName)&&(!cl||this.className.split(' ').includes(cl))}
 querySelectorAll(s){return this.children.flatMap(x=>[...(x.matches(s)?[x]:[]),...x.querySelectorAll(s)])}
 querySelector(s){return this.querySelectorAll(s)[0]??null}
 append(...items){for(const x of items){x.remove();this.children.push(x);x.parent=this}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}
 replaceWith(x){const p=this.parent;if(!p)return;const i=p.children.indexOf(this);x.remove();p.children[i]=x;x.parent=p;this.parent=null}
 addEventListener(k,cb){(this.events[k]??=[]).push(cb)}
 click(x=30,y=30){const e={target:this,clientX:x,clientY:y,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};let n=this;while(n){for(const cb of n.events.click??[])cb(e);if(e.stopped)break;n=n.parent}return e}
 showModal(){this.open=true;this.modalCalls=(this.modalCalls??0)+1}
 close(){this.open=false;for(const cb of this.events.close??[])cb({target:this})}
 focus(){this.doc.activeElement=this}
 getBoundingClientRect(){return {left:10,top:10,right:110,bottom:110}}
}
// A page document with the nara:language event of assets/js/nara-language.js (switchTo changes <html lang>, then announces it).
function page(lang='en'){
 const doc={documentElement:{lang},listeners:{},createElement(tag){return new Element(tag,this)}};doc.body=new Element('body',doc);doc.querySelector=s=>doc.body.querySelector(s);doc.querySelectorAll=s=>doc.body.querySelectorAll(s);
 doc.addEventListener=(k,cb)=>(doc.listeners[k]??=[]).push(cb);
 doc.switchTo=language=>{doc.documentElement.lang=language;for(const cb of doc.listeners['nara:language']??[])cb({type:'nara:language',detail:{language}})};
 return doc;
}
function fixture(lang='en'){
 const doc=page(lang);
 const make=(tag,cl='',text='')=>{const x=doc.createElement(tag);x.className=cl;x.textContent=text;return x};
 const cards=[];
 for(const [id,value,reason]of [['S1','71 / 100','First actual reason'],['S2','68.5 / 100','Second actual reason']]){
  const card=make('article','daily-index-item'),title=make('h2','','Title '+id),details=make('details','reader-rating'),summary=make('summary'),label=make('span','','Reader score'),score=make('strong','',value),body=make('div','reader-rating-body'),p=make('p','',reason),en=make('span','','Reading notes'),sl=make('span','','Obrazložitvi');
  en.setAttribute('data-language-content','en');sl.setAttribute('data-language-content','sl');details.setAttribute('data-reader-rating',id);summary.append(label,score);body.append(p,en,sl);details.append(summary,body);card.append(title,details);doc.body.append(card);cards.push({card,title,body,en,sl});
 }
 const pending=make('span','reader-rating-pending','Reader rating pending');doc.body.append(pending);
 const run=()=>vm.runInNewContext(runtime,{document:doc});run();return {doc,cards,pending,run};
}
test('score click leaves the title and card intact; explanation is attached only to the modal',()=>{
 const {doc,cards,pending}=fixture();const button=doc.querySelector('.reader-score-button'),dialog=doc.querySelector('[data-reader-ratings-dialog]');
 assert.equal(button.textContent,'71 / 100');assert.equal(pending.textContent,'—');assert.deepEqual(cards[0].card.children,[cards[0].title,button]);assert.equal(doc.querySelectorAll('details.reader-rating').length,0);
 const e=button.click();assert.ok(e.prevented&&e.stopped);assert.equal(dialog.parent,doc.body);assert.equal(cards[0].body.parent,dialog);assert.equal(cards[0].title.parent,cards[0].card);assert.equal(dialog.open,true);assert.equal(dialog.modalCalls,1);assert.equal(doc.activeElement.className,'reader-rating-close');assert.equal(cards[0].sl.hidden,true);
 doc.querySelector('.reader-rating-close').click();assert.equal(dialog.open,false);assert.equal(doc.activeElement,button);
});
test('second score swaps the actual explanation and repeated loading creates no duplicate dialogs',()=>{
 const {doc,cards,run}=fixture('sl');const buttons=doc.querySelectorAll('.reader-score-button'),dialog=doc.querySelector('[data-reader-ratings-dialog]');
 buttons[0].click();doc.querySelector('.reader-rating-close').click();buttons[1].click();assert.equal(cards[0].body.parent,null);assert.equal(cards[1].body.parent,dialog);assert.equal(cards[1].en.hidden,true);assert.equal(cards[1].sl.hidden,false);assert.equal(cards[1].body.textContent,'Second actual reasonReading notesObrazložitvi');
 dialog.click(30,30);assert.equal(dialog.open,true);dialog.click(200,200);assert.equal(dialog.open,false);assert.equal(doc.activeElement,buttons[1]);run();assert.equal(doc.querySelectorAll('[data-reader-ratings-dialog]').length,1);
});
test('a language switch relabels score buttons, pending marks and an already open explanation',()=>{
 const {doc,cards,pending}=fixture('en');const button=doc.querySelector('.reader-score-button'),dialog=doc.querySelector('[data-reader-ratings-dialog]');
 assert.equal(button.title,'Open score explanation');assert.equal(pending.title,'Score pending');
 button.click();const close=doc.querySelector('.reader-rating-close');assert.equal(close.title,'Close score explanation');assert.equal(cards[0].en.hidden,false);
 doc.switchTo('sl');
 assert.equal(button.title,'Odpri razlago ocene');assert.equal(button.getAttribute('aria-label'),'71 / 100 — Odpri razlago ocene');
 assert.equal(pending.title,'Ocena še ni pripravljena');assert.equal(pending.getAttribute('aria-label'),'Ocena še ni pripravljena');
 assert.equal(close.title,'Zapri razlago ocene');assert.equal(close.getAttribute('aria-label'),'Zapri razlago ocene');
 assert.equal(dialog.open,true,'the open explanation stays open');assert.equal(cards[0].en.hidden,true);assert.equal(cards[0].sl.hidden,false);
 // Scores and the original model reasons stay exactly as published.
 assert.equal(button.textContent,'71 / 100');assert.equal(cards[0].body.textContent,'First actual reasonReading notesObrazložitvi');
 doc.switchTo('en');
 assert.equal(button.title,'Open score explanation');assert.equal(close.getAttribute('aria-label'),'Close score explanation');assert.equal(pending.title,'Score pending');assert.equal(cards[0].en.hidden,false);
});
test('a page with a pending mark and no scores follows the language too',()=>{
 const doc=page('en'),pending=doc.createElement('span');pending.className='reader-rating-pending';pending.textContent='Reader rating pending';doc.body.append(pending);
 vm.runInNewContext(runtime,{document:doc});
 assert.equal(pending.textContent,'—');assert.equal(pending.title,'Score pending');assert.equal(doc.querySelector('[data-reader-ratings-dialog]'),null,'no dialog without scores');
 doc.switchTo('sl');assert.equal(pending.title,'Ocena še ni pripravljena');assert.equal(pending.getAttribute('aria-label'),'Ocena še ni pripravljena');assert.equal(pending.textContent,'—');
 doc.switchTo('en');assert.equal(pending.getAttribute('aria-label'),'Score pending');
});
test('every generated Daily shell loads the native score-details adapter',()=>{
 for(const source of [dailyRenderer,formatRenderer])assert.match(source,/nara-daily-score-details\.js\?v=20261019-dialog-r2/);
});
