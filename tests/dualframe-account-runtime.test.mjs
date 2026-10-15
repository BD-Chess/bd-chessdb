import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeAccountIdentity,runtimeOperatorPolicies,parseOperatorAdminBindings} from '../functions/lib/dualframe/runtime.mjs';

test('disabled account mode never imports Identity or invokes its API functions',async()=>{
 let imports=0;
 const result=await runtimeAccountIdentity(()=>undefined,{loadIdentity:async()=>{imports++;throw Error('must remain dormant');}});
 assert.equal(result,null);assert.equal(imports,0);
});

test('enabled runtime wires the real SDK signatures but keeps public access held',async()=>{
 let imports=0,userReads=0,settingsReads=0;
 const values={DF_ACCOUNT_IDENTITY_ENABLED:'true',DF_ACCOUNT_IDENTITY_ISSUER:'https://www.mdlxdcc.org/.netlify/identity',DF_PUBLIC_ACCOUNTS_ENABLED:'true',DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'["runtime-account-01"]'};
 const callback=await runtimeAccountIdentity(key=>values[key],{loadIdentity:async()=>{imports++;return {
  getIdentityConfig:()=>({url:values.DF_ACCOUNT_IDENTITY_ISSUER}),
  getSettings:async()=>{settingsReads++;return {autoconfirm:false};},
  getUser:async()=>{userReads++;return {id:'runtime-account-01',email:'test@example.test',confirmedAt:'2026-10-14T12:00:00.000Z'};}
 };}});
 assert.equal(imports,1);assert.equal(userReads,0);assert.equal(settingsReads,0);
 assert.equal(callback.status().public_enabled,false);
 const req=new Request('https://www.mdlxdcc.org/api/df/auth/account',{method:'POST',headers:{origin:'https://www.mdlxdcc.org'}});
 const principal=await callback(req);
 assert.equal(principal.public_enabled,false);assert.equal(principal.account_access,'restricted');
 assert.equal(principal.admin,false);assert.equal(principal.paid_entitlement,0);
 assert.equal(userReads,1);assert.equal(settingsReads,1);
});

test('unavailable Identity is isolated to a sanitized held callback',async()=>{
 const callback=await runtimeAccountIdentity(()=> 'true',{loadIdentity:async()=>{throw Error('private dependency detail');}});
 assert.equal(callback.status().status,'IDENTITY_SDK_UNAVAILABLE');
 await assert.rejects(callback(),error=>error.status===503&&error.code==='IDENTITY_SDK_UNAVAILABLE'&&!error.message.includes('private'));
 const wrongVersion=await runtimeAccountIdentity(()=> 'true',{loadIdentity:async()=>({getUser:async()=>null})});
 assert.equal(wrongVersion.status().status,'IDENTITY_SDK_UNAVAILABLE');
});

const operatorNow=Date.parse('2026-10-15T16:00:00.000Z'),operatorIssuer='https://www.mdlxdcc.org/.netlify/identity';
const operatorBinding={issuer:operatorIssuer,subject:'verified-operator-01',verified:true,verified_at:'2026-10-14T16:00:00.000Z',verification_receipt:'BD_OPERATOR_REVIEW_R1'};
const operatorValues={DF_OPERATOR_POLICY_ENABLED:'true',DF_OPERATOR_DATABASE_URL:'postgresql://synthetic:private-password@db.example.test/dualframe',DF_OPERATOR_ADMIN_BINDINGS_JSON:JSON.stringify([operatorBinding])};

test('operator policy defaults perform no database import, pool creation or secret lookup',async()=>{
 const reads=[];let loads=0;
 const policies=await runtimeOperatorPolicies(key=>{reads.push(key);return undefined;},{loadPg:async()=>{loads++;throw Error('must remain dormant');}});
 assert.equal(loads,0);assert.deepEqual(reads,['DF_OPERATOR_POLICY_ENABLED']);
 assert.equal(policies.enhancementPolicy,null);assert.equal(policies.operatorPolicy,null);assert.equal(policies.configurationStatus.database_verified,false);
});

test('explicit configuration constructs a lazy pool but does not connect, query or initialize schema',async()=>{
 let constructions=0,queries=0,connections=0,errorListener=null;
 class Pool{constructor(config){constructions++;assert.equal(config.connectionString,operatorValues.DF_OPERATOR_DATABASE_URL);}on(name,listener){assert.equal(name,'error');errorListener=listener;}async query(){queries++;throw Error('no SQL during setup');}async connect(){connections++;throw Error('no connection during setup');}}
 const policies=await runtimeOperatorPolicies(key=>operatorValues[key],{loadPg:async()=>({Pool}),now:()=>operatorNow});
 assert.equal(constructions,1);assert.equal(queries,0);assert.equal(connections,0);assert.equal(typeof errorListener,'function');
 assert.equal(policies.configurationStatus.configured,true);assert.equal(policies.configurationStatus.database_verified,false);assert.equal(policies.configurationStatus.schema_verified,false);
 assert.match(policies.enhancementPolicy.configurationStatus.status,/UNVERIFIED/);
 const principal={owner:'account_operator_01',auth_method:'verified-account',issuer:operatorIssuer,subject:operatorBinding.subject};
 assert.equal((await policies.operatorPolicy.resolvePrincipal(principal)).admin,true);
 for(const patch of [{auth_method:'legacy-password'},{issuer:'https://other.example/.netlify/identity'},{subject:'guessed-operator-02'},{auth_method:undefined,email:'operator@example.test',admin:true}])assert.equal((await policies.operatorPolicy.resolvePrincipal({...principal,...patch})).admin,false);
 assert.equal(queries,0);assert.equal(connections,0);assert.ok(!JSON.stringify(policies.configurationStatus).includes('private-password'));
});

test('operator administration requires explicit verified stable bindings and a durable receipt',()=>{
 const [binding]=parseOperatorAdminBindings(JSON.stringify([operatorBinding]),{now:operatorNow});assert.equal(binding.subject,operatorBinding.subject);
 for(const patch of [{verified:false},{verification_receipt:''},{verified_at:'2026-10-16T00:00:00.000Z'},{subject:'operator@example.test'},{issuer:'http://www.mdlxdcc.org/.netlify/identity'},{admin:true}])assert.throws(()=>parseOperatorAdminBindings(JSON.stringify([{...operatorBinding,...patch}]),{now:operatorNow}),/OPERATOR_ADMIN_BINDINGS_INVALID/);
 assert.throws(()=>parseOperatorAdminBindings(undefined),/OPERATOR_ADMIN_BINDINGS_REQUIRED/);
});

test('missing or malformed operator configuration stays held without loading a driver',async()=>{
 let loads=0;const options={loadPg:async()=>{loads++;throw Error('private driver failure');},now:()=>operatorNow};
 for(const [patch,status] of [[{DF_OPERATOR_DATABASE_URL:undefined},'OPERATOR_DATABASE_NOT_CONFIGURED'],[{DF_OPERATOR_DATABASE_URL:'https://user:secret@db.example.test/database'},'OPERATOR_DATABASE_CONFIGURATION_INVALID'],[{DF_OPERATOR_ADMIN_BINDINGS_JSON:undefined},'OPERATOR_ADMIN_BINDINGS_REQUIRED'],[{DF_OPERATOR_ADMIN_BINDINGS_JSON:'["private-bad-config"]'},'OPERATOR_ADMIN_BINDINGS_INVALID']]){
  const result=await runtimeOperatorPolicies(key=>({...operatorValues,...patch})[key],options);assert.equal(result.configurationStatus.status,status);assert.equal(result.enhancementPolicy,null);assert.equal(result.operatorPolicy,null);
 }
 assert.equal(loads,0);
 const unavailable=await runtimeOperatorPolicies(key=>operatorValues[key],options);assert.equal(loads,1);assert.equal(unavailable.configurationStatus.status,'OPERATOR_DATABASE_DRIVER_UNAVAILABLE');assert.ok(!JSON.stringify(unavailable).includes('private driver failure'));
});
