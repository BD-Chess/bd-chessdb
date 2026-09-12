"""Synthetic admission regression tests. Never contain production keys/content."""
import base64
import gzip
import copy
import importlib.util
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('guard', HERE/'scripts/wl_rules_guard.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
NOW=datetime(2026,9,12,12,30,tzinfo=timezone.utc)
T='2026-09-12T12:30:00Z';SLOT='2026-09-12T12:00:00Z'

class RuleGuardTests(unittest.TestCase):
    def setUp(self):
        self.control={'ok':True,'protocol':'WL-RUNTIME-2','paused':False,'server_time':T}
        self.old={'schema':'wl.state.v2','run_id':g.RUN,'revision':7,
          'control':{'paused':False},'mission':'synthetic test only',
          'members':[{'id':i,'name':str(i),'function':'test role','last_event_id':None} for i in g.ROSTER],
          'next_author_id':4,'updated_at':'2026-09-12T11:30:00Z','phase':'RESONANCE',
          'retained':[],'open_alternatives':[],'next_question':'test?',
          'execution':{'auto_steps':2,'manual_steps':1,'last_slot_utc':'2026-09-12T11:00:00Z',
              'last_automatic_at':'2026-09-12T11:30:00Z','mode':'NATIVE_HOURLY',
              'note':'test','scheduled_enabled':True,'fast_trigger_connected':False},
          'entries':[{'seq':i,'event_id':f'e{i:06d}','path':f'data/entries/e{i:06d}.enc.json',
                       'plain_sha256':str(i)*64} for i in (1,2,3)]}
        self.event={'schema':'wl.event.v2','run_id':g.RUN,'seq':4,'event_id':'e000004',
             'author_id':4,'author_name':'4','created_at':T,'slot_utc':SLOT,
             'execution':'scheduled_model_step','body':'Synthetic candidate, not a research contribution.',
             'parent_event_id':'e000003','parent_sha256':'3'*64,
             'rules_receipt':{'schema':'wl.rules.receipt.v1','id':g.RULES_ID,'version':g.VERSION,
                 'sha256':g.DOCUMENT_SHA256,'scope':g.SCOPE,'read_at_utc':'2026-09-12T12:29:00Z',
                 'assurance':'BYTES_VERIFIED_APPLICATION_ATTESTED',
                 'applied_rule_ids':['R03','R11'],
                 'application':'Synthetic test checks restricted writes and one discriminating example.'}}
        self.new=copy.deepcopy(self.old);self.new['revision']+=1
        self.new['updated_at']=T
        self.new['execution'].update(auto_steps=3,last_slot_utc=SLOT,last_automatic_at=T)
        next(m for m in self.new['members'] if m['id']==4)['last_event_id']='e000004'
        self.paths=['public/WL/state.enc.json','public/WL/data/entries/e000004.enc.json']
        self.rehash()
    def rehash(self):
        self.new['entries']=copy.deepcopy(self.old['entries'])+[{'seq':4,'event_id':'e000004',
              'path':'data/entries/e000004.enc.json','plain_sha256':g.digest(g.canonical(self.event))}]
    def validate(self):g.validate_transition(self.old,self.event,self.new,self.paths,self.control,NOW)
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
        self.control['server_time']='2026-09-12T12:00:00Z'
        with self.assertRaises(ValueError):self.validate()
    def test_06_valid_witness(self):
        self.control.update(schema='wl.control.witness.v1',source=g.CONTROL_URL,observed_at=T)
        self.validate()
    def test_07_stale_witness(self):
        self.control.update(schema='wl.control.witness.v1',source=g.CONTROL_URL,observed_at='2026-09-12T11:00:00Z')
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
        self.event['rules_receipt']['read_at_utc']='2026-09-12T12:31:00Z';self.rehash()
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

if __name__=='__main__':unittest.main(verbosity=2)
