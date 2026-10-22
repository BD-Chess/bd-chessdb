"""A narrow client of the existing HOME AI8 PowerShell controller."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time

from .hmal_store import atomic
from .hmal_protocol import canonical, digest
from .hmal_reasoning import capability, choice as reasoning_choice


class BackendProblem(RuntimeError):
    def __init__(self, code, before_dispatch=False, result=None):
        super().__init__(code)
        self.before_dispatch = before_dispatch
        self.result = result


class AI8Backend:
    def __init__(self, config, private_root):
        self.config = config
        self.root = Path(config.get("ai8_root", "D:/AI8"))
        self.jobs = Path(private_root) / "jobs"
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.guard = threading.Lock()
        self.current = None
        self.current_started = None
        self._last_catalogue = None

    def catalogue(self):
        registry = self.root / "Shared" / "Config" / "MODEL_API_REGISTRY.json"
        try:
            first = registry.stat()
            raw = registry.read_bytes()
            last = registry.stat()
            if (first.st_mtime_ns, first.st_size) != (last.st_mtime_ns, last.st_size) or len(raw) > 2 * 1024**2:
                raise ValueError("REGISTRY_CHANGED_DURING_READ")
            obj = json.loads(raw.decode("utf-8-sig"))
            values = obj["models"]
            if not isinstance(values, list) or len(values) > 256:
                raise ValueError("REGISTRY_INVALID")
            models = []
            keys = set()
            for value in values:
                key = value["key"]
                if not isinstance(key, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", key) or key in keys:
                    raise ValueError("REGISTRY_KEY_INVALID")
                keys.add(key)
                cfg_path = self.root / "Shared" / "Config" / (key + ".json")
                cfg_bytes = cfg_path.read_bytes()
                cfg = json.loads(cfg_bytes.decode("utf-8-sig"))
                if cfg.get("key") != key or cfg.get("sha256") != value.get("sha256"):
                    raise ValueError("REGISTRY_CONFIG_CONFLICT")
                profile_pin = {k: cfg.get(k) for k in ("context", "profiles", "ram_policy", "native_template_sha256", "chat_template_override", "thinking_control", "default_system_prompt", "reasoning_preserve")}
                models.append({"key": key, "alias": value.get("alias", key), "name": value.get("official_base", key),
                               "quantization": value.get("quantization"), "sha256": value.get("sha256"),
                               "revision": value.get("revision"), "context": cfg.get("context"),
                               "quality_settings": {k: cfg.get("profiles", {}).get("quality-chat", {}).get(k)
                                                    for k in ("temperature", "top_p", "top_k", "min_p", "presence_penalty", "repeat_penalty")},
                               "profile_sha256": hashlib.sha256(canonical(profile_pin).encode("utf-8")).hexdigest(),
                               "installed": Path(value.get("path", "__missing__")).is_file(),
                               "profile": "quality-chat", "reasoning": capability(key, cfg.get("profiles", {}).get("quality-chat"))})
            answer = {"state": "FRESH", "models": models, "registry_sha256": hashlib.sha256(raw).hexdigest(), "error": None}
            self._last_catalogue = answer
            return answer
        except (OSError, ValueError, KeyError, TypeError):
            return {**(self._last_catalogue or {"models": [], "registry_sha256": None}),
                    "state": "STALE" if self._last_catalogue else "UNAVAILABLE", "error": "REGISTRY_UNAVAILABLE"}

    def state(self):
        try:
            value = json.loads((self.root / "Shared" / "State" / "server.json").read_text(encoding="utf-8-sig"))
            answer = {k: value.get(k) for k in ("key", "status", "phase", "reason", "utc", "load_seconds", "last_memory", "epoch", "pid", "birth_ticks", "profile")}
            answer["ownership"] = self._process_identity(value)
            if value.get("status") in {"RUNNING", "LOADING"} and answer["ownership"] != "VERIFIED_LIVE_PROCESS":
                answer.update(status="UNKNOWN", reason="NATIVE_PROCESS_IDENTITY_UNVERIFIED")
            answer.update(self.execution_gate())
            return answer
        except (OSError, ValueError, TypeError):
            return {"status": "UNKNOWN"}

    def progress(self):
        """Read only our job's local receipt; no inference, slot ownership or ETA guess."""
        with self.guard:
            current, started = self.current, self.current_started
        if not current:
            return None
        answer = {"job_id": current[0], "phase": "PREPARING", "token_progress": None,
                  "elapsed_seconds": round(max(0, time.monotonic() - started), 1) if started is not None else None}
        try:
            value = json.loads((current[2] / "progress.json").read_text(encoding="utf-8-sig"))
            if value.get("job_id") == current[0]:
                answer.update({k: value[k] for k in ("phase", "utc", "input_tokens", "effective_context",
                              "configured_context", "effective_max_tokens", "reasoning_budget_tokens", "completion_policy") if k in value})
        except (OSError, ValueError, TypeError):
            pass
        return answer

    @staticmethod
    def _process_identity(value):
        if not value.get("pid") or os.name != "nt":
            return "UNVERIFIED"
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        handle = kernel.OpenProcess(0x1000, False, int(value["pid"]))
        if not handle:
            return "NO_LIVE_PROCESS"
        try:
            kernel.GetProcessTimes.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
            kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
            kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
            exit_code = wintypes.DWORD()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(exit_code)) or exit_code.value != 259:
                return "NO_LIVE_PROCESS"
            created, exited, system, user = (wintypes.FILETIME() for _ in range(4))
            size = wintypes.DWORD(32768); path = ctypes.create_unicode_buffer(size.value)
            if not kernel.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited), ctypes.byref(system), ctypes.byref(user)) or not kernel.QueryFullProcessImageNameW(handle, 0, path, ctypes.byref(size)):
                return "UNVERIFIED"
            ticks = (created.dwHighDateTime << 32) + created.dwLowDateTime + 504911232000000000
            try:
                same_executable = os.path.samefile(path.value, value.get("exe", ""))
            except OSError:
                return "UNVERIFIED"
            return "VERIFIED_LIVE_PROCESS" if str(ticks) == str(value.get("birth_ticks")) and same_executable else "IDENTITY_CONFLICT"
        finally:
            kernel.CloseHandle.argtypes = [wintypes.HANDLE]
            kernel.CloseHandle(handle)

    def execution_gate(self):
        campaigns = []
        bench = self.root / "Benchmarks" / "LocalLLM"
        for pattern in ("*/campaign-owner.lock", "*/queue-owner.lock"):
            for path in bench.glob(pattern):
                try:
                    with path.open("rb") as stream:
                        stream.read(1)
                except OSError:
                    campaigns.append(path.parent.name)
        return {"controller_busy": bool(campaigns), "protected_campaigns": sorted(set(campaigns))}

    def config_for(self, key):
        if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", key):
            raise ValueError("Invalid key")
        raw = (self.root / "Shared" / "Config" / (key + ".json")).read_bytes()
        value = json.loads(raw.decode("utf-8-sig"))
        value["__file_sha256"] = hashlib.sha256(raw).hexdigest()
        return value

    def assert_memory_idle(self):
        state = self.state()
        if state.get("status") != "STOPPED" or state.get("controller_busy") or state.get("ownership") == "VERIFIED_LIVE_PROCESS":
            raise BackendProblem("AI8_BUSY_MEMORY_CLEANUP_HELD", True)
        phase = json.loads((self.root / "Shared/State/request-phase.json").read_text(encoding="utf-8-sig"))
        ledger = json.loads((self.root / "Shared/State/acceptance-ledger.json").read_text(encoding="utf-8-sig"))
        if phase.get("active") or ledger.get("lease"):
            raise BackendProblem("AI8_BUSY_MEMORY_CLEANUP_HELD", True)

    def clean_memory(self):
        if os.name != "nt":
            raise BackendProblem("HOME_WINDOWS_REQUIRED", True)
        self.assert_memory_idle()
        # The existing helper acquires the same AI8 writer mutex and rechecks
        # model/request/lease before its one clean. No new cleanup implementation.
        helper = self.root / "Shared/Tools/AI8.CleanMemory.ps1"
        exe = str(Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe")
        completed = subprocess.run([exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(helper), "-Mode", "clean"],
                                   capture_output=True, timeout=45, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
        return json.loads(completed.stdout.decode("utf-8-sig"))

    def generate(self, job_id, key, messages, max_tokens, timeout, cancellation, reasoning="default",
                 completion_policy="native", answer_reserve_tokens=1024):
        reasoning_choice(key, reasoning)
        if completion_policy not in {"native", "reserve_final"} or type(answer_reserve_tokens) is not int or not 128 <= answer_reserve_tokens <= 32768:
            raise ValueError("Invalid completion policy")
        if os.name != "nt":
            raise BackendProblem("HOME_WINDOWS_REQUIRED", True)
        if self.execution_gate()["controller_busy"]:
            raise BackendProblem("AI8_CAMPAIGN_ACTIVE", True)
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", job_id):
            raise ValueError("Invalid job id")
        cfg = self.config_for(key)
        helper = Path(__file__).parent / "HMAL_AI8.ps1"
        expected = self.config.get("controller_sha256")
        controller = Path(self.config.get("controller_path", ""))
        if not expected or not controller.is_file() or hashlib.sha256(controller.read_bytes()).hexdigest() != expected:
            raise BackendProblem("AI8_BINDING_REQUIRES_LOCAL_VERIFICATION", True)
        job = self.jobs / job_id
        job.mkdir(exist_ok=False)
        request = {"schema": "hmal.ai8.request.v1", "job_id": job_id, "key": key,
                   "messages": messages, "max_tokens": max_tokens, "timeout_seconds": timeout,
                   "controller_path": str(controller), "controller_sha256": expected,
                   "model_sha256": cfg["sha256"], "profile": "quality-chat", "reasoning": reasoning}
        request.update(completion_policy=completion_policy, answer_reserve_tokens=answer_reserve_tokens)
        request["config_file_sha256"] = cfg["__file_sha256"]
        atomic(job / "input.json", (canonical(request) + "\n").encode("utf-8"))
        exe = str(Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe")
        process = subprocess.Popen([exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                                    "-File", str(helper), "-Job", str(job)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   shell=False, creationflags=subprocess.CREATE_NO_WINDOW)
        with self.guard:
            self.current = (job_id, process, job, exe, helper)
            self.current_started = time.monotonic()
        started = time.monotonic()
        asked = False
        cancel_deadline = None
        try:
            while process.poll() is None:
                if cancellation.is_set() or (timeout > 0 and time.monotonic() - started > timeout + 360):
                    if not asked:
                        atomic(job / "cancel", b"STOP\n")
                        asked = True
                        cancel_deadline = time.monotonic() + 35
                    try:
                        self._cancel_owned(job, exe, helper)
                    except (OSError, subprocess.SubprocessError):
                        pass
                    if process.poll() is None and time.monotonic() >= cancel_deadline:
                        # Only the exact child created above; never taskkill by model name.
                        process.kill()
                        process.wait(timeout=5)
                        raise BackendProblem("OWNED_REQUEST_INTERRUPTED_UNCONFIRMED")
                time.sleep(0.2)
            result_file = job / "result.json"
            if not result_file.is_file():
                raise BackendProblem("AI8_RESULT_UNKNOWN_NO_REPLAY")
            result = json.loads(result_file.read_text(encoding="utf-8-sig"))
            if result.get("state") != "COMPLETED":
                raise BackendProblem(result.get("code", "AI8_FAILED"), result.get("dispatched") is False, result=result)
            if result.get("model_sha256") != cfg["sha256"] or result.get("alias") != cfg["alias"]:
                raise BackendProblem("AI8_RESPONSE_IDENTITY_CONFLICT")
            self._assert_complete(result)
            return result
        finally:
            with self.guard:
                self.current = None
                self.current_started = None

    def _cancel_owned(self, job, exe, helper):
        # This helper checks the run's epoch against the live server, never a global kill.
        subprocess.run([exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                        "-File", str(helper), "-Job", str(job), "-Cancel"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=25,
                       shell=False, creationflags=subprocess.CREATE_NO_WINDOW)

    def cancel(self):
        with self.guard:
            current = self.current
        if current:
            atomic(current[2] / "cancel", b"STOP\n")

    def recover(self, dispatch):
        job_id = dispatch["job_id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", job_id):
            raise BackendProblem("RECOVERY_ID_INVALID")
        root = self.jobs / job_id
        try:
            request = json.loads((root / "input.json").read_text(encoding="utf-8-sig"))
            result = json.loads((root / "result.json").read_text(encoding="utf-8-sig"))
        except (OSError, ValueError):
            raise BackendProblem("RECOVERY_RESULT_NOT_AVAILABLE") from None
        pinned = dispatch["model"]
        if (request.get("job_id") != job_id or request.get("key") != dispatch["author"]
                or digest(request.get("messages")) != dispatch["exposure"]["input_sha256"]
                or result.get("model_sha256") != pinned.get("sha256")
                or result.get("alias") != pinned.get("alias")
                or result.get("state") != "COMPLETED" or not isinstance(result.get("text"), str)):
            raise BackendProblem("RECOVERY_IDENTITY_CONFLICT")
        self._assert_complete(result)
        return {**result, "recovery": "LOCAL_NATIVE_RESULT_NO_INFERENCE"}

    @staticmethod
    def _assert_complete(result):
        if not isinstance(result.get("text"), str) or not result["text"].strip():
            raise BackendProblem("RESPONSE_EMPTY", result=result)
        if result.get("finish_reason") == "length":
            raise BackendProblem("RESPONSE_TRUNCATED", result=result)
        if result.get("finish_reason") != "stop":
            raise BackendProblem("RESPONSE_FINISH_UNVERIFIED", result=result)


class DisabledBackend:
    def catalogue(self):
        return {"state": "UNAVAILABLE", "models": [], "error": "HMAL_NOT_CONFIGURED"}

    def state(self):
        return {"status": "UNAVAILABLE"}

    def cancel(self):
        pass
