#!/usr/bin/python3
"""Offline regression checks; no model calls or credentials."""
import io
import hashlib
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

    def reader_result(self, name):
        return {"status": "ok", "analysis": dict(summary="s", opinion=name,
                reasons=[], uncertainties=[], questions=[])}

    def record_path(self, folder, article, version=host.VERSION):
        key = hashlib.sha256(json.dumps({"version": version, **article}, sort_keys=True).encode()).hexdigest()
        return Path(folder) / (key + ".json")

    def test_model_selection_is_explicit_and_validated(self):
        self.assertEqual(host.models_packet(["gpt"]), ["gpt"])
        self.assertEqual(host.models_packet(["claude"]), ["claude"])
        self.assertEqual(host.models_packet(["claude", "gpt"]), ["gpt", "claude"])
        for value in (None, [], "gpt", ("gpt",), ["other"], ["gpt", "gpt"],
                      ["claude", "gpt", "claude"], [None], [{}], [True]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                host.models_packet(value)

    def test_native_requests_default_both_but_reject_explicit_invalid_modes(self):
        base = {"v": 1, "action": "analyze", "requestId": "choice", "article": self.article()}
        requests = [{"v": 1, "action": "ping", "requestId": "ping"},
                    base, {**base, "models": ["gpt"]}, {**base, "models": ["claude"]},
                    {**base, "models": ["claude", "gpt"]}]
        requests.extend({**base, "models": value} for value in (None, [], ["gpt", "gpt"], ["unknown"]))
        events = []
        with patch.object(sys, "argv", ["host.py", "chrome-extension://example/"]), \
                patch.object(host, "read_message", side_effect=[*requests, None]), \
                patch.object(host, "write_message", side_effect=events.append), \
                patch.object(host, "analyze") as analyze:
            host.serve({"extensionId": "example"})
        self.assertEqual([call.kwargs["models"] for call in analyze.call_args_list],
                         [["gpt", "claude"], ["gpt"], ["claude"], ["gpt", "claude"]])
        self.assertEqual(sum(event["type"] == "error" for event in events), 4)
        ready = [event for event in events if event["type"] == "ready"]
        self.assertEqual(len(ready), 2)
        self.assertTrue(all(event["capabilities"]["modelSelection"] for event in ready))
        self.assertTrue(all(event["hostVersion"] == "0.2.0" for event in ready))

    def test_only_requested_reader_runs_and_cross_mode_cache_is_shared(self):
        for first in ("gpt", "claude"):
            with self.subTest(first=first), tempfile.TemporaryDirectory() as folder:
                calls = []

                def reader(name, *_):
                    calls.append(name)
                    return self.reader_result(name)

                config = {"stateDir": folder}
                article = host.article_packet(self.article())
                events = []
                host.analyze(config, article, "one", events.append, reader, models=[first])
                self.assertEqual(calls, [first])
                self.assertEqual(events[-1]["requestedModels"], [first])
                other = next(name for name in host.MODELS if name != first)
                self.assertEqual(events[-1]["results"][other], {"status": "not-requested", "analysis": None})
                self.assertFalse(events[-1]["cached"])
                self.assertEqual(events[-1]["cachedModels"], [])

                host.analyze(config, article, "two", events.append, reader, models=[first])
                self.assertEqual(calls, [first])
                self.assertTrue(events[-1]["cached"])
                host.analyze(config, article, "both", events.append, reader, models=["gpt", "claude"])
                self.assertCountEqual(calls, ["gpt", "claude"])
                self.assertEqual(len(calls), 2)
                self.assertFalse(events[-1]["cached"])
                self.assertEqual(events[-1]["cachedModels"], [first])
                self.assertEqual(events[-1]["requestedModels"], ["gpt", "claude"])
                for name in host.MODELS:
                    self.assertEqual(events[-1]["results"][name]["analysis"]["opinion"], name)
                host.analyze(config, article, "bothagain", events.append, reader)
                self.assertEqual(len(calls), 2)
                self.assertTrue(events[-1]["cached"])
                self.assertEqual(events[-1]["cachedModels"], ["gpt", "claude"])

    def test_invalid_selection_does_not_start_reader_or_write_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            calls = []
            for models in ([], ["gpt", "gpt"], ["unknown"], "claude"):
                with self.subTest(models=models), self.assertRaises(ValueError):
                    host.analyze({"stateDir": folder}, host.article_packet(self.article()),
                                 "invalid", lambda _: None, lambda *args: calls.append(args), models=models)
            self.assertEqual(calls, [])
            self.assertEqual(list(Path(folder).glob("*.json")), [])

    def test_write_ahead_retains_completed_view_when_second_reader_is_interrupted(self):
        with tempfile.TemporaryDirectory() as folder:
            article = host.article_packet(self.article())
            record = self.record_path(folder, article)
            calls = []

            def reader(name, *_):
                calls.append(name)
                if name == "claude":
                    snapshot = json.loads(record.read_text())
                    self.assertEqual(snapshot["models"]["gpt"]["result"], self.reader_result("gpt"))
                    self.assertEqual(snapshot["models"]["claude"]["state"], "started")
                    self.assertEqual(snapshot["state"], "started")
                    raise KeyboardInterrupt("simulated process interruption")
                return self.reader_result(name)

            events = []
            config = {"stateDir": folder}
            host.analyze(config, article, "gpt", events.append, reader, models=["gpt"])
            with self.assertRaises(KeyboardInterrupt):
                host.analyze(config, article, "both", events.append, reader)
            held_bytes = record.read_bytes()
            host.analyze(config, article, "cachedgpt", events.append, reader, models=["gpt"])
            self.assertTrue(events[-1]["cached"])
            self.assertEqual(events[-1]["results"]["claude"]["status"], "not-requested")
            for models in (["claude"], ["gpt", "claude"]):
                with self.assertRaisesRegex(ValueError, "prekinjena"):
                    host.analyze(config, article, "held", events.append, reader, models=models)
            self.assertEqual(calls, ["gpt", "claude"])
            self.assertEqual(record.read_bytes(), held_bytes)

    def test_failed_and_timed_out_views_are_cached_without_hiding_other_view(self):
        for status in ("error", "timeout"):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as folder:
                calls = []

                def reader(name, *_):
                    calls.append(name)
                    return ({"status": status, "analysis": None, "error": "held"}
                            if name == "gpt" else self.reader_result(name))

                config = {"stateDir": folder}
                article = host.article_packet(self.article())
                events = []
                host.analyze(config, article, "gpt", events.append, reader, models=["gpt"])
                host.analyze(config, article, "both", events.append, reader)
                host.analyze(config, article, "again", events.append, reader)
                self.assertEqual(calls, ["gpt", "claude"])
                self.assertEqual(events[-1]["results"]["gpt"]["status"], status)
                self.assertEqual(events[-1]["results"]["claude"]["status"], "ok")
                self.assertTrue(events[-1]["cached"])

    def test_v1_receipts_are_reused_or_held_without_mutation(self):
        for legacy_state in ("complete", "started"):
            with self.subTest(legacy_state=legacy_state), tempfile.TemporaryDirectory() as folder:
                article = host.article_packet(self.article())
                legacy = self.record_path(folder, article, "1")
                legacy.write_text(json.dumps({"state": legacy_state, "article": article,
                    "result": {"createdAt": "2026-11-07T00:00:00Z", "results": {
                        name: self.reader_result(name) for name in host.MODELS}}}))
                before = legacy.read_bytes()
                calls = []
                events = []

                def reader(name, *_):
                    calls.append(name)
                    return self.reader_result(name)

                if legacy_state == "complete":
                    host.analyze({"stateDir": folder}, article, "old", events.append, reader, models=["claude"])
                    self.assertTrue(events[-1]["cached"])
                    self.assertEqual(events[-1]["requestedModels"], ["claude"])
                    self.assertEqual(events[-1]["results"]["gpt"]["status"], "not-requested")
                else:
                    with self.assertRaisesRegex(ValueError, "prekinjena"):
                        host.analyze({"stateDir": folder}, article, "old", events.append, reader)
                self.assertEqual(calls, [])
                self.assertEqual(legacy.read_bytes(), before)
                self.assertFalse(self.record_path(folder, article).exists())

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
