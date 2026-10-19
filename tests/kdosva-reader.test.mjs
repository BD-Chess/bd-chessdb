// Executes the shipped reader in a minimal DOM fixture. Layout/browser QA is separate.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../public/AI8/KDOSVA.html',import.meta.url),'utf8');
const original=JSON.parse(readFileSync(new URL('../public/AI8/kdosva/feed.json',import.meta.url),'utf8'));
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element{
 constructor(tag='div',text=''){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.events={};this.hidden=false;this._text=text;this._value='';this.style={setProperty(){}};this.rect={top:1000,bottom:1100};this.classList={add:v=>{this.className+=' '+v},remove:v=>{this.className=this.className.split(' ').filter(x=>x!==v).join(' ')}};}
 get className(){return this.attrs.class||''}set className(v){this.attrs.class=v}
 get id(){return this.attrs.id||''}set id(v){this.attrs.id=v}
 get href(){return this.attrs.href||''}set href(v){this.attrs.href=v}
 get options(){return this.children.filter(c=>c.tagName==='OPTION')}
 get value(){return this._value||this.attrs.value||this.options[0]?.value||''}set value(v){this._value=v}
 set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
 set innerHTML(v){this.textContent=v.replace(/<[^>]*>/g,'')}
 append(...nodes){for(const n of nodes){if(n.tagName==='#FRAGMENT'){this.append(...n.children);continue}n.parent=this;this.children.push(n)}}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes)}
 add(n){this.append(n)}setAttribute(k,v){this.attrs[k]=String(v)}removeAttribute(k){delete this.attrs[k]}
 addEventListener(k,f){(this.events[k]??=[]).push(f)}
 async fire(k,event={}){for(const f of this.events[k]||[])await f({target:this,button:0,preventDefault(){},...event})}
 scrollIntoView(){this.scrolled=true}focus(){this.focused=true}getBoundingClientRect(){return this.rect}
 closest(sel){return matches(this,sel)?this:this.parent?.closest(sel)}
}
function matches(n,selector){
 if(selector.includes(' ')){const parts=selector.split(' '),last=parts.pop();if(!matches(n,last))return false;let a=n.parent;while(a){if(matches(a,parts.join(' ')))return true;a=a.parent}return false}
 const attr=/\[([^=\]]+)(?:="([^"]*)")?\]/.exec(selector);if(attr){let val=attr[1].startsWith('data-')?n.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]:n.attrs[attr[1]];if(val===undefined||(attr[2]!==undefined&&val!==attr[2]))return false;selector=selector.replace(attr[0],'')}
 if(selector.startsWith('#'))return n.id===selector.slice(1);if(selector.startsWith('.'))return n.className.split(' ').includes(selector.slice(1));return !selector||n.tagName.toLowerCase()===selector;
}
function dom(){
 const root=new Element('document'),stack=[root];
 const source=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'');
 for(const token of source.match(/<[^>]+>|[^<]+/g)||[]){if(/^<!/.test(token))continue;if(/^<\//.test(token)){if(stack.length>1)stack.pop();continue}if(token[0]!=='<'){stack.at(-1).append(new Element('#text',token));continue}let tag=/^<([\w-]+)/.exec(token)?.[1];if(!tag)continue;const n=new Element(tag);for(const m of token.matchAll(/([\w-]+)="([^"]*)"/g))n.setAttribute(m[1],m[2]);stack.at(-1).append(n);if(!/^(meta|link|input|br|hr|img)$/.test(tag))stack.push(n)}
 const all=()=>{const out=[];const walk=n=>{out.push(n);n.children.forEach(walk)};walk(root);return out};
 return {documentElement:all().find(n=>n.tagName==='HTML'),hidden:false,getElementById:id=>all().find(n=>n.id===id),createElement:t=>new Element(t),createTextNode:t=>new Element('#text',t),createDocumentFragment:()=>new Element('#fragment'),querySelectorAll:sel=>all().filter(n=>sel.split(',').some(s=>matches(n,s.trim()))),querySelector(sel){return this.querySelectorAll(sel)[0]},addEventListener(){}};
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
async function setup(feed=original,hash=''){
 const document=dom(),location=new URL('https://example.test/AI8/KDOSVA.html'+hash),fetches=[];
 const context={document,location,URL,URLSearchParams,Intl,Date,console,Option:class extends Element{constructor(text,value){super('option',text);this.value=value}},localStorage:{getItem:()=>null,setItem(){}},history:{replaceState(_a,_b,url){location.href=new URL(url,location).href},pushState(_a,_b,url){location.href=new URL(url,location).href}},window:{addEventListener(){}},IntersectionObserver:class{observe(){}disconnect(){}},setInterval(){},fetch:async url=>{fetches.push(url.pathname);return {ok:true,json:async()=>url.pathname.endsWith('feed.json')?structuredClone(feed):{schema:'kdosva.archive.v1',posts:structuredClone(original.recent)}}}};
 runInNewContext(code,context);await settle();return {document,location,fetches,$:id=>document.getElementById(id)};
}
test('overview precedes discussion, newest articles indexed first, sixteen sourced bilingual highlights',async()=>{
 const r=await setup();for(const id of ['contents','intro','insights','thread'])assert(r.$(id));assert(html.indexOf('id="contents"')<html.indexOf('id="intro"'));assert(html.indexOf('id="intro"')<html.indexOf('id="insights"'));assert(html.indexOf('id="insights"')<html.indexOf('id="thread"'));
 assert.equal(r.$('article-index').children.length,original.recent.length);assert.equal(r.$('article-index').children[0].dataset.postTarget,original.recent.at(-1).id);assert.equal(r.$('insight-grid').children.length,16);assert.equal(r.document.querySelectorAll('article').length,original.recent.length);assert.equal(r.$('index-more').hidden,true);
 for(const a of r.document.querySelectorAll('.source-links a'))assert(original.recent.some(p=>p.id===a.dataset.postTarget));
 assert(r.$('insights-note').textContent.includes('R012'));assert(r.$('intro-copy').textContent.includes('Bojan Dobrečevič'));
 await r.$('lang-en').fire('click');assert.equal(r.document.documentElement.lang,'en');assert.equal(r.$('contents-heading').textContent,'Article contents');assert.equal(r.$('article-index').children[0].children[1].textContent,original.recent.at(-1).translations.en.title);assert(r.$('intro-copy').textContent.includes('AI8 DNA'));assert(!r.$('R001-GPT').scrolled);
});
test('article and highlight links clear filters, navigate and keep target through language change',async()=>{
 const r=await setup();r.$('search').value='no match';await r.$('search').fire('input');assert.equal(r.document.querySelectorAll('article').length,0);
 const link=r.$('article-index').children.find(n=>n.dataset.postTarget==='R005-GPT');await r.$('article-index').fire('click',{target:link});await settle();assert.equal(r.$('search').value,'');assert(r.$('R005-GPT').scrolled);assert(r.$('R005-GPT').focused);assert.equal(r.location.hash,'#R005-GPT');assert.equal(r.$('article-index').children.find(n=>n.dataset.postTarget==='R005-GPT').attrs['aria-current'],'true');
 r.$('R005-GPT').rect={top:100,bottom:700};await r.$('lang-en').fire('click');assert.equal(r.location.hash,'#R005-GPT');assert(r.$('R005-GPT').scrolled);
 const source=r.document.querySelectorAll('.source-links a')[0];await r.$('insight-grid').fire('click',{target:source});await settle();assert.equal(r.location.hash,'#R001-GPT');
});
test('older contributions remain reachable from contents and direct permalinks after feed rollover',async()=>{
 const feed=structuredClone(original);feed.recent=[original.recent.at(-1)];
 let r=await setup(feed);assert.equal(r.$('index-more').hidden,false);await r.$('index-more').fire('click');await settle();assert.equal(r.$('article-index').children.length,original.recent.length);assert.equal(r.$('index-more').hidden,true);
 const old=r.$('article-index').children.find(n=>n.dataset.postTarget==='R001-GPT');await r.$('article-index').fire('click',{target:old});await settle();assert.equal(r.$('archive').value,feed.archives[0].path);assert(r.$('R001-GPT').scrolled);
 r=await setup(feed,'?lang=en#R001-GPT');assert(r.$('R001-GPT').scrolled);assert.equal(r.document.documentElement.lang,'en');assert(r.fetches.some(s=>s.includes('/archive/')));
});
test('contents use text nodes for incoming titles and support new feed entries without HTML edits',async()=>{
 const feed=structuredClone(original),post=structuredClone(feed.recent.at(-1));post.round='R'+String(Number(post.round.slice(1))+1).padStart(3,'0');post.id=post.round+'-CLAUDE';post.actor='CLAUDE';post.title='<img src=x onerror=alert(1)>';delete post.translations;feed.recent.push(post);feed.total_posts=original.total_posts+1;
 const r=await setup(feed);assert.equal(r.$('article-index').children.length,original.recent.length+1);const title=r.$('article-index').children[0].children[1];assert.equal(title.textContent,post.title);assert.equal(title.children.length,0);
});

