'use strict';
const assert=require('assert');
globalThis.performance=require('perf_hooks').performance;
require('../../public/F4M/f4m-core.js');
require('../../public/F4M/f4m-search.js');
require('./smart-time-v2.js');
const E=globalThis.F4M,S=globalThis.F4MSearch;
let checks=0;
const ok=(cond,msg)=>{checks++;assert.ok(cond,msg);};
const eq=(a,b,msg)=>{checks++;assert.strictEqual(a,b,msg);};
const budget=(s,ms)=>S.smartTimeBudget(s,ms);

const s0=E.create(2);
eq(budget(s0,4500).effectiveMs,4500,'Master unchanged');
eq(budget(s0,1600).effectiveMs,1600,'Challenge unchanged');
eq(budget(s0,60000).effectiveMs,1000,'GM first move fast');
eq(budget(s0,120000).effectiveMs,1500,'Champion first move fast');

let s1=E.action(s0,{type:'drop',col:3});
eq(budget(s1,60000).effectiveMs,1000,'other side first move fast');
let s2=E.action(s1,{type:'drop',col:4});
eq(budget(s2,60000).effectiveMs,3000,'first side second move fast');
eq(budget(s2,120000).effectiveMs,5000,'Champion second move fast');
let s3=E.action(s2,{type:'drop',col:2});
eq(budget(s3,60000).effectiveMs,3000,'other side second move fast');
let s4=E.action(s3,{type:'drop',col:5});
const gm3=budget(s4,60000),ch3=budget(s4,120000);
eq(gm3.playerMove,3,'ply identifies third move per side');
ok(gm3.effectiveMs>=15000&&gm3.effectiveMs<=30000,'GM third move enters serious early budget');
ok(ch3.effectiveMs>=25000&&ch3.effectiveMs<=50000,'Champion third move enters serious early budget');

const mid=E.create(2);mid.ply=10;
const gmMid=budget(mid,60000),chMid=budget(mid,120000);
ok(gmMid.effectiveMs>=30000&&gmMid.effectiveMs<=60000,'GM midgame floor');
ok(chMid.effectiveMs>=55000&&chMid.effectiveMs<=120000,'Champion midgame floor');

const complex=E.create(3);complex.ply=20;
complex.grid[7][2]=1;complex.grid[7][3]=1;complex.grid[7][4]=1;
complex.grid[6][2]=2;complex.grid[6][3]=2;
complex.mag.top[2]={p:1,life:5};complex.mag.left[6]={p:2,life:4};complex.mag.right[7]={p:1,life:3};
const gmComplex=budget(complex,60000),chComplex=budget(complex,120000);
ok(gmComplex.effectiveMs>=45000,'GM complex position gets 45s+');
ok(chComplex.effectiveMs>=90000,'Champion complex position gets 90s+');
ok(gmComplex.effectiveMs>gmMid.effectiveMs,'complexity raises GM time');
ok(chComplex.effectiveMs>chMid.effectiveMs,'complexity raises Champion time');
ok(gmComplex.effectiveMs<=60000&&chComplex.effectiveMs<=120000,'ceilings preserved');
ok(gmComplex.legalMoves>=8,'legal branching recorded');
ok(gmComplex.activeMagnets===3,'active magnets recorded');
ok(gmComplex.threats>0,'threat signal recorded');

const forced=E.create(0);forced.ply=12;
for(let c=0;c<8;c++)for(let r=0;r<8;r++)forced.grid[r][c]=((r+c)&1)+1;
forced.grid[0][7]=0;forced.result=0;
const forcedB=budget(forced,60000);
ok(forcedB.legalMoves<=1,'forced fixture has <=1 legal move');
eq(forcedB.reason,'forced-move','forced move short-circuits budget');

const meta=S.smartTimeBudget(complex,60000);
ok(meta.playerMove===11&&meta.ply===20,'move metadata deterministic');
console.log(JSON.stringify({scope:'Smart Time v2',checks,passed:checks,gm3:gm3.effectiveMs,ch3:ch3.effectiveMs,gmMid:gmMid.effectiveMs,chMid:chMid.effectiveMs,gmComplex:gmComplex.effectiveMs,chComplex:chComplex.effectiveMs}));
