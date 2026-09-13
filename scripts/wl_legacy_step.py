"""Deterministic Legacy preparation/readback. No networking or remote writes.

Caller verifies release pins before running. Secrets enter getpass, never argv.
Run from a materialized exact GitHub snapshot: python scripts/wl_legacy_step.py
After private unlock, send one JSON command per stdin line. Inspect before prepare.
The prepared release contains only ciphertext and its exact Git blob checksums.
"""
from __future__ import annotations
import copy
import getpass
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import wl_codec as c
import wl_rules_guard as g

ROOT = Path(__file__).resolve().parents[1]
WL = ROOT / 'public/WL'

def stamp(now=None):
    return (now or datetime.now(timezone.utc)).isoformat().replace('+00:00','Z')

def blob_sha(raw):
    return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()

def history(state, key, wl=WL):
    c.validate_state(state)
    if state.get('recovery'):
        r=state['recovery']
        raw=(wl/r['path']).read_bytes()
        g.require(c.sha256(raw)==c.RECOVERY_SHA256 and json.loads(raw)==r,'recovery manifest mismatch')
        g.require(c.sha256((wl/r['rejected_event_path']).read_bytes())==r['rejected_event_sha256'],'rejected attempt changed')
    events=[]
    for ref in state['entries']:
        e=c.open_box(json.loads((wl/ref['path']).read_text()),key,'WL:event:'+ref['event_id'])
        c.validate_event(e,events[-1] if events else None)
        g.require(c.sha256(c.canonical(e))==ref['plain_sha256'],'indexed event hash mismatch')
        g.validate_receipt(e)
        events.append(e)
    return events

def prepare(old, parent, proposal, evidence, control, now):
    """Construct the exact permitted state transition; never accept prebuilt envelopes."""
    g.validate_policy(old,now);g.validate_control(control,now)
    seq=c.next_seq(old);eid=f'e{seq:06d}';created=stamp(now)
    g.require(set(proposal)<=set(['title','phase','body','retained','sources','next_question',
        'input_event_ids','evidence_class','open_alternatives','next_author_id','rules_read_at_utc',
        'applied_rule_ids','rules_application']),'unknown proposal field')
    g.require(all(k in proposal for k in ['title','phase','body','retained','sources','next_question',
        'input_event_ids','evidence_class','open_alternatives','next_author_id',
        'rules_read_at_utc','applied_rule_ids','rules_application']),'incomplete proposal')
    author=next(m for m in old['members'] if m['id']==old['next_author_id'])
    event={k:copy.deepcopy(proposal[k]) for k in ['title','phase','body','retained','sources',
        'next_question','input_event_ids','evidence_class']}
    event.update(schema='wl.event.v2',run_id=g.RUN,seq=seq,event_id=eid,author_id=author['id'],
        author_name=author['name'],created_at=created,slot_utc=g.slot_utc(now),
        parent_event_id=parent['event_id'],parent_sha256=c.sha256(c.canonical(parent)),
        execution='event_driven_model_step' if evidence['kind']=='gmail' else 'scheduled_model_step',
        wake_origin={k:evidence[k] for k in ['kind','automation_id','invocation_id']},
        model_provenance={'provider':'OpenAI','mode':'same_model_role','independence':'NOT_CLAIMED'})
    if evidence['kind']=='gmail':event['wake_origin']['message_id']=evidence['message_id']
    if seq==10 and parent['seq']==8:event['recovery_sha256']=c.RECOVERY_SHA256
    event['rules_receipt']={'schema':'wl.rules.receipt.v1','id':g.RULES_ID,'version':g.VERSION,
        'sha256':g.DOCUMENT_SHA256,'scope':g.SCOPE,'read_at_utc':proposal['rules_read_at_utc'],
        'assurance':'BYTES_VERIFIED_APPLICATION_ATTESTED','applied_rule_ids':proposal['applied_rule_ids'],
        'application':proposal['rules_application']}
    new=copy.deepcopy(old);new['revision']+=1;new['updated_at']=created
    for name in ['phase','retained','open_alternatives','next_question','next_author_id']:
        new[name]=copy.deepcopy(proposal[name])
    next(m for m in new['members'] if m['id']==author['id'])['last_event_id']=eid
    new['entries'].append({'seq':seq,'event_id':eid,'path':f'data/entries/{eid}.enc.json',
        'plain_sha256':c.sha256(c.canonical(event))})
    ex=new['execution'];ex['auto_steps']+=1;ex['last_slot_utc']=g.slot_utc(now);ex['last_automatic_at']=created
    if evidence['kind']=='gmail':ex['gmail_seen_ids'].append(evidence['message_id'])
    paths=[f'public/WL/data/entries/{eid}.enc.json','public/WL/state.enc.json']
    c.validate_event(event,parent);c.validate_state(new)
    g.validate_transition(old,event,new,paths,control,now,evidence)
    return event,new,paths

def release_bytes(event,new,key,vault_id,source_sha):
    objects=[(f"public/WL/data/entries/{event['event_id']}.enc.json",event,'WL:event:'+event['event_id']),
        ('public/WL/state.enc.json',new,'WL:state:'+vault_id)]
    files={};tree=[]
    for path,obj,aad in objects:
        box=c.seal(obj,key,aad);g.require(c.open_box(box,key,aad)==obj,'local crypto roundtrip failed')
        raw=c.canonical(box);files[path]={'sha256':c.sha256(raw),'git_blob_sha1':blob_sha(raw),'bytes':len(raw)}
        tree.append({'path':path,'mode':'100644','type':'blob','content':raw.decode()})
    return {'schema':'wl.legacy.prepared-step.v1','source_sha':source_sha,'event_id':event['event_id'],
        'slot_utc':event['slot_utc'],'parent_event_id':event['parent_event_id'],
        'files':files,'tree_elements':tree}

def main():
    vault=json.loads((WL/'vault.json').read_text())
    print('Private auth mode (machine/human):',flush=True)
    mode=sys.stdin.readline().strip()
    secret=getpass.getpass('Private Legacy access: ')
    if mode=='machine':
        m=c.open_box(json.loads((WL/'gmail-writer.enc.json').read_text()),c.unb64(secret),'WL:legacy:gmail-writer:v1')
        g.require(m['schema']=='wl.legacy.machine-access.v1' and m['run_id']==g.RUN
            and m['purpose']=='LEGACY_RESEARCH_ONLY' and datetime.now(timezone.utc)<g.utc(m['expires_at_utc']),
            'invalid or expired machine access')
        key=c.unb64(m['master_key_b64'])
    elif mode=='human':key=c.unlock(secret,vault)
    else:raise ValueError('unsupported private auth mode')
    del secret
    document=g.load_rules((WL/'rules.manifest.json').read_bytes(),(WL/'rules/v1.0.1.enc.json').read_bytes(),key)
    old=c.open_box(json.loads((WL/'state.enc.json').read_text()),key,'WL:state:'+vault['vault_id'])
    g.validate_policy(old,datetime.now(timezone.utc));events=history(old,key)
    if mode=='machine':
        g.require(m['task_id']==old['wake_policy']['gmail_task_id']
            and m['expires_at_utc']==old['wake_policy']['expires_at_utc'],'machine scope mismatch')
    inspected=False;prepared=None;prepared_plain=None
    print(json.dumps({'status':'ACCESS_RULES_HISTORY_PASS','frontier':events[-1]['event_id'],
        'next_seq':c.next_seq(old),'state_revision':old['revision']}),flush=True)
    for line in sys.stdin:
        try:
            q=json.loads(line);op=q.get('op')
            if op=='finish':break
            if op=='inspect':
                inspected=True
                print(json.dumps({'rules_markdown':document['markdown'],'state':old,'last_events':events[-6:],
                    'read_at_utc':stamp()},ensure_ascii=False),flush=True)
            elif op=='prepare':
                g.require(inspected,'inspect full mandate/history before research')
                g.require(not prepared,'one candidate per private process')
                proposal=json.loads(Path(q['proposal_file']).read_text())
                evidence=json.loads(Path(q['evidence_file']).read_text())
                control=json.loads(Path(q['control_file']).read_text())
                if mode=='machine':g.require(evidence['kind']=='gmail','machine task scope mismatch')
                event,new,paths=prepare(old,events[-1],proposal,evidence,control,datetime.now(timezone.utc))
                g.require(not (ROOT/paths[0]).exists(),'event path already occupied')
                prepared=release_bytes(event,new,key,vault['vault_id'],q['source_sha']);prepared_plain=(event,new)
                out=Path(q['output_file']);out.write_bytes(c.canonical(prepared))
                print(json.dumps({'status':'PREPARE_PASS','event_id':event['event_id'],'slot_utc':event['slot_utc'],
                    'output_file':str(out),'release_sha256':c.sha256(out.read_bytes()),'files':prepared['files']}),flush=True)
            elif op=='readback':
                g.require(prepared is not None,'no prepared step')
                remote=Path(q['readback_root'])
                for item in prepared['tree_elements']:
                    path=item['path'];raw=(remote/path).read_bytes()
                    g.require(blob_sha(raw)==prepared['files'][path]['git_blob_sha1']
                        and raw==item['content'].encode(),'exact readback mismatch')
                    obj=prepared_plain[1] if path.endswith('state.enc.json') else prepared_plain[0]
                    aad='WL:state:'+vault['vault_id'] if path.endswith('state.enc.json') else 'WL:event:'+obj['event_id']
                    g.require(c.open_box(json.loads(raw),key,aad)==obj,'readback crypto mismatch')
                print(json.dumps({'status':'EXACT_READBACK_PASS','event_id':prepared['event_id'],
                    'slot_utc':prepared['slot_utc'],'commit_sha':q['commit_sha']}),flush=True)
            else:raise ValueError('unknown operation')
        except Exception as e:
            print(json.dumps({'status':'BLOCKED','reason_code':type(e).__name__,'reason':str(e)}),flush=True)

if __name__=='__main__':main()
