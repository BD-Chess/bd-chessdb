"""Private, historical acceptance report; no model calls and no live health claims."""
from pathlib import Path
import hashlib
import json


def read_report(data_root):
    path = Path(data_root) / "evidence" / "smoke-results.v1.json"
    try:
        if path.stat().st_size > 65536:
            raise ValueError("Report too large")
        raw = path.read_bytes()
        value = json.loads(raw.decode("utf-8-sig"))
        if value.get("schema") != "hmal.smoke_report.v1":
            raise ValueError("Unknown report")
        summary = value["summary"]
        if any(type(summary[k]) is not int or summary[k] < 0 for k in ("cases", "pass", "fail")):
            raise ValueError("Invalid counts")
        if summary["pass"] + summary["fail"] != summary["cases"]:
            raise ValueError("Counts do not agree")
        if not isinstance(value["rows"], list) or len(value["rows"]) > 64:
            raise ValueError("Invalid rows")
        return {"state": "AVAILABLE", "historical": True, "report": value,
                "sha256": hashlib.sha256(raw).hexdigest()}
    except (OSError, ValueError, KeyError, TypeError):
        return {"state": "UNAVAILABLE", "historical": True, "report": None}
