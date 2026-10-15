import test from 'node:test';
import assert from 'node:assert/strict';
import {ACCOUNT_IDENTITY_SCHEMA,accountOwner,createAccountIdentity} from '../functions/lib/dualframe/account-identity.mjs';

const issuer='https://www.mdlxdcc.org/.netlify/identity',now=Date.parse('2026-10-15T15:00:00.000Z');
const userA={id:'identity-user-A01',email:'a@example.test',confirmedAt:'2026-10-14T12:00:00.000Z'};
const userB={id:'identity-user-B02',email:'b@example.test',confirmedAt:'2026-10-14T13:00:00.000Z'};
const req=(origin='https://www.mdlxdcc.org',body={})=>new Request('https://www.mdlxdcc.org/api/df/auth/account',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const make=({user=userA,values={},getSettings=async()=>({autoconfirm:false,disableSignup:true,providers:{email:true}}),getIdentityConfig=()=>({url:issuer}),publicAccessVerified=false}={})=>createAccountIdentity({getUser:async()=>user,getIdentityConfig,getSettings,now:()=>now,publicAccessVerified,env:key=>({DF_ACCOUNT_IDENTITY_ENABLED:'true',DF_ACCOUNT_IDENTITY_ISSUER:issuer,DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:JSON.stringify([userA.id,userB.id]),...values})[key]});

test('default configuration and public gates remain held without creating or logging in accounts',async()=>{
 let reads=0;
 const disabled=createAccountIdentity({getUser:async()=>{reads++;return userA;}});
 assert.equal(disabled.status().status,'IDENTITY_NOT_CONFIGURED');
 await assert.rejects(disabled(req()),/IDENTITY_NOT_CONFIGURED/);assert.equal(reads,0);
 const restricted=make();assert.equal(restricted.status().public_enabled,false);
 assert.equal((await restricted(req())).account_access,'restricted');
 const unlisted=make({values:{DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'[]',DF_PUBLIC_ACCOUNTS_ENABLED:'true'}});
 await assert.rejects(unlisted(req()),/PUBLIC_ENABLEMENT_HELD/);
 const released=make({values:{DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'[]',DF_PUBLIC_ACCOUNTS_ENABLED:'true'},publicAccessVerified:true});
 assert.equal((await released(req())).public_enabled,true);
});

test('two independently verified accounts produce stable isolated owners, never authority from email',async()=>{
 const a=await make({user:userA})(req()),b=await make({user:userB})(req());
 assert.equal(a.schema,ACCOUNT_IDENTITY_SCHEMA);assert.notEqual(a.owner,b.owner);
 assert.match(a.owner,/^account_[a-f0-9]{64}$/);assert.equal(a.owner,accountOwner(issuer,userA.id));
 assert.notEqual(a.owner,'bd-research-owner');assert.equal(a.admin,false);assert.equal(a.paid_entitlement,0);
 const changedEmail=await make({user:{...userA,email:userB.email}})(req());assert.equal(changedEmail.owner,a.owner);
 assert.notEqual(accountOwner('https://other.example/.netlify/identity',userA.id),a.owner);
 assert.ok(!JSON.stringify(a).includes(userA.email));
});

test('forged body, editable metadata and administrator-looking Identity fields cannot elevate',async()=>{
 const principal=await make({user:{...userA,roles:['admin'],appMetadata:{roles:['admin'],plan:'premium'},userMetadata:{email_verified:true,owner:'bd-research-owner'}}})(req(undefined,{owner:'bd-research-owner',email_verified:true,plan:'premium',admin:true,subject:userB.id}));
 assert.equal(principal.owner,accountOwner(issuer,userA.id));assert.equal(principal.subject,userA.id);
 assert.equal(principal.admin,false);assert.equal(principal.paid_entitlement,0);
 assert.equal(principal.legacy_binding_applied,false);assert.ok(Object.isFrozen(principal));
});

test('unverified email, JWT-only fallback and autoconfirm do not authorize an account exchange',async()=>{
 for(const user of [null,{...userA,confirmedAt:undefined},{...userA,email:undefined},{...userA,email:'a@b@example.test'},{...userA,confirmedAt:'1'},{...userA,confirmedAt:'future'},{...userA,confirmedAt:'2026-10-16T01:00:00.000Z'},{...userA,confirmedAt:undefined,userMetadata:{confirmedAt:'2026-10-14T12:00:00.000Z',email_verified:true}}]){
  await assert.rejects(make({user})(req()),error=>[401,403].includes(error.status)&&['ACCOUNT_UNAUTHORIZED','ACCOUNT_EMAIL_UNVERIFIED'].includes(error.code));
 }
 await assert.rejects(make({getSettings:async()=>({autoconfirm:true})})(req()),/ACCOUNT_EMAIL_CONFIRMATION_REQUIRED/);
 await assert.rejects(make({getSettings:async()=>({})})(req()),/ACCOUNT_EMAIL_CONFIRMATION_REQUIRED/);
});

test('issuer and same-origin cookie boundary are checked; operator tokens are never inspected',async()=>{
 const config={url:issuer};Object.defineProperty(config,'token',{get(){throw Error('must not inspect secret');}});
 await make({getIdentityConfig:()=>config})(req());
 await assert.rejects(make()(req('https://bd-chess.github.io')),/ACCOUNT_EXCHANGE_ORIGIN_INVALID/);
 await assert.rejects(make()(new Request('https://www.mdlxdcc.org/api/df/auth/account',{method:'POST'})),/ACCOUNT_EXCHANGE_ORIGIN_INVALID/);
 await assert.rejects(make({getIdentityConfig:()=>({url:'https://attacker.example/.netlify/identity'})})(req()),/IDENTITY_ISSUER_MISMATCH/);
 await assert.rejects(make({getIdentityConfig:()=>null})(req()),/IDENTITY_CONFIGURATION_UNVERIFIED/);
});

test('legacy BD alias requires an explicit verified issuer/subject binding with durable receipt',async()=>{
 const binding={issuer,subject:userA.id,verified:true,verified_at:'2026-10-14T12:00:00.000Z',verification_receipt:'BD_ACCOUNT_BINDING_REVIEW_R1'};
 const values={DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'[]',DF_BD_ACCOUNT_BINDING_JSON:JSON.stringify(binding)};
 const a=await make({values})(req());assert.equal(a.owner,'bd-research-owner');assert.equal(a.legacy_binding_applied,true);assert.equal(a.admin,false);
 await assert.rejects(make({values,user:userB})(req()),/PUBLIC_ENABLEMENT_HELD/);
 for(const patch of [{verified:false},{verification_receipt:''},{subject:'guessed subject with spaces'},{issuer:'https://different.example/.netlify/identity'},{verified_at:'2026-10-16T00:00:00.000Z'}])await assert.rejects(make({values:{...values,DF_BD_ACCOUNT_BINDING_JSON:JSON.stringify({...binding,...patch})}})(req()),/BD_ACCOUNT_BINDING_INVALID/);
});

test('SDK failures and invalid configuration return sanitized held status',async()=>{
 const secret='never-emit-operator-token';
 const identity=createAccountIdentity({getUser:async()=>{throw Error(secret);},getIdentityConfig:()=>({url:issuer}),getSettings:async()=>({autoconfirm:false}),env:key=>({DF_ACCOUNT_IDENTITY_ENABLED:'true',DF_ACCOUNT_IDENTITY_ISSUER:issuer})[key],now:()=>now});
 await assert.rejects(identity(req()),error=>error.code==='ACCOUNT_IDENTITY_UNAVAILABLE'&&!error.message.includes(secret));
 const broken=make({values:{DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'broken '+secret}});
 assert.equal(broken.status().status,'ACCOUNT_ALLOWLIST_INVALID');assert.ok(!JSON.stringify(broken.status()).includes(secret));
});
