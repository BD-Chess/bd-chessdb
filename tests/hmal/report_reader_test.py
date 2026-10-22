"""No inference, no private fixture, no external services."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("report_reader", ROOT / "integrations/hmal/app/hmal_smoke.py")
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


class ReportReader(unittest.TestCase):
    def test_private_location_missing_and_valid_then_invalid(self):
        with tempfile.TemporaryDirectory() as temp:
            self.assertEqual(module.read_report(temp)["state"], "UNAVAILABLE")
            path = Path(temp) / "evidence/smoke-results.v1.json"; path.parent.mkdir()
            value = {"schema": "hmal.smoke_report.v1", "summary": {"cases": 2, "pass": 1, "fail": 1}, "rows": []}
            path.write_text(json.dumps(value), encoding="utf-8")
            answer = module.read_report(temp)
            self.assertEqual(answer["state"], "AVAILABLE"); self.assertTrue(answer["historical"]); self.assertEqual(len(answer["sha256"]), 64)
            value["summary"]["pass"] = 2; path.write_text(json.dumps(value))
            self.assertEqual(module.read_report(temp)["state"], "UNAVAILABLE")
            path.write_text("X" * 65537)
            self.assertEqual(module.read_report(temp)["state"], "UNAVAILABLE")


if __name__ == "__main__": unittest.main()
