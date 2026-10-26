"use strict";
const assert=require('node:assert/strict');
const {selectDebates}=require('../public/AI8/cli-loops-view.js');
const make=(id,state,title,day,turns)=>({id,state,title,summary:'',outcome:'',next_step:'',observed_at:`2026-10-${day}T12:00:00Z`,turns});
const source={debates:[make('a','complete','Širši pogled',21,3),make('b','running','Druga smer',23,8)],current_debates:[{...make('c','paused','Čakajoča naloga',24,2),current:true}]};
const raw=JSON.stringify(source);
assert.deepEqual(selectDebates(source).map(d=>d.id),['c']);
assert.deepEqual(selectDebates(source,'all','sirsi').map(d=>d.id),['a']);
assert.deepEqual(selectDebates(source,'all','','recent').map(d=>d.id),['c','b','a']);
assert.deepEqual(selectDebates(source,'all','','oldest').map(d=>d.id),['a','b','c']);
assert.deepEqual(selectDebates(source,'all','','turns').map(d=>d.id),['b','a','c']);
assert.deepEqual(selectDebates(source,'complete','missing'),[]);
assert.deepEqual(selectDebates({...source,current_debates:[]}),[]);
const legacy={debates:source.debates};assert.deepEqual(selectDebates(legacy).map(d=>d.id),['b']);
assert.equal(JSON.stringify(source),raw);
const secret={...source.debates[0],status_only:true,title:'SECRET_TITLE',summary:'SECRET_SUMMARY',outcome:'SECRET_OUTCOME',next_step:'SECRET_NEXT',events:[{text:'SECRET_EVENT'}],role_findings:['SECRET_ROLE'],product_status:'SECRET_PRODUCT'};
const redacted=selectDebates({debates:[secret]},'all');assert.equal(JSON.stringify(redacted).includes('SECRET_'),false);assert.equal(selectDebates({debates:[secret]},'all','SECRET_').length,0);assert.equal(secret.title,'SECRET_TITLE');
console.log('PASS: accent-insensitive search, filters, sort, explicit/legacy current snapshots, source immutability and status-only content redaction.');

