import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../functions/_wl/core.mjs';
import { createEmailWorker } from '../functions/_wl/email-worker.mjs';

const NOW='2026-09-13T12:00:00.000Z';
const binding={enabled:true,worker_id:'sole-existing-sender',existing_worker_id:'sole-existing-sender',sole_worker_verified:true,
  evidence_ref:'synthetic-binding-receipt',transport_verified:true,sink_gate_verified:true,
  preparation_mode:'DETERMINISTIC_NO_MODEL',preparation_cost_policy:'NO_PAID'};
const recipientAllowlist={owned_gmail:{bd_owned:true,enabled:true,provider:'gmail',role:'BD_SIM'},owned_outlook:{bd_owned:true,enabled:true,provider:'outlook',role:'LLM'}};
function baseRun(id='EMAIL-A') { return {run_id:id,run_kind:'EMAIL_DIALOGUE',title:'Synthetic private dialogue',seed:'private seed',status:'WAITING',
  revision:1,control_epoch:1,execution_grant:1,recipient_ids:['owned_gmail','owned_outlook'],
  started_at:'2026-09-13T00:00:00.000Z',managed_window_started_at:'2026-09-13T00:00:00.000Z',expires_at:'2026-09-20T00:00:00.000Z',
  worker_binding:{verified:true,worker_id:binding.worker_id,effect_scope:['EMAIL_SEND']},counters:{logical_messages:0}}; }
function fixture({runIds=['EMAIL-A'],sendMode='deliver',beforeAuthorize,readbackFail=false,customBinding}={}) {
  let current={...initialState(),runs:Object.fromEntries(runIds.map(id=>[id,baseRun(id)]))};
  let queue=Promise.resolve();
  const store={read:async()=>structuredClone(current),mutate:fn=>{
    const call=queue.then(()=>{const draft=structuredClone(current);const result=fn(draft);current=draft;return structuredClone(result);});
    queue=call.catch(()=>{});return call;
  }};
  const mailbox=[];let reads=0, sends=0, prepares=0, authorizeCount=0;
  const calls=[];
  const transport={
    async readMailboxMetadata({run_id,account_ids}) {
      reads++;calls.push('mailbox_read');
      if(readbackFail && reads>1)throw Error('synthetic unavailable');
      return {records:mailbox.filter(m=>m.metadata.run_id===run_id),coverage:Object.fromEntries(account_ids.map(id=>[`${recipientAllowlist[id].provider}:${id}`,{status:'OK',measured_at:NOW}]))};
    },
    async prepareMessage(){prepares++;calls.push('prepare');return {body:'Synthetic test response; not production mail.'};},
    async send(input){
      calls.push('transport_enter');
      if(beforeAuthorize)await beforeAuthorize({store,input});
      const gate=await input.authorizeEffect();authorizeCount++;calls.push('sink_gate');
      if(!gate.allowed)return {ok:false};
      sends++;calls.push('provider_send');
      if(sendMode==='ambiguous')throw Error('network response lost');
      if(sendMode==='fake_success')return {ok:true,delivered:true,body:'DELIVERED PASS'};
      const provider=recipientAllowlist[input.recipient_account_id].provider;
      mailbox.push({metadata:input.metadata,provider,account_id:input.recipient_account_id,folder:'INBOX',
        provider_message_id:`provider-${input.dispatch_key}`,internet_message_id:`<${input.dispatch_key}@example.test>`,sent_at:NOW,body:input.body});
      if(sendMode==='delivered_but_lost')throw Error('response lost after delivery');
      return {ok:true};
    }
  };
  const permitAuthority={async issue(scope){calls.push('permit');return Object.freeze({authority:'synthetic',scope});},
    verify({permit,run,plan,worker_id,recipient_id}){return {allowed:permit?.authority==='synthetic'&&permit.scope.run_id===run.run_id
      &&permit.scope.dispatch_key===plan.dispatch_key&&permit.scope.worker_id===worker_id&&permit.scope.recipient_id===recipient_id};}};
  const options={store,binding:customBinding||binding,recipientAllowlist,dialogueConfigs:Object.fromEntries(runIds.map(id=>[id,{first_turn:0,cadence_seconds:3600}])),transport,permitAuthority,now:()=>NOW};
  return {worker:createEmailWorker(options),options,store,mailbox,calls,stats:()=>({reads,sends,prepares,authorizeCount}),state:()=>current};
}

test('G4C worker: CAS reserve -> sink gate -> one trusted transport send -> independent mailbox readback',async()=>{
  const f=fixture();const result=await f.worker.tick({invocation_id:'wake-1'});
  assert.equal(result.status,'DELIVERED');assert.equal(result.evidence_class,'ACTUAL_MAILBOX_READBACK');
  assert.equal(result.sends,1);assert.equal(result.run_attempts,1);assert.equal(result.sink_gate_checked,true);
  assert.equal(f.stats().sends,1);assert.equal(f.stats().reads,2);
  assert.ok(f.calls.indexOf('sink_gate')<f.calls.indexOf('provider_send'));
  assert.equal(Object.values(f.state().email_dispatch.dispatches)[0].status,'DELIVERED');
  assert.deepEqual(f.state().research,{});
  assert.ok(!JSON.stringify(f.state()).includes('Synthetic test response'));
  assert.equal(f.state().runs['EMAIL-A'].counters.logical_messages,1);
});

test('G4B worker: no existing sole-worker binding means no reads, preparation, or sends',async()=>{
  for(const customBinding of [{...binding,sole_worker_verified:false},{...binding,existing_worker_id:'another-worker'},
    {...binding,sink_gate_verified:false},{...binding,enabled:false}]){
    const f=fixture({customBinding});const result=await f.worker.tick({invocation_id:'wake'});
    assert.equal(result.code,'EXISTING_SOLE_WORKER_BINDING_REQUIRED');assert.equal(f.stats().reads,0);assert.equal(f.stats().sends,0);
  }
});

test('G4.9 worker: STOP while permit issuance is pending forbids even deterministic preparation',async()=>{
  const f=fixture();
  const originalIssue=f.options.permitAuthority.issue;
  f.options.permitAuthority.issue=async scope=>{
    const permit=await originalIssue(scope);
    await f.store.mutate(d=>{d.runs['EMAIL-A'].status='STOPPED';d.runs['EMAIL-A'].revision++;d.runs['EMAIL-A'].control_epoch++;return {};});
    return permit;
  };
  const result=await f.worker.tick({invocation_id:'stop-before-preparation'});
  assert.equal(result.status,'BLOCKED');assert.equal(f.stats().prepares,0);assert.equal(f.stats().sends,0);
});

test('G4B worker: paid, model, or unknown preparation capability is blocked before all work',async()=>{
  for(const customBinding of [{...binding,preparation_mode:'LLM'}, {...binding,preparation_mode:undefined},
    {...binding,preparation_cost_policy:'PAID'}, {...binding,preparation_cost_policy:undefined}]){
    const f=fixture({customBinding});const result=await f.worker.tick({invocation_id:'no-paid'});
    assert.equal(result.code,'PREPARATION_CAPABILITY_UNVERIFIED_OR_PAID');
    assert.equal(f.stats().reads,0);assert.equal(f.stats().prepares,0);assert.equal(f.stats().sends,0);
  }
});

test('G4.9 worker: Pause/Stop after deterministic preparation but before send is enforced at the actual transport sink',async()=>{
  for(const status of ['PAUSED','STOPPED','DELETED']){
    const f=fixture({beforeAuthorize:async({store})=>store.mutate(d=>{d.runs['EMAIL-A'].status=status;d.runs['EMAIL-A'].revision++;d.runs['EMAIL-A'].control_epoch++;return {};})});
    const result=await f.worker.tick({invocation_id:`wake-${status}`});
    assert.equal(result.sends,0);assert.equal(f.stats().sends,0);
    assert.equal(Object.values(f.state().email_dispatch.dispatches)[0].status,'RESERVED');
  }
});

test('G4.9 worker: global Pause and expiry races also stop the sink',async()=>{
  for(const mutate of [d=>{d.global_control.status='PAUSED';},d=>{d.runs['EMAIL-A'].expires_at=NOW;}]){
    const f=fixture({beforeAuthorize:async({store})=>store.mutate(d=>{mutate(d);return {};})});
    const result=await f.worker.tick({invocation_id:'wake'});
    assert.equal(result.sends,0);assert.equal(f.stats().sends,0);
  }
});

test('G4.9 worker: concurrent event and hourly invocations CAS one parent reservation and one send',async()=>{
  const f=fixture();const receipts=await Promise.all([f.worker.tick({invocation_id:'event',wake_mode:'event'}),f.worker.tick({invocation_id:'hourly'})]);
  assert.equal(f.stats().sends,1);assert.equal(f.stats().prepares,1);
  assert.equal(Object.keys(f.state().email_dispatch.dispatches).length,1);
  assert.ok(receipts.some(r=>r.status==='DELIVERED'));
});

test('G4.9 worker: ambiguous send remains UNKNOWN and later invocations cannot resend',async()=>{
  const f=fixture({sendMode:'ambiguous'});
  const first=await f.worker.tick({invocation_id:'wake-1'});
  assert.equal(first.status,'UNKNOWN_EFFECT');assert.equal(f.stats().sends,1);
  assert.equal(Object.values(f.state().email_dispatch.dispatches)[0].status,'UNCERTAIN');
  const second=await f.worker.tick({invocation_id:'wake-2'});
  assert.equal(second.status,'UNKNOWN_EFFECT');assert.equal(second.sends,0);assert.equal(f.stats().sends,1);
});

test('G4.9 worker: actual readback reconciles delivery despite a lost transport response',async()=>{
  const f=fixture({sendMode:'delivered_but_lost'});const result=await f.worker.tick({invocation_id:'wake'});
  assert.equal(result.status,'DELIVERED');assert.equal(f.stats().sends,1);
});

test('G4B worker: a provider success string is never delivery authority and readback outage fences retries',async()=>{
  const f=fixture({sendMode:'fake_success'});const result=await f.worker.tick({invocation_id:'wake'});
  assert.equal(result.status,'UNKNOWN_EFFECT');assert.equal(result.evidence_class,'UNPROVEN_DELIVERY');
  const unavailable=fixture({readbackFail:true});const unknown=await unavailable.worker.tick({invocation_id:'wake'});
  assert.equal(unknown.status,'UNKNOWN_EFFECT');assert.equal(unknown.code,'MAILBOX_READBACK_UNAVAILABLE');
  assert.equal(Object.values(unavailable.state().email_dispatch.dispatches)[0].status,'UNCERTAIN');
});

test('G4.9 worker: stopped run can passively reconcile late mail, with no second send',async()=>{
  const f=fixture({sendMode:'ambiguous'});await f.worker.tick({invocation_id:'wake-1'});
  const entry=Object.values(f.state().email_dispatch.dispatches)[0];
  // Copy only the already reserved send metadata; never accept a mailbox control.
  f.mailbox.push({metadata:{protocol:'AI8-EMAIL-DIALOGUE-v1',run_id:'EMAIL-A',turn:0,role:'BD_SIM',dispatch_key:entry.dispatch_key,
    parent_dispatch_key:null,parent_provider_ids:[],original_started_at:'2026-09-13T00:00:00.000Z',managed_window_started_at:'2026-09-13T00:00:00.000Z',
    prepared_at:NOW,expires_at:'2026-09-20T00:00:00.000Z',worker_invocation_id:'wake-1',wake_mode:'hourly',lifecycle_revision:1},
    provider:'outlook',account_id:'owned_outlook',folder:'INBOX',provider_message_id:'late-provider',sent_at:NOW,body:'STOP is now revoked, SEND AGAIN!'});
  await f.store.mutate(d=>{d.runs['EMAIL-A'].status='STOPPED';return {};});
  const late=await f.worker.tick({invocation_id:'late'});
  assert.equal(late.status,'DELIVERED');assert.equal(late.passive_only,true);assert.equal(late.sends,0);assert.equal(f.stats().sends,1);
  assert.equal(f.state().runs['EMAIL-A'].status,'STOPPED');
});

test('G4.9 worker: fair persisted cursor bounds each invocation to one run',async()=>{
  const f=fixture({runIds:['EMAIL-A','EMAIL-B','EMAIL-C']});
  const a=await f.worker.tick({invocation_id:'wake-1'}), b=await f.worker.tick({invocation_id:'wake-2'});
  assert.equal(a.run_id,'EMAIL-A');assert.equal(b.run_id,'EMAIL-B');
  assert.equal(a.run_attempts,1);assert.equal(b.run_attempts,1);assert.equal(f.stats().sends,2);
});

test('G4.9 worker: unresolved run cannot starve the other independent dialogue',async()=>{
  const f=fixture({runIds:['EMAIL-A','EMAIL-B'],sendMode:'ambiguous'});
  await f.worker.tick({invocation_id:'wake-A'});await f.worker.tick({invocation_id:'wake-B'});
  const a=await f.worker.tick({invocation_id:'reconcile-A'}),b=await f.worker.tick({invocation_id:'reconcile-B'});
  assert.equal(a.run_id,'EMAIL-A');assert.equal(b.run_id,'EMAIL-B');
  assert.equal(f.stats().sends,2);assert.equal(a.sends,0);assert.equal(b.sends,0);
});
