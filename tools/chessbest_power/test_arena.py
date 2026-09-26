"""Focused crash, perspective and source-integrity checks for the arena."""

import hashlib
import json
import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import chess
import chess.pgn

import arena

SCRIPT = Path(arena.__file__).resolve()


def fixture(root: Path, count: int) -> tuple[Path, chess.Board]:
    games = root / "public/chess/new/Games"
    games.mkdir(parents=True)
    (root / "public/chess/new/js").mkdir(parents=True)
    (root / "public/chess/new/js/8zc-utils.js").write_text(
        "const gameBuckets = [\n    { name: 'Selected', file: 'Selected.pgn' },\n  ];\n")
    first_board = chess.Board()
    body = []
    choices = list(first_board.legal_moves)
    for i in range(count):
        game = chess.pgn.Game()
        game.headers["White"] = "Test A"
        game.headers["Black"] = f"Test B {i}"
        game.headers["Date"] = "2026.09.26"
        board = chess.Board()
        move1 = chess.Move.from_uci("e2e4") if i == 0 else choices[i % len(choices)]
        board.push(move1)
        move2 = chess.Move.from_uci("e7e5") if i == 0 else list(board.legal_moves)[(i // len(choices)) % board.legal_moves.count()]
        node = game.add_variation(move1)
        node.add_variation(move2)
        body.append(str(game))
    (games / "Selected.pgn").write_text("\n\n".join(body) + "\n", encoding="utf-8")
    return games / "Selected.pgn", first_board


def command(repo: Path, run_dir: Path, *extra: str) -> list[str]:
    return [sys.executable, str(SCRIPT), "run", "--repo", str(repo), "--run-dir", str(run_dir),
            "--min-ply", "1", "--max-ply", "4", "--max-positions", "2", *extra]


class ArenaTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory(prefix="ChessBest Power test ")
        self.addCleanup(self.dir.cleanup)
        self.base = Path(self.dir.name)
        self.repo = self.base / "source repo with spaces"
        self.run = self.base / "state with spaces"

    def test_offline_pov_and_idempotent_resume(self):
        fixture(self.repo, 3)
        b = chess.Board()
        b.push_san("e4")
        pre = b.fen()
        b.push_san("e5")
        post = b.fen()
        cache = {
            "qa:" + " ".join(pre.split()[:4]): {"moves": [
                {"move": "c7c5", "score": 200, "rank": 1},
                {"move": "e7e5", "score": 80, "rank": 2}]},
            "qa:" + " ".join(post.split()[:4]): {"moves": [{"move": "g1f3", "score": -80, "rank": 1}]},
        }
        frozen = self.base / "frozen inputs.json"
        frozen.write_text(json.dumps(cache), encoding="utf-8")
        cmd = command(self.repo, self.run, "--frozen-cdb", str(frozen), "--focus", "Test B 0")
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(done.returncode, 0, done.stderr)
        found = [json.loads(x) for x in (self.run / "candidates.jsonl").read_text().splitlines()]
        candidate = next(c for c in found if c["played_uci"] == "e7e5")
        self.assertEqual(candidate["cdb"]["regret_cp"], 120)
        self.assertEqual(candidate["cdb"]["best_cp_white"], -200)
        self.assertEqual(candidate["cdb"]["played_cp_white"], -80)
        self.assertEqual(candidate["review_status"], "CANDIDATE_ONLY_NOT_VERIFIED")
        before = sqlite3.connect(self.run / "run.sqlite")
        counts = [before.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in ("games", "positions", "observations", "selected_positions")]
        before.close()
        rerun = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(rerun.returncode, 0, rerun.stderr)
        after = sqlite3.connect(self.run / "run.sqlite")
        self.assertEqual([after.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in ("games", "positions", "observations", "selected_positions")], counts)
        after.close()
        self.assertEqual(counts[2], 0, "default run made a provider request")

    def test_live_one_root_move_child_score_and_sf_gap_rank_before_historical(self):
        fixture(self.repo, 1)
        cmd = command(self.repo, self.run)
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(done.returncode, 0, done.stderr)
        board = chess.Board()
        initial = board.fen()
        board.push_san("e4")
        root = board.fen()
        board.push_san("e5")
        child = board.fen()
        cache = {
            # The much larger historical lead must rank behind a live,
            # complete same-root move-regret discrepancy.
            "qa:" + " ".join(initial.split()[:4]): {"moves": [{"move": "d2d4", "score": 900, "rank": 1}]},
            "qs:" + " ".join(root.split()[:4]): {"score": -10},
        }
        with sqlite3.connect(self.run / "run.sqlite", isolation_level=None) as conn:
            arena.observe(conn, "CDB_live", "queryall:0", root, {"action": "queryall", "learn": 0},
                          lambda: ({"text": "move:c7c5,score:450,rank:1", "learn": 0},
                                   "move:c7c5,score:450,rank:1"))
            arena.observe(conn, "CDB_live", "queryscore", child, {"action": "queryscore", "learn": 0},
                          lambda: ({"text": "eval:-90", "learn": 0}, "eval:-90"))
            sf = {"request": {"fen": root, "depth": 15, "multiPV": 8},
                  "result": {"achievedDepth": 15, "completeMultiPV": True,
                             "lines": [{"move": "c7c5", "score": {"type": "cp", "bound": "exact", "mover": 220}},
                                       {"move": "e7e5", "score": {"type": "cp", "bound": "exact", "mover": 160}}]}}
            arena.observe(conn, "SF_Lite", "root:15", root, {"depth": 15, "multiPV": 8},
                          lambda: (sf, arena.canonical(sf)))
            rows = arena.candidates(conn, cache)
            self.assertEqual(rows[0]["played_uci"], "e7e5")
            self.assertEqual(rows[0]["category"], "CDB_SF_GAP_TO_REVIEW")
            self.assertEqual(rows[0]["cdb"]["regret_cp"], 360)
            self.assertEqual(rows[0]["cdb"]["root_coverage"], 1)
            self.assertEqual(rows[0]["cdb"]["played_origin"], "CDB_live")
            self.assertIn("learn=0", rows[0]["cdb"]["root_coverage_caution"])
            self.assertEqual(rows[0]["sf_lite"]["15"]["regret_cp"], 60)
            self.assertEqual(rows[0]["regret_gap_cp"], 300)
            self.assertEqual(rows[0]["sf_comparison_depth"], 15)
            self.assertEqual(rows[0]["review_status"], "CANDIDATE_ONLY_NOT_VERIFIED")
            self.assertTrue(any(row["category"] == "HISTORICAL_TRIAGE_ONLY" and
                                row["cdb"]["regret_cp"] == 890 for row in rows[1:]))
            sf["result"]["completeMultiPV"] = False
            conn.execute("UPDATE observations SET parsed=? WHERE provider='SF_Lite' AND action='root:15' AND fen=?",
                         (arena.canonical(sf), root))
            incomplete = next(row for row in arena.candidates(conn, cache) if row["played_uci"] == "e7e5")
            self.assertEqual(incomplete["category"], "EVAL_REGRET_UNCONFIRMED")
            self.assertIsNone(incomplete["regret_gap_cp"])

    def test_changed_input_fails_closed(self):
        p, _ = fixture(self.repo, 2)
        cmd = command(self.repo, self.run)
        ok = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        old = hashlib.sha256((self.run / "manifest.json").read_bytes()).hexdigest()
        p.write_text(p.read_text() + "\n{external edit}\n")
        reject = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(reject.returncode, 2)
        self.assertIn("Run identity differs", reject.stderr)
        self.assertEqual(hashlib.sha256((self.run / "manifest.json").read_bytes()).hexdigest(), old)

    def test_cdb_readonly_only_and_ambiguous_request_is_not_retried(self):
        b = chess.Board()
        with self.assertRaisesRegex(ValueError, "forbids learn=1"):
            arena.cdb_request("queryall", b.fen(), learn=1)
        config = {"schema": arena.SCHEMA, "test": True}
        conn = arena.init_db(self.run / "run.sqlite", arena.sha(arena.canonical(config).encode()), config)
        options = {"api": "chessdb.cn/cdb.php", "action": "queryall:0", "learn": 0, "showall": 1}
        key = arena.sha(arena.canonical(["CDB_live", "queryall:0", b.fen(), options]).encode())
        with conn:
            conn.execute("INSERT INTO observations VALUES(?,?,?,?,?,?,?,?,?,?)",
                         (key, "CDB_live", "queryall:0", b.fen(), arena.canonical(options),
                          "started", None, None, arena.timestamp(), None))
        called = []
        outcome = arena.observe(conn, "CDB_live", "queryall:0", b.fen(), options,
                                lambda: called.append(True))
        self.assertIsNone(outcome)
        self.assertEqual(called, [])
        self.assertEqual(conn.execute("SELECT status FROM observations WHERE observation_id=?", (key,)).fetchone()[0], "ambiguous")
        conn.close()

    def test_active_bucket_change_fails_closed_and_curated_file_is_excluded(self):
        fixture(self.repo, 2)
        curated = self.repo / "public/chess/new/Games/ChessBest_Top_Picks.pgn"
        curated.write_text((self.repo / "public/chess/new/Games/Selected.pgn").read_text())
        active = self.repo / "public/chess/new/js/8zc-utils.js"
        active.write_text(active.read_text().replace("  ];", "    { name: 'ChessBest Top Picks', file: 'ChessBest_Top_Picks.pgn' },\n  ];"))
        self.assertTrue(all("Top_Picks" not in x["name"] for x in arena.game_files(self.repo)))
        cmd = command(self.repo, self.run)
        ok = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        with sqlite3.connect(self.run / "run.sqlite") as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM games").fetchone()[0], 2)
        extra = self.repo / "public/chess/new/Games/More.pgn"
        extra.write_text((self.repo / "public/chess/new/Games/Selected.pgn").read_text())
        active.write_text(active.read_text().replace("  ];", "    { name: 'More', file: 'More.pgn' },\n  ];"))
        reject = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(reject.returncode, 2)
        self.assertIn("Run identity differs", reject.stderr)

    def test_forced_kill_resume_and_readonly_live_extract(self):
        fixture(self.repo, 100)
        cmd = command(self.repo, self.run)
        env = dict(os.environ, CHESSBEST_POWER_TEST_PAUSE_AFTER_COMMIT_MS="40")
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, env=env)
        try:
            deadline = time.monotonic() + 12
            count = 0
            while time.monotonic() < deadline:
                try:
                    with arena.readonly_connection(self.run / "run.sqlite") as c:
                        count = c.execute("SELECT COUNT(*) FROM games").fetchone()[0]
                except (FileNotFoundError, sqlite3.DatabaseError, sqlite3.OperationalError):
                    pass
                if 3 <= count < 100:
                    break
                time.sleep(.01)
            self.assertTrue(3 <= count < 100, f"could not observe mid-run checkpoint: {count}")
            if os.name != "nt":
                os.kill(proc.pid, signal.SIGSTOP)
                time.sleep(.05)
                db = self.run / "run.sqlite"
                wal = self.run / "run.sqlite-wal"
                before = [hashlib.sha256(p.read_bytes()).digest() for p in (db, wal) if p.exists()]
                extract = self.base / "Live Extract with spaces.zip"
                generated = subprocess.run([sys.executable, str(SCRIPT), "extract", "--run-dir", str(self.run), "--out", str(extract)],
                                           capture_output=True, text=True, timeout=20)
                self.assertEqual(generated.returncode, 0, generated.stderr)
                self.assertTrue(extract.exists())
                with __import__("zipfile").ZipFile(extract) as z:
                    self.assertIn("summary.json", z.namelist())
                self.assertEqual(before, [hashlib.sha256(p.read_bytes()).digest() for p in (db, wal) if p.exists()])
                os.kill(proc.pid, signal.SIGCONT)
            proc.kill()
            proc.wait(timeout=10)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=10)
            proc.stderr.close()
        resumed = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        self.assertEqual(resumed.returncode, 0, resumed.stderr)
        with sqlite3.connect(self.run / "run.sqlite") as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM games").fetchone()[0], 100)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM games WHERE status='duplicate'").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM positions").fetchone()[0], 200)
        repeated = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        self.assertEqual(repeated.returncode, 0, repeated.stderr)


if __name__ == "__main__":
    unittest.main()
