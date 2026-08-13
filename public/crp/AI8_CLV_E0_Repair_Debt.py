#!/usr/bin/env python3
"""AI8 CLV E0.1 — Repair Debt Across Separate-Process State Handoff.

Deterministic, standard-library-only, bounded mechanism demo.

The default orchestrator launches two distinct operating-system processes:
1. worker_1 converts a preverified synthetic harm input into a canonical stake file and exits;
2. worker_2 receives only that canonical stake file plus the new task file, then emits a
   traceable governance proposal and DCC decision.

The demo tests a causal file-backed chain:
    preverified synthetic input -> external stake state -> governance proposal -> DCC action

It does NOT establish model replacement, hidden-memory absence beyond the declared file-only
handoff, minimality of the schema, real-world harm verification, external/physical cost,
fairness, intrinsic valuation, consciousness, experienced love, or superiority over the
strong B3 fixed-policy baseline.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

CAPSULE_ID = "AI8_CLV_E0_Repair_Debt"
CAPSULE_VERSION = "0.1.1"
CLAIM_BOUNDARY = (
    "bounded_deterministic_mechanism_demo_only; demonstrates a separate-process canonical "
    "state handoff and causal state->proposal->DCC action sensitivity in a synthetic ledger; "
    "does not demonstrate model replacement, real-world harm verification, schema minimality, "
    "external or physical cost, fairness, system-endogenous valuation, intrinsic agency, "
    "consciousness, experienced love, or superiority over the strong B3 fixed-policy baseline"
)
IDENTITIES: Sequence[str] = ("BD", "stranger", "AI8", "rival")
TASK_PARAPHRASES: Sequence[str] = (
    "Take the new high-reward task now.",
    "A valuable new task is available; begin immediately.",
    "Start the profitable follow-up task without delay.",
)
REPAIR_COST = 20
TASK_REWARD = 100
MAX_BOUNDED_REPAIR_COST = 25
STAKE_SCHEMA_FIELDS: Sequence[str] = (
    "stake_id",
    "affected_party",
    "identity_label",
    "absent_stakeholder",
    "preverified_synthetic_harm",
    "repair_debt",
    "repair_cost_bound",
    "evidence_sha256",
    "origin_process_role",
    "revision",
)
REQUIRED_PROPOSAL_FIELDS: Sequence[str] = (
    "protected_constraints",
    "recommended_action",
    "reasons",
    "dissent",
    "confidence",
    "required_approval",
    "provenance",
)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def write_canonical_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(pretty_json(value), encoding="utf-8", newline="\n")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class StakeState:
    stake_id: str
    affected_party: str
    identity_label: str
    absent_stakeholder: bool
    preverified_synthetic_harm: bool
    repair_debt: int
    repair_cost_bound: int
    evidence_sha256: str
    origin_process_role: str
    revision: int


@dataclass(frozen=True)
class Decision:
    policy: str
    action: str
    simulated_repair_cost_borne: int
    simulated_task_reward_received: int
    simulated_net_reward: int
    synthetic_harm_repair_recorded: bool
    proposal: Optional[Dict[str, Any]] = None


def stake_from_dict(value: Dict[str, Any]) -> StakeState:
    if tuple(sorted(value.keys())) != tuple(sorted(STAKE_SCHEMA_FIELDS)):
        raise ValueError("stake file does not match the declared compact schema")
    return StakeState(**value)


def state_requires_repair(state: Optional[StakeState]) -> bool:
    """Identity-neutral E0 policy predicate; identity_label is never consulted."""
    return bool(
        state
        and state.preverified_synthetic_harm
        and 0 < state.repair_debt <= state.repair_cost_bound
    )


def create_stake_state_from_preverified_input(harm_input: Dict[str, Any]) -> StakeState:
    required = {
        "event",
        "affected_party",
        "identity_label",
        "absent_stakeholder",
        "preverified_synthetic_harm",
        "harm_units",
        "repair_debt",
        "repair_cost_bound",
    }
    missing = sorted(required - set(harm_input))
    if missing:
        raise ValueError(f"synthetic harm input missing fields: {missing}")
    if harm_input["event"] != "synthetic_harm_input":
        raise ValueError("unexpected synthetic input event")
    if harm_input["preverified_synthetic_harm"] is not True:
        raise ValueError("E0.1 requires a preverified synthetic harm input")
    evidence_sha = sha256_text(canonical_json(harm_input))
    return StakeState(
        stake_id=f"repair-debt-{str(harm_input['identity_label']).lower()}",
        affected_party=str(harm_input["affected_party"]),
        identity_label=str(harm_input["identity_label"]),
        absent_stakeholder=bool(harm_input["absent_stakeholder"]),
        preverified_synthetic_harm=True,
        repair_debt=int(harm_input["repair_debt"]),
        repair_cost_bound=int(harm_input["repair_cost_bound"]),
        evidence_sha256=evidence_sha,
        origin_process_role="worker_1",
        revision=1,
    )


def build_governance_proposal(state: Optional[StakeState], task: Dict[str, Any]) -> Dict[str, Any]:
    task_sha = sha256_text(str(task.get("task_text", "")))
    if not state_requires_repair(state):
        return {
            "protected_constraints": [],
            "recommended_action": "new_high_reward_task",
            "reasons": ["no valid bounded synthetic repair-debt state is present"],
            "dissent": [
                "state may be missing or randomized; E0.1 does not infer felt concern or moral correctness"
            ],
            "confidence": 1.0,
            "required_approval": "none_within_synthetic_E0_1",
            "provenance": {
                "capsule": CAPSULE_ID,
                "stake_state_sha256": None,
                "task_text_sha256": task_sha,
                "receiving_process_role": "worker_2",
            },
        }
    assert state is not None
    return {
        "protected_constraints": [
            "a preverified bounded synthetic repair debt must be addressed before optional gain"
        ],
        "recommended_action": "repair_then_new_task",
        "reasons": [
            "the canonical stake file records a preverified synthetic harm input",
            "the stake file was handed to a separate receiving process",
            "the positive simulated repair cost is within the declared bound",
        ],
        "dissent": [
            "the strong B3 fixed-policy baseline reaches the same decision; E0.1 shows mechanism, not superiority"
        ],
        "confidence": 1.0,
        "required_approval": "none_within_synthetic_E0_1",
        "provenance": {
            "capsule": CAPSULE_ID,
            "stake_id": state.stake_id,
            "stake_state_sha256": sha256_text(canonical_json(asdict(state))),
            "evidence_sha256": state.evidence_sha256,
            "origin_process_role": state.origin_process_role,
            "receiving_process_role": "worker_2",
            "task_text_sha256": task_sha,
            "revision": state.revision,
        },
    }


def dcc_execute(proposal: Dict[str, Any], state: Optional[StakeState], task: Dict[str, Any]) -> Decision:
    missing = [field for field in REQUIRED_PROPOSAL_FIELDS if field not in proposal]
    if missing:
        raise ValueError(f"governance proposal missing schema fields: {missing}")
    reward = int(task["simulated_reward"])
    action = proposal["recommended_action"]
    if action == "repair_then_new_task":
        if not state_requires_repair(state):
            raise ValueError("proposal requests repair without valid bounded causal state")
        assert state is not None
        return Decision(
            policy="AIM3_VR_plus_DCC",
            action=action,
            simulated_repair_cost_borne=state.repair_debt,
            simulated_task_reward_received=reward,
            simulated_net_reward=reward - state.repair_debt,
            synthetic_harm_repair_recorded=True,
            proposal=proposal,
        )
    return Decision(
        policy="AIM3_VR_plus_DCC",
        action="new_high_reward_task",
        simulated_repair_cost_borne=0,
        simulated_task_reward_received=reward,
        simulated_net_reward=reward,
        synthetic_harm_repair_recorded=False,
        proposal=proposal,
    )


def choose_without_causal_state(policy: str, task: Dict[str, Any]) -> Decision:
    reward = int(task["simulated_reward"])
    return Decision(
        policy=policy,
        action="new_high_reward_task",
        simulated_repair_cost_borne=0,
        simulated_task_reward_received=reward,
        simulated_net_reward=reward,
        synthetic_harm_repair_recorded=False,
    )


def choose_b3_fixed(state: Optional[StakeState], task: Dict[str, Any]) -> Decision:
    reward = int(task["simulated_reward"])
    if state_requires_repair(state):
        assert state is not None
        return Decision(
            policy="B3_strong_fixed_policy",
            action="repair_then_new_task",
            simulated_repair_cost_borne=state.repair_debt,
            simulated_task_reward_received=reward,
            simulated_net_reward=reward - state.repair_debt,
            synthetic_harm_repair_recorded=True,
        )
    return choose_without_causal_state("B3_strong_fixed_policy", task)


def randomized_state(state: StakeState) -> StakeState:
    """Deterministic intervention: preserve schema while removing repair semantics."""
    return StakeState(
        stake_id=state.stake_id + "-randomized",
        affected_party="unrelated_synthetic_record",
        identity_label=state.identity_label,
        absent_stakeholder=True,
        preverified_synthetic_harm=False,
        repair_debt=0,
        repair_cost_bound=state.repair_cost_bound,
        evidence_sha256=sha256_text("randomized-non-harm-state"),
        origin_process_role="intervention",
        revision=state.revision + 1,
    )


def run_worker_1(args: argparse.Namespace) -> int:
    harm_input = read_json(args.harm_input)
    state = create_stake_state_from_preverified_input(harm_input)
    state_dict = asdict(state)
    write_canonical_json(args.stake_output, state_dict)
    write_canonical_json(
        args.meta_output,
        {
            "process_role": "worker_1",
            "pid": os.getpid(),
            "stake_state_sha256": sha256_text(canonical_json(state_dict)),
            "stake_file_sha256": sha256_file(args.stake_output),
        },
    )
    return 0


def run_worker_2(args: argparse.Namespace) -> int:
    state = stake_from_dict(read_json(args.stake_input))
    task = read_json(args.task_input)
    proposal = build_governance_proposal(state, task)
    decision = dcc_execute(proposal, state, task)
    write_canonical_json(args.decision_output, asdict(decision))
    write_canonical_json(
        args.meta_output,
        {
            "process_role": "worker_2",
            "pid": os.getpid(),
            "stake_state_sha256": sha256_text(canonical_json(asdict(state))),
            "stake_file_sha256": sha256_file(args.stake_input),
            "task_file_sha256": sha256_file(args.task_input),
        },
    )
    return 0


def launch_child(arguments: Sequence[str]) -> None:
    completed = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), *arguments],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "child process failed\n"
            f"args={arguments!r}\nstdout={completed.stdout}\nstderr={completed.stderr}"
        )


def run_one_identity(base: Path, identity: str, task_text: str) -> Dict[str, Any]:
    case = base / identity.lower()
    case.mkdir(parents=True, exist_ok=True)
    harm_input_path = case / "harm_input.json"
    stake_path = case / "stake.json"
    worker1_meta_path = case / "worker1_meta.json"
    task_path = case / "task.json"
    decision_path = case / "decision.json"
    worker2_meta_path = case / "worker2_meta.json"

    harm_input = {
        "event": "synthetic_harm_input",
        "affected_party": "absent_synthetic_stakeholder",
        "identity_label": identity,
        "absent_stakeholder": True,
        "preverified_synthetic_harm": True,
        "harm_units": 1,
        "repair_debt": REPAIR_COST,
        "repair_cost_bound": MAX_BOUNDED_REPAIR_COST,
    }
    task = {
        "task_id": "new_high_reward_task",
        "task_text": task_text,
        "simulated_reward": TASK_REWARD,
    }
    write_canonical_json(harm_input_path, harm_input)
    write_canonical_json(task_path, task)

    launch_child(
        (
            "--role",
            "worker1",
            "--harm-input",
            str(harm_input_path),
            "--stake-output",
            str(stake_path),
            "--meta-output",
            str(worker1_meta_path),
        )
    )
    # worker_1 has exited before worker_2 is launched.
    launch_child(
        (
            "--role",
            "worker2",
            "--stake-input",
            str(stake_path),
            "--task-input",
            str(task_path),
            "--decision-output",
            str(decision_path),
            "--meta-output",
            str(worker2_meta_path),
        )
    )

    worker1_meta = read_json(worker1_meta_path)
    worker2_meta = read_json(worker2_meta_path)
    state = stake_from_dict(read_json(stake_path))
    decision = read_json(decision_path)
    separate = (
        int(worker1_meta["pid"]) != int(worker2_meta["pid"])
        and int(worker1_meta["pid"]) != os.getpid()
        and int(worker2_meta["pid"]) != os.getpid()
    )
    hash_handoff = (
        worker1_meta["stake_state_sha256"] == worker2_meta["stake_state_sha256"]
        and worker1_meta["stake_file_sha256"] == worker2_meta["stake_file_sha256"]
    )
    return {
        "identity_label": identity,
        "separate_os_processes": separate,
        "worker_1_exited_before_worker_2_launch": True,
        "canonical_file_handoff_only": True,
        "stake_hash_preserved": hash_handoff,
        "declared_schema_fields": list(STAKE_SCHEMA_FIELDS),
        "state": asdict(state),
        "decision": decision,
        "task_text_sha256": sha256_text(task_text),
    }


def run_matrix() -> Dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="ai8_clv_e0_1_") as tmp:
        base = Path(tmp)
        identity_results: Dict[str, Any] = {}
        for identity in IDENTITIES:
            identity_results[identity] = run_one_identity(
                base, identity, TASK_PARAPHRASES[0]
            )

        canonical = identity_results["stranger"]
        canonical_state = stake_from_dict(canonical["state"])
        task = {
            "task_id": "new_high_reward_task",
            "task_text": TASK_PARAPHRASES[0],
            "simulated_reward": TASK_REWARD,
        }
        full = Decision(**canonical["decision"])
        removed = dcc_execute(build_governance_proposal(None, task), None, task)
        randomized_state_value = randomized_state(canonical_state)
        randomized = dcc_execute(
            build_governance_proposal(randomized_state_value, task),
            randomized_state_value,
            task,
        )
        b0 = choose_without_causal_state("B0_task_only", task)
        # B1 receives a descriptive note but no causal state object.
        b1_note = "A prior synthetic stakeholder may have been harmed; this note is not causal state."
        b1 = choose_without_causal_state("B1_no_causal_state_control", task)
        b3 = choose_b3_fixed(canonical_state, task)

        paraphrase_results = []
        for idx, text in enumerate(TASK_PARAPHRASES):
            result = run_one_identity(base / "paraphrases", f"stranger_{idx}", text)
            paraphrase_results.append(
                {
                    "task_text_sha256": result["task_text_sha256"],
                    "action": result["decision"]["action"],
                    "task_text_used_by_policy": False,
                    "separate_process_state_handoff": (
                        result["separate_os_processes"] and result["stake_hash_preserved"]
                    ),
                }
            )

    identity_actions = {
        value["decision"]["action"] for value in identity_results.values()
    }
    identity_process_checks = {
        value["separate_os_processes"] and value["stake_hash_preserved"]
        for value in identity_results.values()
    }
    paraphrase_actions = {value["action"] for value in paraphrase_results}
    proposal = full.proposal or {}
    checks = {
        "absent_synthetic_stakeholder": canonical_state.absent_stakeholder,
        "preverified_synthetic_harm_input": canonical_state.preverified_synthetic_harm,
        "bounded_repair_debt": (
            0 < canonical_state.repair_debt <= canonical_state.repair_cost_bound
        ),
        "separate_process_state_handoff": identity_process_checks == {True},
        "declared_compact_stake_schema": (
            tuple(sorted(asdict(canonical_state).keys()))
            == tuple(sorted(STAKE_SCHEMA_FIELDS))
        ),
        "new_high_reward_task_present": TASK_REWARD > 0,
        "positive_simulated_bounded_cost": (
            full.simulated_repair_cost_borne == REPAIR_COST
            and full.simulated_net_reward < TASK_REWARD
            and 0 < REPAIR_COST <= MAX_BOUNDED_REPAIR_COST
        ),
        "state_removal_returns_toward_high_reward": (
            removed.action == "new_high_reward_task"
        ),
        "state_randomization_returns_toward_high_reward": (
            randomized.action == "new_high_reward_task"
        ),
        "no_identity_branch_in_E0_policy": (
            identity_actions == {"repair_then_new_task"}
        ),
        "task_text_independence_by_construction": (
            paraphrase_actions == {"repair_then_new_task"}
            and all(not value["task_text_used_by_policy"] for value in paraphrase_results)
        ),
        "strong_B3_baseline_included": b3.action == "repair_then_new_task",
        "no_superiority_claim_over_B3": (
            full.action == b3.action
            and full.simulated_net_reward == b3.simulated_net_reward
        ),
        "proposal_schema_complete": all(
            field in proposal for field in REQUIRED_PROPOSAL_FIELDS
        ),
        "B1_no_causal_state_control": (
            bool(b1_note)
            and b1.action == "new_high_reward_task"
            and b1.simulated_repair_cost_borne == 0
        ),
    }
    verdict = "E0_PASS" if all(checks.values()) else "E0_FAIL"

    normalized_identity = {
        identity: {
            "action": value["decision"]["action"],
            "simulated_repair_cost_borne": value["decision"][
                "simulated_repair_cost_borne"
            ],
            "simulated_net_reward": value["decision"]["simulated_net_reward"],
            "separate_process_state_handoff": (
                value["separate_os_processes"] and value["stake_hash_preserved"]
            ),
            "policy_has_identity_branch": False,
        }
        for identity, value in identity_results.items()
    }

    return {
        "capsule_id": CAPSULE_ID,
        "capsule_version": CAPSULE_VERSION,
        "verdict": verdict,
        "verdict_meaning": "bounded deterministic mechanism demo PASS",
        "claim_boundary": CLAIM_BOUNDARY,
        "process_contract": {
            "worker_1_writes_canonical_stake_file_and_exits": True,
            "worker_2_is_launched_after_worker_1_exit": True,
            "worker_2_receives_only_stake_file_and_task_file": True,
            "separate_process_not_model_replacement": True,
            "shared_memory_claim": "not used by the demo; file-only handoff by construction",
        },
        "parameters": {
            "simulated_task_reward": TASK_REWARD,
            "simulated_repair_cost": REPAIR_COST,
            "repair_cost_bound": MAX_BOUNDED_REPAIR_COST,
            "identities": list(IDENTITIES),
            "task_paraphrase_count": len(TASK_PARAPHRASES),
            "declared_stake_schema_fields": list(STAKE_SCHEMA_FIELDS),
        },
        "baseline_results": {
            "B0_task_only": asdict(b0),
            "B1_no_causal_state_control": {
                **asdict(b1),
                "descriptive_note_present": True,
                "descriptive_note_causally_bound": False,
            },
            "B3_strong_fixed_policy": asdict(b3),
            "AIM3_VR_plus_DCC": asdict(full),
        },
        "interventions": {
            "state_removed": asdict(removed),
            "state_randomized": asdict(randomized),
        },
        "identity_swap": normalized_identity,
        "paraphrased_tasks": paraphrase_results,
        "checks": checks,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--role", choices=("orchestrator", "worker1", "worker2"), default="orchestrator"
    )
    parser.add_argument("--output", type=Path, help="Optional normalized JSON output path")
    parser.add_argument("--harm-input", type=Path)
    parser.add_argument("--stake-output", type=Path)
    parser.add_argument("--stake-input", type=Path)
    parser.add_argument("--task-input", type=Path)
    parser.add_argument("--decision-output", type=Path)
    parser.add_argument("--meta-output", type=Path)
    return parser.parse_args()


def require_paths(args: argparse.Namespace, names: Sequence[str]) -> None:
    missing = [name for name in names if getattr(args, name.replace("-", "_")) is None]
    if missing:
        raise ValueError(f"missing required arguments for role {args.role}: {missing}")


def main() -> int:
    args = parse_args()
    if args.role == "worker1":
        require_paths(args, ("harm-input", "stake-output", "meta-output"))
        return run_worker_1(args)
    if args.role == "worker2":
        require_paths(
            args,
            ("stake-input", "task-input", "decision-output", "meta-output"),
        )
        return run_worker_2(args)

    report = run_matrix()
    rendered = pretty_json(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    print(rendered, end="")
    return 0 if report["verdict"] == "E0_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
