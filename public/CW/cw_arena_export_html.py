#!/usr/bin/env python3
"""
Export crossword arena results into a JSON pack suitable for an HTML viewer.

Supported inputs:
- arena ZIP bundles containing best_result.json / leaderboard.jsonl / run_manifest.json
- extracted arena folders
- single best_result.json files
- leaderboard.jsonl files

Output:
- a pack JSON with puzzles in viewer-ready format
- optionally individual puzzle JSON files

The viewer-ready puzzle schema matches the existing browser crossword format:
  {
    rows, cols, mask, solution, clueMap, numAssigned,
    title, sourceLabel, meta
  }
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import pathlib
import sys
import zipfile
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _read_json_from_zip(zf: zipfile.ZipFile, suffix: str) -> Optional[dict]:
    names = [n for n in zf.namelist() if n.endswith(suffix)]
    if not names:
        return None
    return json.loads(zf.read(names[0]).decode("utf-8"))


def _read_text_from_zip(zf: zipfile.ZipFile, suffix: str) -> Optional[str]:
    names = [n for n in zf.namelist() if n.endswith(suffix)]
    if not names:
        return None
    return zf.read(names[0]).decode("utf-8")


def _iter_records_from_zip(path: str) -> Tuple[List[dict], Dict]:
    with zipfile.ZipFile(path) as zf:
        manifest = _read_json_from_zip(zf, "run_manifest.json") or {}
        best = _read_json_from_zip(zf, "best_result.json")
        leaderboard = _read_text_from_zip(zf, "leaderboard.jsonl")
        records: List[dict] = []
        seen_ids = set()
        if best:
            best["_record_source"] = f"{os.path.basename(path)}:best_result"
            records.append(best)
            seen_ids.add((best.get("trial_id"), best.get("gen"), best.get("quality")))
        if leaderboard:
            for line in leaderboard.splitlines():
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                key = (rec.get("trial_id"), rec.get("gen"), rec.get("quality"))
                if key in seen_ids:
                    continue
                rec["_record_source"] = f"{os.path.basename(path)}:leaderboard"
                records.append(rec)
                seen_ids.add(key)
        return records, {
            "input_path": path,
            "input_type": "zip",
            "manifest": manifest,
        }


def _iter_records_from_folder(path: str) -> Tuple[List[dict], Dict]:
    p = pathlib.Path(path)
    manifest = {}
    if (p / "run_manifest.json").exists():
        manifest = json.loads((p / "run_manifest.json").read_text(encoding="utf-8"))
    records: List[dict] = []
    seen_ids = set()
    best_path = p / "best_result.json"
    if best_path.exists():
        best = json.loads(best_path.read_text(encoding="utf-8"))
        best["_record_source"] = f"{p.name}:best_result"
        records.append(best)
        seen_ids.add((best.get("trial_id"), best.get("gen"), best.get("quality")))
    lb_path = p / "leaderboard.jsonl"
    if lb_path.exists():
        for line in lb_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            key = (rec.get("trial_id"), rec.get("gen"), rec.get("quality"))
            if key in seen_ids:
                continue
            rec["_record_source"] = f"{p.name}:leaderboard"
            records.append(rec)
            seen_ids.add(key)
    return records, {
        "input_path": str(path),
        "input_type": "folder",
        "manifest": manifest,
    }


def _iter_records_from_file(path: str) -> Tuple[List[dict], Dict]:
    p = pathlib.Path(path)
    if p.name.endswith("best_result.json"):
        rec = json.loads(p.read_text(encoding="utf-8"))
        rec["_record_source"] = p.name
        return [rec], {"input_path": str(path), "input_type": "best_result", "manifest": {}}
    if p.name.endswith("leaderboard.jsonl"):
        records = []
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                rec = json.loads(line)
                rec["_record_source"] = p.name
                records.append(rec)
        return records, {"input_path": str(path), "input_type": "leaderboard", "manifest": {}}
    raise ValueError(f"Unsupported file input: {path}")


def load_input(path: str) -> Tuple[List[dict], Dict]:
    if zipfile.is_zipfile(path):
        return _iter_records_from_zip(path)
    if os.path.isdir(path):
        return _iter_records_from_folder(path)
    return _iter_records_from_file(path)


def board_signature(board: Sequence[str]) -> str:
    return "|".join(board)


def parse_board(board: Sequence[str]) -> Tuple[int, int, List[List[int]], List[List[str]]]:
    rows = len(board)
    cols = len(board[0]) if rows else 0
    if not rows or any(len(r) != cols for r in board):
        raise ValueError("Board must be rectangular and non-empty")
    mask: List[List[int]] = []
    solution: List[List[str]] = []
    for row in board:
        mask_row = []
        sol_row = []
        for ch in row:
            if ch == "#":
                mask_row.append(0)
                sol_row.append("")
            else:
                mask_row.append(1)
                sol_row.append(ch)
        mask.append(mask_row)
        solution.append(sol_row)
    return rows, cols, mask, solution


def enumerate_slots(board: Sequence[str]) -> Tuple[List[Dict], List[Dict], Dict[str, int]]:
    rows, cols, _, _ = parse_board(board)
    across: List[Dict] = []
    down: List[Dict] = []
    num_assigned: Dict[str, int] = {}
    n = 1
    for r in range(rows):
        for c in range(cols):
            if board[r][c] == "#":
                continue
            starts_across = c == 0 or board[r][c - 1] == "#"
            starts_down = r == 0 or board[r - 1][c] == "#"
            if starts_across or starts_down:
                num_assigned[f"{r},{c}"] = n
            if starts_across:
                cells = []
                cc = c
                while cc < cols and board[r][cc] != "#":
                    cells.append([r, cc])
                    cc += 1
                if len(cells) >= 2:
                    across.append({"num": n, "cells": cells, "answer": "".join(board[r][x] for _, x in cells)})
            if starts_down:
                cells = []
                rr = r
                while rr < rows and board[rr][c] != "#":
                    cells.append([rr, c])
                    rr += 1
                if len(cells) >= 2:
                    down.append({"num": n, "cells": cells, "answer": "".join(board[y][c] for y, _ in cells)})
            if starts_across or starts_down:
                n += 1
    return across, down, num_assigned


def convert_record(record: dict, source_label: str) -> dict:
    board = record.get("board")
    words = record.get("words", [])
    if not board or not words:
        raise ValueError("Record missing board or words")

    rows, cols, mask, solution = parse_board(board)
    across_slots, down_slots, num_assigned = enumerate_slots(board)
    across_words = [w for w in words if w.get("o") == "A"]
    down_words = [w for w in words if w.get("o") == "D"]

    if len(across_words) != len(across_slots) or len(down_words) != len(down_slots):
        raise ValueError(
            f"Slot count mismatch: across {len(across_words)} vs {len(across_slots)}, "
            f"down {len(down_words)} vs {len(down_slots)}"
        )

    def build_lookup(word_list):
        lookup = {}
        for w in word_list:
            key = (w["w"].upper(), int(w.get("len", len(w["w"]))))
            lookup.setdefault(key, []).append(w)
        return lookup

    across_lookup = build_lookup(across_words)
    down_lookup = build_lookup(down_words)
    clue_map = {"across": {}, "down": {}}

    for slot in across_slots:
        key = (slot["answer"], len(slot["cells"]))
        bucket = across_lookup.get(key)
        if not bucket:
            raise ValueError(f"Across answer not found in words list: {key[0]}")
        word = bucket.pop(0)
        clue_map["across"][str(slot["num"])] = {
            "num": slot["num"],
            "clue": word.get("h", ""),
            "answer": key[0],
            "cells": slot["cells"],
            "score": word.get("s"),
        }

    for slot in down_slots:
        key = (slot["answer"], len(slot["cells"]))
        bucket = down_lookup.get(key)
        if not bucket:
            raise ValueError(f"Down answer not found in words list: {key[0]}")
        word = bucket.pop(0)
        clue_map["down"][str(slot["num"])] = {
            "num": slot["num"],
            "clue": word.get("h", ""),
            "answer": key[0],
            "cells": slot["cells"],
            "score": word.get("s"),
        }

    quality = record.get("quality")
    title = f"{rows}×{cols} · Q {quality:.4f}" if isinstance(quality, (int, float)) else f"{rows}×{cols} crossword"
    return {
        "id": f"cw-{record.get('gen', 'g')}-{record.get('trial_id', 't')}",
        "title": title,
        "rows": rows,
        "cols": cols,
        "mask": mask,
        "solution": solution,
        "clueMap": clue_map,
        "numAssigned": num_assigned,
        "sourceLabel": source_label,
        "playerGrid": [["" for _ in range(cols)] for _ in range(rows)],
        "meta": {
            "quality": record.get("quality"),
            "solved": record.get("solved"),
            "num_solutions": record.get("num_solutions"),
            "nodes": record.get("nodes"),
            "seconds": record.get("seconds"),
            "gen": record.get("gen"),
            "trial_id": record.get("trial_id"),
            "first_solved_at": record.get("first_solved_at"),
            "best_partial_depth": record.get("best_partial_depth"),
            "signals": record.get("signals", {}),
            "rejections": record.get("rejections", []),
            "record_source": record.get("_record_source"),
        },
    }


def choose_candidates(records: Sequence[dict], source_label: str, top_n: int, require_unique_solution: bool, min_quality: Optional[float]) -> List[dict]:
    filtered = []
    for rec in records:
        if not rec.get("solved"):
            continue
        if require_unique_solution and rec.get("num_solutions") not in (1, "1"):
            continue
        if not rec.get("board") or not rec.get("words"):
            continue
        if min_quality is not None and (rec.get("quality") is None or float(rec.get("quality")) < min_quality):
            continue
        filtered.append(rec)
    filtered.sort(key=lambda r: (r.get("quality", float("-inf")), -(r.get("nodes", 10**9))), reverse=True)

    chosen = []
    seen = set()
    for rec in filtered:
        sig = board_signature(rec["board"])
        if sig in seen:
            continue
        seen.add(sig)
        chosen.append(convert_record(rec, source_label))
        if len(chosen) >= top_n:
            break
    return chosen


def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Export crossword arena runs to HTML-friendly JSON")
    ap.add_argument("inputs", nargs="+", help="ZIPs, folders, best_result.json, or leaderboard.jsonl files")
    ap.add_argument("--out", default="cw_puzzles_pack.json", help="Output pack JSON path")
    ap.add_argument("--top-per-run", type=int, default=4, help="Max unique puzzles to take from each input")
    ap.add_argument("--max-puzzles", type=int, default=16, help="Global max puzzles in final pack")
    ap.add_argument("--emit-individual-dir", default="", help="Optional directory for one JSON per puzzle")
    ap.add_argument("--min-quality", type=float, default=None, help="Optional minimum quality threshold")
    ap.add_argument("--allow-non-unique", action="store_true", help="Allow num_solutions != 1")
    args = ap.parse_args(argv)

    all_puzzles: List[dict] = []
    input_summaries: List[dict] = []
    for path in args.inputs:
        records, meta = load_input(path)
        manifest = meta.get("manifest", {})
        source_label = os.path.basename(path)
        if manifest:
            hours = manifest.get("hours")
            mask = manifest.get("mask")
            source_label = f"{os.path.basename(path)} · {hours}h · {mask}"
        puzzles = choose_candidates(records, source_label, args.top_per_run, not args.allow_non_unique, args.min_quality)
        input_summaries.append({
            "input_path": path,
            "source_label": source_label,
            "records_loaded": len(records),
            "puzzles_selected": len(puzzles),
        })
        all_puzzles.extend(puzzles)

    # Global dedupe by mask+solution board signature.
    final: List[dict] = []
    seen = set()
    all_puzzles.sort(key=lambda p: p.get("meta", {}).get("quality", float("-inf")), reverse=True)
    for p in all_puzzles:
        sig_rows = []
        for r in range(p["rows"]):
            row = []
            for c in range(p["cols"]):
                row.append(p["solution"][r][c] if p["mask"][r][c] else "#")
            sig_rows.append("".join(row))
        sig = board_signature(sig_rows)
        if sig in seen:
            continue
        seen.add(sig)
        final.append(p)
        if len(final) >= args.max_puzzles:
            break

    pack = {
        "format": "cw_html_pack_v1",
        "created_utc": _utc_now(),
        "generator": "cw_arena_export_html.py",
        "puzzle_count": len(final),
        "inputs": input_summaries,
        "puzzles": final,
    }

    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.emit_individual_dir:
        out_dir = pathlib.Path(args.emit_individual_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, puzzle in enumerate(final, start=1):
            slug = f"{i:02d}_{puzzle['title'].replace('×','x').replace(' ','_').replace('.','_')}".lower()
            (out_dir / f"{slug}.json").write_text(json.dumps(puzzle, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {len(final)} puzzle(s) to {out_path}")
    for p in final:
        q = p.get("meta", {}).get("quality")
        print(f" - {p['title']} :: {p['sourceLabel']}")
        if q is not None:
            print(f"   quality={q:.4f} nodes={p['meta'].get('nodes')} gen={p['meta'].get('gen')} trial={p['meta'].get('trial_id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
