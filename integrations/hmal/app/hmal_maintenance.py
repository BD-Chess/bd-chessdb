"""Explicit, idempotent HMAL maintenance. Startup never repeats a cleanup."""
import json
from pathlib import Path
import threading

from .hmal_store import atomic, now


class MemoryMaintenance:
    def __init__(self, backend, root):
        self.backend = backend
        self.root = Path(root) / "maintenance"
        self.latest = self.root / "memory-latest.json"
        self.guard = threading.RLock()
        self.thread = None
        self.value = {"state": "NOT_RUN"}
        if self.latest.is_file():
            self.value = json.loads(self.latest.read_text(encoding="utf-8"))
            if self.value.get("state") == "RUNNING":
                self.value.update(state="UNKNOWN", code="CLEANUP_INTERRUPTED_NO_REPLAY")
                self._save()

    def _save(self):
        body = (json.dumps(self.value, ensure_ascii=False) + "\n").encode("utf-8")
        atomic(self.root / ("operation-" + self.value["operation_id"] + ".json"), body)
        atomic(self.latest, body)

    def status(self):
        with self.guard:
            return dict(self.value)

    def active(self):
        return self.status().get("state") == "RUNNING"

    def start(self, operation_id):
        with self.guard:
            prior = self.root / ("operation-" + operation_id + ".json")
            if prior.is_file():
                return json.loads(prior.read_text(encoding="utf-8"))
            if self.active():
                raise RuntimeError("HMAL_MAINTENANCE_BUSY")
            self.backend.assert_memory_idle()
            self.value = {"operation_id": operation_id, "state": "RUNNING", "utc": now()}
            self._save()  # Durable intent before the one permitted side effect.
            self.thread = threading.Thread(target=self._work, name="HMAL-memory", daemon=True)
            self.thread.start()
            return dict(self.value)

    def _work(self):
        try:
            proof = self.backend.clean_memory()
            result = {"state": "COMPLETED" if proof.get("status") == "PASS" and proof.get("cleanup_confirmed") else "UNKNOWN",
                      "proof": proof}
        except Exception:
            result = {"state": "UNKNOWN", "code": "CLEANUP_NOT_CONFIRMED_NO_RETRY"}
        with self.guard:
            self.value.update(**result, updated=now())
            self._save()
