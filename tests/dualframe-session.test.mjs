import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const key='bd-dualframe-api-session-v3';
function environment(){
 const memory=new Map(),old={};for(const n of ['location','localStorage','document','fetch'])old[n]=globalThis[n];
 const dialog=new EventTarget(),form=new EventTarget(),input={value:''},error={textContent:''},submit={disabled:false};let opens=0;
 dialog.showModal=()=>opens++;dialog.close=()=>dialog.dispatchEvent(new Event('close'));input.focus=()=>{};form.querySelector=()=>submit;
 const doc=new EventTarget();doc.getElementById=id=>({'api-auth':dialog,'api-auth-form':form,'api-password':input,'api-auth-error':error}[id]);
 globalThis.document=doc;globalThis.location={hostname:'bd-chess.github.io',origin:'https://bd-chess.github.io'};globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 return {memory,form,input,dialog,get opens(){return opens;},restore(){for(const [k,v]of Object.entries(old)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
test('saved local session authenticates once and serves ten image requests without a password popup',async()=>{
 const e=environment(),token=randomUUID();e.memory.set(key,JSON.stringify({token,expires_at:new Date(Date.now()+86400000).toISOString()}));let checks=0,requests=0;
 try{globalThis.fetch=async(url,options)=>{assert.equal(options.headers.authorization,'Bearer '+token);if(url.endsWith('/session'))checks++;else requests++;return Response.json({ok:true});};const api=await import('../public/Nara/dualframe-lab/api-client.mjs?test='+randomUUID());await api.ensureAuth();for(let i=0;i<10;i++){await api.ensureAuth();await api.request('/jobs/'+i);}assert.equal(e.opens,0);assert.equal(checks,1);assert.equal(requests,10);api.lockAPI();assert.equal(e.memory.has(key),false);}finally{e.restore();}
});
test('concurrent generation requests share one popup and persist only the server session',async()=>{
 const e=environment(),password=randomUUID(),token=randomUUID();let auths=0;
 try{globalThis.fetch=async(url,options)=>{assert.ok(url.endsWith('/auth'));auths++;assert.equal(JSON.parse(options.body).password,password);return Response.json({token,expires_at:new Date(Date.now()+30*86400000).toISOString()});};const api=await import('../public/Nara/dualframe-lab/api-client.mjs?test='+randomUUID());const a=api.ensureAuth(),b=api.ensureAuth();assert.equal(e.opens,1);e.input.value=password;e.form.dispatchEvent(new Event('submit',{cancelable:true}));await Promise.all([a,b]);assert.equal(auths,1);assert.equal(e.input.value,'');assert.equal(JSON.parse(e.memory.get(key)).token,token);assert.ok(![...e.memory.values()].some(v=>v.includes(password)));await api.ensureAuth();assert.equal(e.opens,1);}finally{e.restore();}
});
test('large saved PNG is reassembled from authenticated byte ranges',async()=>{
 const e=environment(),data=new Uint8Array(2097170);data.fill(173);e.memory.set(key,JSON.stringify({token:randomUUID(),expires_at:new Date(Date.now()+86400000).toISOString()}));let calls=0;
 try{globalThis.fetch=async(url,options)=>{assert.ok(options.headers.authorization);const [,a,b]=options.headers.range.match(/bytes=(\d+)-(\d+)/),start=Number(a),end=Math.min(Number(b),data.length-1);calls++;return new Response(data.slice(start,end+1),{status:206,headers:{'content-type':'image/png','content-range':`bytes ${start}-${end}/${data.length}`}});};const api=await import('../public/Nara/dualframe-lab/api-client.mjs?test='+randomUUID());const blob=await api.asset('fixture-asset');assert.equal(calls,2);assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),data);}finally{e.restore();}
});
