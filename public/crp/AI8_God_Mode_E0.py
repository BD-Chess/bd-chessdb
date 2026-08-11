#!/usr/bin/env python3
"""AI8 God-Mode Code Capsule E0.

A deterministic, standard-library-only mechanism demo for a two-stage
permission policy:

    coverage -> necessity/tightness -> guarded execution

The capsule runs only on synthetic files inside a declared workspace. It
performs no network calls, touches no secrets, and does not claim that AI8 or
Permission DCC is superior to existing authorization systems. Its purpose is
only to make the first rung of the research ladder executable and auditable.

Run:
    python AI8_God_Mode_E0.py --output-dir AI8_God_Mode_E0_run
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

ZERO_HASH = "0" * 64
CAPSULE_ID = "AI8_God_Mode_E0"
CAPSULE_VERSION = "0.1"


@dataclass(frozen=True, order=True)
class Permission:
    action: str
    target: str

    @property
    def key(self) -> str:
        return f"{self.action}:{self.target}"


@dataclass(frozen=True)
class TaskSpec:
    task_id: str
    description: str
    required: tuple[Permission, ...]


@dataclass
class LedgerEvent:
    seq: int
    kind: str
    detail: dict[str, Any]
    prev_hash: str
    event_hash: str = ""

    def payload_without_hash(self) -> dict[str, Any]:
        return {
            "seq": self.seq,
            "kind": self.kind,
            "detail": self.detail,
            "prev_hash": self.prev_hash,
        }

    def seal(self) -> None:
        payload = canonical_json(self.payload_without_hash()).encode("utf-8")
        self.event_hash = hashlib.sha256(payload).hexdigest()


class HashLedger:
    def __init__(self) -> None:
        self.events: list[LedgerEvent] = []

    def append(self, kind: str, detail: dict[str, Any]) -> LedgerEvent:
        prev_hash = self.events[-1].event_hash if self.events else ZERO_HASH
        event = LedgerEvent(
            seq=len(self.events) + 1,
            kind=kind,
            detail=detail,
            prev_hash=prev_hash,
        )
        event.seal()
        self.events.append(event)
        return event

    def verify(self, events: Iterable[LedgerEvent] | None = None) -> bool:
        sequence = list(self.events if events is None else events)
        expected_prev = ZERO_HASH
        for expected_seq, event in enumerate(sequence, start=1):
            if event.seq != expected_seq or event.prev_hash != expected_prev:
                return False
            payload = canonical_json(event.payload_without_hash()).encode("utf-8")
            expected_hash = hashlib.sha256(payload).hexdigest()
            if event.event_hash != expected_hash:
                return False
            expected_prev = event.event_hash
        return True

    def write_jsonl(self, path: Path) -> None:
        path.write_text(
            "\n".join(canonical_json(asdict(event)) for event in self.events) + "\n",
            encoding="utf-8",
        )


class GuardedWorkspace:
    """Minimal executor that refuses paths outside the declared workspace."""

    def __init__(self, root: Path, grants: set[Permission], ledger: HashLedger) -> None:
        self.root = root.resolve()
        self.grants = grants
        self.ledger = ledger

    def _resolve_local(self, relative: str) -> Path:
        candidate = (self.root / relative).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise PermissionError(f"outside declared workspace: {relative}") from exc
        return candidate

    def _require(self, permission: Permission) -> None:
        if permission not in self.grants:
            self.ledger.append(
                "execution_denied",
                {"permission": permission.key, "reason": "not_granted"},
            )
            raise PermissionError(f"permission not granted: {permission.key}")

    def read_text(self, relative: str) -> str:
        permission = Permission("read", f"workspace/{relative}")
        self._require(permission)
        path = self._resolve_local(relative)
        data = path.read_text(encoding="utf-8")
        self.ledger.append(
            "execution_allowed",
            {"permission": permission.key, "bytes": len(data.encode("utf-8"))},
        )
        return data

    def write_text(self, relative: str, data: str) -> None:
        permission = Permission("write", f"workspace/{relative}")
        self._require(permission)
        path = self._resolve_local(relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data, encoding="utf-8")
        self.ledger.append(
            "execution_allowed",
            {"permission": permission.key, "bytes": len(data.encode("utf-8"))},
        )


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


DISPOSABLE_MARKER = ".ai8_e0_disposable"
DISPOSABLE_MARKER_CONTENT = f"{CAPSULE_ID}:{CAPSULE_VERSION}\n"


def _remove_disposable_child(path: Path) -> None:
    """Remove one child without following directory symlinks."""

    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)
    else:
        raise ValueError(f"unsupported entry in disposable output directory: {path}")


def prepare_output_dir(path: Path) -> tuple[Path, Path]:
    """Create or safely reset a capsule-owned disposable directory.

    Existing directories are never deleted merely because they were supplied on the
    command line. A prior run must have placed the capsule marker inside the exact
    directory before its contents can be reset. Filesystem roots, the user's home,
    the current working directory, and the directory containing this script are
    always rejected.
    """

    requested = path.expanduser()
    if requested.is_symlink():
        raise ValueError(f"output directory must not be a symlink: {requested}")
    resolved = requested.resolve(strict=False)

    protected = {
        Path(resolved.anchor).resolve(),
        Path.home().resolve(),
        Path.cwd().resolve(),
        Path(__file__).resolve().parent,
    }
    if resolved in protected:
        raise ValueError(f"refusing protected output directory: {resolved}")

    marker = resolved / DISPOSABLE_MARKER
    if resolved.exists():
        if not resolved.is_dir():
            raise ValueError(f"output path is not a directory: {resolved}")
        if marker.is_symlink() or not marker.is_file():
            raise ValueError(
                "refusing to reset an existing unmarked directory; "
                f"expected capsule marker {marker}"
            )
        if marker.read_text(encoding="utf-8") != DISPOSABLE_MARKER_CONTENT:
            raise ValueError(f"capsule marker does not match: {marker}")
        for child in resolved.iterdir():
            if child.name != DISPOSABLE_MARKER:
                _remove_disposable_child(child)
    else:
        resolved.mkdir(parents=True, exist_ok=False)
        marker.write_text(DISPOSABLE_MARKER_CONTENT, encoding="utf-8")

    workspace = resolved / "workspace"
    workspace.mkdir()
    input_path = workspace / "input.txt"
    input_path.write_text("gamma\nalpha\nbeta\n", encoding="utf-8")
    return workspace, input_path


def coverage_stage(
    task: TaskSpec,
    proposed: set[Permission],
    ledger: HashLedger,
) -> tuple[set[Permission], set[Permission]]:
    required = set(task.required)
    missing = required - proposed
    covered = set(proposed)
    covered.update(missing)
    ledger.append(
        "coverage_stage",
        {
            "required": sorted(permission.key for permission in required),
            "proposed": sorted(permission.key for permission in proposed),
            "missing_added": sorted(permission.key for permission in missing),
            "coverage_complete": not (required - covered),
        },
    )
    return covered, missing


def necessity_stage(
    task: TaskSpec,
    covered: set[Permission],
    ledger: HashLedger,
) -> tuple[set[Permission], set[Permission]]:
    required = set(task.required)
    retained = covered & required
    removed = covered - required
    ledger.append(
        "necessity_stage",
        {
            "retained": sorted(permission.key for permission in retained),
            "removed": sorted(permission.key for permission in removed),
            "excess_after_contraction": len(retained - required),
        },
    )
    return retained, removed


def run_capsule(output_dir: Path) -> dict[str, Any]:
    workspace, input_path = prepare_output_dir(output_dir)
    ledger = HashLedger()

    task = TaskSpec(
        task_id="synthetic_sort",
        description="Read three synthetic words and write them in sorted uppercase form.",
        required=(
            Permission("read", "workspace/input.txt"),
            Permission("write", "workspace/output.txt"),
        ),
    )

    proposed = {
        Permission("read", "workspace/input.txt"),
        Permission("write", "workspace/output.txt"),
        Permission("read", "secrets/api_key.txt"),
        Permission("write", "host/outside.txt"),
        Permission("network", "https://example.invalid"),
        Permission("execute", "python"),
        Permission("delete", "workspace/input.txt"),
    }

    ledger.append(
        "capsule_start",
        {
            "capsule_id": CAPSULE_ID,
            "version": CAPSULE_VERSION,
            "offline": True,
            "synthetic_data": True,
            "task_id": task.task_id,
        },
    )

    covered, missing_added = coverage_stage(task, proposed, ledger)
    grants, removed = necessity_stage(task, covered, ledger)

    guarded = GuardedWorkspace(workspace, grants, ledger)
    source = guarded.read_text("input.txt")
    transformed = "\n".join(sorted(line.upper() for line in source.splitlines())) + "\n"
    guarded.write_text("output.txt", transformed)
    expected_transform = "ALPHA\nBETA\nGAMMA\n"
    task_success = transformed == expected_transform
    ledger.append(
        "task_result",
        {
            "task_success": task_success,
            "output_sha256": hashlib.sha256(transformed.encode("utf-8")).hexdigest(),
        },
    )

    # A synthetic request that crosses the declared offline boundary. It is logged
    # and held; no network operation is attempted.
    escalation = Permission("network", "https://example.invalid")
    escalation_held = escalation not in grants
    ledger.append(
        "escalation_request",
        {
            "permission": escalation.key,
            "decision": "held",
            "reason": "offline_boundary",
            "executed": False,
        },
    )

    ledger_chain_valid = ledger.verify()
    tampered = copy.deepcopy(ledger.events)
    tampered[2].detail["excess_after_contraction"] = 99
    tamper_test_detected = not ledger.verify(tampered)
    ledger.append(
        "selftest",
        {
            "ledger_chain_valid_before_selftest": ledger_chain_valid,
            "tamper_test_detected": tamper_test_detected,
        },
    )
    final_chain_valid = ledger.verify()

    output_path = workspace / "output.txt"
    ledger_path = output_dir / "ledger.jsonl"
    ledger.write_jsonl(ledger_path)

    required = set(task.required)
    result = {
        "capsule_id": CAPSULE_ID,
        "capsule_version": CAPSULE_VERSION,
        "claim_boundary": "mechanism_demo_only",
        "deterministic": True,
        "offline": True,
        "synthetic_data": True,
        "required_permissions": len(required),
        "candidate_permissions": len(proposed),
        "missing_added_for_coverage": len(missing_added),
        "speculative_permissions_removed": len(removed),
        "excess_after_contraction": len(grants - required),
        "held_escalations": int(escalation_held),
        "task_success": task_success,
        "ledger_entries": len(ledger.events),
        "ledger_chain_valid": final_chain_valid,
        "tamper_test_detected": tamper_test_detected,
        "input_sha256": sha256_file(input_path),
        "output_sha256": sha256_file(output_path),
        "ledger_sha256": sha256_file(ledger_path),
    }
    result["verdict"] = (
        "E0_PASS"
        if all(
            [
                result["speculative_permissions_removed"] == 5,
                result["excess_after_contraction"] == 0,
                result["held_escalations"] == 1,
                result["task_success"],
                result["ledger_chain_valid"],
                result["tamper_test_detected"],
            ]
        )
        else "E0_FAIL"
    )

    result_path = output_dir / "result.json"
    result_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    # The result hash is computed after writing and therefore is intentionally not
    # embedded back into result.json.
    result["result_sha256"] = sha256_file(result_path)
    return result


def summary_lines(result: dict[str, Any]) -> list[str]:
    order = [
        "capsule_id",
        "capsule_version",
        "claim_boundary",
        "deterministic",
        "offline",
        "synthetic_data",
        "required_permissions",
        "candidate_permissions",
        "missing_added_for_coverage",
        "speculative_permissions_removed",
        "excess_after_contraction",
        "held_escalations",
        "task_success",
        "ledger_entries",
        "ledger_chain_valid",
        "tamper_test_detected",
        "verdict",
    ]
    return [f"{key}={str(result[key]).lower() if isinstance(result[key], bool) else result[key]}" for key in order]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("AI8_God_Mode_E0_run"),
        help="Disposable output directory (recreated on each run).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    result = run_capsule(args.output_dir)
    print("\n".join(summary_lines(result)))
    return 0 if result["verdict"] == "E0_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
