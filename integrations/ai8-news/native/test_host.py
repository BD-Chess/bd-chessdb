#!/usr/bin/python3
"""Offline regression checks; no model calls or credentials."""
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

import host


class HostTests(unittest.TestCase):
    def article(self, **kwargs):
        return {"url": "https://example.org/story", "title": "Primer",
                "text": "  Dobesedno besedilo.  ", "inputKind": "manual", **kwargs}

    def test_packet_binds_literal_text_and_rejects_commands(self):
        value = host.article_packet(self.article(text='$(touch /tmp/unsafe) <script>test</script>'))
        self.assertEqual(value["text"], '$(touch /tmp/unsafe) <script>test</script>')
        self.assertEqual(len(value["sha256"]), 64)
        for url in ("file:///etc/passwd", "javascript:alert(1)", "https://user:password@example.org"):
            with self.assertRaises(ValueError):
                host.article_packet(self.article(url=url))
        with self.assertRaises(ValueError):
            host.article_packet(self.article(text="x" * 60000))

    def test_framing_and_bounds(self):
        stream = io.BytesIO()
        host.write_message({"type": "ready", "text": "čšž"}, stream)
        stream.seek(0)
        self.assertEqual(host.read_message(stream)["text"], "čšž")
        for raw in (b"\x01", struct.pack("=I", host.MAX_MESSAGE + 1), struct.pack("=I", 10) + b"{}"):
            with self.assertRaises(ValueError):
                host.read_message(io.BytesIO(raw))

    def test_analysis_shape_is_bounded(self):
        good = dict(summary="s", opinion="o", reasons=[], uncertainties=[], questions=[])
        self.assertEqual(host.analysis_packet(good), good)
        with self.assertRaises(ValueError):
            host.analysis_packet({**good, "command": "sh"})
        with self.assertRaises(ValueError):
            host.analysis_packet({**good, "reasons": [{}]})

    def test_independent_workers_and_cache_prevent_repeat_calls(self):
        with tempfile.TemporaryDirectory() as folder:
            config = {"stateDir": folder}
            calls = []

            def reader(name, *_):
                calls.append(name)
                return {"status": "ok", "analysis": dict(summary="s", opinion=name,
                       reasons=[], uncertainties=[], questions=[])}

            article = host.article_packet(self.article())
            events = []
            host.analyze(config, article, "one", events.append, reader)
            host.analyze(config, article, "two", events.append, reader)
            self.assertCountEqual(calls, ["gpt", "claude"])
            self.assertTrue(events[-1]["cached"])
            self.assertEqual(events[-1]["requestId"], "two")
            self.assertNotIn("text", events[-1]["article"])
            self.assertEqual(events[-1]["results"]["gpt"]["analysis"]["opinion"], "gpt")
            self.assertEqual(events[-1]["results"]["claude"]["analysis"]["opinion"], "claude")
            record = next(Path(folder).glob("*.json"))
            self.assertEqual(record.stat().st_mode & 0o777, 0o600)
            record.write_text(json.dumps({"state": "started"}))
            with self.assertRaisesRegex(ValueError, "prekinjena"):
                host.analyze(config, article, "three", events.append, reader)
            self.assertEqual(len(calls), 2)

    def test_no_page_supplied_command_or_auth_env(self):
        cmd = host.codex_command("/fixed/codex", Path("/schema"), Path("/answer"), Path("/worker"))
        self.assertIn("--ignore-user-config", cmd)
        self.assertIn("shell_tool", cmd)
        self.assertIn("read-only", cmd)
        with patch.dict(os.environ, {"CODEX_THREAD_ID": "private", "CLAUDECODE": "1", "OPENAI_API_KEY": "secret"}):
            env = host.clean_env()
            self.assertNotIn("CODEX_THREAD_ID", env)
            self.assertNotIn("CLAUDECODE", env)
            self.assertNotIn("OPENAI_API_KEY", env)

    @unittest.skipUnless(sys.platform == "linux", "Linux lifecycle guard")
    def test_exec_guard_limits_output_before_disk_fill(self):
        guard = str(Path(host.__file__).with_name("reader_exec.py"))
        with tempfile.TemporaryFile() as output:
            result = subprocess.run([sys.executable, guard, str(os.getpid()), sys.executable, "-c",
                                     "import os; os.write(1, b'x' * 4000000); os.write(1, b'x')"],
                                    stdout=output, stderr=subprocess.DEVNULL, timeout=5)
            self.assertNotEqual(result.returncode, 0)
            self.assertLessEqual(output.tell(), 2097152)

    @unittest.skipUnless(sys.platform == "linux", "Linux lifecycle guard")
    def test_exec_guard_stops_reader_if_native_parent_dies(self):
        guard = str(Path(host.__file__).with_name("reader_exec.py"))
        script = ("import subprocess,sys,time,os; "
                  "p=subprocess.Popen([sys.executable,sys.argv[1],str(os.getpid()),sys.executable,'-c',"
                  "'import time; print(\"ready\",flush=True); time.sleep(20)'],stdout=subprocess.PIPE); "
                  "p.stdout.readline(); print(p.pid,flush=True)")
        result = subprocess.run([sys.executable, "-c", script, guard], capture_output=True,
                                text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        pid = int(result.stdout)
        for _ in range(100):
            status = Path(f"/proc/{pid}/stat")
            try:
                if status.read_text().split(")", 1)[1].strip().startswith("Z"):
                    break
            except (FileNotFoundError, ProcessLookupError):
                break
            time.sleep(.01)
        else:
            os.kill(pid, 9)
            self.fail("Reader survived its native parent")


if __name__ == "__main__":
    unittest.main()
