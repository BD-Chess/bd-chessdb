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


if __name__ == '__main__':
    unittest.main()
