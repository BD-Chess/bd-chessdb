"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/AI8/cli-loops-preferences.js'),'utf8');
function browser(initial={},blocked=false){
 const stored={...initial},events={},controls={};
 for(const id of ['font-down','font-up','font-value','theme'])controls[id]={attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.handlers[k]=fn}};
 const root={dataset:{},style:{setProperty(k,v){this[k]=v}}},meta={};
 vm.runInNewContext(code,{document:{documentElement:root,getElementById:id=>controls[id],querySelector:()=>meta},localStorage:{getItem(k){if(blocked)throw Error('blocked');return stored[k]??null},setItem(k,v){if(blocked)throw Error('blocked');stored[k]=v}},matchMedia:()=>({matches:true}),window:{addEventListener(k,fn){events[k]=fn}}});
 return {root,controls,stored,events};
}
let b=browser({'mdlxdcc-font':'1.5','mdlxdcc-theme':'dark'});
assert.equal(b.root.style['--scale'],1.5);assert.equal(b.controls['font-up'].attrs['aria-disabled'],'true');assert.equal(b.root.dataset.theme,'dark');
b.controls['font-down'].handlers.click();assert.equal(b.stored['mdlxdcc-font'],'1.45');
b.events.storage({key:'mdlxdcc-font',newValue:'0.1'});assert.equal(b.root.style['--scale'],.8);assert.equal(b.controls['font-down'].attrs['aria-disabled'],'true');
b.events.storage({key:'mdlxdcc-theme',newValue:null});assert.equal(b.root.dataset.theme,'light');
b.events.storage({key:null,newValue:null});assert.equal(b.root.style['--scale'],1);assert.equal(b.root.dataset.theme,'light');
b=browser({'mdlxdcc-font':'garbage'});assert.equal(b.root.style['--scale'],1);
b=browser({},true);assert.equal(b.root.style['--scale'],1);b.controls.theme.handlers.click();assert.equal(b.root.dataset.theme,'dark');b.controls['font-up'].handlers.click();assert.equal(b.root.style['--scale'],1.05);
console.log('PASS: preference bounds, persistence, storage events/removal, system fallback and blocked storage.');
