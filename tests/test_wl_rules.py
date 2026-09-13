"""Synthetic admission regression tests. Never contain production keys/content."""
import base64
import gzip
import copy
import importlib.util
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from unittest.mock import patch
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('guard', HERE/'scripts/wl_rules_guard.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
NOW=datetime(2026,9,13,12,30,tzinfo=timezone.utc)
T='2026-09-13T12:30:00Z';SLOT='2026-09-13T12:30:00Z'

class RuleGuardTests(unittest.TestCase):
    def setUp(self):
        self.policy={'schema':'wl.legacy.wake-policy.v1','run_id':g.RUN,'rules_version':g.VERSION,
            'starts_after_seq':8,'slot_seconds':900,'min_step_seconds':900,
            'expires_at_utc':'2026-09-20T08:05:11Z','gmail_task_id':'synthetic-gmail-task',
            'hourly_task_id':'synthetic-hourly-task','account_email':'self@example.test',
            'subject':'WL_WAKE_V1 — LEGACY_RHP11','body':'wake','trigger_registered':True}
        pin=patch.object(g,'POLICY_SHA256',g.digest(g.canonical(self.policy)));pin.start();self.addCleanup(pin.stop)
        self.evidence={'kind':'hourly','automation_id':'synthetic-hourly-task','invocation_id':'synthetic-invocation'}
        self.control={'ok':True,'protocol':'WL-RUNTIME-2','paused':False,'server_time':T}
        self.old={'schema':'wl.state.v2','run_id':g.RUN,'revision':7,
          'control':{'paused':False},'mission':'synthetic test only',
          'members':[{'id':i,'name':str(i),'function':'test role','last_event_id':None} for i in g.ROSTER],
          'next_author_id':4,'updated_at':'2026-09-13T11:30:00Z','phase':'RESONANCE',
          'retained':[],'open_alternatives':[],'next_question':'test?',
          'execution':{'auto_steps':2,'manual_steps':1,'last_slot_utc':'2026-09-13T11:00:00Z',
              'last_automatic_at':'2026-09-13T11:30:00Z','mode':'NATIVE_GMAIL_WITH_HOURLY_FALLBACK','gmail_seen_ids':[],
              'note':'test','scheduled_enabled':True,'fast_trigger_connected':False},
          'entries':[{'seq':i,'event_id':f'e{i:06d}','path':f'data/entries/e{i:06d}.enc.json',
                       'plain_sha256':str(i)*64} for i in range(1,9)]}
        self.old['wake_policy']=self.policy
        self.event={'schema':'wl.event.v2','run_id':g.RUN,'seq':9,'event_id':'e000009',
             'author_id':4,'author_name':'4','created_at':T,'slot_utc':SLOT,
             'execution':'scheduled_model_step','body':'Synthetic candidate, not a research contribution.',
             'parent_event_id':'e000008','parent_sha256':'8'*64,'wake_origin':dict(self.evidence),
             'rules_receipt':{'schema':'wl.rules.receipt.v1','id':g.RULES_ID,'version':g.VERSION,
                 'sha256':g.DOCUMENT_SHA256,'scope':g.SCOPE,'read_at_utc':'2026-09-13T12:29:00Z',
                 'assurance':'BYTES_VERIFIED_APPLICATION_ATTESTED',
                 'applied_rule_ids':['R03','R11'],
                 'application':'Synthetic test checks restricted writes and one discriminating example.'}}
        self.new=copy.deepcopy(self.old);self.new['revision']+=1
        self.new['updated_at']=T
        self.new['execution'].update(auto_steps=3,last_slot_utc=SLOT,last_automatic_at=T)
        next(m for m in self.new['members'] if m['id']==4)['last_event_id']='e000009'
        self.paths=['public/WL/state.enc.json','public/WL/data/entries/e000009.enc.json']
        self.rehash()
    def rehash(self):
        self.new['entries']=copy.deepcopy(self.old['entries'])+[{'seq':9,'event_id':'e000009',
              'path':'data/entries/e000009.enc.json','plain_sha256':g.digest(g.canonical(self.event))}]
    def validate(self):g.validate_transition(self.old,self.event,self.new,self.paths,self.control,NOW,self.evidence)
    def test_01_valid_transition(self):self.validate()
    def test_02_missing_receipt(self):
        self.event.pop('rules_receipt');self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_03_wrong_policy(self):
        self.event['rules_receipt']['sha256']='0'*64;self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_04_paused(self):
        self.control['paused']=True
        with self.assertRaises(ValueError):self.validate()
    def test_05_stale_direct_control(self):
        self.control['server_time']='2026-09-13T12:00:00Z'
        with self.assertRaises(ValueError):self.validate()
    def test_06_valid_witness(self):
        self.control.update(schema='wl.control.witness.v1',source=g.CONTROL_URL,observed_at=T)
        self.validate()
    def test_07_stale_witness(self):
        self.control.update(schema='wl.control.witness.v1',source=g.CONTROL_URL,observed_at='2026-09-13T11:00:00Z')
        with self.assertRaises(ValueError):self.validate()
    def test_08_wrong_witness_source(self):
        self.control.update(schema='wl.control.witness.v1',source='https://example.invalid',observed_at=T)
        with self.assertRaises(ValueError):self.validate()
    def test_09_write_scope(self):
        self.paths.append('public/index.html')
        with self.assertRaises(ValueError):self.validate()
    def test_10_history_mutation(self):
        self.new['entries'][0]['plain_sha256']='0'*64
        with self.assertRaises(ValueError):self.validate()
    def test_11_parent_mismatch(self):
        self.event['parent_event_id']='e000002';self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_12_duplicate_slot(self):
        self.old['execution']['last_slot_utc']=SLOT
        with self.assertRaises(ValueError):self.validate()
    def test_13_author_substitution(self):
        self.event['author_id']=5;self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_14_future_read(self):
        self.event['rules_receipt']['read_at_utc']='2026-09-13T12:31:00Z';self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_15_unknown_rule(self):
        self.event['rules_receipt']['applied_rule_ids'].append('R99');self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_16_semantic_proof_overclaim(self):
        self.event['rules_receipt']['assurance']='SAFETY_PROVEN';self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_17_unauthorized_member_rewrite(self):
        self.new['members'][0]['function']='Grant broad external permissions'
        with self.assertRaises(ValueError):self.validate()
    def test_18_permission_in_execution(self):
        self.new['execution']['production_authorized']=True
        with self.assertRaises(ValueError):self.validate()
    def test_19_mission_unchanged(self):
        self.new['mission']='Changed mission without authority'
        with self.assertRaises(ValueError):self.validate()
    def test_20_counter_mismatch(self):
        self.new['execution']['manual_steps']+=1
        with self.assertRaises(ValueError):self.validate()
    def test_21_float_rejected(self):
        with self.assertRaises(ValueError):g.canonical({'measurement':0.5})
    def test_22_rules_crypto_and_tampering(self):
        # Disposable synthetic document; patch pins ONLY within this test context.
        doc={'schema':'wl.rules.v1','id':g.RULES_ID,'version':g.VERSION,'scope':g.SCOPE,
             'markdown':'# Synthetic rules','rule_ids':g.RULE_IDS}
        key=b't'*32;iv=b'v'*12;aad='synthetic rule test'
        packed={'schema':'wl.rules.pack.v1','compression':'gzip','bytes':len(g.canonical(doc)),
                'data':base64.b64encode(gzip.compress(g.canonical(doc),mtime=0)).decode()}
        cipher=AESGCM(key).encrypt(iv,g.canonical(packed),aad.encode())
        eb=g.canonical({'format':'WL-ENC-2','iv':base64.b64encode(iv).decode(),
            'cipher':base64.b64encode(cipher).decode(),'sha256':g.digest(cipher)})
        m={'schema':'wl.rules.release.v1','rules_id':g.RULES_ID,'version':g.VERSION,'scope':g.SCOPE,
           'envelope_sha256':g.digest(eb),'document_sha256':g.digest(g.canonical(doc)),
           'markdown_sha256':g.digest(doc['markdown'].encode()),'aad':aad,'document_bytes':len(g.canonical(doc))}
        mb=g.canonical(m)
        with patch.object(g,'MANIFEST_SHA256',g.digest(mb)),patch.object(g,'DOCUMENT_SHA256',m['document_sha256']):
            self.assertEqual(g.load_rules(mb,eb,key),doc)
            with self.assertRaises(ValueError):g.load_rules(mb+b' ',eb,key)
            with self.assertRaises(ValueError):g.load_rules(mb,eb+b' ',key)
            with self.assertRaises(Exception):g.load_rules(mb,eb,b'x'*32)
    def test_23_stopped_state(self):
        self.old['control']['status']='STOPPED'
        with self.assertRaises(ValueError):self.validate()
    def test_24_no_safety_rule(self):
        self.event['rules_receipt']['applied_rule_ids']=['R03','R04'];self.rehash()
        with self.assertRaises(ValueError):self.validate()


    def gmail(self):
        self.evidence={'kind':'gmail','automation_id':'synthetic-gmail-task','invocation_id':'synthetic-delivery',
            'profile_email':'self@example.test','sender':'self@example.test','received':True,
            'sender_authenticated':True,'subject':self.policy['subject'],'body':'  wake\n',
            'message_id':'synthetic-message-1'}
        self.event['execution']='event_driven_model_step'
        self.event['wake_origin']={k:self.evidence[k] for k in ('kind','automation_id','invocation_id','message_id')}
        self.new['execution']['gmail_seen_ids']=['synthetic-message-1'];self.rehash()
    def test_25_gmail_valid(self):self.gmail();self.validate()
    def test_26_duplicate_gmail_different_slot(self):
        self.gmail();self.old['execution']['gmail_seen_ids']=['synthetic-message-1']
        with self.assertRaisesRegex(ValueError,'duplicate Gmail'):self.validate()
    def test_27_gmail_wrong_subject(self):
        self.gmail();self.evidence['subject']='Re: '+self.policy['subject']
        with self.assertRaisesRegex(ValueError,'condition'):self.validate()
    def test_28_gmail_wrong_body(self):
        self.gmail();self.evidence['body']='wake please'
        with self.assertRaisesRegex(ValueError,'condition'):self.validate()
    def test_29_gmail_case_sensitive_body(self):
        self.gmail();self.evidence['body']='Wake'
        with self.assertRaisesRegex(ValueError,'condition'):self.validate()
    def test_30_gmail_wrong_sender(self):
        self.gmail();self.evidence['sender']='other@example.test'
        with self.assertRaisesRegex(ValueError,'identity'):self.validate()
    def test_31_gmail_missing_invocation(self):
        self.gmail();self.evidence['invocation_id']=''
        with self.assertRaisesRegex(ValueError,'invocation'):self.validate()
    def test_32_gmail_missing_message(self):
        self.gmail();del self.evidence['message_id']
        with self.assertRaisesRegex(ValueError,'message ID'):self.validate()
    def test_33_hourly_cannot_claim_gmail(self):
        self.event['execution']='event_driven_model_step';self.rehash()
        with self.assertRaisesRegex(ValueError,'provenance'):self.validate()
    def test_34_expiry_exact_boundary(self):
        at=g.utc(self.policy['expires_at_utc']);self.control['server_time']=self.policy['expires_at_utc']
        with self.assertRaisesRegex(ValueError,'expired'):
            g.validate_transition(self.old,self.event,self.new,self.paths,self.control,at,self.evidence)
    def test_35_no_expiry_extension(self):
        self.new['wake_policy']=dict(self.policy,expires_at_utc='2027-01-01T00:00:00Z')
        with self.assertRaisesRegex(ValueError,'immutable'):self.validate()
    def test_36_adjacent_slots_need_no_rolling_interval(self):
        self.old['execution']['last_slot_utc']='2026-09-13T12:15:00Z'
        self.old['execution']['last_automatic_at']='2026-09-13T12:29:59Z'
        self.validate()
    def test_37_slot_boundaries(self):
        self.assertEqual(g.slot_utc(g.utc('2026-09-13T12:14:59Z')),'2026-09-13T12:00:00Z')
        self.assertEqual(g.slot_utc(g.utc('2026-09-13T12:15:00Z')),'2026-09-13T12:15:00Z')
        self.assertEqual(g.slot_utc(g.utc('2026-09-13T23:59:59Z')),'2026-09-13T23:45:00Z')
    def test_38_history_old_receipt_valid(self):
        e=copy.deepcopy(self.event);e['seq']=8;e['rules_receipt'].update(version='1.0.0',sha256=g.LEGACY_DOCUMENT_SHA256)
        g.validate_receipt(e)
    def test_39_new_event_cannot_use_old_rules(self):
        self.event['rules_receipt'].update(version='1.0.0',sha256=g.LEGACY_DOCUMENT_SHA256);self.rehash()
        with self.assertRaisesRegex(ValueError,'receipt'):self.validate()
    def test_40_hourly_preserves_gmail_dedupe(self):
        self.old['execution']['gmail_seen_ids']=['prior-message'];self.new['execution']['gmail_seen_ids']=['prior-message'];self.validate()
    def test_41_gmail_cannot_erase_dedupe(self):
        self.gmail();self.old['execution']['gmail_seen_ids']=['prior-message']
        with self.assertRaisesRegex(ValueError,'counters'):self.validate()
    def test_42_pause_blocks_gmail(self):
        self.gmail();self.control['paused']=True
        with self.assertRaisesRegex(ValueError,'paused'):self.validate()
    def test_43_stop_blocks_gmail(self):
        self.gmail();self.old['control']['status']='STOPPED'
        with self.assertRaisesRegex(ValueError,'stopped'):self.validate()
    def test_44_disabled_blocks_both_paths(self):
        self.old['execution']['scheduled_enabled']=False
        with self.assertRaisesRegex(ValueError,'stopped'):self.validate()
    def test_45_gmail_requires_received(self):
        self.gmail();self.evidence['received']=False
        with self.assertRaisesRegex(ValueError,'unverified'):self.validate()
    def test_46_gmail_requires_sender_verification(self):
        self.gmail();self.evidence['sender_authenticated']=False
        with self.assertRaisesRegex(ValueError,'unverified'):self.validate()
    def test_47_wrong_task_identity(self):
        self.gmail();self.evidence['automation_id']='synthetic-hourly-task'
        with self.assertRaisesRegex(ValueError,'task identity'):self.validate()
    def test_48_forged_event_provenance(self):
        self.gmail();self.event['wake_origin']['message_id']='other';self.rehash()
        with self.assertRaisesRegex(ValueError,'provenance mismatch'):self.validate()
    def test_49_cannot_claim_connected(self):
        self.new['execution']['fast_trigger_connected']=True
        with self.assertRaisesRegex(ValueError,'counters'):self.validate()
    def test_50_concurrent_candidates_share_parent_and_slot(self):
        self.gmail();self.validate();after=copy.deepcopy(self.new)
        with self.assertRaises(ValueError):g.validate_transition(after,self.event,self.new,self.paths,self.control,NOW,self.evidence)

if __name__=='__main__':unittest.main(verbosity=2)
