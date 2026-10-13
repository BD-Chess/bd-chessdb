'use strict';
// Original verified NNUE, no engine search. Exercise actual session/IDB glue.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb'),{webcrypto}=require('node:crypto');
const Deep=require('../js/8zc-deep-engine.js'),source=fs.readFileSync(path.join(__dirname,'../js/8zc-analysis-session.js'),'utf8');
function session(indexedDB){
 const root={indexedDB,crypto:webcrypto,navigator:{hardwareConcurrency:4},localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>{throw new Error('Duplicate NNUE network fetch');}},module={exports:{}};
 vm.runInNewContext(source,{window:root,module,require:()=>Deep,URL,Date,Promise,AbortController,setTimeout,clearTimeout});return module.exports;
}
test('a tab with prior missing NNUE restores a later save by another tab without redownload',async()=>{
 const db=new IDBFactory(),first=session(db),second=session(db);
 assert.equal((await first.restoreBerserkNetwork()).berserkNetworkState,'missing');
 const directory=path.join(__dirname,'../vendor/berserk/v14-5b8d6c93');
 const bytes=Buffer.concat([0,1,2].map(n=>fs.readFileSync(path.join(directory,'berserk-9b84c340af7e.part'+n+'.nn'))));
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 await second.loadBerserkNetwork({size:bytes.length,arrayBuffer:async()=>buffer});
 const result=await first.ensureBerserkNetwork();assert.equal(result.berserkNetworkReady,true);assert.equal(result.berserkNetworkPersistent,true);assert.equal(result.berserkNetworkState,'ready');
});
