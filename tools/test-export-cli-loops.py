"""Small, isolated test of the public status boundary. No listener required."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).with_name('export-cli-loops.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTest(unittest.TestCase):
    def test_status_boundary_and_throttle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            journal, output = root/'journal.sqlite', root/'feed.json'
            db = sqlite3.connect(journal)
            db.executescript('CREATE TABLE jobs(request_id TEXT,state TEXT,runtime_json TEXT); CREATE TABLE turns(request_id TEXT,turn_id TEXT,author TEXT);')
            runtime = {'work_used_s': 125.9, 'private_canary': 'PRIVATE /home/secret user@example.test',
                       'tier_state': {'mode': 'MAX', 'rotation_digest': {'body': 'never export me'},
                                      'applied': {'GPT': {'effort': 'max', 'client_reported_effort': 'max'}}}}
            db.execute('INSERT INTO jobs VALUES(?,?,?)', ('37eaccbf-test', 'RUNNING', json.dumps(runtime)))
            db.execute('INSERT INTO jobs VALUES(?,?,?)', ('ffffffff-private', 'RUNNING', json.dumps(runtime)))
            db.execute('INSERT INTO turns VALUES(?,?,?)', ('37eaccbf-test', 'T001', 'GPT'))
            db.commit()
            now = dt.datetime(2026, 10, 24, tzinfo=dt.timezone.utc)
            feed = {'schema': 'ai8.cli-loops.public.v1', 'published_at': (now-dt.timedelta(hours=1)).isoformat(),
                    'debates': [{'id': '37eaccbf', 'state': 'running', 'mode': 'MAX', 'rhp': True,
                                 'observed_at': now.isoformat(), 'turns': 0, 'title': 'Approved title',
                                 'summary': 'Approved summary', 'outcome': 'Status only', 'events': [],
                                 'next_step': 'Review later'}]}
            output.write_text(json.dumps(feed), encoding='utf-8')
            source_bytes = journal.read_bytes()
            self.assertEqual(exporter.export(journal, output, now), 'CHANGED')
            result = json.loads(output.read_bytes())['debates'][0]
            self.assertEqual(result['turns'], 1)
            self.assertEqual(result['active_seconds'], 125)
            self.assertEqual(result['next_author'], 'Claude')
            self.assertIsNone(result['effort']['Claude']['reported'])
            for forbidden in ['PRIVATE', '/home/', '@', 'never export', 'ffffffff', 'rotation_digest']:
                self.assertNotIn(forbidden, output.read_text(encoding='utf-8'))
            self.assertEqual(journal.read_bytes(), source_bytes)
            saved = output.read_bytes()
            self.assertEqual(exporter.export(journal, output, now+dt.timedelta(minutes=20)), 'UNCHANGED')
            self.assertEqual(output.read_bytes(), saved)
            db.execute("UPDATE jobs SET state='PAUSED_QUOTA' WHERE request_id='37eaccbf-test'")
            db.commit()
            self.assertEqual(exporter.export(journal, output, now+dt.timedelta(minutes=1)), 'THROTTLED')
            self.assertEqual(output.read_bytes(), saved)
            self.assertEqual(exporter.export(journal, output, now+dt.timedelta(minutes=15)), 'CHANGED')
            self.assertEqual(json.loads(output.read_bytes())['debates'][0]['state'], 'paused')
            for state, expected in [('VALIDATED', 'queued'), ('COMPLETE', 'complete'), ('PARTIAL', 'partial')]:
                db.execute('UPDATE jobs SET state=?', (state,))
                db.commit()
                now += dt.timedelta(hours=1)
                self.assertEqual(exporter.export(journal, output, now), 'CHANGED')
                self.assertEqual(json.loads(output.read_bytes())['debates'][0]['state'], expected)
            db.execute("UPDATE jobs SET state='unexpected-private-state'")
            db.commit()
            saved = output.read_bytes()
            with self.assertRaises(ValueError):
                exporter.export(journal, output, now+dt.timedelta(hours=1))
            self.assertEqual(output.read_bytes(), saved)
            db.close()

    def test_editorial_identifiers_are_refused(self):
        for value in ['PRIVATE', 'D:\\secret', 'user@example.test', 'https://drive.google.com/test', 'abcdefghijklmnopqrstuvwxy12345']:
            with self.assertRaises(ValueError):
                exporter.safe_text(value)

    def test_current_leases_are_anonymous_and_host_scoped(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);journal=root/'journal.sqlite';output=root/'feed.json'
            db=sqlite3.connect(journal)
            db.executescript('CREATE TABLE jobs(request_id TEXT,state TEXT,runtime_json TEXT,run_path TEXT); CREATE TABLE turns(request_id TEXT,turn_id TEXT,author TEXT);')
            now=dt.datetime(2026,10,24,tzinfo=dt.timezone.utc)
            reviewed=dict(id='37eaccbf',state='complete',mode='MAX',rhp=True,observed_at=now.isoformat(),turns=0,
                          title='Reviewed title',summary='Reviewed summary',outcome='Reviewed outcome',events=[],next_step='Review later')
            db.execute('INSERT INTO jobs VALUES(?,?,?,?)',('37eaccbf-test','COMPLETE','{}',None))
            # Five admitted jobs, plus an unrelated private RUNNING job: no SQL discovery.
            ids=['12345678-1234-1234-1234-'+str(i).zfill(12) for i in range(5)]
            for rid in ids+['ffffffff-ffff-ffff-ffff-ffffffffffff']:
                db.execute('INSERT INTO jobs VALUES(?,?,?,?)',(rid,'RUNNING',json.dumps({'private_topic':'PRIVATE user@example.test','tier_state':{'mode':'MIN'},'effective_request':{'topic':'NEVER_PUBLISH_TOPIC'}}),None))
                db.execute('INSERT INTO turns VALUES(?,?,?)',(rid,'T001','GPT'))
            db.commit();before=journal.read_bytes()
            work=dict(reviewed,id='live-work-test',host='WORK',status_only=True,current=True,state='running')
            output.write_text(json.dumps(dict(schema='ai8.cli-loops.public.v1',published_at=(now-dt.timedelta(hours=1)).isoformat(),
                                            debates=[reviewed],current_debates=[work],current_hosts={'WORK':dict(capacity=5,observed_at=now.isoformat())})),encoding='utf-8')
            status=dict(schema='8zlistener.status.v2',host='HOME',last_poll_utc=now.isoformat(),nonce='NEVER_PUBLISH_NONCE',parallel=dict(capacity=5,request_ids=ids))
            (root/'listener_status.json').write_text(json.dumps(status),encoding='utf-8')
            self.assertEqual(exporter.export(journal,output,now),'CHANGED')
            result=json.loads(output.read_bytes());home=[d for d in result['current_debates'] if d['host']=='HOME']
            self.assertEqual(len(home),5);self.assertEqual(len(result['current_debates']),6)
            self.assertEqual(result['current_hosts']['HOME']['capacity'],5)
            self.assertEqual(home[0]['turns'],1);self.assertEqual(home[0]['next_author'],'Claude')
            self.assertEqual(len({d['id'] for d in home}),5)
            self.assertEqual(journal.read_bytes(),before)
            for forbidden in ids+['ffffffff','PRIVATE','@','NEVER_PUBLISH','private_topic','nonce','run_path']:
                self.assertNotIn(forbidden,output.read_text(encoding='utf-8'))
            # Poll time alone is not a publication; public aliases survive subsequent exports.
            status['last_poll_utc']=(now+dt.timedelta(minutes=20)).isoformat()
            (root/'listener_status.json').write_text(json.dumps(status),encoding='utf-8')
            self.assertEqual(exporter.export(journal,output,now+dt.timedelta(minutes=20)),'UNCHANGED')
            status['parallel']['request_ids']=ids[:1]
            (root/'listener_status.json').write_text(json.dumps(status),encoding='utf-8')
            self.assertEqual(exporter.export(journal,output,now+dt.timedelta(minutes=20)),'CHANGED')
            result=json.loads(output.read_bytes())
            self.assertEqual([d['id'] for d in result['current_debates'] if d['host']=='HOME'],[home[0]['id']])
            status['stopped_at_utc']=(now+dt.timedelta(minutes=40)).isoformat()
            (root/'listener_status.json').write_text(json.dumps(status),encoding='utf-8')
            self.assertEqual(exporter.export(journal,output,now+dt.timedelta(minutes=40)),'CHANGED')
            self.assertEqual([d['host'] for d in json.loads(output.read_bytes())['current_debates']],['WORK'])
            # A reviewed admitted job remains one record, hence one token contribution.
            reviewed_id='37eaccbf-1234-1234-1234-000000000001'
            db.execute("UPDATE jobs SET request_id=?,state='RUNNING' WHERE request_id='37eaccbf-test'",(reviewed_id,));db.commit()
            status.pop('stopped_at_utc');status['parallel']['request_ids']=[reviewed_id]
            (root/'listener_status.json').write_text(json.dumps(status),encoding='utf-8')
            self.assertEqual(exporter.export(journal,output,now+dt.timedelta(hours=1)),'CHANGED')
            result=json.loads(output.read_bytes())
            self.assertTrue(result['debates'][0]['current']);self.assertEqual(result['debates'][0]['host'],'HOME')
            self.assertEqual(len(result['current_debates']),1)
            db.close()


if __name__ == '__main__':
    unittest.main()
