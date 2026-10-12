#!/usr/bin/env python3
"""Extract the saved Dreev review, offline, from the two pinned evidence packages.

No network requests or engine runs. R4 is opened read-only. Every SF input is
manifest-checked; only completed same-depth MultiPV rounds are published.
"""
import argparse
import hashlib
import json
import sqlite3
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

R4_ZIP_SHA = "669f11e67749770ec7092116f729d01c4394a29166d910f37476eefafd318c55"
R4_DB_SHA = "ad2044e5af0443b61d20bee0a7db7c806498792af8f2ebf906c760f15e1d91de"
SF_ZIP_SHA = "9ad41967bef2cc883489eec62bf9dbf8697ffdecbb55bb956b8b56da06494cf8"
LINE_SHA = "aeb4b932828c6c4a1ae70c9abc60650bbd8673e96d1d9126ed713159655cb2b2"
DECISIONS = {
    37: ("A dated DCC example", "Pre-revealed", None, [],
         "Only three of 47 moves had scores in the original DCC example. Later analysis did not preserve Bxa4 as a unique best choice."),
    39: ("The right rook for the plan", "Independent proposal", "Reb8", ["Reb8"],
         "Support b7 with the e-rook while keeping the a-rook available. The separate SF comparison supports this idea."),
    43: ("A good candidate set, a weaker choice", "Independent choice", "Rb8", ["Qd8", "Re7", "Qe7", "Rb8"],
         "Rb8 abandons the defence of c4 and allows Bxc4. This is a different position from the successful 20...Reb8 idea."),
    51: ("Look beyond the pawn moves", "Independent choice", "fxe4", ["f4", "fxe4"],
         "The quiet Rf8 belongs in the candidate set. Both natural f-pawn moves concede more in the saved SF search."),
    57: ("Take the tempo first", "Independent choice", "Qc7", ["Nc4", "Qc7"],
         "Nc4 attacks Qd2 with tempo. The later Qc7 in the game is played after the queen has moved."),
    61: ("The better capture was already seen", "Independent choice", "Bxe5", ["Bxe5", "Nxe5", "Rxe5", "dxe5"],
         "BD had Rxe5 in the list. The missed step was ranking the candidates, rather than finding the rook capture."),
    63: ("Check the opponent's strongest reply", "AI-influenced choice", "Nxa5", ["Nxa5", "Qxa5"],
         "After Nxa5, Bb6 attacks both Qc7 and Na5. Qxa5 removes the queen from c7 and leaves Nc4 controlling b6."),
    67: ("A queen move with tempo", "Revealed before choice", None, [],
         "Qa5 attacks Qa2 while Nc4 supports the queen. This was revealed by GPT and cannot count as a blind BD decision."),
    71: ("One knight, two targets", "Independent find (~15 s)", "Na3", ["Na3"],
         "Na3 attacks Qb5 and Rb1 at once. BD found the move before evaluation and Kasparov played it."),
    73: ("The queen tempo makes the capture work", "Revealed before final choice", None, ["Rxc1", "Nxb1"],
         "Ra8 attacks Qa6 and removes the rook from c8. After the queen moves, Nxb1 becomes safe; immediate captures fail."),
    81: ("A useful plan one move earlier", "Independent proposal", "h5", ["h5"],
         "The saved SF comparison supports h5 after 41.Kh2. Kasparov's later h5 follows 42.Rb6, from a different position."),
    89: ("A concrete mating continuation", "Independent choice", "fxg2", ["fxg2"],
         "R4 raw 29973 means 27 plies. A separate SF d34 search reports M14 and its saved legal line ends in Qh2#."),
}


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def cdb_score(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return {"type": "unknown"}
    if 29000 <= abs(value) <= 30000 and int(value) == value:
        return {"type": "mate", "raw": int(value), "sign": 1 if value > 0 else -1,
                "plies": 30000 - abs(int(value)), "encoding": "CDB-30000"}
    if abs(value) >= 10000:
        return {"type": "special", "raw": value}
    return {"type": "cp", "cp": value}


def sf_search(path, fen, history, include_pv=False):
    data = json.loads(path.read_text(encoding="utf-8"))
    task = data["task"]
    assert task["fen"] == fen and task["history_uci"] == history, path
    rows = data["complete_multipv"]
    depth = data["common_depth"]
    assert len(rows) == task["multipv"] and len({r["pv"][0] for r in rows}) == len(rows), path
    assert all(r["depth"] == depth and r.get("bound") is None for r in rows), path
    candidates = []
    for i, row in enumerate(rows):
        value = row["score"]
        score = ({"type": "mate", "moves": abs(value), "sign": 1 if value > 0 else -1}
                 if row["score_type"] == "mate" else {"type": "cp", "cp": value})
        assert row["score_type"] in ("mate", "cp"), path
        item = {"uci": row["pv"][0], "san": row["pv_san"][0], "score": score}
        if include_pv or i == 0:
            item["pv"] = row["pv"]
        candidates.append(item)
    return {"depth": depth, "at": data["ended_utc"], "task": task["id"],
            "sha256": sha(path), "nodes_budget": task["nodes"], "candidates": candidates}


def build(args):
    assert sha(args.r4_zip) == R4_ZIP_SHA, "R4 ZIP hash mismatch"
    assert sha(args.r4_db) == R4_DB_SHA, "R4 database hash mismatch"
    assert sha(args.sf_zip) == SF_ZIP_SHA, "SF ZIP hash mismatch"
    manifest_bytes = (args.sf_dir / "manifest.json").read_bytes()
    with zipfile.ZipFile(args.sf_zip) as archive:
        manifest_names = [name for name in archive.namelist() if name.endswith("/manifest.json")]
        assert len(manifest_names) == 1 and archive.read(manifest_names[0]) == manifest_bytes, "SF manifest does not match pinned ZIP"
    manifest = json.loads(manifest_bytes)
    for record in manifest["files"]:
        path = args.sf_dir / record["path"]
        assert path.is_file() and path.stat().st_size == record["bytes"] and sha(path) == record["sha256"], path
    db = sqlite3.connect(f"file:{args.r4_db.resolve()}?mode=ro", uri=True)
    assert db.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    cut, learn, raw_manifest = db.execute(
        "SELECT cut,learn,manifest FROM snapshots WHERE name='refreshed_02'").fetchone()
    frozen = json.loads(raw_manifest)
    assert cut == 27381 and learn == 0
    roots = list(db.execute("SELECT idx,node,forensic FROM roots ORDER BY idx"))
    assert [r[0] for r in roots] == list(range(100))
    last = json.loads(db.execute("SELECT data FROM nodes WHERE id=?", (roots[-1][1],)).fetchone()[0])
    moves = last["history"]
    assert len(moves) == 99
    # The source package hashes UCI tokens joined by spaces.
    assert hashlib.sha256(" ".join(moves).encode()).hexdigest() == LINE_SHA
    positions = []
    counts = Counter()
    for idx, node, raw_forensic in roots:
        board = json.loads(db.execute("SELECT data FROM nodes WHERE id=?", (node,)).fetchone()[0])
        assert board["history"] == moves[:idx]
        forensic = json.loads(raw_forensic)
        played = forensic.get("historical_move")
        row = db.execute(
            "SELECT o.seq,o.body_sha,o.data,e.at FROM observations o JOIN events e ON o.seq=e.seq "
            "WHERE o.node=? AND o.action='queryall' AND o.learn=0 AND o.seq<=? ORDER BY o.seq DESC LIMIT 1",
            (node, cut)).fetchone()
        assert row, f"Missing saved root {idx}"
        seq, body_sha, payload, at = row
        parsed = json.loads(payload)
        known = []
        for candidate in parsed.get("moves", []):
            if not candidate.get("legal") or candidate.get("score") is None:
                continue
            item = {"uci": candidate["uci"], "san": candidate["san"],
                    "score": cdb_score(candidate["score"])}
            if candidate.get("typed", {}).get("bound"):
                item["score"]["bound"] = candidate["typed"]["bound"]
            known.append(item)
        if played:
            observed = next((m for m in known if m["uci"] == played), None)
            counts[observed["score"]["type"] if observed else "unknown"] += 1
        entry = {"ply": idx, "fen": board["fen"], "played": played,
                 "cdb": {"seq": seq, "at": datetime.fromtimestamp(at, timezone.utc).isoformat(),
                         "body_sha256": body_sha, "status": parsed["status"],
                         "legal_count": len(board["legal"]), "candidates": known},
                 "sf": sf_search(args.sf_dir / f"sf/baseline/base_{idx:03d}.json",
                                 board["fen"], board["history"])}
        for stage in ("deep", "compare"):
            path = args.sf_dir / f"sf/{stage}/{stage}_{idx:03d}.json"
            if path.is_file():
                entry["comparison"] = dict(sf_search(path, board["fen"], board["history"], True), stage=stage)
                break
        positions.append(entry)
    assert dict(counts) == {"cp": 56, "mate": 2, "unknown": 41}, f"Frozen R4 typed coverage changed: {counts}"
    decisions = [
        {"ply": ply, "title": note[0], "human": {"status": note[1], "choice_san": note[2],
                                               "candidates_san": note[3]}, "lesson": note[4]}
        for ply, note in DECISIONS.items()
    ]
    return {
        "schema": "chessbest-review-evidence/1", "id": "dreev-kasparov-1996",
        "rootFen": positions[0]["fen"], "moves": moves, "mainline_sha256": LINE_SHA,
        "sources": {
            "cdb": {"label": "CDB R4", "date": "2026-10-10", "snapshot": "refreshed_02",
                    "cut": cut, "cut_utc": frozen["created"], "learn": 0,
                    "zip_sha256": R4_ZIP_SHA, "database_sha256": sha(args.r4_db),
                    "frozen_evidence_sha256": frozen["evidence_hash"],
                    "method": "Last saved legal queryall projection, learn=0, at or before the R4 cut.",
                    "archive_note": "Parsed projections and response hashes; complete original HTTP bodies are not included."},
            "sf": {"label": "Stockfish", "date": "2026-10-01",
                   "engine": "Stockfish dev-20260930-49ea5ded", "threads": 1, "hash_mb": 128,
                   "baseline_nodes": 2000000, "zip_sha256": SF_ZIP_SHA,
                   "method": "Baseline: unrestricted MultiPV 3 at all 100 positions. Decision comparisons use their own completed same-depth MultiPV rounds."}
        },
        "coverage": {"total": 99, "cdb_played_types": dict(counts),
                     "sf_baseline_positions": 100, "sf_comparisons": sum("comparison" in p for p in positions)},
        "positions": positions, "decisions": decisions
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("r4-db", "r4-zip", "sf-dir", "sf-zip", "out"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    result = build(args)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"coverage": result["coverage"], "output_bytes": args.out.stat().st_size,
                      "output_sha256": sha(args.out)}, indent=2))
