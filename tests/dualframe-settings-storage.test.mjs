import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ENABLED_MODELS,normalizeSettings,readSettings,writeSettings,orientationTransition,estimateHydrationSafety,readModelHealth,recordModelHealth} from '../public/Nara/dualframe-lab/settings.mjs';
import {storageErrorCode} from '../public/Nara/dualframe-lab/store.mjs';
const allModels=['wan-image-pro','grok-imagine','openai-flare','openai-sunburst','gemini-nano','minimax-image'];
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('default image models are the four BD-confirmed image models, others remain opt-in',()=>{
 const config=normalizeSettings({},allModels);
 assert.deepEqual(config.enabledModels,DEFAULT_ENABLED_MODELS);
 assert.equal(config.model,'openai-sunburst');
 assert.equal(config.delaySeconds,2);
 assert.equal(config.quality,'hd');
 assert.equal(config.autoSyncMetadata,true);
});
test('settings survive save/reload with validation, Unicode-safe local content and no secret fields',()=>{
 const memory=storage();
 const config=writeSettings({enabledModels:['gemini-nano','openai-flare'],model:'gemini-nano',mode:'faithful',position:'top',quality:'4k',galleryCollection:'own',viewerQuality:'4k',delaySeconds:5,autoSyncMetadata:false,rememberLast:true,secret:'do-not-store'},memory,allModels);
 assert.equal(config.model,'gemini-nano');assert.equal(config.delaySeconds,5);
 const loaded=readSettings(memory,allModels);assert.deepEqual(loaded,config);
 assert.equal(memory.getItem('bd-dualframe-settings-v1').includes('do-not-store'),false);
 const invalid=normalizeSettings({delaySeconds:200,mode:'malicious',enabledModels:['unregistered'],model:'unregistered',quality:'INVALID'},allModels);
 assert.equal(invalid.delaySeconds,2);assert.equal(invalid.mode,'smart');assert.ok(invalid.enabledModels.length>0);
 assert.equal(invalid.quality,'hd');assert.ok(allModels.includes(invalid.model));
});
test('rotation delay is off/immediate or a bounded hold; no delay on initial image',()=>{
 assert.equal(orientationTransition(null,'portrait',2),'unchanged');
 assert.equal(orientationTransition('portrait','portrait',5),'unchanged');
 assert.equal(orientationTransition('landscape','portrait',0),'immediate');
 assert.equal(orientationTransition('landscape','portrait',2),'delay');
});
test('storage budget never relies on the device free-space guess',()=>{
 const mib=1048576;
 assert.deepEqual(estimateHydrationSafety({supported:false},100*mib).safe,true);
 assert.equal(estimateHydrationSafety({supported:true,usage:700*mib,quota:800*mib},90*mib).safe,false);
 assert.equal(estimateHydrationSafety({supported:true,usage:100*mib,quota:800*mib},90*mib).safe,true);
});
test('IndexedDB errors retain cause classes instead of generic storage full',()=>{
 assert.equal(storageErrorCode({name:'QuotaExceededError'}),'STORAGE_QUOTA_EXCEEDED');
 assert.equal(storageErrorCode({name:'AbortError'}),'STORAGE_TRANSACTION_ABORTED');
 assert.equal(storageErrorCode({name:'UnknownError'}),'STORAGE_IO_FAILURE');
 assert.equal(storageErrorCode({name:'SecurityError'}),'STORAGE_ACCESS_DENIED');
 assert.equal(storageErrorCode({name:'InvalidStateError'}),'STORAGE_CONNECTION_CLOSED');
 assert.equal(storageErrorCode(null),'STORAGE_OPERATION_FAILED');
});
test('model history records only actual job outcomes and never configured-key checks',()=>{
 const memory=storage();
 recordModelHealth('wan-image-pro','expand','READY',memory);
 recordModelHealth('wan-image-pro','generate','FAILED',memory);
 recordModelHealth('wan-image-pro','expand','KEY_CONFIGURED',memory);
 const row=readModelHealth(memory)['wan-image-pro'];
 assert.equal(row.successful,1);assert.equal(row.failed,1);assert.equal(row.lastTask,'generate');assert.equal(row.lastStatus,'FAILED');
});
