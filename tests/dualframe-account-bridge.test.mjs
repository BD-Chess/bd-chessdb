import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ACCOUNT_ORIGIN,parseAccountBridge,validateAccountSession,exchangeAccountSession,sendAccountSession,authenticateAccount} from '../public/Nara/dualframe-lab/account-login.mjs';
const nonce='a'.repeat(48),openerOrigin='https://bd-chess.github.io';
const url=()=>ACCOUNT_ORIGIN+'/Nara/dualframe-lab/account-login.html?'+new URLSearchParams({opener_origin:openerOrigin,nonce,lang:'sl'});
const session=()=>({token:'synthetic_bearer_token_'+'.a'.repeat(20),expires_at:new Date(Date.now()+3600000).toISOString(),owner:'account_synthetic_owner',auth_method:'verified-account',admin:false,paid_entitlement:0,account_access:'restricted'});

test('login bridge requires canonical HTTPS origin, allowlisted opener and a unique strong nonce without token-bearing URLs',()=>{
 assert.deepEqual(parseAccountBridge(url()),{openerOrigin,nonce,language:'sl'});
 for(const bad of [url().replace(ACCOUNT_ORIGIN,'https://mdlxdcc.org'),url().replace(ACCOUNT_ORIGIN,'https://user:password@www.mdlxdcc.org'),url().replace('account-login.html','index.html'),url()+'&token=secret',url()+'#access_token=secret',url()+'&nonce='+nonce,url().replace(nonce,'weak'),url().replace(encodeURIComponent(openerOrigin),encodeURIComponent('https://bd-chess.github.io.evil.example')),url().replace(encodeURIComponent(openerOrigin),encodeURIComponent('http://bd-chess.github.io'))])assert.throws(()=>parseAccountBridge(bad),/ACCOUNT_BRIDGE/);
});

test('cookie exchange uses same canonical origin without legacy bearer or client-selected ownership',async()=>{
 let seen;const expected=session();const result=await exchangeAccountSession({fetcher:async(url,options)=>{seen={url,options};return Response.json(expected);}});
 assert.deepEqual(result,expected);assert.equal(seen.url,ACCOUNT_ORIGIN+'/api/df/auth/account');assert.equal(seen.options.method,'POST');assert.equal(seen.options.credentials,'include');assert.equal(seen.options.cache,'no-store');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.body,'{}');assert.deepEqual(seen.options.headers,{'content-type':'application/json'});
 await assert.rejects(exchangeAccountSession({fetcher:async()=>Response.json({error:'PUBLIC_ENABLEMENT_HELD'},{status:503})}),/PUBLIC_ENABLEMENT_HELD/);
});

test('only server-issued verified-account sessions cross the exact opener boundary with the nonce',()=>{
 const bridge=parseAccountBridge(url()),value=session(),messages=[];sendAccountSession({postMessage:(...args)=>messages.push(args)},bridge,value);
 assert.deepEqual(messages,[[{type:'dualframe-account-session',nonce,session:value},openerOrigin]]);
 for(const invalid of [{...value,auth_method:'legacy-password'},{...value,owner:'bad/owner'},{...value,admin:true},{...value,paid_entitlement:100},{...value,expires_at:'2020-01-01T00:00:00Z'},{...value,token:'https://example.com/token'}])assert.throws(()=>validateAccountSession(invalid),/ACCOUNT_SESSION_INVALID/);
 assert.throws(()=>sendAccountSession({closed:true,postMessage(){}},bridge,value),/ACCOUNT_OPENER_CLOSED/);
 assert.throws(()=>sendAccountSession({postMessage(){}},{...bridge,openerOrigin:'*'},value),/ACCOUNT_BRIDGE_INVALID/);
});

test('email/password sign-in uses the official SDK once and does not expose credential errors or invent owner entitlement',async()=>{
 const log=[],value=session();const result=await authenticateAccount({email:' user@example.org ',password:'synthetic-password',sdk:{login:async(...args)=>{log.push(args);return {id:'editable-client-id',roles:['admin']};}},fetcher:async()=>Response.json(value)});
 assert.deepEqual(result,value);assert.deepEqual(log,[['user@example.org','synthetic-password']]);
 await assert.rejects(authenticateAccount({email:'user@example.org',password:'secret',sdk:{login:async()=>{throw Error('provider echoed secret');}}}),error=>error.message==='ACCOUNT_SIGN_IN_FAILED');
 await assert.rejects(authenticateAccount({email:'invalid',password:'secret',sdk:{login(){throw Error('MUST_NOT_CALL');}}}),/ACCOUNT_CREDENTIALS_REQUIRED/);
});

test('vendored official client is hash-bound and resolves its browser dependency without runtime CDN imports',async()=>{
 const base=new URL('../public/Nara/dualframe-lab/vendor/',import.meta.url),metadata=JSON.parse(await readFile(new URL('netlify-identity-2.0.0.provenance.json',base),'utf8')),bundle=await readFile(new URL('netlify-identity-2.0.0.mjs',base));
 assert.equal(metadata.package,'@netlify/identity');assert.equal(metadata.version,'2.0.0');assert.equal(metadata.dependency,'1.0.1');assert.equal(createHash('sha256').update(bundle).digest('hex'),metadata.bundle_sha256);
 assert.equal(/(?:from|import)\s*['"](?:gotrue-js|https?:)/.test(bundle.toString()),false);
 const sdk=await import(new URL('netlify-identity-2.0.0.mjs',base));for(const name of ['login','getUser','getSettings','handleAuthCallback'])assert.equal(typeof sdk[name],'function');
});
