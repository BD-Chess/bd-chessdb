import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('tail', ROOT / 'tools/game_log_tail.py')
tail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tail)


class TailTests(unittest.TestCase):
    def test_token_file_cursor_follow_and_no_secret_output(self):
        token = 'offline-tail-only-fixture-' * 3
        session = 'b26f851e-5712-47ef-8ec0-2c74db15bb3a'
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'reader.txt'
            path.write_text(token, encoding='utf8')
            self.assertEqual(tail.read_token(path), token)
            row = {'game_session_id': session, 'seq': 3, 'payload': {'text': token}}
            output, errors = io.StringIO(), io.StringIO()
            with patch.object(tail, 'fetch_page', return_value=json.dumps(row)) as fetch, patch.object(tail.time, 'sleep', side_effect=KeyboardInterrupt), contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                code = tail.main([session, '--token-file', str(path), '--since', '2', '--follow'])
            self.assertEqual(code, 0)
            self.assertNotIn(token, output.getvalue() + errors.getvalue())
            self.assertEqual(fetch.call_args.args[2]['since'], 2)
            self.assertIn('[redacted]', output.getvalue())
            with patch.object(tail, 'fetch_page', side_effect=ValueError(token)), contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                self.assertEqual(tail.main([session, '--token-file', str(path)]), 1)
            self.assertNotIn(token, errors.getvalue())

    def test_https_redirect_and_cursor_guards(self):
        for url in ['http://example.test/.netlify/functions/game-guide', 'https://user:pass@example.test/.netlify/functions/game-guide', 'https://example.test/.netlify/functions/game-guide?token=bad']:
            with self.assertRaises(ValueError):
                tail.endpoint(url)
        self.assertIsNone(tail.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://elsewhere.test'))
        with self.assertRaises(ValueError):
            tail.read_events('{"seq":1,"game_session_id":"other"}', 'ours', 0)
        with self.assertRaises(ValueError):
            tail.read_events('{"seq":1,"game_session_id":"ours"}', 'ours', 1)


if __name__ == '__main__':
    unittest.main()
