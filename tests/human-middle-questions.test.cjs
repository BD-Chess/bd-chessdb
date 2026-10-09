'use strict';
// Public-gallery regression. Node only: no browser, network or private APIs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const pub=path.resolve(__dirname,'../public');
const base='assets/human-middle/v5/';
const read=p=>fs.readFileSync(path.join(pub,p),'utf8');
const html=read('index.html'),script=read(base+'human-middle-r13-family.js');
const css=read(base+'human-middle-family-r1.css');
const window={};
vm.runInNewContext(read(base+'human-middle-series-r1.js'),{window});
vm.runInNewContext(read(base+'human-middle-explanations-r1.js'),{window});
const series=window.MDLxDCCHumanMiddleSeries;
assert.equal(series.time.items.length,9);
assert.equal(series.information.items.length,9);
assert.equal(series.questions.items.length,1);
assert.equal(Object.keys(window.MDLxDCCHumanMiddleExplanations).length,27,'Existing bilingual explanations retained');
const banner=html.match(/<section class="human-middle human-middle-family"[\s\S]*?<\/section>/)?.[0];
assert.ok(banner,'Single family banner');
assert.equal((html.match(/class="hm-unified-banner"/g)||[]).length,1);
assert.deepEqual([...banner.matchAll(/data-hm-open-series="([^"]+)"/g)].map(m=>m[1]),['space','time','information','questions']);
assert.equal((banner.match(/aria-controls="human-middle-dialog"/g)||[]).length,4);
assert.doesNotMatch(banner,/human-middle-card|hm-family-banners|Queations/);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'No duplicate landing IDs');
for(const door of ['index-search.html','index-atlas.html','index-todo.html','index-intro.html'])assert.ok(html.includes('class="door" href="'+door+'"'),'Original door '+door);
assert.match(script,/questions:'#clovek-vprasanja'/);
assert.match(script,/if\(id==='questions'\)galleryController\?\.openFirst\(\)/);
assert.match(script,/if\(currentSeries==='questions'\)galleryController\?\.openFirst\(\)/);
assert.match(script,/if\(HM_DETAILS\.length<2\)viewer\.querySelectorAll/);
assert.match(script,/detailOpen\?galleryController\?\.closeDetail\(\):close\(false\)/);
assert.match(script,/lastOpener\?\.isConnected\?lastOpener:openBtn/);
assert.match(script,/d\.explanation\?\.\[l\]/);
assert.match(css,/\.hm-family-buttons\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.hm-family-buttons\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/hm-family-entry:focus-visible/);

const status=Object.fromEntries(['space','time','information','questions'].map(id=>[id,{dataset:{},innerHTML:''}]));
const root={dataset:{lang:'en'}};
const context={window,root,currentSeries:'questions',SERIES_IDS:['space','time','information','questions'],SPACE_DETAILS:Array(9).fill({}),$:(selector)=>status[selector.match(/data-hm-series-status="([^"]+)"/)?.[1]]};
vm.createContext(context);
for(const name of ['galleryLang','galleryText','html','readyImage','seriesSpec','publishedCount','familySources','familyAbout','updateFamilyBanners']){
 const line=script.split('\n').find(x=>x.startsWith('function '+name+'('));
 assert.ok(line,name+' declaration');vm.runInContext(line,context);
}
const item=series.questions.items[0];
assert.equal(context.readyImage(item),true);
assert.equal(context.readyImage({...item,src:item.preview}),true);
for(const bad of ['https://example.com/image.webp','assets/human-middle/../bad.webp','assets/human-middle/./bad.webp','assets/human-middle/image.webp?x=1','javascript:alert(1)'])assert.equal(context.readyImage({...item,src:bad}),false,bad);
for(const p of [item.src,item.preview])assert.ok(fs.existsSync(path.join(pub,p)),p);
assert.equal(item.width,941);assert.equal(item.height,1672);
assert.equal(item.credit,'seed BD · words BD × Claude · picture GPT · 2026');
assert.equal(item.title.en,'The Meadow and the Tower');
assert.equal(item.summary.en,'Knowledge lives in the tower. Questions are born on the meadow.');
assert.equal(item.summary.sl,'Znanje živi v stolpnici. Vprašanja se rodijo na travniku.');
assert.equal(item.sources.length,0,'Art metaphor has no invented scientific sources');
for(const lang of ['en','sl']){
 root.dataset.lang=lang;
 const about=context.familyAbout(series.questions);
 assert.ok(about.includes(item.title[lang]));assert.ok(about.includes(item.explanation[lang]));assert.ok(about.includes(item.credit));
 assert.ok(about.includes(item.src));assert.ok(about.includes(item.preview));
 assert.doesNotMatch(about,/all nine images|vseh devet slik|in preparation|v pripravi/);
}
context.updateFamilyBanners();
assert.match(status.questions.innerHTML,/Bonus image/);assert.match(status.questions.innerHTML,/Bonus slika/);
assert.doesNotMatch(status.questions.innerHTML,/1 images/);
assert.equal(status.questions.dataset.pending,'false');
assert.match(status.space.innerHTML,/9 images/);
for(const p of [base+'human-middle-r13-family.js',base+'human-middle-series-r1.js',base+'human-middle-explanations-r1.js','pwa.js','sw.js'])new vm.Script(read(p),{filename:p});
for(const [n,m] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
 if(/\bsrc=/.test(m[1]))continue;
 if(/application\/ld\+json/.test(m[1]))JSON.parse(m[2]);
 else if(!/\btype=(?:"|')application\/json/.test(m[1]))new vm.Script(m[2],{filename:'index.html inline '+n});
}
console.log('PASS Human in the Middle: one banner, four axes, 27 explanations, bilingual bonus, safe paths, keyboard/focus wiring, responsive grids, all JS and JSON-LD syntax');
