"""HMAL service: one local writer, sequential conversations, local+Drive history."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime

from .hmal_backend import AI8Backend, BackendProblem, DisabledBackend
from .hmal_protocol import canonical, digest, messages, plan, validate, PROJECTION, RHP_SHA
from .hmal_store import DriveOutbox, Store, now
from ._mal_storage import stable_call_id
from .hmal_maintenance import MemoryMaintenance
from .hmal_smoke import read_report

BUILD = "HMAL_QUALITY_SMOKE_R2_20261022"


class HMALProblem(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message
        super().__init__(code)


class HMAL:
    def __init__(self, config, backend=None, outbox=None):
        self.config = config
        self.guard = threading.RLock()
        self.cancel = threading.Event()
        self.active = None
        self.thread = None
        self.archivers = []
        self.closing = False
        self.store = Store(config["data_root"], config.get("max_disk_bytes", 2 * 1024**3))
        self.backend = backend or AI8Backend(config, self.store.root)
        self.outbox = outbox or DriveOutbox(self.store, config.get("drive", {}))
        self.enabled = config.get("enabled") is True
        self.memory = MemoryMaintenance(self.backend, self.store.root)
        self.archive_guard = threading.Lock()
        self.archive_stop = threading.Event()
        self.archive_status = {"state": "IDLE", "interval_seconds": 300}
        self.archive_clock = threading.Thread(target=self._archive_loop, name="HMAL-archive-clock", daemon=True)
        self.archive_clock.start()

    def status(self):
        catalogue = self.backend.catalogue()
        native = self.backend.state()
        native.pop("epoch", None)
        return {"build": BUILD, "enabled": self.enabled, "catalogue": catalogue, "native": native,
                "memory_cleanup": self.memory.status(),
                "generation_progress": self.backend.progress() if hasattr(self.backend, "progress") else None,
                "drive_sync": dict(self.archive_status),
                "hold_reason": self.config.get("hold_reason", ""),
                "active_run": self.active, "runs": self.store.history(), "rhp_projection": PROJECTION,
                "inference_transport": "NATIVE_NONSTREAMING", "observed_at": now(),
                "drive_configured": bool(self.config.get("drive", {}).get("destination"))}

    def create(self, request):
        if not self.enabled:
            raise HMALProblem(503, "HMAL_DISABLED", "HMAL še ni priklopljen na domači krmilnik.")
        catalogue = self.backend.catalogue()
        if catalogue["state"] != "FRESH":
            raise HMALProblem(409, "CATALOGUE_NOT_FRESH", "Počakaj na svež lokalni register modelov.")
        request_id = str(request.get("request_id", ""))
        self._id(request_id)
        try:
            config = validate(request, {m["key"]: m for m in catalogue["models"]})
        except ValueError as exc:
            raise HMALProblem(400, "REQUEST_INVALID", str(exc)) from None
        if config["rhp"]:
            source = Path(__file__).parent.parent / "protocols" / "RHP.md"
            if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != RHP_SHA:
                raise HMALProblem(409, "RHP_SOURCE_CHANGED", "Pripeti vir RHP se ne ujema; potreben je pregled povezave.")
        logical_hash = digest(config)
        config["model_snapshot"] = [m for m in catalogue["models"] if m["key"] in config["models"]]
        config["registry_sha256"] = catalogue.get("registry_sha256")
        config["build"] = BUILD
        with self.guard:
            if self.memory.active():
                raise HMALProblem(409, "HMAL_MAINTENANCE_BUSY", "Počakaj na dokončanje čiščenja pomnilnika.")
            run_id, fresh = self.store.create(uuid.uuid4().hex, request_id, logical_hash, config, plan(config))
            # Creating never dispatches. The separate start action is itself idempotent.
            return {"run": self.store.snapshot(run_id), "created": fresh}

    @staticmethod
    def _id(value):
        if not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,90}", value):
            raise HMALProblem(400, "ID_INVALID", "ID zahteve ni veljaven.")

    def control(self, run_id, request):
        self._id(run_id)
        operation_id = request.get("operation_id", "")
        self._id(operation_id)
        action = request.get("action")
        if action not in {"start", "resume", "step", "pause", "stop", "comment", "skip", "recover", "continue_chat", "sync"}:
            raise HMALProblem(400, "ACTION_INVALID", "Neznano dejanje.")
        with self.guard:
            if self.memory.active() and action in {"start", "resume", "step", "continue_chat"}:
                raise HMALProblem(409, "HMAL_MAINTENANCE_BUSY", "Počakaj na dokončanje čiščenja pomnilnika.")
            run = self.store.get(run_id)
            body_hash = digest(request)
            with self.store.connect() as db:
                old = db.execute("SELECT * FROM operations WHERE id=?", (operation_id,)).fetchone()
                if old:
                    if old["run_id"] != run_id or old["body_hash"] != body_hash:
                        raise HMALProblem(409, "OPERATION_ID_CONFLICT", "Isti ID dejanja ima drugačno vsebino.")
                    return self.store.snapshot(run_id)
            if action == "sync":
                # Saving never adopts, pauses or replays an inference run. A
                # single background batch also works while a model is running.
                with self.store.connect() as db:
                    db.execute("INSERT INTO operations VALUES(?,?,?)", (operation_id, run_id, body_hash))
                self._archive_async()
                return self.store.snapshot(run_id)
            if action in {"start", "resume", "step", "continue_chat", "skip", "recover"}:
                if self.active:
                    raise HMALProblem(409, "HMAL_BUSY", "Najprej počakaj ali ustavi aktivni HMAL pogovor.")
            if action in {"start", "resume", "step", "continue_chat"} and not self.enabled:
                raise HMALProblem(503, "HMAL_DISABLED", "HMAL ni omogočen.")
            if action in {"start", "resume", "step"} and run["state"] in {"STOPPED", "INTERRUPTED", "COMPLETED"}:
                raise HMALProblem(409, "EXPLICIT_RECOVERY_REQUIRED", "Prekinjene poteze ne ponavljamo. Preskoči zabeleženo vrzel ali začni nov pogovor.")
            if action == "continue_chat" and (run["config"]["mode"] != "chat" or run["state"] != "COMPLETED"):
                raise HMALProblem(409, "CHAT_NOT_READY", "Počakaj na dokončan odgovor v načinu Chat.")
            text = request.get("text", "")
            if action in {"comment", "continue_chat"} and (not isinstance(text, str) or not text.strip() or len(text) > 18000):
                raise HMALProblem(400, "TEXT_INVALID", "Vpiši sporočilo do 18.000 znakov.")
            recovery = dispatch = None
            if action == "recover":
                if run["state"] != "INTERRUPTED":
                    raise HMALProblem(409, "NO_INTERRUPTED_TURN", "Ni prekinjene poteze za obnovo.")
                dispatches = [r for r in self.store.records(run_id) if r["kind"] == "dispatch" and r["step_index"] == run["next_step"]]
                if not dispatches:
                    raise HMALProblem(409, "NO_PENDING_DISPATCH", "Ni zabeležene oddaje za obnovo.")
                dispatch = dispatches[-1]
                try:
                    recovery = self.backend.recover(dispatch)
                except (BackendProblem, AttributeError) as exc:
                    raise HMALProblem(409, "RECOVERY_PENDING", "Potrjen shranjeni odgovor še ni dosegljiv ali se ne ujema z oddajo.") from None
            # Commit the human operation and its effect together. A crash never replays a dispatch.
            with self.store.connect() as db:
                db.execute("INSERT INTO operations VALUES(?,?,?)", (operation_id, run_id, body_hash))
                if action in {"comment", "continue_chat"}:
                    self.store._record(db, run_id, {"kind": "human", "author": "BD", "state": "COMMITTED", "text": text, "operation_id": operation_id})
                else:
                    self.store._record(db, run_id, {"kind": "control", "author": "BD", "state": "COMMITTED", "action": action,
                                                    "text": action, "operation_id": operation_id})
                if action == "continue_chat":
                    expanded = run["plan"] + plan(run["config"])
                    db.execute("UPDATE runs SET plan=?,state='RUNNING',reason='',updated=? WHERE id=?", (canonical(expanded), now(), run_id))
                elif action == "recover":
                    step = run["plan"][run["next_step"]]
                    self.store._record(db, run_id, {"kind": "model", "author": step["model"], "state": "COMMITTED",
                        "job_id": dispatch["job_id"], "call_id": dispatch.get("call_id"), "step_index": run["next_step"],
                        "phase": step["phase"], "round": step["round"], "text": recovery["text"],
                        "result": recovery, "exposure": dispatch["exposure"]})
                    db.execute("UPDATE runs SET next_step=next_step+1,state='PAUSED',reason='LOCAL_RESULT_RECOVERED',updated=? WHERE id=?", (now(), run_id))
                elif action == "skip":
                    if run["state"] != "INTERRUPTED":
                        raise HMALProblem(409, "NO_INTERRUPTED_TURN", "Ni prekinjene poteze za preskok.")
                    db.execute("UPDATE runs SET next_step=next_step+1,state='PAUSED',reason='GAP_EXPLICITLY_SKIPPED',updated=? WHERE id=?", (now(), run_id))
                elif action == "pause":
                    db.execute("UPDATE runs SET state=?,updated=? WHERE id=? AND state NOT IN ('STOPPED','COMPLETED')", ("PAUSING" if self.active == run_id else "PAUSED", now(), run_id))
                elif action == "stop":
                    db.execute("UPDATE runs SET state=?,reason='BD_STOP',updated=? WHERE id=?", ("STOPPING" if self.active == run_id else "STOPPED", now(), run_id))
                elif action in {"start", "resume", "step"}:
                    db.execute("UPDATE runs SET state='RUNNING',reason='',updated=? WHERE id=?", (now(), run_id))
            if action == "stop" and self.active == run_id:
                self.cancel.set()
                self.backend.cancel()
            if action in {"start", "resume", "step", "continue_chat"}:
                self.active = run_id
                self.cancel.clear()
                self.thread = threading.Thread(target=self._work, args=(run_id, action == "step"),
                                               name="HMAL-" + run_id[:8], daemon=True)
                self.thread.start()
            return self.store.snapshot(run_id)

    def clean_memory(self, request):
        operation_id = request.get("operation_id", "")
        self._id(operation_id)
        with self.guard:
            if self.active:
                raise HMALProblem(409, "HMAL_BUSY", "Najprej počakaj na dokončanje modelne poteze.")
            self.store.room()
            try:
                return self.memory.start(operation_id)
            except (BackendProblem, RuntimeError, OSError, ValueError):
                raise HMALProblem(409, "MEMORY_CLEANUP_HELD", "Čiščenje ni dovoljeno: krmilnik je zaseden ali stanje ni potrjeno.") from None

    def _archive_loop(self):
        # Server-side scheduling continues even when the browser is closed.
        # Never flush at startup, on every record or when a model turn ends.
        while not self.archive_stop.wait(300):
            self._archive_async()

    def _archive_async(self):
        if self.closing or not self.archive_guard.acquire(blocking=False):
            return
        self.archivers = [t for t in self.archivers if t.is_alive()]
        self.archive_status = {"state": "RUNNING", "interval_seconds": 300, "started": now()}
        def archive():
            ok = True
            try:
                # Include all pending conversations, not just the open one or
                # the first 200 shown in the sidebar. Each flush takes a stable
                # snapshot; records appended later remain durable for next time.
                with self.store.connect() as db:
                    run_ids = [row[0] for row in db.execute("SELECT DISTINCT run_id FROM records WHERE sync_state!='VERIFIED' ORDER BY run_id")]
                for run_id in run_ids:
                    if self.closing:
                        ok = False
                        break
                    ok = self.outbox.flush(run_id) and ok
            except Exception:
                ok = False  # Durable outbox and its error remain inspectable.
            finally:
                self.archive_status = {"state": "IDLE" if ok else "PENDING", "interval_seconds": 300, "finished": now()}
                self.archive_guard.release()
        thread = threading.Thread(target=archive, name="HMAL-archive", daemon=True)
        self.archivers.append(thread)
        thread.start()

    def _post_cleanup_confirmed(self, record):
        if record.get("result", {}).get("post_cleanup_status") in {None, "PASS"}:
            return True
        cleanup = self.memory.status()
        proof = cleanup.get("proof", {})
        try:
            return (cleanup.get("state") == "COMPLETED" and proof.get("status") == "PASS" and
                    proof.get("cleanup_confirmed") is True and
                    datetime.fromisoformat(cleanup["updated"]) >= datetime.fromisoformat(record["utc"]))
        except (KeyError, ValueError, TypeError):
            return False

    def _work(self, run_id, single=False):
        completed = 0
        try:
            while True:
                run = self.store.get(run_id)
                if self.cancel.is_set() or run["state"] in {"STOPPING", "STOPPED"}:
                    self.store.update(run_id, state="STOPPED", reason="BD_STOP")
                    return
                if run["state"] in {"PAUSING", "PAUSED"}:
                    self.store.update(run_id, state="PAUSED")
                    return
                index = run["next_step"]
                if index >= len(run["plan"]):
                    self.store.update(run_id, state="COMPLETED", reason="")
                    return
                if single and completed:
                    self.store.update(run_id, state="PAUSED", reason="ONE_STEP_COMPLETED")
                    return
                prior_models = [r for r in self.store.records(run_id) if r["kind"] == "model"]
                if prior_models and not self._post_cleanup_confirmed(prior_models[-1]):
                    self.store.update(run_id, state="PAUSED", reason="MEMORY_CLEANUP_PENDING")
                    return
                step = run["plan"][index]
                # Preserve the selected model identity; a changed register needs a new explicit run.
                current = self.backend.catalogue()
                pinned = {m["key"]: m for m in run["config"]["model_snapshot"]}
                observed = {m["key"]: m for m in current["models"]}
                if current["state"] != "FRESH" or step["model"] not in observed or any(observed[step["model"]].get(field) != pinned[step["model"]].get(field) for field in ("sha256", "profile_sha256")):
                    self.store.update(run_id, state="PAUSED", reason="MODEL_IDENTITY_CHANGED")
                    return
                native = self.backend.state()
                if native.get("status") in {"RUNNING", "LOADING"} or native.get("controller_busy") or native.get("reason") == "NATIVE_PROCESS_IDENTITY_UNVERIFIED":
                    self.store.update(run_id, state="PAUSED", reason="AI8_CAMPAIGN_ACTIVE" if native.get("controller_busy") else "AI8_BUSY_OTHER_RUN")
                    return
                cfg = self.backend.config_for(step["model"])
                packet, exposure = messages(run["config"], step, self.store.records(run_id),
                                            cfg.get("default_system_prompt", ""), cfg.get("reasoning_preserve"))
                job_id = uuid.uuid4().hex
                call_id = stable_call_id(run_id, str(index), step["model"], exposure["input_sha256"])
                self.store.append(run_id, {"kind": "dispatch", "author": step["model"], "state": "SENT",
                                          "step_index": index, "job_id": job_id, "call_id": call_id, "step": step,
                                          "input": packet, "exposure": exposure,
                                          "model": pinned[step["model"]], "text": ""})
                try:
                    result = self.backend.generate(job_id, step["model"], packet, run["config"]["max_tokens"],
                                                   run["config"]["timeout_seconds"], self.cancel,
                                                   reasoning=run["config"].get("reasoning", {}).get(step["model"], "default"),
                                                   completion_policy=run["config"].get("completion_policy", "native"),
                                                   answer_reserve_tokens=run["config"].get("answer_reserve_tokens", 1024))
                except BackendProblem as exc:
                    self.store.append(run_id, {"kind": "interruption", "author": step["model"], "state": "NOT_DISPATCHED" if exc.before_dispatch else "INTERRUPTED",
                                              "job_id": job_id, "step_index": index, "text": str(exc),
                                              "result": exc.result})
                    stopped = self.cancel.is_set()
                    self.store.update(run_id, state="STOPPED" if stopped else "PAUSED" if exc.before_dispatch else "INTERRUPTED", reason=str(exc))
                    return
                self.store.commit_model(run_id, index, {"kind": "model", "author": step["model"], "state": "COMMITTED", "job_id": job_id,
                                          "call_id": call_id,
                                          "step_index": index, "phase": step["phase"], "round": step["round"],
                                          "text": result["text"], "result": result, "exposure": exposure})
                completed += 1
                if result.get("post_cleanup_status") not in {None, "PASS"}:
                    self.store.update(run_id, state="PAUSED", reason="MEMORY_CLEANUP_PENDING")
                    return
        except Exception as exc:
            # Unknown means no automatic replay. Export the error class, never private exception text.
            self.store.update(run_id, state="STOPPED" if self.cancel.is_set() else "INTERRUPTED", reason=type(exc).__name__.upper())
        finally:
            with self.guard:
                if self.active == run_id:
                    self.active = None

    def snapshot(self, run_id):
        self._id(run_id)
        return self.store.snapshot(run_id)

    def close(self):
        self.closing = True
        self.archive_stop.set()
        self.cancel.set()
        self.backend.cancel()
        deadline = time.monotonic() + 5
        self.archive_clock.join(timeout=max(0, deadline - time.monotonic()))
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=max(0, deadline - time.monotonic()))
        for thread in self.archivers:
            thread.join(timeout=max(0, deadline - time.monotonic()))
        if (not self.thread or not self.thread.is_alive()) and not any(t.is_alive() for t in self.archivers):
            self.store.close()


class Unconfigured:
    enabled = False

    def status(self):
        return {"build": BUILD, "enabled": False, "catalogue": {"state": "UNAVAILABLE", "models": [], "error": "HMAL_NOT_CONFIGURED"},
                "native": {"status": "UNKNOWN"}, "active_run": None, "runs": [], "observed_at": now(), "drive_configured": False}

    def close(self):
        pass


def load_service(portal_config):
    default = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "BDHomePortal" / "hmal.v1.local.json"
    path = Path(portal_config.get("hmal_config", str(default)))
    if not path.is_file():
        return Unconfigured()
    try:
        if path.stat().st_size > 65536:
            raise ValueError("HMAL config too large")
        config = json.loads(path.read_text(encoding="utf-8-sig"))
        return HMAL(config)
    except (ValueError, OSError, RuntimeError, KeyError, TypeError, sqlite3.Error):
        return Unconfigured()


def get(handler, path):
    if path == "/api/hmal/smoke-results":
        service = handler.runtime.hmal
        return read_report(service.config["data_root"]) if isinstance(service, HMAL) else {
            "state": "UNAVAILABLE", "historical": True, "report": None}
    if path == "/api/hmal/status":
        return handler.runtime.hmal.status()
    if path in {"/api/hmal/run", "/api/hmal/export"}:
        try:
            return handler.runtime.hmal.snapshot(handler._query().get("id", ""))
        except AttributeError:
            raise HMALProblem(503, "HMAL_DISABLED", "HMAL še ni nastavljen.") from None
        except KeyError:
            raise HMALProblem(404, "RUN_NOT_FOUND", "Pogovora ni mogoče najti.") from None
    raise HMALProblem(404, "NOT_FOUND", "Neznana pot HMAL.")


def post(handler, path, value):
    service = handler.runtime.hmal
    if not isinstance(service, HMAL):
        raise HMALProblem(503, "HMAL_DISABLED", "HMAL še ni nastavljen.")
    try:
        if path == "/api/hmal/memory-clean":
            return service.clean_memory(value)
        if path == "/api/hmal/create":
            return service.create(value)
        if path == "/api/hmal/control":
            return service.control(value.get("run_id", ""), value)
    except KeyError:
        raise HMALProblem(404, "RUN_NOT_FOUND", "Pogovora ni mogoče najti.") from None
    except ValueError as exc:
        raise HMALProblem(409, "CONFLICT", str(exc)) from None
    raise HMALProblem(404, "NOT_FOUND", "Neznana pot HMAL.")
