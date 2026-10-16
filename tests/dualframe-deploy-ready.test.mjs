import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPublishedDeploy} from '../scripts/dualframe-deploy-ready.mjs';
const site=(id,state='ready')=>({published_deploy:{id,state},account_id:'synthetic-account'});
test('ready production returns immediately only for the exact expected deployment',async()=>{
 const current=site('expected');assert.equal(await waitForPublishedDeploy({expectedId:'expected',initialSite:current,loadSite:()=>{throw Error('UNEXPECTED_READ');}}),current);
});
test('stale site metadata and an in-progress deployment settle through bounded reads',async()=>{
 const ready=site('expected'),rows=[site('expected','building'),ready],waits=[];
 assert.equal(await waitForPublishedDeploy({expectedId:'expected',initialSite:site('previous'),loadSite:async()=>rows.shift(),wait:async ms=>waits.push(ms),attempts:3}),ready);
 assert.deepEqual(waits,[2000,2000]);assert.equal(rows.length,0);
});
test('a competing or never-ready deployment cannot pass the production gate',async()=>{
 for(const current of [site('competing'),site('expected','building')]){
  let reads=0,waits=0;await assert.rejects(waitForPublishedDeploy({expectedId:'expected',initialSite:current,loadSite:async()=>{reads++;return current;},wait:async()=>{waits++;},attempts:3}),/PRODUCTION_DEPLOY_NOT_READY/);
  assert.equal(reads,2);assert.equal(waits,2);
 }
});
test('missing CLI identity and API read failures remain hard failures',async()=>{
 let reads=0;await assert.rejects(waitForPublishedDeploy({initialSite:site('expected'),loadSite:async()=>{reads++;}}),/PRODUCTION_DEPLOY_NOT_READY/);assert.equal(reads,0);
 await assert.rejects(waitForPublishedDeploy({expectedId:'expected',initialSite:site('previous'),loadSite:async()=>{throw Error('NETLIFY_API_503');},wait:async()=>{}}),/NETLIFY_API_503/);
});
