"""Synthetic regression tests for the single rejected attempt and exact codec bytes."""
import copy,json,sys,unittest
from pathlib import Path
from datetime import timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import wl_codec as c
import wl_legacy_step as step
import test_wl_rules as baseline
from unittest.mock import patch
g=baseline.g
NOW=baseline.NOW

class RecoveryTests(baseline.RuleGuardTests):
    def setUp(self):
        super().setUp()
        p=patch.object(step,'g',g);p.start();self.addCleanup(p.stop)
        self.recovery=json.loads((Path(__file__).resolve().parents[1]/'public/WL/recovery/e000009-rejected.json').read_text())
        self.old['recovery']=copy.deepcopy(self.recovery)
        self.new['recovery']=copy.deepcopy(self.recovery)
        self.event.update(seq=10,event_id='e000010',recovery_sha256=c.RECOVERY_SHA256)
        self.new['members'][4]['last_event_id']='e000010'
        self.paths=['public/WL/state.enc.json','public/WL/data/entries/e000010.enc.json']
        self.rehash()
    def rehash(self):
        eid=self.event['event_id'];seq=self.event['seq']
        self.new['entries']=copy.deepcopy(self.old['entries'])+[{'seq':seq,'event_id':eid,
            'path':f'data/entries/{eid}.enc.json','plain_sha256':g.digest(g.canonical(self.event))}]
    def test_recovery_valid_state(self):
        c.validate_state(self.new);self.assertEqual(c.next_seq(self.old),10);self.assertEqual(c.next_seq(self.new),11)
    def test_recovery_metadata_changed(self):
        self.old['recovery']['rejected_seq']=10
        with self.assertRaisesRegex(ValueError,'recovery'):c.validate_state(self.old)
    def test_recovery_missing_event_attestation(self):
        self.event.pop('recovery_sha256');self.rehash()
        with self.assertRaisesRegex(ValueError,'recovery'):self.validate()
    def test_recovery_cannot_replace_rejected_9(self):
        self.event.update(seq=9,event_id='e000009');self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_recovery_cannot_skip_10(self):
        self.event.update(seq=11,event_id='e000011');self.rehash()
        with self.assertRaises(ValueError):self.validate()
    def test_recovery_cannot_erase_record(self):
        self.new.pop('recovery')
        with self.assertRaises(ValueError):self.validate()
    def test_recovery_parent_hash_always_required(self):
        parent={'schema':'wl.event.v2','run_id':g.RUN,'seq':8,'event_id':'e000008','author_id':4,'body':'synthetic'}
        e=copy.deepcopy(self.event);e['parent_sha256']=c.sha256(c.canonical(parent));c.validate_event(e,parent)
        e['parent_sha256']='0'*64
        with self.assertRaises(ValueError):c.validate_event(e,parent)
    def test_other_gap_rejected(self):
        parent={'seq':10,'event_id':'e000010'};e=copy.deepcopy(self.event);e.update(seq=12,event_id='e000012',parent_event_id='e000010',parent_sha256=c.sha256(c.canonical(parent)))
        with self.assertRaises(ValueError):c.validate_event(e,parent)
    def test_codec_rejects_incident_envelope(self):
        with self.assertRaises(Exception):c.open_box({'format':'WL-ENC-2','nonce':'AAAA','cipher':'A=='},b'x'*32,'test')
    def test_deterministic_preparation_and_exact_transport(self):
        parent={'schema':'wl.event.v2','run_id':g.RUN,'seq':8,'event_id':'e000008','author_id':4,'body':'synthetic'}
        self.old['entries'][-1]['plain_sha256']=c.sha256(c.canonical(parent))
        proposal={'title':'Synthetic','phase':'RESONANCE','body':'Synthetic transport regression, not production research.',
            'retained':[],'sources':[],'next_question':'Synthetic?','input_event_ids':['e000008'],
            'evidence_class':'SYNTHETIC_TEST','open_alternatives':[],'next_author_id':5,
            'rules_read_at_utc':(NOW-timedelta(seconds=1)).isoformat(),'applied_rule_ids':['R03','R11'],
            'rules_application':'Checks exact deterministic construction and authenticated encrypted bytes.'}
        event,state,paths=step.prepare(self.old,parent,proposal,self.evidence,self.control,NOW)
        self.assertEqual(event['event_id'],'e000010')
        r=step.release_bytes(event,state,b'x'*32,'synthetic','a'*40)
        transported=json.loads(json.dumps(r,ensure_ascii=False))
        for f in transported['tree_elements']:
            raw=f['content'].encode();self.assertEqual(step.blob_sha(raw),r['files'][f['path']]['git_blob_sha1'])
            box=json.loads(raw);self.assertEqual(set(box),{'format','iv','cipher','sha256'})
            aad='WL:event:e000010' if 'entries' in f['path'] else 'WL:state:synthetic'
            self.assertEqual(c.open_box(box,b'x'*32,aad),event if 'entries' in f['path'] else state)

if __name__=='__main__':unittest.main()
