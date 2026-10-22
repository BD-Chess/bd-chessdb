import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scryptSync } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { ipHash, demoCookie, readDemo, loginDemo, demoBudget, maximumCharge } from '../../functions/lib/omnicpq/runtime.mjs';
import { makeAuth } from '../../functions/omnicpq-auth.mjs';

process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'synthetic-test-session-'.repeat(4);
process.env.OMNICPQ_DEMO_EMAIL = 'synthetic@example.test';
const salt = Buffer.alloc(16, 17);
process.env.OMNICPQ_DEMO_PASSWORD_HASH = `scrypt-v1$${salt.toString('hex')}$${scryptSync('synthetic-password', salt, 32, { N:131072,r:8,p:1,maxmem:256*1024*1024 }).toString('hex')}`;
const context = { ip: '192.0.2.5' }, token = 'a'.repeat(64);
const demo = { id:'00000000-0000-4000-a000-000000000001',role:'demo',ipHash:ipHash(context), usage:{expires_at:new Date(Date.now()+86400000).toISOString()} };
const req = cookie => new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-auth',{headers:{cookie}});
test('signed demo is bound to the trusted context IP and expires',()=>{
  const cookie=demoCookie(demo).split(';')[0];
  assert.equal(readDemo(req(cookie),context).id,demo.id);
  assert.throws(()=>readDemo(req(cookie),{ip:'192.0.2.6'}),/DEMO_IP_CHANGED/);
  assert.equal(readDemo(req(cookie+'x'),context),null);
  assert.equal(readDemo(req(cookie),context,Date.now()+86410000),null);
  assert.throws(()=>ipHash({}),/DEMO_IP_UNAVAILABLE/);
  assert.equal(ipHash({ip:'::ffff:192.0.2.5'}),ipHash(context));
});
test('demo requires password AND invitation, without accepting client roles',async()=>{
  let calls=0; const rpc=async(action,data)=>{calls++;assert.equal(action,'claim');assert.match(data.token_hash,/^[a-f0-9]{64}$/);assert.equal(data.ip_hash,ipHash(context));return {id:demo.id,...demo.usage};};
  await assert.rejects(loginDemo('synthetic@example.test','wrong',token,context,{rpc}),/INVALID_LOGIN/);
  await assert.rejects(loginDemo('synthetic@example.test','synthetic-password','',context,{rpc}),/DEMO_INVITATION_REQUIRED/);
  assert.equal(calls,0);
  assert.equal((await loginDemo('synthetic@example.test','synthetic-password',token,context,{rpc})).role,'demo');
  assert.equal(calls,1);
});
test('reservation includes reasoning output, pictures and a persistent request ID',async()=>{
  const payload={model:'gpt-6-luna',service_tier:'default',max_output_tokens:6000,input:[{role:'user',content:[{type:'input_image',image_url:'data:image/png;base64,AA=='}]}]};
  assert.equal(maximumCharge(payload),1_050_000*275+6000*825);
  assert(maximumCharge(payload)<1e9);
  assert.throws(()=>maximumCharge({...payload,tools:[{type:'web_search'}]}),/UNPRICED_MODEL/);
  const events=[];const budget=demoBudget(demo,'gpt','gpt-6-luna',{requestId:demo.id,rpc:async(a,d)=>events.push({a,d})});
  const held=await budget.reserve(payload); await budget.settle(held,null);
  assert.equal(events[0].d.request_id,demo.id);assert.equal(events[1].d.amount,held.amount);assert.equal(events[1].d.unknown,true);
});
test('owner management operations reject demo and cross-origin requests',async()=>{
  let writes=0;const handler=makeAuth({auth:async()=>demo,create:async()=>{writes++;}});
  const request=origin=>new Request('https://www.mdlxdcc.org/.netlify/functions/omnicpq-auth',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({action:'create_demo',role:'owner'})});
  assert.equal((await handler(request('https://www.mdlxdcc.org'),context)).status,403);
  assert.equal((await handler(request('https://attacker.test'),context)).status,403);assert.equal(writes,0);
});
test('database: claim, IP, locks, dedupe, cap, unknown charge, revocation and RLS',async()=>{
  const db=await PGlite.create();
  try {
    await db.exec("create role anon;create role authenticated;create schema mdlxdcc_guide_private;create function mdlxdcc_guide_private.server_allowed() returns boolean language sql as 'select current_setting(''test.server_allowed'',true)=''yes''';grant usage on schema mdlxdcc_guide_private to anon,authenticated;set test.server_allowed='yes';");
    await db.exec(await readFile(new URL('../../scripts/omnicpq/runtime.sql',import.meta.url),'utf8'));
    const call=async(a,d={})=>(await db.query('select public.omnicpq_runtime($1,$2::jsonb) as r',[a,JSON.stringify(d)])).rows[0].r;
    await call('create',{id:demo.id,token_hash:'a'.repeat(64)});
    const claim=await call('claim',{token_hash:'a'.repeat(64),ip_hash:demo.ipHash});
    assert.equal(Date.parse(claim.expires_at)-Date.parse(claim.claimed_at),86400000);
    assert.equal((await call('claim',{token_hash:'a'.repeat(64),ip_hash:'b'.repeat(64)})).error,'DEMO_IP_CHANGED');
    assert.equal((await call('claim',{token_hash:'a'.repeat(64),ip_hash:demo.ipHash})).expires_at,claim.expires_at);
    const held='00000000-0000-4000-a000-000000000002',r='00000000-0000-4000-a000-000000000003';
    const data={id:held,demo_id:demo.id,ip_hash:demo.ipHash,request_id:r,amount:800000000};
    assert.equal((await call('reserve',data)).reserved,0.8);
    assert.equal((await call('reserve',data)).error,'DUPLICATE_REQUEST');
    assert.equal((await call('reserve',{...data,id:'00000000-0000-4000-a000-000000000004',request_id:'00000000-0000-4000-a000-000000000005'})).error,'REQUEST_IN_PROGRESS');
    assert.equal((await call('settle',{id:held,demo_id:demo.id,amount:800000000,unknown:true})).spent,0.8);
    assert.equal((await call('reserve',{...data,id:'00000000-0000-4000-a000-000000000004',request_id:'00000000-0000-4000-a000-000000000005',amount:200000001})).error,'DEMO_LIMIT');
    assert.equal((await call('settle',{id:held,demo_id:demo.id,amount:0})).spent,0.8);
    assert.equal((await call('list')).length,1);
    await call('revoke',{id:demo.id});assert.equal((await call('check',{id:demo.id,ip_hash:demo.ipHash})).error,'DEMO_REVOKED');
    const expiredId='00000000-0000-4000-a000-000000000006';
    await call('create',{id:expiredId,token_hash:'b'.repeat(64)});
    await call('claim',{token_hash:'b'.repeat(64),ip_hash:demo.ipHash});
    await db.exec("update omnicpq_private.demo_grants set claimed_at=claimed_at-interval '25 hours',expires_at=expires_at-interval '25 hours' where id='"+expiredId+"'");
    assert.equal((await call('check',{id:expiredId,ip_hash:demo.ipHash})).error,'DEMO_EXPIRED');
    assert.equal((await call('storage_status')).parts,0);
    const tables=await db.query("select relname,relrowsecurity from pg_class where relnamespace='omnicpq_private'::regnamespace and relkind='r'");
    assert(tables.rows.every(r=>r.relrowsecurity));
    await db.exec("set test.server_allowed='no';set role anon;");
    assert.equal((await db.query('select * from omnicpq_private.demo_grants')).rows.length,0);
    await assert.rejects(call('knowledge'),/Server authentication required/);
  } finally {await db.close();}
});
