"""Transactional local history and a durable, immutable-file Drive outbox."""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import threading
from datetime import datetime, timezone

from .hmal_protocol import canonical


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic(path, body):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".hmal-")
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


class Store:
    def __init__(self, root, max_bytes=2 * 1024**3):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = self.root / "history.sqlite3"
        self.max_bytes = max_bytes
        self.lock = threading.RLock()
        self.lease = (self.root / "service.lock").open("a+b")
        # Keep the lock file inode: unlinking a live advisory lock permits two writers.
        try:
            if os.name == "nt":
                import msvcrt
                self.lease.seek(0)
                self.lease.write(b"0")
                self.lease.flush()
                self.lease.seek(0)
                msvcrt.locking(self.lease.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.lease.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.lease.close()
            raise RuntimeError("HMAL_ALREADY_RUNNING") from None
        with self.connect() as db:
            db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS runs(
              id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, request_hash TEXT NOT NULL,
              config TEXT NOT NULL, plan TEXT NOT NULL, state TEXT NOT NULL, next_step INTEGER NOT NULL DEFAULT 0,
              created TEXT NOT NULL, updated TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS records(
              run_id TEXT NOT NULL, seq INTEGER NOT NULL, id TEXT UNIQUE NOT NULL,
              body TEXT NOT NULL, sha256 TEXT NOT NULL, sync_state TEXT NOT NULL DEFAULT 'NEW',
              sync_error TEXT NOT NULL DEFAULT '', PRIMARY KEY(run_id,seq));
            CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, run_id TEXT NOT NULL, body_hash TEXT NOT NULL);
            """)
            # No inference is replayed just because the service restarted.
            db.execute("UPDATE runs SET state='INTERRUPTED',reason='SERVICE_RESTART_NO_REPLAY',updated=? WHERE state IN ('RUNNING','STOPPING','PAUSING')", (now(),))

    @contextlib.contextmanager
    def connect(self):
        with self.lock:
            db = sqlite3.connect(self.db, timeout=10)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA synchronous=FULL")
            try:
                with db:
                    yield db
            finally:
                db.close()

    def room(self):
        total = sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())
        if total >= self.max_bytes or __import__("shutil").disk_usage(self.root).free < 16 * 1024**2:
            raise RuntimeError("LOCAL_DISK_LIMIT")

    def create(self, run_id, request_id, request_hash, config, steps):
        self.room()
        with self.connect() as db:
            old = db.execute("SELECT * FROM runs WHERE request_id=?", (request_id,)).fetchone()
            if old:
                if old["request_hash"] != request_hash:
                    raise ValueError("Isti ID zahteve ima drugačno vsebino.")
                return old["id"], False
            db.execute("INSERT INTO runs VALUES(?,?,?,?,?,?,0,?,?,?)", (run_id, request_id, request_hash,
                       canonical(config), canonical(steps), "PAUSED", now(), now(), ""))
            self._record(db, run_id, {"kind": "contract", "author": "BD", "state": "COMMITTED", "config": config,
                                     "plan": steps, "text": config["seed"]})
            return run_id, True

    def _record(self, db, run_id, value):
        seq = db.execute("SELECT COALESCE(MAX(seq),0)+1 FROM records WHERE run_id=?", (run_id,)).fetchone()[0]
        row = {"schema": "hmal.record.v1", "run_id": run_id, "seq": seq,
               "id": f"{run_id}-T{seq:06d}", "utc": now(), **value}
        body = canonical(row) + "\n"
        sha = hashlib.sha256(body.encode("utf-8")).hexdigest()
        db.execute("INSERT INTO records(run_id,seq,id,body,sha256) VALUES(?,?,?,?,?)", (run_id, seq, row["id"], body, sha))
        # Keep the immediate local JSON archive independently of the deferred
        # Drive worker. A transaction rollback can leave an unreferenced file;
        # it is never uploaded without the corresponding committed DB record.
        atomic(self.root / "runs" / run_id / f"{seq:06d}_{sha}.json", body.encode("utf-8"))
        return row

    def append(self, run_id, value):
        self.room()
        with self.connect() as db:
            self.get(run_id, db)
            return self._record(db, run_id, value)

    def get(self, run_id, db=None):
        if db is None:
            with self.connect() as connection:
                return self.get(run_id, connection)
        row = db.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if row is None:
            raise KeyError("Pogovora ni mogoče najti.")
        value = dict(row)
        value["config"] = json.loads(value["config"])
        value["plan"] = json.loads(value["plan"])
        return value

    def commit_model(self, run_id, index, record):
        """The received answer and cursor move share one durable transaction."""
        self.room()
        with self.connect() as db:
            run = self.get(run_id, db)
            if run["next_step"] != index:
                raise RuntimeError("MODEL_COMMIT_CURSOR_CONFLICT")
            self._record(db, run_id, record)
            db.execute("UPDATE runs SET next_step=?,updated=? WHERE id=?", (index + 1, now(), run_id))

    def update(self, run_id, **fields):
        allowed = {"state", "next_step", "reason", "plan", "config"}
        if not fields or set(fields) - allowed:
            raise ValueError("Invalid update")
        fields["updated"] = now()
        for key in ("plan", "config"):
            if key in fields:
                fields[key] = canonical(fields[key])
        with self.connect() as db:
            db.execute("UPDATE runs SET " + ",".join(k + "=?" for k in fields) + " WHERE id=?", (*fields.values(), run_id))

    def records(self, run_id):
        with self.connect() as db:
            return [{**json.loads(r["body"]), "sha256": r["sha256"], "drive_state": r["sync_state"]}
                    for r in db.execute("SELECT * FROM records WHERE run_id=? ORDER BY seq", (run_id,))]

    def history(self):
        with self.connect() as db:
            return [{"id": r["id"], "state": r["state"], "updated": r["updated"],
                     "title": json.loads(r["config"])["seed"][:90], "mode": json.loads(r["config"])["mode"]}
                    for r in db.execute("SELECT id,state,updated,config FROM runs ORDER BY updated DESC LIMIT 200")]

    def snapshot(self, run_id):
        run = self.get(run_id)
        run.pop("request_hash", None)
        run["records"] = self.records(run_id)
        run["drive_pending"] = sum(r["drive_state"] != "VERIFIED" for r in run["records"])
        return run

    def close(self):
        if not self.lease.closed:
            self.lease.close()


class DriveOutbox:
    def __init__(self, store, config, runner=subprocess.run):
        self.store, self.config, self.runner = store, config, runner
        self.lock = threading.Lock()

    def _run(self, args):
        return self.runner([self.config["executable"], *args], capture_output=True, timeout=60,
                           shell=False, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

    def flush(self, run_id):
        with self.lock:
            with self.store.connect() as db:
                rows = [dict(r) for r in db.execute("SELECT * FROM records WHERE run_id=? AND sync_state!='VERIFIED' ORDER BY seq", (run_id,))]
            for row in rows:
                local = self.store.root / "runs" / run_id / f"{row['seq']:06d}_{row['sha256']}.json"
                body = row["body"].encode("utf-8")
                if not local.exists():
                    atomic(local, body)
                elif local.read_bytes() != body:
                    self._mark(row, "CONFLICT", "LOCAL_ARCHIVE_CONFLICT")
                    return False
                if not self.config.get("executable") or not self.config.get("destination"):
                    self._mark(row, row["sync_state"], "DRIVE_NOT_CONFIGURED")
                    return False
                destination = self.config["destination"].rstrip("/") + "/" + run_id + "/" + local.name
                try:
                    if row["sync_state"] == "CONFLICT":
                        return False
                    if row["sync_state"] == "NEW":
                        # Persist intent BEFORE the external effect. Crash means UNKNOWN, never blind resend.
                        self._mark(row, "SENT", "")
                        result = self._run(["copyto", str(local), destination, "--immutable", "--retries", "1", "--low-level-retries", "1"])
                        if result.returncode:
                            self._mark(row, "UNKNOWN", "DRIVE_WRITE_UNCONFIRMED")
                    check = self._run(["cat", destination, "--retries", "1", "--low-level-retries", "1"])
                    if check.returncode:
                        self._mark(row, "UNKNOWN", "DRIVE_READBACK_PENDING")
                        return False
                    if check.stdout != body:
                        self._mark(row, "CONFLICT", "DRIVE_BYTES_DIFFER")
                        return False
                    self._mark(row, "VERIFIED", "")
                except (OSError, subprocess.SubprocessError):
                    self._mark(row, "UNKNOWN", "DRIVE_READBACK_PENDING")
                    return False
            return True

    def _mark(self, row, state, error):
        with self.store.connect() as db:
            db.execute("UPDATE records SET sync_state=?,sync_error=? WHERE id=?", (state, error, row["id"]))
