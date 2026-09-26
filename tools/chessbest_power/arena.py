#!/usr/bin/env python3
"""Read-only PGN mining with durable, bounded CDB/SF observations.

Run-state belongs in a separate output directory; the ChessBest source tree is
never edited. Python-chess is required for legal-move and full-FEN receipts.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import logging
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from contextlib import contextmanager
from pathlib import Path

import chess
import chess.pgn

# python-chess also logs malformed PGNs to stderr by default. Retain errors in
# the durable per-game receipts and keep the console to one status line.
logging.getLogger("chess.pgn").setLevel(logging.CRITICAL)

SCHEMA = 1
VERSION = "0.1.0"
HERE = Path(__file__).resolve().parent
PGN_RE = re.compile(r"['\"]([^'\"\n]+\.pgn)['\"]", re.IGNORECASE)
MOVE_RE = re.compile(r"move:([a-h][1-8][a-h][1-8][qrbn]?),score:(-?\d+),rank:(\d+)")
MAX_RESPONSE_BYTES = 128 * 1024
MAX_SUPPLEMENTAL_PGN_BYTES = 64 * 1024 * 1024
# These are constructed opening lines, not games eligible for a showcase.
CURATED_PGNS = {"ChessBest_Top_Picks.pgn", "ChessBest_Top_Picks_TCEC.pgn"}
SUPPLEMENTAL_EXCLUDED = CURATED_PGNS | {"Chess_Openings_Top_Lines.pgn"}
SUPPLEMENTAL_EXCLUDED_DIRS = {"TopLines", "Openings"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def atomic_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with tmp.open("wb") as file:
        file.write((canonical(obj) + "\n").encode())
        file.flush()
        os.fsync(file.fileno())
    if path.exists():
        old = path.with_name(path.name + ".prev")
        os.replace(path, old)
    os.replace(tmp, path)
    if os.name != "nt":
        fd = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


@contextmanager
def single_writer(run_dir: Path):
    """Advisory OS lock: automatically released on SIGKILL or power loss."""
    run_dir.mkdir(parents=True, exist_ok=True)
    with (run_dir / "writer.lock").open("a+b") as handle:
        if handle.seek(0, os.SEEK_END) == 0:
            handle.write(b" ")
            handle.flush()
        handle.seek(0)
        if os.name == "nt":
            import msvcrt
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise ValueError("This run already has an active writer") from exc
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise ValueError("This run already has an active writer") from exc
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)


def game_files(repo: Path, *, include_supplemental: bool = False) -> list[dict]:
    page = repo / "public/chess/new/js/8zc-utils.js"
    content = page.read_text(encoding="utf-8")
    start = content.find("const gameBuckets = [")
    end = content.find("\n  ];", start)
    if start < 0 or end < 0:
        raise ValueError("Active LAB gameBuckets block missing; refuse guessed library list")
    block = content[start:end + len("\n  ];")]
    names = [n for n in dict.fromkeys(PGN_RE.findall(block)) if n not in CURATED_PGNS]
    if not names:
        raise ValueError("No base PGN inputs in active LAB gameBuckets; refuse broad scan")
    root = (repo / "public/chess/new/Games").resolve()
    rows = [{"name": "js/8zc-utils.js#gameBuckets", "sha256": sha(block.encode()), "bytes": len(block.encode()),
             "source_set": "library_index", "excluded_curated_files": sorted(CURATED_PGNS)}]
    for name in names:
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Missing/unsafe loaded PGN: {name}")
        rows.append({"name": f"Games/{name}", "sha256": sha(path.read_bytes()),
                     "bytes": path.stat().st_size, "source_set": "active"})
    if include_supplemental:
        active = set(names)
        # An opt-in sweep extends the loaded library to player and TCEC PGNs
        # already on disk. Directory/name exclusions keep generated books and
        # the derived Top Picks from feeding their own selection back in.
        for candidate in sorted(root.rglob("*")):
            if candidate.suffix.casefold() != ".pgn":
                continue
            relative = candidate.relative_to(root)
            name = relative.as_posix()
            if (name in active or name in SUPPLEMENTAL_EXCLUDED or
                    any(part in SUPPLEMENTAL_EXCLUDED_DIRS for part in relative.parts[:-1])):
                continue
            path = candidate.resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError(f"Missing/unsafe supplemental PGN: {name}")
            size = path.stat().st_size
            if size > MAX_SUPPLEMENTAL_PGN_BYTES:
                raise ValueError(f"Supplemental PGN exceeds bounded input size: {name}")
            rows.append({"name": f"Games/{name}", "sha256": sha(path.read_bytes()),
                         "bytes": size, "source_set": "supplemental"})
    return rows


def sf_asset_hashes(repo: Path) -> dict[str, str]:
    base = repo / "public/chess/new"
    assets = ["vendor/stockfish/stockfish-18-lite-single.js",
              "vendor/stockfish/stockfish-18-lite-single.wasm",
              "vendor/stockfish/nn-9067e33176e8.nnue",
              "js/8zc-deep-engine.js", "js/chess.min.js"]
    return {name: sha((base / name).read_bytes()) for name in assets} | {
        "bridge_sha256": sha((HERE / "sf_lite_bridge.mjs").read_bytes())}


def config_from_args(args: argparse.Namespace) -> dict:
    repo = Path(args.repo).resolve()
    sources = game_files(repo, include_supplemental=args.include_supplemental)
    frozen = None
    if args.frozen_cdb:
        path = Path(args.frozen_cdb).resolve()
        frozen = {"path": str(path), "sha256": sha(path.read_bytes()), "bytes": path.stat().st_size}
    sf_assets = None
    if args.sf_lite:
        sf_assets = sf_asset_hashes(repo)
    return {
        "schema": SCHEMA, "arena_version": VERSION, "arena_sha256": sha(Path(__file__).read_bytes()),
        "python_chess": getattr(chess, "__version__", "unknown"), "repo": str(repo),
        "inputs": sources, "frozen_cdb": frozen,
        "include_supplemental": bool(args.include_supplemental),
        "min_ply": args.min_ply, "max_ply": args.max_ply,
        "focus": args.focus or "", "focus_ply": args.focus_ply,
        "max_positions": args.max_positions, "per_game_limit": args.per_game_limit,
        "live_cdb": bool(args.live_cdb), "max_cdb_calls": args.max_cdb_calls,
        "cdb_interval_ms": args.cdb_interval_ms,
        "sf_lite": bool(args.sf_lite), "max_sf_positions": args.max_sf_positions,
        "sf_depths": list(args.sf_depths), "sf_timeout_s": args.sf_timeout_s, "sf_assets": sf_assets,
    }


def init_db(path: Path, identity: str, config: dict) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    existed = path.exists() and path.stat().st_size > 0
    conn = sqlite3.connect(path, timeout=20, isolation_level=None)
    conn.execute("PRAGMA busy_timeout=20000")
    if existed:
        try:
            row = conn.execute("SELECT value FROM meta WHERE key='identity'").fetchone()
        except sqlite3.DatabaseError as exc:
            conn.close()
            raise ValueError("Existing run database has no readable identity; refuse overwrite") from exc
        if not row or row[0] != identity:
            conn.close()
            raise ValueError("Run identity differs: input/config/backend changed; choose a new run directory")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=FULL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS games(
          game_id TEXT PRIMARY KEY, source TEXT NOT NULL, source_index INTEGER NOT NULL,
          headers TEXT NOT NULL, moves TEXT NOT NULL, plies INTEGER NOT NULL,
          status TEXT NOT NULL, duplicate_of TEXT, error TEXT, mainline_hash TEXT NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS game_source ON games(source, source_index);
        CREATE TABLE IF NOT EXISTS positions(
          position_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, ply INTEGER NOT NULL,
          fen TEXT NOT NULL, after_fen TEXT NOT NULL, side TEXT NOT NULL,
          played_uci TEXT NOT NULL, played_san TEXT NOT NULL,
          FOREIGN KEY(game_id) REFERENCES games(game_id));
        CREATE INDEX IF NOT EXISTS position_fen ON positions(fen);
        CREATE TABLE IF NOT EXISTS selected_positions(
          rank INTEGER PRIMARY KEY, position_id TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS observations(
          observation_id TEXT PRIMARY KEY, provider TEXT NOT NULL, action TEXT NOT NULL,
          fen TEXT NOT NULL, settings TEXT NOT NULL, status TEXT NOT NULL,
          raw TEXT, parsed TEXT, recorded_at TEXT NOT NULL, error TEXT);
        CREATE INDEX IF NOT EXISTS obs_lookup ON observations(provider, action, fen);
        CREATE TABLE IF NOT EXISTS events(
          id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);
    """)
    if not existed:
        with conn:
            conn.execute("INSERT INTO meta VALUES('identity',?)", (identity,))
            conn.execute("INSERT INTO meta VALUES('config',?)", (canonical(config),))
            conn.execute("INSERT INTO meta VALUES('created_at',?)", (timestamp(),))
    if conn.execute("SELECT value FROM meta WHERE key='config'").fetchone()[0] != canonical(config):
        conn.close()
        raise ValueError("Stored run config differs despite identity; refuse unsafe resume")
    return conn


def event(conn: sqlite3.Connection, kind: str, detail: str) -> None:
    with conn:
        conn.execute("INSERT INTO events(at,kind,detail) VALUES(?,?,?)", (timestamp(), kind, detail[:700]))


def scan(conn: sqlite3.Connection, config: dict) -> None:
    repo = Path(config["repo"])
    count = conn.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    start = time.monotonic()
    print(f"[{timestamp()}] SCAN resume committed games={count} | ETA UNKNOWN", flush=True)
    for src in config["inputs"][1:]:
        source = src["name"]
        with (repo / "public/chess/new" / source).open(encoding="utf-8-sig", errors="replace") as file:
            source_index = 0
            while (game := chess.pgn.read_game(file)) is not None:
                source_index += 1
                if conn.execute("SELECT 1 FROM games WHERE source=? AND source_index=?", (source, source_index)).fetchone():
                    continue
                moves = list(game.mainline_moves())
                b = game.board()
                move_uci = [move.uci() for move in moves]
                headers = dict(game.headers)
                logical_id = sha((b.fen() + "|" + " ".join(move_uci)).encode())
                duplicate = conn.execute("SELECT game_id FROM games WHERE mainline_hash=? AND status='ok' LIMIT 1",
                                         (logical_id,)).fetchone()
                game_id = sha((source + ":" + str(source_index) + ":" + logical_id).encode())
                status = "bad_pgn" if game.errors else "duplicate" if duplicate else "ok"
                error = "; ".join(str(x)[:250] for x in game.errors[:3]) if game.errors else None
                with conn:
                    conn.execute("INSERT INTO games VALUES(?,?,?,?,?,?,?,?,?,?)",
                                 (game_id, source, source_index, canonical(headers), canonical(move_uci), len(moves),
                                  status, duplicate[0] if duplicate else None, error, logical_id))
                    if status == "ok":
                        for ply, move in enumerate(moves, 1):
                            fen = b.fen()
                            side = "white" if b.turn == chess.WHITE else "black"
                            san = b.san(move)
                            b.push(move)
                            if config["min_ply"] <= ply <= config["max_ply"]:
                                pid = sha((game_id + ":" + str(ply) + ":" + fen).encode())
                                conn.execute("INSERT INTO positions VALUES(?,?,?,?,?,?,?,?)",
                                             (pid, game_id, ply, fen, b.fen(), side,
                                              move.uci(), san))
                count += 1
                if status != "ok":
                    event(conn, "scan_skip", f"{source} #{source_index}: {status}; {error or duplicate[0]}")
                if count % 25 == 0:
                    elapsed = max(0.01, time.monotonic() - start)
                    print(f"\r[{timestamp()}] SCAN games={count} rate={count/elapsed:.1f}/s | ETA UNKNOWN | checkpoint=game", end="", flush=True)
                delay = int(os.environ.get("CHESSBEST_POWER_TEST_PAUSE_AFTER_COMMIT_MS", "0"))
                if delay > 0:
                    time.sleep(min(delay, 1000) / 1000)
    print(f"\n[{timestamp()}] SCAN complete games={count}; checkpoint=game", flush=True)


def load_frozen(config: dict) -> dict:
    p = config["frozen_cdb"]
    if not p:
        return {}
    path = Path(p["path"])
    if sha(path.read_bytes()) != p["sha256"]:
        raise ValueError("Frozen CDB source checksum changed; refuse resume")
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            candidates = [x for x in z.namelist() if x.endswith("/8zc_cache/cache.json")]
            if len(candidates) != 1:
                raise ValueError("Archive must contain exactly one historical 8zc_cache/cache.json")
            return json.loads(z.read(candidates[0]))
    return json.loads(path.read_text(encoding="utf-8"))


def frozen_value(cache: dict, action: str, fen: str) -> dict | None:
    # Old ChessDCC cache used 4-field FEN keys. The 50-move state is lost,
    # so the value is historical triage evidence, never current validation.
    key = "qa:" if action == "queryall" else "pv:" if action == "querypv" else "qs:"
    value = cache.get(key + " ".join(fen.split()[:4]))
    return value if isinstance(value, dict) else None


def parse_cdb_moves(raw0: str) -> list[dict]:
    merged: dict[str, dict] = {}
    for uci, score, rank in MOVE_RE.findall(raw0 or ""):
        if int(score) <= -999 and int(rank) < 2:
            continue
        merged[uci] = {"move": uci, "score": int(score), "rank": int(rank)}
    return sorted(merged.values(), key=lambda m: (-m["score"], m["rank"]))


def observe(conn: sqlite3.Connection, provider: str, action: str, fen: str, settings: dict,
            query, *, retry_started: bool = False) -> dict | None:
    key = sha(canonical([provider, action, fen, settings]).encode())
    row = conn.execute("SELECT status,parsed FROM observations WHERE observation_id=?", (key,)).fetchone()
    if row:
        if row[0] == "ok":
            return json.loads(row[1])
        if row[0] == "started" and provider == "CDB_live":
            with conn:
                conn.execute("UPDATE observations SET status='ambiguous',error=? WHERE observation_id=?",
                             ("Process ended during external request; no automatic retry", key))
            return None
        if not retry_started or row[0] not in ("started", "ambiguous"):
            return None
    # This reservation is committed BEFORE an external query; a crash cannot
    # trigger an invisible second query. Local SF may safely retry on resume.
    with conn:
        conn.execute("INSERT INTO observations VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(observation_id) DO UPDATE SET status='started',recorded_at=excluded.recorded_at,error=NULL",
                     (key, provider, action, fen, canonical(settings), "started", None, None, timestamp(), None))
    try:
        parsed, raw = query()
        status, error = "ok", None
    except Exception as exc:
        parsed, raw, status, error = None, None, "error", f"{type(exc).__name__}: {str(exc)[:280]}"
    with conn:
        conn.execute("UPDATE observations SET status=?,raw=?,parsed=?,recorded_at=?,error=? WHERE observation_id=?",
                     (status, raw[:MAX_RESPONSE_BYTES] if isinstance(raw, str) else None,
                      canonical(parsed) if parsed is not None else None, timestamp(), error, key))
    if error:
        event(conn, "provider_error", f"{provider}/{action}: {error}")
    return parsed


def cdb_request(action: str, fen: str, learn: int = 0) -> tuple[dict, str]:
    if learn != 0:
        raise ValueError("Read-only CDB arena forbids learn=1")
    url = "https://www.chessdb.cn/cdb.php?" + urllib.parse.urlencode(
        {"action": action, "board": fen, "learn": learn, "showall": 1})
    req = urllib.request.Request(url, headers={"User-Agent": "ChessBestPower/0.1 research"})
    with urllib.request.urlopen(req, timeout=12) as response:
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("CDB response exceeds bounded size")
        text = raw.decode("utf-8", errors="replace").strip()
    if not re.match(r"^(move:|score:|eval:|checkmate|stalemate)", text):
        raise ValueError("CDB returned unknown/unscored/rate-limited response")
    return {"text": text, "learn": learn}, text


def get_observation(conn: sqlite3.Connection, provider: str, action: str, fen: str) -> dict | None:
    row = conn.execute("SELECT parsed FROM observations WHERE provider=? AND action=? AND fen=? AND status='ok' ORDER BY recorded_at DESC LIMIT 1",
                       (provider, action, fen)).fetchone()
    return json.loads(row[0]) if row else None


def cdb_moves(conn: sqlite3.Connection, cache: dict, fen: str) -> tuple[list[dict], str]:
    zero = get_observation(conn, "CDB_live", "queryall:0", fen)
    if zero:
        return parse_cdb_moves(zero.get("text", "")), "CDB_live"
    old = frozen_value(cache, "queryall", fen)
    return (old or {}).get("moves", []), "CDB_historical_unverified" if old else "unknown"


def score_after(conn: sqlite3.Connection, cache: dict, fen: str) -> tuple[int | None, str]:
    live = get_observation(conn, "CDB_live", "queryscore", fen)
    if live:
        m = re.search(r"eval:(-?\d+)", live.get("text", ""))
        return (int(m[1]) if m else None), "CDB_live"
    for action in ("queryscore", "querypv"):
        old = frozen_value(cache, action, fen)
        if old and isinstance(old.get("score"), int):
            return old["score"], "CDB_historical_unverified"
    old = frozen_value(cache, "queryall", fen)
    if old:
        scored = [m["score"] for m in old.get("moves", []) if isinstance(m.get("score"), int)]
        if scored:
            return max(scored), "CDB_historical_unverified"
    return None, "unknown"


def select_positions(conn: sqlite3.Connection, config: dict, cache: dict) -> list[tuple]:
    if not config["max_positions"]:
        return []
    rows = conn.execute("SELECT p.position_id,p.fen,p.after_fen,p.ply,p.played_uci,p.side,g.headers,g.source,g.game_id "
                        "FROM positions p JOIN games g ON g.game_id=p.game_id WHERE g.status='ok'").fetchall()
    focus = config["focus"].casefold()
    ranked = []
    for row in rows:
        _, fen, after, ply, played, _, headers_json, source, game_id = row
        if source.startswith("Games/TopLines/"):
            continue  # book/constructed lines are separate from demonstrative games
        moves, kind = cdb_moves(conn, cache, fen)
        valid = [m for m in moves if isinstance(m.get("score"), int) and abs(m["score"]) < 29000]
        exact = next((m["score"] for m in valid if m.get("move") == played), None)
        child, child_kind = score_after(conn, cache, after)
        regret = max(m["score"] for m in valid) - (exact if exact is not None else -child) if valid and (exact is not None or child is not None) and (child is None or abs(child) < 29000) else -1
        is_focus = focus and focus in (headers_json + " " + source).casefold()
        is_anchor = is_focus and config["focus_ply"] == ply
        ranked.append((0 if is_anchor else 1 if is_focus else 2, -regret, abs(ply - (config["focus_ply"] or 88)), row[0], row))
    ranked.sort()
    seen: set[tuple] = set()
    per_game: dict[str, int] = {}
    selected: list[tuple] = []
    for _, _, _, _, row in ranked:
        key = (row[1], row[4])
        if key in seen or per_game.get(row[8], 0) >= config["per_game_limit"]:
            continue
        seen.add(key)
        per_game[row[8]] = per_game.get(row[8], 0) + 1
        selected.append(row)
        if len(selected) >= config["max_positions"]:
            break
    return selected


def enrich(conn: sqlite3.Connection, config: dict, cache: dict) -> None:
    frozen_selection = conn.execute("SELECT COUNT(*) FROM selected_positions").fetchone()[0]
    if frozen_selection:
        positions = {row[0]: row for row in conn.execute("SELECT p.position_id,p.fen,p.after_fen,p.ply,p.played_uci,p.side,g.headers,g.source,g.game_id "
                                                           "FROM positions p JOIN games g ON g.game_id=p.game_id")}
        selected = [positions[pid] for (pid,) in conn.execute("SELECT position_id FROM selected_positions ORDER BY rank")]
    else:
        selected = select_positions(conn, config, cache)
        with conn:
            conn.executemany("INSERT INTO selected_positions(rank,position_id) VALUES(?,?)",
                             ((i, row[0]) for i, row in enumerate(selected)))
    print(f"[{timestamp()}] ENRICH selected={len(selected)} live_CDB={config['live_cdb']} "
          f"max_calls={config['max_cdb_calls']} SF_Lite={config['sf_lite']} ETA UNKNOWN", flush=True)
    cdb_count = conn.execute("SELECT COUNT(*) FROM observations WHERE provider='CDB_live'").fetchone()[0]
    sf_done = set()
    bridge = HERE / "sf_lite_bridge.mjs"
    sf_root = Path(config["repo"]) / "public/chess/new"
    if config["sf_lite"] and sf_asset_hashes(Path(config["repo"])) != config["sf_assets"]:
        raise ValueError("SF Lite bridge/engine/parser assets changed during run; refuse mixed observations")
    for index, row in enumerate(selected, 1):
        pid, fen, after, ply, played, side, _, _, _ = row
        if config["live_cdb"]:
            for action, target, learn in (("queryall:0", fen, 0), ("queryscore", after, 0)):
                existing = get_observation(conn, "CDB_live", action, target)
                already_reserved = conn.execute("SELECT 1 FROM observations WHERE provider='CDB_live' AND action=? AND fen=?",
                                                (action, target)).fetchone()
                if existing or already_reserved or cdb_count >= config["max_cdb_calls"]:
                    continue
                detail = {"api": "chessdb.cn/cdb.php", "action": action, "learn": learn, "showall": 1}
                observe(conn, "CDB_live", action, target, detail,
                        lambda a=action.split(":")[0], f=target, l=learn: cdb_request(a, f, l))
                cdb_count += 1
                time.sleep(config["cdb_interval_ms"] / 1000)
        if config["sf_lite"] and index <= config["max_sf_positions"]:
            sf_done.add(fen)
            for depth in config["sf_depths"]:
                options = {"depth": depth, "multiPV": 8, "threads": 1, "hashMB": 16,
                           "bridgeSha256": sha(bridge.read_bytes()) if bridge.exists() else "missing"}
                def invoke(d=depth, f=fen):
                    proc = subprocess.run(["node", str(bridge), "--root", str(sf_root), "--fen", f,
                                           "--depth", str(d), "--multipv", "8"], text=True,
                                          capture_output=True, timeout=config["sf_timeout_s"], check=True)
                    parsed = json.loads(proc.stdout)
                    return parsed, proc.stdout
                observe(conn, "SF_Lite", f"root:{depth}", fen, options, invoke, retry_started=True)
        if index % 10 == 0 or index == len(selected):
            print(f"\r[{timestamp()}] ENRICH {index}/{len(selected)} CDB calls={cdb_count} "
                  f"SF positions={len(sf_done)} checkpoint=observation | ETA UNKNOWN", end="", flush=True)
    print("", flush=True)


def candidates(conn: sqlite3.Connection, cache: dict, *, limit: int = 250, focus: str = "",
               supplemental_sources: frozenset[str] = frozenset()) -> list[dict]:
    rows = conn.execute("SELECT p.position_id,p.fen,p.after_fen,p.ply,p.played_uci,p.played_san,p.side,"
                        "g.source,g.source_index,g.headers,g.game_id FROM positions p JOIN games g ON g.game_id=p.game_id "
                        "WHERE g.status='ok'").fetchall()
    result = []
    for pid, fen, after, ply, played, san, side, source, source_index, headers_json, game_id in rows:
        if source.startswith("Games/TopLines/"):
            continue
        root, origin = cdb_moves(conn, cache, fen)
        scored = [m for m in root if isinstance(m.get("score"), int) and abs(m["score"]) < 29000]
        if not scored:
            continue
        best = max(scored, key=lambda x: x["score"])
        played_score = next((x["score"] for x in scored if x.get("move") == played), None)
        after_score, child_origin = score_after(conn, cache, after)
        if played_score is None and after_score is not None and abs(after_score) < 29000:
            played_score = -after_score  # post-move side-to-move POV -> root mover POV
        if played_score is None:
            continue
        regret = best["score"] - played_score
        if regret < 60:
            continue
        sf: dict[str, dict] = {}
        for depth in (15, 18, 21):
            data = get_observation(conn, "SF_Lite", f"root:{depth}", fen)
            if not data:
                continue
            lines = data.get("result", {}).get("lines", [])
            cp = [x for x in lines if x.get("score", {}).get("type") == "cp" and x["score"].get("bound") in ("exact", None) and isinstance(x["score"].get("mover"), int)]
            played_line = next((x for x in cp if x.get("move") == played), None)
            sf[str(depth)] = {"best_move": cp[0]["move"] if cp else None,
                              "best_cp_mover": cp[0]["score"]["mover"] if cp else None,
                              "played_cp_mover": played_line["score"]["mover"] if played_line else None,
                              "regret_cp": cp[0]["score"]["mover"] - played_line["score"]["mover"] if cp and played_line else None,
                              "achieved_depth": data.get("result", {}).get("achievedDepth"),
                              "complete_multi_pv": data.get("result", {}).get("completeMultiPV")}
        # Compare move-specific regret at the same root FEN. The child CDB
        # queryscore is a usable played-move estimate even when read-only
        # queryall supplies just one scored root alternative. It does not
        # establish that the observed CDB root move is globally best.
        played_origin = origin if any(x.get("move") == played for x in scored) else child_origin
        compared_depth = next((depth for depth in ("21", "18", "15")
                               if depth in sf and sf[depth]["complete_multi_pv"]
                               and sf[depth]["regret_cp"] is not None), None)
        compared = sf[compared_depth] if compared_depth else None
        live_comparison = origin == "CDB_live" and played_origin == "CDB_live" and compared is not None
        regret_gap = regret - compared["regret_cp"] if live_comparison else None
        category = "EVAL_REGRET_UNCONFIRMED"
        if live_comparison and regret >= 150 and regret_gap >= 100:
            category = "CDB_SF_GAP_TO_REVIEW"
        elif live_comparison and len(scored) >= 2:
            category = "SF_LITE_UNDERESTIMATES_REGRET" if compared["regret_cp"] <= 40 and regret >= 120 else "CDB_SF_COMPARABLE"
        elif origin == "CDB_historical_unverified" or child_origin == "CDB_historical_unverified":
            category = "HISTORICAL_TRIAGE_ONLY"
        result.append({"position_id": pid, "game_id": game_id, "source": source,
                       "source_set": "supplemental" if source in supplemental_sources else "active",
                       "source_index": source_index, "headers": json.loads(headers_json),
                       "ply": ply, "move_number": int(fen.split()[5]),
                       "fen": fen, "after_fen": after, "side_to_move": side,
                       "played_san": san, "played_uci": played,
                       "cdb": {"best_uci": best["move"], "best_observed_only": True,
                               "best_cp_mover": best["score"],
                               "played_cp_mover": played_score, "best_cp_white": best["score"] if side == "white" else -best["score"],
                               "played_cp_white": played_score if side == "white" else -played_score,
                               "regret_cp": regret, "root_origin": origin, "played_origin": played_origin,
                               "root_coverage": len(scored),
                               "root_coverage_caution": "Best CDB move is only the best scored move observed in queryall learn=0; full legal-move coverage is not established."},
                       "sf_lite": sf, "category": category,
                       "regret_gap_cp": regret_gap,
                       "sf_comparison_depth": int(compared_depth) if compared_depth else None,
                       "review_status": "CANDIDATE_ONLY_NOT_VERIFIED"})
    # A fresh same-root, complete-MultiPV discrepancy comes before historical
    # leads; this is triage priority, not an engine-superiority assertion.
    priority = {"CDB_SF_GAP_TO_REVIEW": 0, "SF_LITE_UNDERESTIMATES_REGRET": 1,
                "CDB_SF_COMPARABLE": 1, "HISTORICAL_TRIAGE_ONLY": 2}
    result.sort(key=lambda x: (priority.get(x["category"], 3),
                               0 if focus and focus.casefold() in (canonical(x["headers"]) + x["source"]).casefold() else 1,
                               -(x["regret_gap_cp"] if x["regret_gap_cp"] is not None else -99999),
                               -x["cdb"]["regret_cp"], x["position_id"]))
    # Preserve a short diverse lead rather than filling the entire extract with
    # one game or archaic mating-score outliers. The full index remains in SQLite.
    diverse = []
    by_game: dict[str, int] = {}
    for row in result:
        if by_game.get(row["game_id"], 0) >= 3:
            continue
        by_game[row["game_id"]] = by_game.get(row["game_id"], 0) + 1
        diverse.append(row)
        if len(diverse) >= limit:
            break
    return diverse


def summary(conn: sqlite3.Connection, config: dict, cache: dict) -> dict:
    games = dict(conn.execute("SELECT status,COUNT(*) FROM games GROUP BY status"))
    game_classes: dict[str, dict[str, int]] = {"played_or_engine_games": {}, "opening_book_lines": {}}
    supplemental_sources = frozenset(row["name"] for row in config["inputs"]
                                     if row.get("source_set") == "supplemental")
    source_sets: dict[str, dict[str, int]] = {"active": {}, "supplemental": {}}
    for source, status, n in conn.execute("SELECT source,status,COUNT(*) FROM games GROUP BY source,status"):
        group = source_sets["supplemental" if source in supplemental_sources else "active"]
        group[status] = group.get(status, 0) + n
    for source_class, status, n in conn.execute(
            "SELECT CASE WHEN source LIKE 'Games/TopLines/%' THEN 'opening_book_lines' ELSE 'played_or_engine_games' END, "
            "status,COUNT(*) FROM games GROUP BY 1,2"):
        game_classes[source_class][status] = n
    observations = [{"provider": p, "status": s, "count": n} for p,s,n in
                    conn.execute("SELECT provider,status,COUNT(*) FROM observations GROUP BY provider,status")]
    recent = []
    for provider, action, fen, settings, status, parsed, raw, recorded, error in conn.execute(
            "SELECT provider,action,fen,settings,status,parsed,raw,recorded_at,error "
            "FROM observations ORDER BY recorded_at DESC LIMIT 12"):
        detail = None
        if parsed:
            item = json.loads(parsed)
            if provider == "SF_Lite":
                info = item.get("result", {})
                detail = {"achieved_depth": info.get("achievedDepth"),
                          "complete_multi_pv": info.get("completeMultiPV"),
                          "nodes": info.get("nodes"), "search_elapsed_ms": info.get("searchElapsedMs"),
                          "top_lines": [{"move": line.get("move"), "rank": line.get("rank"),
                                         "score": line.get("score")} for line in info.get("lines", [])[:8]],
                          "engine": item.get("engine", {})}
            else:
                text = item.get("text", "")
                detail = {"first_scored_moves": parse_cdb_moves(text)[:5] if action.startswith("queryall") else [],
                          "eval": re.search(r"eval:(-?\d+)", text).group(1) if re.search(r"eval:(-?\d+)", text) else None}
        recent.append({"provider": provider, "action": action, "fen": fen,
                       "settings": json.loads(settings), "status": status, "at": recorded,
                       "raw_sha256": sha((raw or "").encode()) if raw is not None else None,
                       "error": error, "detail": detail})
    chosen = conn.execute("SELECT COUNT(*) FROM selected_positions").fetchone()[0]
    return {"schema": SCHEMA, "version": VERSION, "generated_at": timestamp(), "config_sha256": sha(canonical(config).encode()),
            "games": games, "game_classes": game_classes, "source_sets": source_sets,
            "positions": conn.execute("SELECT COUNT(*) FROM positions").fetchone()[0],
            "selected_positions": chosen, "observations": observations, "recent_observations": recent,
            "candidates": candidates(conn, cache, limit=250, focus=config["focus"],
                                     supplemental_sources=supplemental_sources),
            "recent_events": [{"at":a,"kind":k,"detail":d} for a,k,d in
                              conn.execute("SELECT at,kind,detail FROM events ORDER BY id DESC LIMIT 30")]}


def readonly_connection(db: Path) -> sqlite3.Connection:
    if not db.exists():
        raise FileNotFoundError(db)
    uri = "file:" + urllib.parse.quote(str(db)) + "?mode=ro"
    return sqlite3.connect(uri, uri=True, timeout=5)


def write_output(run_dir: Path, config: dict, data: dict) -> None:
    atomic_json(run_dir / "manifest.json", {"identity": sha(canonical(config).encode()),
                                            "config": config, "summary": {k:v for k,v in data.items() if k != "candidates"}})
    lines = "".join(canonical(c) + "\n" for c in data["candidates"])
    tmp = run_dir / "candidates.jsonl.tmp"
    with tmp.open("wb") as f:
        f.write(lines.encode()); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, run_dir / "candidates.jsonl")


def live_extract(run_dir: Path, out: Path, config: dict) -> None:
    with readonly_connection(run_dir / "run.sqlite") as conn:
        conn.execute("BEGIN")
        # Snapshot is a read transaction over WAL. No backup or checkpoint is
        # required and no checkpoint/learning state is changed by this action.
        data = summary(conn, config, {})
        conn.rollback()
    prior_file = run_dir / "candidates.jsonl"
    committed_candidates = None
    if prior_file.is_file() and prior_file.stat().st_size <= 2 * 1024 * 1024:
        committed_candidates = prior_file.read_bytes()
        data["last_committed_candidate_file"] = {"sha256": sha(committed_candidates),
                                                  "bytes": len(committed_candidates),
                                                  "status": "PRIOR_COMMITTED_SNAPSHOT"}
    report = ["# ChessBest Power — read-only Live Extract", "", f"Generated UTC: {data['generated_at']}",
              f"Run ID: `{sha(canonical(config).encode())}`", f"Games: {data['games']}",
              f"Positions: {data['positions']}", f"Observations: {data['observations']}", "",
              "Latest live observations are read from SQLite. A separately labeled prior committed shortlist may include historical frozen triage.",
              "No candidate constitutes a verified strength comparison or publication approval."]
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("README.md", "\n".join(report) + "\n")
        z.writestr("summary.json", canonical({k:v for k,v in data.items() if k != "candidates"}) + "\n")
        z.writestr("current_live_candidates.jsonl", "".join(canonical(c) + "\n" for c in data["candidates"][:50]))
        if committed_candidates is not None:
            z.writestr("prior_committed_candidates.jsonl", b"\n".join(committed_candidates.splitlines()[:50]) + b"\n")
        z.writestr("config.json", canonical(config) + "\n")
    os.replace(tmp, out)
    print(f"Live Extract: {out} ({out.stat().st_size} bytes); source state unchanged")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Mine current ChessBest LAB Game library for evidence-backed Top Picks (no source writes)")
    sub = p.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="scan/resume PGNs then optionally make bounded provider observations")
    run.add_argument("--repo", default=str(HERE.parents[1]), help="repository root, pinned by source hashes")
    run.add_argument("--run-dir", help="isolated durable directory; default ~/.chessbest_power/runs/<config-hash>")
    run.add_argument("--frozen-cdb", help="historical 8zc_cache/cache.json or source pack ZIP for offline TRIAGE only")
    run.add_argument("--include-supplemental", action="store_true",
                     help="also scan unlisted on-disk player/TCEC PGNs; excludes curated/book PGNs")
    run.add_argument("--min-ply", type=int, default=30)
    run.add_argument("--max-ply", type=int, default=140)
    run.add_argument("--focus", default="", help="prioritize player/date/source text, not a corpus filter")
    run.add_argument("--focus-ply", type=int, default=0, help="if focus matches, prioritize this exact half-move (e.g. 88 = 44...f6)")
    run.add_argument("--max-positions", type=int, default=20, help="max unique FEN+played positions for enrichment")
    run.add_argument("--per-game-limit", type=int, default=2)
    run.add_argument("--live-cdb", action="store_true", help="opt in to public CDB requests; explicit total limit required")
    run.add_argument("--max-cdb-calls", type=int, default=0, help="total per run, including ambiguous interrupted calls")
    run.add_argument("--cdb-interval-ms", type=int, default=1250)
    run.add_argument("--sf-lite", action="store_true", help="opt in to EXACT LAB bundled Stockfish.js 18 Lite")
    run.add_argument("--max-sf-positions", type=int, default=0)
    run.add_argument("--sf-depths", type=int, nargs="+", default=[15,18,21])
    run.add_argument("--sf-timeout-s", type=int, default=180)
    stat = sub.add_parser("status", help="read-only state view")
    stat.add_argument("--run-dir", required=True)
    extract = sub.add_parser("extract", help="compact read-only Live Extract during a running scan")
    extract.add_argument("--run-dir", required=True)
    extract.add_argument("--out", required=True)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.command in ("status", "extract"):
        run_dir = Path(args.run_dir).resolve()
        with readonly_connection(run_dir / "run.sqlite") as conn:
            cfgrow = conn.execute("SELECT value FROM meta WHERE key='config'").fetchone()
            if not cfgrow:
                raise ValueError("Uninitialized/corrupt run database")
            config = json.loads(cfgrow[0])
            if args.command == "status":
                print(canonical({k:v for k,v in summary(conn, config, {}).items() if k != "candidates"}))
                return 0
        live_extract(run_dir, Path(args.out), config)
        return 0
    if args.min_ply < 1 or args.max_ply < args.min_ply or args.focus_ply < 0 or args.max_positions < 0 or args.per_game_limit < 1 or args.max_cdb_calls < 0 or args.max_sf_positions < 0:
        raise ValueError("Invalid nonnegative budget or ply range")
    if args.live_cdb and not args.max_cdb_calls:
        raise ValueError("--live-cdb requires --max-cdb-calls > 0")
    if args.sf_lite and not args.max_sf_positions:
        raise ValueError("--sf-lite requires --max-sf-positions > 0")
    if not 250 <= args.cdb_interval_ms <= 60000 or not 1 <= args.sf_timeout_s <= 3600 or not all(1 <= d <= 50 for d in args.sf_depths):
        raise ValueError("Invalid rate/timeout/depth")
    config = config_from_args(args)
    identity = sha(canonical(config).encode())
    run_dir = Path(args.run_dir).resolve() if args.run_dir else Path.home() / ".chessbest_power" / "runs" / identity[:16]
    with single_writer(run_dir):
        conn = init_db(run_dir / "run.sqlite", identity, config)
        try:
            event(conn, "launch", f"identity={identity} resume")
            scan(conn, config)
            if game_files(Path(config["repo"]), include_supplemental=config["include_supplemental"]) != config["inputs"]:
                raise ValueError("LAB game library changed during scan; source snapshot invalid")
            cache = load_frozen(config)
            enrich(conn, config, cache)
            if game_files(Path(config["repo"]), include_supplemental=config["include_supplemental"]) != config["inputs"]:
                raise ValueError("LAB game library changed during enrichment; source snapshot invalid")
            if config["sf_lite"] and sf_asset_hashes(Path(config["repo"])) != config["sf_assets"]:
                raise ValueError("SF Lite assets changed during enrichment; source snapshot invalid")
            data = summary(conn, config, cache)
            write_output(run_dir, config, data)
            event(conn, "run_complete", f"games={sum(data['games'].values())} positions={data['positions']} observations={len(data['recent_observations'])} recent")
            print(f"[{timestamp()}] COMPLETE games={data['games']} positions={data['positions']} "
                  f"triage_candidates={len(data['candidates'])} run={run_dir}")
        finally:
            conn.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, sqlite3.DatabaseError, subprocess.SubprocessError) as exc:
        print(f"ChessBest Power ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(2)
