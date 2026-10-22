#!/usr/bin/env python3
"""Crash-safe storage and paid-call idempotency for MAL v1.2."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import hashlib
import json
import os
import tempfile
import threading
import time
from typing import Any, Iterator

_LOCK_GUARD = threading.Lock()
_LOCKS: dict[str, threading.RLock] = {}


def _thread_lock(path: Path) -> threading.RLock:
    key = str(path.resolve()).lower()
    with _LOCK_GUARD:
        return _LOCKS.setdefault(key, threading.RLock())


@contextmanager
def file_lock(path: Path, timeout: float = 15.0) -> Iterator[None]:
    """Cross-thread and best-effort cross-process lock using a sibling lock file."""
    path = Path(path)
    lock_path = path if path.suffix == ".lock" else path.with_name(path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    tlock = _thread_lock(lock_path)
    deadline = time.monotonic() + max(0.1, timeout)
    with tlock:
        fh = lock_path.open("a+b")
        acquired = False
        try:
            while not acquired:
                try:
                    if os.name == "nt":
                        import msvcrt
                        fh.seek(0)
                        if fh.tell() == 0:
                            fh.write(b"0")
                            fh.flush()
                        fh.seek(0)
                        msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    acquired = True
                except (OSError, BlockingIOError):
                    if time.monotonic() >= deadline:
                        raise TimeoutError(f"Timed out waiting for lock: {lock_path}")
                    time.sleep(0.025)
            yield
        finally:
            if acquired:
                try:
                    if os.name == "nt":
                        import msvcrt
                        fh.seek(0)
                        msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
                except OSError:
                    pass
            fh.close()
            try:
                lock_path.unlink(missing_ok=True)
            except OSError:
                pass


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with file_lock(path):
        fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
        tmp = Path(tmp_name)
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)
        finally:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass


def atomic_write_text(path: Path, text: str, encoding: str = "utf-8") -> None:
    atomic_write_bytes(Path(path), (text or "").encode(encoding))


def atomic_write_json(path: Path, obj: Any, *, indent: int = 2, sort_keys: bool = True) -> None:
    atomic_write_text(path, json.dumps(obj, ensure_ascii=False, indent=indent, sort_keys=sort_keys) + "\n")


def atomic_append_text(path: Path, text: str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with file_lock(path):
        with path.open("a", encoding="utf-8", newline="") as fh:
            fh.write(text or "")
            fh.flush()
            os.fsync(fh.fileno())


def atomic_update_json(path: Path, updater, default: Any | None = None) -> Any:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with file_lock(path):
        if path.exists():
            try:
                current = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                current = default if default is not None else {}
        else:
            current = default if default is not None else {}
        updated = updater(current)
        fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
        tmp = Path(tmp_name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
                json.dump(updated, fh, ensure_ascii=False, indent=2, sort_keys=True)
                fh.write("\n")
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)
        finally:
            tmp.unlink(missing_ok=True)
        return updated


CALL_STATES = ("planned", "sent", "received", "saved", "failed", "recovery_required")


def stable_call_id(*parts: str) -> str:
    raw = "\x1f".join(str(x or "") for x in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class PaidCallStore:
    """Per-run state machine preventing duplicate paid calls and supporting crash recovery."""

    def __init__(self, run_dir: Path):
        self.run_dir = Path(run_dir)
        self.path = self.run_dir / "PAID_CALL_STATES.json"

    def _load(self) -> dict:
        if not self.path.exists():
            return {"schema": "AIM3_MAL_PAID_CALL_STATES_V1_2", "calls": {}}
        try:
            obj = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(obj, dict) or not isinstance(obj.get("calls"), dict):
                raise ValueError("invalid paid-call store")
            return obj
        except Exception:
            return {"schema": "AIM3_MAL_PAID_CALL_STATES_V1_2", "calls": {}}

    def get(self, call_id: str) -> dict | None:
        return self._load().get("calls", {}).get(call_id)

    def plan(self, call_id: str, metadata: dict) -> dict:
        now = str(metadata.get("date_utc") or "")
        def update(obj: dict) -> dict:
            obj.setdefault("schema", "AIM3_MAL_PAID_CALL_STATES_V1_2")
            calls = obj.setdefault("calls", {})
            existing = calls.get(call_id)
            if existing:
                return obj
            calls[call_id] = {"call_id": call_id, "state": "planned", "created_utc": now, **metadata}
            return obj
        obj = atomic_update_json(self.path, update, default={"schema":"AIM3_MAL_PAID_CALL_STATES_V1_2","calls":{}})
        return obj["calls"][call_id]

    def may_send(self, call_id: str, *, retry_intent: str = "") -> tuple[bool, dict]:
        row = self.get(call_id) or {}
        state = row.get("state")
        if state in {"sent", "received", "saved", "recovery_required"}:
            return False, row
        if state == "failed" and retry_intent != "RETRY_FAILED_CALL":
            return False, row
        return state in {"planned", "failed"}, row

    def transition(self, call_id: str, state: str, **updates) -> dict:
        if state not in CALL_STATES:
            raise ValueError(f"invalid paid-call state: {state}")
        def update(obj: dict) -> dict:
            calls = obj.setdefault("calls", {})
            row = calls.setdefault(call_id, {"call_id": call_id, "state": "planned"})
            prior = row.get("state", "planned")
            legal = {
                "planned": {"sent", "failed"},
                "sent": {"received", "failed", "recovery_required"},
                "received": {"saved", "failed", "recovery_required"},
                "failed": {"sent", "failed"},
                "recovery_required": {"saved", "failed"},
                "saved": {"saved"},
            }
            if state not in legal.get(prior, set()):
                raise RuntimeError(f"illegal paid-call transition {prior} -> {state} for {call_id}")
            row.update(updates)
            row["state"] = state
            calls[call_id] = row
            return obj
        obj = atomic_update_json(self.path, update, default={"schema":"AIM3_MAL_PAID_CALL_STATES_V1_2","calls":{}})
        return obj["calls"][call_id]

    def recover(self) -> dict:
        def update(obj: dict) -> dict:
            for row in obj.setdefault("calls", {}).values():
                if row.get("state") in {"sent", "received"}:
                    row["state"] = "recovery_required"
                    row["recovery_note"] = "Provider may already have been charged; inspect saved response/ledger before any retry."
            return obj
        return atomic_update_json(self.path, update, default={"schema":"AIM3_MAL_PAID_CALL_STATES_V1_2","calls":{}})
