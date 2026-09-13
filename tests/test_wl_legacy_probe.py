import base64
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('probe', Path(__file__).parents[1] / 'scripts/wl_legacy_probe.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.event = {'repository': {'full_name': p.REPO}, 'action': 'created',
                      'issue': {'number': 17, 'state': 'open'},
                      'comment': {'id': 123, 'user': {'id': p.OWNER_ID},
                                  'body': 'WL_PROBE_V1 ' + 'a'*32 + ' SNAPSHOT'},
                      'sender': {'id': p.OWNER_ID}}
        self.now = datetime(2026, 9, 13, 7, 50, tzinfo=timezone.utc)
        self.control = {'ok': True, 'protocol': 'WL-RUNTIME-2', 'paused': False,
                        'server_time': self.now.isoformat()}

    def bad_event(self, mutate):
        e = deepcopy(self.event)
        mutate(e)
        with self.assertRaises(p.ProbeError):
            p.parse_request(e)

    def test_valid_snapshot(self):
        self.assertEqual(p.parse_request(self.event), ('a'*32, 'SNAPSHOT', 123))
    def test_valid_control(self):
        self.event['comment']['body'] = 'WL_PROBE_V1 ' + 'b'*32 + ' CONTROL'
        self.assertEqual(p.parse_request(self.event)[1], 'CONTROL')
    def test_foreign_repo(self): self.bad_event(lambda e: e['repository'].update(full_name='other/repo'))
    def test_foreign_sender(self): self.bad_event(lambda e: e['sender'].update(id=1))
    def test_foreign_author(self): self.bad_event(lambda e: e['comment']['user'].update(id=1))
    def test_wrong_issue(self): self.bad_event(lambda e: e['issue'].update(number=18))
    def test_closed_issue(self): self.bad_event(lambda e: e['issue'].update(state='closed'))
    def test_pr_is_not_issue(self): self.bad_event(lambda e: e['issue'].update(pull_request={'url':'x'}))
    def test_edited_comment(self): self.bad_event(lambda e: e.update(action='edited'))
    def test_no_shell(self): self.bad_event(lambda e: e['comment'].update(body='WL_PROBE_V1 '+'a'*32+' CONTROL; echo leak'))
    def test_no_url_input(self): self.bad_event(lambda e: e['comment'].update(body='WL_PROBE_V1 https://evil CONTROL'))
    def test_no_nonce_traversal(self): self.bad_event(lambda e: e['comment'].update(body='WL_PROBE_V1 ../../etc/passwd CONTROL'))
    def test_no_arbitrary_mode(self): self.bad_event(lambda e: e['comment'].update(body='WL_PROBE_V1 '+'a'*32+' RESUME'))
    def test_receipt_is_not_probe(self): self.bad_event(lambda e: e['comment'].update(body='WL_RECEIPT_V1 {}'))
    def test_missing_id(self): self.bad_event(lambda e: e['comment'].pop('id'))
    def test_boolean_id(self): self.bad_event(lambda e: e['comment'].update(id=True))
    def test_fresh(self): self.assertEqual(p.validate_control(self.control, self.now), self.control)
    def test_paused_remains_paused(self):
        self.control['paused'] = True
        self.assertTrue(p.validate_control(self.control, self.now)['paused'])
    def test_string_pause_rejected(self):
        self.control['paused'] = 'false'
        with self.assertRaises(p.ProbeError): p.validate_control(self.control, self.now)
    def test_stale_rejected(self):
        with self.assertRaises(p.ProbeError): p.validate_control(self.control, self.now + timedelta(seconds=181))
    def test_future_rejected(self):
        with self.assertRaises(p.ProbeError): p.validate_control(self.control, self.now - timedelta(seconds=181))
    def test_boundary(self): p.validate_control(self.control, self.now + timedelta(seconds=180))
    def test_naive_rejected(self):
        self.control['server_time'] = '2026-09-13T07:50:00'
        with self.assertRaises(p.ProbeError): p.validate_control(self.control, self.now)
    def test_wrong_protocol(self):
        self.control['protocol'] = 'PREAI8'
        with self.assertRaises(p.ProbeError): p.validate_control(self.control, self.now)

    def blob(self, path, raw):
        return {'path': path, 'type': 'file', 'encoding': 'base64', 'size':len(raw),
                'sha': hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),
                'content': base64.b64encode(raw).decode()}
    def encrypted(self):
        cipher=b'test-only-cipher'
        return json.dumps({'format':'WL-ENC-2', 'iv':base64.b64encode(bytes(12)).decode(),
                           'cipher':base64.b64encode(cipher).decode(), 'sha256':p.digest(cipher)}).encode()
    def test_exact_encrypted_transfer(self):
        path='public/WL/data/entries/e000007.enc.json'
        raw=self.encrypted()
        self.assertEqual(p.validate_file(path, self.blob(path,raw)),raw)
    def test_not_plaintext(self):
        path='public/WL/state.enc.json'
        with self.assertRaises(p.ProbeError): p.validate_file(path,self.blob(path,b'{"body":"private"}'))
    def test_not_other_file(self):
        path='.env'
        with self.assertRaises(p.ProbeError): p.validate_file(path,self.blob(path,b'x'))
    def test_symlink_rejected(self):
        path='public/WL/state.enc.json'
        b=self.blob(path,self.encrypted());b['type']='symlink'
        with self.assertRaises(p.ProbeError): p.validate_file(path,b)
    def test_wrong_sha(self):
        path='public/WL/state.enc.json'
        b=self.blob(path,self.encrypted());b['sha']='0'*40
        with self.assertRaises(p.ProbeError): p.validate_file(path,b)
    def test_wrong_size(self):
        path='public/WL/state.enc.json'
        b=self.blob(path,self.encrypted());b['size']+=1
        with self.assertRaises(p.ProbeError): p.validate_file(path,b)
    def test_pin_mismatch(self):
        path='scripts/wl_rules_guard.py'
        with self.assertRaises(p.ProbeError): p.validate_file(path,self.blob(path,b'# changed guard\n'))
    def test_control_only_no_journal_write(self):
        outer=self
        calls=[]
        class Fake:
            def __init__(self, token): pass
            def api(self, path, **kwargs):
                calls.append((path,kwargs))
                if path.startswith('/contents/probes/') and kwargs.get('missing'): return None
                if path.startswith('/branches/'): return {}
                if path=='/git/ref/heads/main': return {'object':{'sha':'f'*40}}
                if kwargs.get('method')=='PUT': return {}
                raise AssertionError(path)
            def control(self): return outer.control
        self.event['comment']['body']='WL_PROBE_V1 '+'c'*32+' CONTROL'
        with tempfile.TemporaryDirectory() as d:
            ef=Path(d)/'event.json';ef.write_text(json.dumps(self.event))
            env={'GITHUB_REPOSITORY':p.REPO,'GITHUB_EVENT_NAME':'issue_comment',
                 'GITHUB_EVENT_PATH':str(ef),'GITHUB_TOKEN':'synthetic-not-a-secret',
                 'RUNNER_TEMP':d,'GITHUB_RUN_ID':'1234','GITHUB_SHA':'e'*40,'GITHUB_OUTPUT':str(Path(d)/'out')}
            with patch.dict('os.environ',env), patch.object(p,'Client',Fake): p.main()
        writes=[x for x in calls if x[1].get('method')=='PUT']
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0][0],'/contents/probes/'+'c'*32+'.json')
        self.assertEqual(writes[0][1]['body']['branch'],p.BRANCH)
        record=json.loads(base64.b64decode(writes[0][1]['body']['content']))
        self.assertFalse(record['paused'])
        self.assertEqual(record['server_time'],self.control['server_time'])
        self.assertEqual(record['request_comment_id'],123)

if __name__ == '__main__': unittest.main()
