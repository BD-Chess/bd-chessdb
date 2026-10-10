'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'public/site-search-index.json'),'utf8'));
assert.match(html,/<a class="brand" href="\.\/Start\/index\.html"/);
assert.match(html,/id="landing-compact-header"/);
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(!/application\/ld\+json|\bsrc=/.test(m[1]))new vm.Script(m[2]);
}
assert.equal(data.body_indexed,false,'No protected bodies indexed');
assert.equal(data.total_pages,data.items.length);
const canonical=url=>url.replace(/\/index\.html$/i,'/').replace(/\/+$/,'').toLowerCase();
const targets=['/Start/index.html','/chess-lab/','/S/new/','/Trip/new/','/F4M/new/','/CW/new/'];
for(const url of targets){
 const matches=data.items.filter(x=>canonical(x.url)===canonical(url));
 assert.equal(matches.length,1,'One canonical result: '+url);
 if(url!==targets[0])assert.equal(matches[0].channel,'lab');
}
// Execute actual production normalization, seeds, index merge and ranking, not a test copy.
const runtime=html.match(/<script id="landing-runtime">([\s\S]*?)<\/script>/)[1];
const seed=runtime.slice(runtime.indexOf('const BASE='),runtime.indexOf('function localPath'));
const helpers=runtime.slice(runtime.indexOf('function localPath'),runtime.indexOf('let history=[]'));
const search=runtime.slice(runtime.indexOf('async function loadIndex'),runtime.indexOf('function historyView'));
async function check(base,offline){
 const context={URL,Map,document:{baseURI:base},location:new URL(base),render(){},fetch:async()=>{
  if(offline)throw Error('Offline');return {ok:true,json:async()=>data};
 }};
 vm.createContext(context);
 vm.runInContext(seed+helpers+search+';globalThis.qa={shortlist,loadIndex,get pages(){return pages}}',context);
 await context.qa.loadIndex();
 const first=q=>canonical(new URL(context.qa.shortlist(q)[0]?.url).pathname.replace(new URL(base).pathname.replace(/\/$/,''),''));
 assert.equal(context.qa.shortlist('LAB').length,5,'Only the five active LAB entrances');
 for(const q of ['šah lab','chess lab','lab chess','sah lab'])assert.equal(first(q),'/chess-lab');
 for(const [q,target] of [['sudoku lab','/s/new'],['trip lab','/trip/new'],['flip4m lab','/f4m/new'],['križanke lab','/cw/new'],['crosswords lab','/cw/new'],['Start','/start'],['/Start/','/start'],['začetna','/start'],['chess','/chess']])assert.equal(first(q),target,q);
 assert.equal(context.qa.shortlist('lab no-such-project-321').length,0);
 assert.ok(context.qa.shortlist('LAB').every(x=>!x.url.includes('/old/')));
 console.log('PASS actual search merge/ranking',new URL(base).pathname,offline?'fallback':'global index');
}
(async()=>{
 for(const base of ['https://www.mdlxdcc.org/','https://bd-chess.github.io/bd-chessdb/'])for(const offline of [false,true])await check(base,offline);
 console.log('PASS landing header/search source, canonical LAB metadata, languages, global and offline fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
