# 8Z Control v0.1 — architecture and state schema

`index-todo.html` is the view. The three JSON files under `public/data/` are the canonical operational state. A daily refresh changes data first; the view renders it without a daily HTML rewrite.

## Boundary and evidence policy

- Authoritative scan boundary: **project chats only** across ChatGPT projects.
- Project files may corroborate a current run, checkpoint, result, builder handoff, or resume state.
- Non-project chats are never a daily source. If a meaningful orphan is found during a one-off review, record a migration need and move its authority to an appropriate project context before it joins the daily scan.
- Evidence priority: newer direct evidence (fresh CMD/output, live extract, checkpoint, PID/process proof, explicit BD confirmation) beats an older summary.
- `ready`, `next`, `resume`, `planned`, `builder`, and `handoff` are not evidence that a process is running.
- Absence of a newer message never changes `RUNNING` to a stopped state by itself.

## Files

| File | Role |
|---|---|
| `public/data/BD_MASTER_ARENA_REGISTER_LATEST.json` | Current source of truth for arenas, state history, corrections, provenance, and compact safe operational detail. |
| `public/data/BD_PROJECT_STATE_LATEST.json` | Project roll-up, machine facts, family order, and the small explicit Needs BD set. |
| `public/data/BD_MORNING_DELTA_LATEST.json` | Material changes since the previous successful refresh only. |
| `public/index-todo.html` | Static, dependency-free client view that fetches the three files and renders 8Z Control. |

The files are public-safe operational summaries. They must not contain API keys, passwords, private filesystem paths, protected 8zShield material, MAL internals, or sensitive trading rules.

## Arena schema

Every `arenas[]` item has a stable `arena_id` and at least:

```json
{
  "arena_id": "stable-kebab-id",
  "family": "TSP | Trading | …",
  "project": "Project name",
  "name": "Arena name",
  "version": "version or null",
  "branch": "branch or null",
  "status": "RUNNING | STANDBY | NEXT | BUILD | TEST | BLOCKED | DONE | UNCERTAIN",
  "running": false,
  "resume_ready": false,
  "last_verified_at": "ISO time/date or null",
  "last_verified_source": "short proof description",
  "source_chat": "authoritative project chat",
  "evidence_type": "direct/indirect proof type",
  "checkpoint": "short safe checkpoint or null",
  "best_result": "short safe result or null",
  "progress": "short state/progress",
  "workers": "known workers or null",
  "machine": "Home PC | Work PC | null",
  "next_action": "next safe action",
  "attention": "OK | WATCH | ACTION",
  "confidence": "HIGH | MEDIUM | LOW",
  "notes": "short safe qualification"
}
```

`running` must be `true` only with `status: "RUNNING"`. `ACTION` means BD has a concrete decision or operation to perform; it is not a generic reminder.

## Material change log

`state_history` retains only material changes: status transition, new best, significant checkpoint, crash, resume, completion, new version, new arena, or state correction. Each entry contains timestamp, arena ID, old/new status/value, evidence, source project chat, and confidence. Do not append cosmetic wording edits or repeated unchanged extracts.

## Refresh algorithm

1. Read the last successful register and delta.
2. Scan only project chats changed since the last successful refresh, then check every `RUNNING` arena for later direct evidence of alive/progress/best/checkpoint/stop/crash/required action.
3. Normalize each finding against the evidence policy. Preserve active processes unless later direct stop/failure evidence exists.
4. Update arena records, project roll-up/machine facts, and the material `state_history`.
5. Compute `BD_MORNING_DELTA_LATEST.json`. If there is no material change, set its `changes` to `[]` and use the exact no-change message; do not invent a delta.
6. Validate JSON, stable/unique IDs, status counters, running count, references, and public-safety rules.
7. Commit only the changed data files (and an implementation/documentation file only when necessary) to `main`; the existing GitHub → Netlify deployment remains the deployment path.
8. On a material change, also write date-stamped register/control snapshots. Do not create snapshots for a no-change refresh.

## View behavior

The page renders, in this order on mobile:

1. counters and state freshness;
2. Morning Delta;
3. Needs BD;
4. Running Arenas;
5. Standby Arsenal;
6. Build / Test / Next;
7. Projects and Compute.

Search and filters are client-side and dependency-free. `RUNNING` remains first even when a user applies another non-running filter. If JSON cannot be fetched, the view shows an explicit unavailable/fallback notice rather than stale invented state.

### v0.1.1 compact arena index

Each status group is an index of collapsed arena rows: name, expansion arrow, and only a small `WATCH`/`ACTION` dot or current Morning Delta `Δ` marker when applicable. Expanding a row reveals the safe evidence fields. Multiple arena rows can remain open for comparison; this is deliberately not an accordion.

Stable deep links use the canonical `arena_id`, for example `index-todo.html#arena=tsp-dev23-nu3496`. A link clears transient filters, opens the required status group and arena, then scrolls to that record. `Open all` and `Collapse all` operate on the arenas matching the active filters; opening also reveals the relevant status groups. `Collapse all` restores a compact catalogue view without changing canonical state.

Run `node scripts/validate-8z-control-state.js` before every state commit. It validates all three JSON files, IDs, state/counter coherence, project and delta references, and a conservative public-safety pattern check.

## Deployment and rollback

The repository production branch is `main`. Before a refresh writes data, fetch `origin/main`, verify the base, and keep commits small and descriptive. Git history is the rollback path. Do not change Netlify secrets, MAL secrets, 8zShield cryptography, or deployment infrastructure for this control layer.

## Initial baseline

The v0.1 baseline is dated 2026-09-10. Its Morning Delta intentionally contains only material corrections established during the authoritative project-chat review, including the direct-evidence correction that TSP DEV2.3 is `RUNNING`.
