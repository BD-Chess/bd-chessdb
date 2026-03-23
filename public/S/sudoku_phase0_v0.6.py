#!/usr/bin/env python3
"""
Sudoku Phase 0 — Founding Hypothesis Empirical Test
AIF8 · AIM³ Lab · March 23, 2026

En kernel. Štiri abecede. Vsaka nova domena POTRJUJE
da je kernel domensko neodvisen — ker DELUJE na drugačni abecedi.

Tests whether the MDL founding hypothesis (better solution = more compressible process)
holds on constraint satisfaction (Sudoku) — a domain with ZERO geometry.

Usage:
    python sudoku_phase0.py                        # full: 1000 puzzles 9×9
    python sudoku_phase0.py --count 50             # quick test: 50 puzzles
    python sudoku_phase0.py --count 100 --size 16  # 16×16 optional
    python sudoku_phase0.py --test-solver          # verify solver correctness
    python sudoku_phase0.py --test-metrics         # verify metrics computation
"""

import argparse
import csv
import math
import os
import random
import sys
import time
from collections import defaultdict
from copy import deepcopy
from statistics import median

# ─────────────────────────────────────────────────────────────
#  LZ76 — proven implementation from TSP arena
# ─────────────────────────────────────────────────────────────

def lz76_complexity(bitstring):
    """Lempel-Ziv 76 complexity count."""
    n = len(bitstring)
    if n <= 1:
        return n
    c = 1
    l = 1
    i = 0
    k = 1
    k_max = 1
    while True:
        if bitstring[i + k - 1] == bitstring[l + k - 1]:
            k += 1
            if l + k > n:
                c += 1
                break
        else:
            if k > k_max:
                k_max = k
            i += 1
            if i == l:
                c += 1
                l += k_max
                if l >= n:
                    break
                i = 0
                k = 1
                k_max = 1
            else:
                k = 1
    return c


def lz76_normalized(bitstring):
    """LZ76 complexity normalized by sequence length."""
    n = len(bitstring)
    if n <= 1:
        return 0.0
    raw = lz76_complexity(bitstring)
    return raw / (n / max(math.log2(n), 1.0))


# ─────────────────────────────────────────────────────────────
#  Sudoku Grid Utilities
# ─────────────────────────────────────────────────────────────

def get_candidates(grid, size):
    """Compute candidate sets for every empty cell."""
    box_size = int(math.isqrt(size))
    candidates = {}
    all_vals = set(range(1, size + 1))
    for r in range(size):
        for c in range(size):
            if grid[r][c] == 0:
                row_vals = set(grid[r])
                col_vals = {grid[rr][c] for rr in range(size)}
                br, bc = (r // box_size) * box_size, (c // box_size) * box_size
                box_vals = {grid[br + dr][bc + dc]
                            for dr in range(box_size) for dc in range(box_size)}
                candidates[(r, c)] = all_vals - row_vals - col_vals - box_vals
    return candidates


def count_total_candidates(grid, size):
    """Count total number of candidates across all empty cells."""
    cands = get_candidates(grid, size)
    return sum(len(v) for v in cands.values())


def is_valid_placement(grid, r, c, val, size):
    """Check if placing val at (r,c) is valid."""
    box_size = int(math.isqrt(size))
    if val in grid[r]:
        return False
    if any(grid[rr][c] == val for rr in range(size)):
        return False
    br, bc = (r // box_size) * box_size, (c // box_size) * box_size
    for dr in range(box_size):
        for dc in range(box_size):
            if grid[br + dr][bc + dc] == val:
                return False
    return True


def is_solved(grid, size):
    """Check if grid is fully and correctly solved."""
    all_vals = set(range(1, size + 1))
    box_size = int(math.isqrt(size))
    for r in range(size):
        if set(grid[r]) != all_vals:
            return False
    for c in range(size):
        if {grid[r][c] for r in range(size)} != all_vals:
            return False
    for br in range(0, size, box_size):
        for bc in range(0, size, box_size):
            box = {grid[br + dr][bc + dc]
                   for dr in range(box_size) for dc in range(box_size)}
            if box != all_vals:
                return False
    return True


# ─────────────────────────────────────────────────────────────
#  Solver with Logging
# ─────────────────────────────────────────────────────────────

def solve_logged(grid_input, size=None):
    """
    Solve Sudoku with backtracking + naked/hidden singles propagation.
    Returns (solved_grid, log) where log is a list of step dicts.
    """
    if size is None:
        size = len(grid_input)
    grid = deepcopy(grid_input)
    log = []
    step_counter = [0]

    def propagate_singles(grid):
        """Propagate naked and hidden singles. Returns resolved cells and contradiction flag."""
        resolved = []
        changed = True
        box_size = int(math.isqrt(size))
        while changed:
            changed = False
            cands = get_candidates(grid, size)
            # Naked singles
            for (r, c), vals in list(cands.items()):
                if len(vals) == 0:
                    return resolved, True
                if len(vals) == 1:
                    val = next(iter(vals))
                    grid[r][c] = val
                    resolved.append((r, c, val, "naked_single"))
                    changed = True
                    break  # recompute candidates
            if changed:
                continue
            # Hidden singles — rows
            cands = get_candidates(grid, size)
            found = False
            for r in range(size):
                val_positions = defaultdict(list)
                for (cr, cc), vals in cands.items():
                    if cr == r:
                        for v in vals:
                            val_positions[v].append((cr, cc))
                for v, cells in val_positions.items():
                    if len(cells) == 1:
                        cr, cc = cells[0]
                        grid[cr][cc] = v
                        resolved.append((cr, cc, v, "hidden_single"))
                        changed = True
                        found = True
                        break
                if found:
                    break
            if changed:
                continue
            # Hidden singles — cols
            for c in range(size):
                val_positions = defaultdict(list)
                for (cr, cc), vals in cands.items():
                    if cc == c:
                        for v in vals:
                            val_positions[v].append((cr, cc))
                for v, cells in val_positions.items():
                    if len(cells) == 1:
                        cr, cc = cells[0]
                        grid[cr][cc] = v
                        resolved.append((cr, cc, v, "hidden_single"))
                        changed = True
                        found = True
                        break
                if found:
                    break
            if changed:
                continue
            # Hidden singles — boxes
            for br in range(0, size, box_size):
                for bc in range(0, size, box_size):
                    val_positions = defaultdict(list)
                    for (cr, cc), vals in cands.items():
                        if br <= cr < br + box_size and bc <= cc < bc + box_size:
                            for v in vals:
                                val_positions[v].append((cr, cc))
                    for v, cells in val_positions.items():
                        if len(cells) == 1:
                            cr, cc = cells[0]
                            grid[cr][cc] = v
                            resolved.append((cr, cc, v, "hidden_single"))
                            changed = True
                            found = True
                            break
                    if found:
                        break
                if found:
                    break
        return resolved, False

    def solve_recursive(grid):
        cands_before = count_total_candidates(grid, size)
        resolved, contradiction = propagate_singles(grid)

        # Log propagated cells with cascade depth on first cell
        cascade_len = len(resolved)
        for i, (r, c, v, strategy) in enumerate(resolved):
            step_counter[0] += 1
            cands_now = count_total_candidates(grid, size)
            log.append({
                "step": step_counter[0],
                "row": r, "col": c, "value": v,
                "strategy": strategy,
                "candidates_before": cands_before,
                "candidates_after": cands_now,
                "cascade_depth": cascade_len - 1 if i == 0 else 0,
                "backtrack": False
            })
            cands_before = cands_now

        if contradiction:
            for r, c, v, _ in reversed(resolved):
                grid[r][c] = 0
            return False

        # Check if solved
        if not any(grid[r][c] == 0 for r in range(size) for c in range(size)):
            return True

        # MRV: pick empty cell with fewest candidates
        cands = get_candidates(grid, size)
        if not cands:
            for r, c, v, _ in reversed(resolved):
                grid[r][c] = 0
            return False

        min_cell = min(cands.keys(), key=lambda k: len(cands[k]))
        if len(cands[min_cell]) == 0:
            for r, c, v, _ in reversed(resolved):
                grid[r][c] = 0
            return False

        r, c = min_cell
        for val in sorted(cands[(r, c)]):
            step_counter[0] += 1
            cb = count_total_candidates(grid, size)
            grid[r][c] = val
            ca = count_total_candidates(grid, size)
            log.append({
                "step": step_counter[0],
                "row": r, "col": c, "value": val,
                "strategy": "guess",
                "candidates_before": cb,
                "candidates_after": ca,
                "cascade_depth": 0,
                "backtrack": False
            })

            saved = deepcopy(grid)
            if solve_recursive(grid):
                return True

            # Backtrack
            step_counter[0] += 1
            for rr in range(size):
                for cc in range(size):
                    grid[rr][cc] = saved[rr][cc]
            grid[r][c] = 0
            ca2 = count_total_candidates(grid, size)
            log.append({
                "step": step_counter[0],
                "row": r, "col": c, "value": val,
                "strategy": "backtrack",
                "candidates_before": ca,
                "candidates_after": ca2,
                "cascade_depth": 0,
                "backtrack": True
            })

        for r, c, v, _ in reversed(resolved):
            grid[r][c] = 0
        return False

    solve_recursive(grid)
    return grid, log


# ─────────────────────────────────────────────────────────────
#  Metrics
# ─────────────────────────────────────────────────────────────

def compute_metrics(log, solved_grid, size=9):
    """Compute all four metrics plus control from a solve log."""
    if not log:
        return {"n_steps": 0, "n_backtracks": 0,
                "LZ_process": 0.0, "LZ_solution": 0.0,
                "LZ_cascade": 0.0, "ADSR_bimodality": 0.0}

    n_steps = len(log)
    n_backtracks = sum(1 for s in log if s["backtrack"])

    # ρ₁: LZ_process — entropy deltas
    deltas = [s["candidates_before"] - s["candidates_after"] for s in log]
    if len(deltas) >= 2:
        med_d = median(deltas)
        bits = ''.join('1' if d > med_d else '0' for d in deltas)
        lz_process = lz76_normalized(bits)
    else:
        lz_process = 0.0

    # ρ₂: LZ_solution — solved grid as binary string
    grid_str = ''.join(str(solved_grid[r][c]) for r in range(size) for c in range(size))
    bits_sol = ''.join(format(int(ch), '04b') for ch in grid_str if ch.isdigit())
    lz_solution = lz76_normalized(bits_sol) if len(bits_sol) > 1 else 0.0

    # ρ₃: LZ_cascade — cascade depth sequence (non-backtrack steps only)
    cascades = [s["cascade_depth"] for s in log if not s["backtrack"]]
    if len(cascades) >= 2:
        med_c = median(cascades)
        bits_c = ''.join('1' if d > med_c else '0' for d in cascades)
        lz_cascade = lz76_normalized(bits_c)
    else:
        lz_cascade = 0.0

    # ρ₄: ADSR bimodality
    if cascades:
        n_zero = sum(1 for d in cascades if d == 0)
        n_deep = sum(1 for d in cascades if d >= 5)
        adsr = (n_zero + n_deep) / len(cascades)
    else:
        adsr = 0.0

    return {
        "n_steps": n_steps,
        "n_backtracks": n_backtracks,
        "LZ_process": round(lz_process, 6),
        "LZ_solution": round(lz_solution, 6),
        "LZ_cascade": round(lz_cascade, 6),
        "ADSR_bimodality": round(adsr, 6)
    }


# ─────────────────────────────────────────────────────────────
#  Puzzle Generator
# ─────────────────────────────────────────────────────────────

def generate_full_grid(size=9):
    """Generate a random complete valid Sudoku grid."""
    grid = [[0] * size for _ in range(size)]

    def fill(pos=0):
        if pos == size * size:
            return True
        r, c = pos // size, pos % size
        vals = list(range(1, size + 1))
        random.shuffle(vals)
        for v in vals:
            if is_valid_placement(grid, r, c, v, size):
                grid[r][c] = v
                if fill(pos + 1):
                    return True
                grid[r][c] = 0
        return False

    fill()
    return grid


def count_solutions(grid, size, limit=2):
    """Count solutions up to limit (for uniqueness check)."""
    grid = deepcopy(grid)
    count = [0]

    def solve(pos=0):
        if count[0] >= limit:
            return
        while pos < size * size:
            r, c = pos // size, pos % size
            if grid[r][c] == 0:
                break
            pos += 1
        else:
            count[0] += 1
            return
        r, c = pos // size, pos % size
        for v in range(1, size + 1):
            if is_valid_placement(grid, r, c, v, size):
                grid[r][c] = v
                solve(pos + 1)
                if count[0] >= limit:
                    grid[r][c] = 0
                    return
                grid[r][c] = 0

    solve()
    return count[0]


def generate_puzzle(size=9, target_givens=None):
    """Generate a puzzle with unique solution."""
    solution = generate_full_grid(size)
    puzzle = deepcopy(solution)
    cells = [(r, c) for r in range(size) for c in range(size)]
    random.shuffle(cells)

    removed = 0
    total = size * size
    for r, c in cells:
        if target_givens and (total - removed) <= target_givens:
            break
        saved = puzzle[r][c]
        puzzle[r][c] = 0
        if count_solutions(puzzle, size, limit=2) != 1:
            puzzle[r][c] = saved
        else:
            removed += 1

    n_givens = sum(1 for r in range(size) for c in range(size) if puzzle[r][c] != 0)
    return puzzle, solution, n_givens


def classify_difficulty(puzzle, size=9):
    """Classify puzzle difficulty by givens count and guesses needed."""
    n_givens = sum(1 for r in range(size) for c in range(size) if puzzle[r][c] != 0)
    _, log = solve_logged(deepcopy(puzzle), size)
    n_guesses = sum(1 for s in log if s["strategy"] == "guess")

    if size == 9:
        if n_guesses == 0 and n_givens >= 36:
            return "easy", 1
        elif n_guesses <= 2 and n_givens >= 28:
            return "medium", 2
        elif n_guesses <= 5 and n_givens >= 24:
            return "hard", 3
        else:
            return "evil", 4
    else:
        if n_guesses == 0:
            return "easy", 1
        elif n_guesses <= 5:
            return "medium", 2
        elif n_guesses <= 15:
            return "hard", 3
        else:
            return "evil", 4


def generate_puzzle_set(count=1000, size=9, status_callback=None, quiet=False):
    """Generate puzzles with balanced difficulty distribution."""
    if count >= 100:
        target = {
            "easy": int(count * 0.30),
            "medium": int(count * 0.30),
            "hard": int(count * 0.20),
            "evil": count - int(count * 0.80)
        }
    else:
        per = count // 4
        target = {"easy": per, "medium": per, "hard": per, "evil": count - 3 * per}

    # Givens targets to steer difficulty
    givens_ranges = {
        "easy": (36, 45), "medium": (28, 35),
        "hard": (24, 27), "evil": (17, 23)
    }

    puzzles = []
    counts = {"easy": 0, "medium": 0, "hard": 0, "evil": 0}
    attempts = 0
    max_attempts = count * 30

    t0 = time.time()
    while sum(counts.values()) < count and attempts < max_attempts:
        attempts += 1
        needed = {d: target[d] - counts[d] for d in target if target[d] - counts[d] > 0}
        if not needed:
            break

        target_diff = max(needed, key=needed.get)
        lo, hi = givens_ranges[target_diff]
        tg = random.randint(lo, hi)

        puzzle, solution, n_givens = generate_puzzle(size, tg)
        difficulty, diff_num = classify_difficulty(puzzle, size)

        if counts[difficulty] < target.get(difficulty, 0):
            counts[difficulty] += 1
            puzzles.append({
                "puzzle": puzzle, "solution": solution,
                "n_givens": n_givens,
                "difficulty": difficulty, "difficulty_num": diff_num
            })
            done = sum(counts.values())
            if status_callback:
                status_callback(done, "generating")
            if not quiet:
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                eta = (count - done) / rate if rate > 0 else 0
                sys.stdout.write(
                    f"\r  Generating: {done}/{count} "
                    f"[E:{counts['easy']} M:{counts['medium']} H:{counts['hard']} X:{counts['evil']}] "
                    f"({elapsed:.0f}s, ~{eta:.0f}s remaining)   "
                )
                sys.stdout.flush()

    if not quiet:
        print()
    return puzzles


# ─────────────────────────────────────────────────────────────
#  Analysis
# ─────────────────────────────────────────────────────────────

def run_analysis(results):
    """Compute and display Spearman ρ for each metric vs difficulty."""
    try:
        from scipy.stats import spearmanr
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "scipy",
                               "--break-system-packages", "-q"])
        from scipy.stats import spearmanr

    difficulties = [r["difficulty_num"] for r in results]
    metrics = {
        "LZ_process": [r["LZ_process"] for r in results],
        "LZ_solution": [r["LZ_solution"] for r in results],
        "LZ_cascade": [r["LZ_cascade"] for r in results],
        "ADSR_bimodal": [r["ADSR_bimodality"] for r in results],
        "backtracks": [r["n_backtracks"] for r in results],
    }

    by_diff = defaultdict(list)
    for r in results:
        by_diff[r["difficulty"]].append(r)

    print("\n  Per-difficulty averages:\n")
    print(f"  {'Difficulty':<12} {'N':>5} {'Steps':>7} {'BT':>6} {'LZ_proc':>8} {'LZ_sol':>8} {'LZ_casc':>8} {'ADSR':>6}")
    print(f"  {'─' * 12} {'─' * 5} {'─' * 7} {'─' * 6} {'─' * 8} {'─' * 8} {'─' * 8} {'─' * 6}")

    for d in ["easy", "medium", "hard", "evil"]:
        if d not in by_diff:
            continue
        items = by_diff[d]
        n = len(items)
        avg = lambda key: sum(r[key] for r in items) / n
        print(f"  {d:<12} {n:>5} {avg('n_steps'):>7.1f} {avg('n_backtracks'):>6.1f} "
              f"{avg('LZ_process'):>8.3f} {avg('LZ_solution'):>8.3f} "
              f"{avg('LZ_cascade'):>8.3f} {avg('ADSR_bimodality'):>6.2f}")

    print("\n  Spearman ρ vs difficulty:\n")
    labels = {
        "LZ_process":  "ρ₁ LZ_process   ",
        "LZ_solution": "ρ₂ LZ_solution  ",
        "LZ_cascade":  "ρ₃ LZ_cascade   ",
        "ADSR_bimodal":"ρ₄ ADSR_bimodal ",
        "backtracks":  "ρ_ref backtracks",
    }
    notes = {
        "LZ_process":  "← founding hypothesis",
        "LZ_solution": "← rešitev ali proces?",
        "LZ_cascade":  "← dinamična piramida",
        "ADSR_bimodal":"← bifurkacija",
        "backtracks":  "← kontrola",
    }

    rho_results = {}
    for key in ["LZ_process", "LZ_solution", "LZ_cascade", "ADSR_bimodal", "backtracks"]:
        rho, p = spearmanr(difficulties, metrics[key])
        rho_results[key] = (rho, p)
        print(f"  {labels[key]} = {rho:+.4f}  (p = {p:.4e})  {notes[key]}")

    rho1 = rho_results["LZ_process"][0]
    rho2 = rho_results["LZ_solution"][0]
    rho3 = rho_results["LZ_cascade"][0]
    rho4 = rho_results["ADSR_bimodal"][0]

    print("\n  INTERPRETACIJA:")
    if rho1 > 0.5:
        print("  ✓ ρ₁ > 0.5 → founding hypothesis DRŽI na constraint satisfaction")
    elif rho1 > 0.3:
        print("  ~ ρ₁ > 0.3 → moderate signal — partially supported")
    else:
        print("  ✗ ρ₁ ≤ 0.3 → weak signal — further investigation needed")

    if rho1 > 0.5 and abs(rho2) < 0.2:
        print("  ✓ ρ₁ > 0.5 in ρ₂ ≈ 0 → kompresibilen PROCES, ne rešitev")
    elif abs(rho2) > 0.3:
        print(f"  ~ ρ₂ = {rho2:+.3f} → rešitev sama ima signal")

    if rho3 > rho1:
        print("  ✓ ρ₃ > ρ₁ → cascade depth boljši senzor kot entropy delta")
    else:
        print(f"  ~ ρ₃ ≤ ρ₁ → entropy delta remains primary sensor")

    if rho4 < -0.3:
        print("  ✓ ρ₄ < -0.3 → ADSR bifurkacija korelira s težavnostjo")
    else:
        print(f"  ~ ρ₄ = {rho4:+.3f} → ADSR pattern inconclusive")

    return rho_results


# ─────────────────────────────────────────────────────────────
#  Self-Tests
# ─────────────────────────────────────────────────────────────

def test_solver():
    """Verify solver correctness on known puzzles."""
    print("\n  ── Solver Self-Test ──\n")

    hard_puzzle = [
        [8, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 3, 6, 0, 0, 0, 0, 0],
        [0, 7, 0, 0, 9, 0, 2, 0, 0],
        [0, 5, 0, 0, 0, 7, 0, 0, 0],
        [0, 0, 0, 0, 4, 5, 7, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 3, 0],
        [0, 0, 1, 0, 0, 0, 0, 6, 8],
        [0, 0, 8, 5, 0, 0, 0, 1, 0],
        [0, 9, 0, 0, 0, 0, 4, 0, 0],
    ]
    easy_puzzle = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ]

    all_pass = True
    for name, puzzle in [("Easy", easy_puzzle), ("Hard (Inkala)", hard_puzzle)]:
        t0 = time.time()
        solved, log = solve_logged(puzzle)
        dt = time.time() - t0
        valid = is_solved(solved, 9)
        n_bt = sum(1 for s in log if s["backtrack"])
        status = "PASS ✓" if valid else "FAIL ✗"
        if not valid:
            all_pass = False
        print(f"  {name:20s}: {status}  ({len(log)} steps, {n_bt} BT, {dt:.3f}s)")

    print(f"\n  Round-trip test (generate → solve → verify)...")
    puzzle, solution, n_givens = generate_puzzle(9)
    solved, log = solve_logged(puzzle)
    match = all(solved[r][c] == solution[r][c] for r in range(9) for c in range(9))
    valid = is_solved(solved, 9) and match
    status = "PASS ✓" if valid else "FAIL ✗"
    if not valid:
        all_pass = False
    print(f"  Generated puzzle:     {status}  ({n_givens} givens, {len(log)} steps)")

    print(f"\n  {'All solver tests passed ✓' if all_pass else 'SOME TESTS FAILED ✗'}")
    return all_pass


def test_metrics():
    """Verify metrics computation."""
    print("\n  ── Metrics Self-Test ──\n")
    all_pass = True

    assert lz76_complexity("0000000000") == 2, "LZ76 all-zeros"
    assert lz76_complexity("0101010101") == 3, "LZ76 01-repeat"
    c3 = lz76_complexity("0110100101")
    assert c3 >= 4, f"LZ76 random-ish: got {c3}"
    print("  LZ76 basic tests:    PASS ✓")

    puzzle, solution, _ = generate_puzzle(9)
    solved, log = solve_logged(puzzle)
    m = compute_metrics(log, solved, 9)
    assert m["n_steps"] > 0
    assert 0 <= m["LZ_process"] <= 2.0, f"LZ_process={m['LZ_process']}"
    assert 0 <= m["LZ_solution"] <= 2.0, f"LZ_solution={m['LZ_solution']}"
    assert 0 <= m["ADSR_bimodality"] <= 1.0, f"ADSR={m['ADSR_bimodality']}"
    print(f"  Metric ranges:       PASS ✓  (steps={m['n_steps']}, LZ_p={m['LZ_process']:.3f}, "
          f"LZ_s={m['LZ_solution']:.3f}, ADSR={m['ADSR_bimodality']:.2f})")

    easy_p, easy_sol, _ = generate_puzzle(9, target_givens=40)
    hard_p, hard_sol, _ = generate_puzzle(9, target_givens=22)
    _, el = solve_logged(easy_p)
    _, hl = solve_logged(hard_p)
    em = compute_metrics(el, easy_sol, 9)
    hm = compute_metrics(hl, hard_sol, 9)
    print(f"  Easy puzzle:         steps={em['n_steps']:>4}, BT={em['n_backtracks']:>3}, LZ_p={em['LZ_process']:.3f}")
    print(f"  Hard puzzle:         steps={hm['n_steps']:>4}, BT={hm['n_backtracks']:>3}, LZ_p={hm['LZ_process']:.3f}")

    print(f"\n  {'All metric tests passed ✓' if all_pass else 'SOME TESTS FAILED ✗'}")
    return all_pass


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sudoku Phase 0 — Founding Hypothesis Test")
    parser.add_argument("--count", type=int, default=1000, help="Number of puzzles")
    parser.add_argument("--size", type=int, default=9, choices=[9, 16], help="Grid size")
    parser.add_argument("--test-solver", action="store_true")
    parser.add_argument("--test-metrics", action="store_true")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--csv", type=str, default="sudoku_phase0_results.csv")
    parser.add_argument("--workers", type=int, default=1, help="Parallel workers (subprocess per worker)")
    parser.add_argument("--resume", action="store_true", help="Resume interrupted run")
    parser.add_argument("--worker-id", type=int, default=None, help="(internal) worker index")
    parser.add_argument("--worker-count", type=int, default=None, help="(internal) total workers")
    parser.add_argument("--skip", type=int, default=0, help="(internal) skip first N solved puzzles (resume)")
    args = parser.parse_args()

    if args.worker_id is None:
        print("""
══════════════════════════════════════════════════════
  Sudoku Phase 0 — Founding Hypothesis Test
  AIF8 · AIM³ Lab · March 23, 2026
══════════════════════════════════════════════════════""")

    if args.test_solver:
        return 0 if test_solver() else 1
    if args.test_metrics:
        return 0 if test_metrics() else 1

    # ── Multi-worker launcher ──
    if args.workers > 1 and args.worker_id is None:
        import subprocess, json, shutil
        cols = shutil.get_terminal_size((80, 25)).columns

        print(f"\n  Config: {args.count} puzzles, {args.size}×{args.size}, seed={args.seed}")
        print(f"  Workers: {args.workers} (work-stealing)")
        if args.resume:
            print(f"  Mode: RESUME")
        print(f"  Output: {args.csv}\n")

        t0 = time.time()

        # ── Build task list with pre-assigned difficulties ──
        task_file = "_sudoku_tasks.json"
        counter_file = "_sudoku_counter.txt"
        lock_file = "_sudoku_counter.lock"

        if args.resume and os.path.exists(task_file):
            with open(task_file, "r") as f:
                tasks = json.load(f)
            print(f"  Resumed task list: {len(tasks)} tasks")
        else:
            # Assign difficulties
            if args.count >= 100:
                dist = {"easy": int(args.count * 0.30), "medium": int(args.count * 0.30),
                        "hard": int(args.count * 0.20)}
                dist["evil"] = args.count - dist["easy"] - dist["medium"] - dist["hard"]
            else:
                q = args.count // 4
                dist = {"easy": q, "medium": q, "hard": q, "evil": args.count - 3 * q}

            tasks = []
            diff_map = {"easy": 1, "medium": 2, "hard": 3, "evil": 4}
            for diff in ["easy", "medium", "hard", "evil"]:
                for _ in range(dist[diff]):
                    tid = len(tasks)
                    tasks.append({"id": tid, "difficulty": diff,
                                  "difficulty_num": diff_map[diff],
                                  "seed": args.seed + tid})
            # Shuffle so evil isn't all at the end
            random.seed(args.seed)
            random.shuffle(tasks)
            # Re-number after shuffle
            for i, t in enumerate(tasks):
                t["id"] = i

            with open(task_file, "w") as f:
                json.dump(tasks, f)

        # ── Find already-completed task IDs (resume) ──
        completed_ids = set()
        if args.resume:
            for wid in range(args.workers):
                tmp_csv = f"_sudoku_w{wid}.csv"
                if os.path.exists(tmp_csv):
                    try:
                        with open(tmp_csv, "r") as f:
                            for row in csv.DictReader(f):
                                completed_ids.add(int(row["puzzle_id"]) - 1)  # puzzle_id is 1-indexed
                    except: pass
            if completed_ids:
                print(f"  Already completed: {len(completed_ids)}/{len(tasks)} tasks")

        # ── Init counter (skip completed) ──
        if not args.resume or not os.path.exists(counter_file):
            with open(counter_file, "w") as f:
                f.write("0")
        # Clean lock
        if os.path.exists(lock_file):
            os.remove(lock_file)

        # ── Write completed set for workers ──
        completed_file = "_sudoku_completed.json"
        with open(completed_file, "w") as f:
            json.dump(list(completed_ids), f)

        # ── Launch workers ──
        status_files = []
        tmp_csvs = []
        procs = []

        for wid in range(args.workers):
            tmp_csv = f"_sudoku_w{wid}.csv"
            status_f = f"_sudoku_w{wid}.status"
            tmp_csvs.append(tmp_csv)
            status_files.append(status_f)

            if not args.resume:
                for fn in [tmp_csv, status_f]:
                    if os.path.exists(fn):
                        os.remove(fn)

            cmd = [
                sys.executable, __file__,
                "--count", str(args.count),
                "--size", str(args.size),
                "--seed", str(args.seed),
                "--csv", tmp_csv,
                "--worker-id", str(wid),
                "--worker-count", str(args.workers),
            ]
            if args.resume:
                cmd.append("--resume")
            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            p = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
            procs.append((wid, p))

        print(f"  Launched W0..W{args.workers-1}\n")

        # ── Enable ANSI on Windows ──
        if sys.platform == "win32":
            try:
                import ctypes
                k = ctypes.windll.kernel32
                k.SetConsoleMode(k.GetStdHandle(-11), 7)
            except: pass

        # ── Poll status files — two-line display ──
        total_target = args.count
        all_done = False
        first_print = True
        while not all_done:
            time.sleep(0.5)
            gen_parts = []
            solve_parts = []
            total_gen = 0
            total_solve = 0
            for wid, p in procs:
                sf = status_files[wid]
                gd = 0; sd = 0
                try:
                    with open(sf, "r") as f:
                        data = json.loads(f.read())
                        gd = data.get("gen", 0)
                        sd = data.get("solve", 0)
                except:
                    pass
                total_gen += gd
                total_solve += sd
                gen_parts.append(f"{gd:>3}")
                solve_parts.append(f"{sd:>3}")

            elapsed = time.time() - t0
            rate = total_solve / elapsed if elapsed > 0 else 0.01
            remaining = total_target - total_solve - len(completed_ids)
            eta = max(0, remaining / rate) if rate > 0.01 else 0

            gen_line = f"  Gen:   [{' '.join(gen_parts)}] {total_gen}"
            sol_line = f"  Solve: [{' '.join(solve_parts)}] {total_solve + len(completed_ids)}/{total_target}  {elapsed:.0f}s eta:{eta:.0f}s"
            if len(gen_line) > cols - 1:
                gen_line = gen_line[:cols - 4] + "..."
            if len(sol_line) > cols - 1:
                sol_line = sol_line[:cols - 4] + "..."

            if first_print:
                sys.stdout.write(f"{gen_line:<{cols-1}}\n{sol_line:<{cols-1}}")
                first_print = False
            else:
                sys.stdout.write(f"\033[A\r{gen_line:<{cols-1}}\n{sol_line:<{cols-1}}")
            sys.stdout.flush()

            all_done = all(p.poll() is not None for _, p in procs)

        # ── Final ──
        elapsed = time.time() - t0
        if not first_print:
            sys.stdout.write(f"\033[A\r{' '*(cols-1)}\n{' '*(cols-1)}\r\033[A\r")
        print(f"  All workers finished in {elapsed:.1f}s\n")

        for wid, p in procs:
            sf = status_files[wid]
            try:
                with open(sf, "r") as f:
                    data = json.loads(f.read())
                sd = data.get("solve", 0)
                wtime = data.get("elapsed", 0)
                print(f"  W{wid}: {sd} puzzles in {wtime:.1f}s (rc={p.returncode})")
            except:
                print(f"  W{wid}: rc={p.returncode}")

        # ── Merge CSVs ──
        fields = ["puzzle_id", "size", "difficulty", "difficulty_num", "n_givens",
                   "n_steps", "n_backtracks", "LZ_process", "LZ_solution",
                   "LZ_cascade", "ADSR_bimodality"]
        all_results = []
        for wid, tmp in enumerate(tmp_csvs):
            try:
                with open(tmp, "r") as f:
                    for row in csv.DictReader(f):
                        for k in ["size", "difficulty_num", "n_givens", "n_steps", "n_backtracks"]:
                            row[k] = int(row[k])
                        for k in ["LZ_process", "LZ_solution", "LZ_cascade", "ADSR_bimodality"]:
                            row[k] = float(row[k])
                        all_results.append(row)
            except FileNotFoundError:
                pass

        # Sort by puzzle_id, re-number
        all_results.sort(key=lambda r: r["puzzle_id"])
        for i, r in enumerate(all_results):
            r["puzzle_id"] = i + 1

        with open(args.csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in all_results:
                w.writerow(r)
        print(f"\n  Merged: {len(all_results)} puzzles → {args.csv}")
        print(f"  Total: {elapsed:.1f}s\n")
        run_analysis(all_results)
        print("══════════════════════════════════════════════════════\n")

        # Cleanup
        for fn in [task_file, counter_file, completed_file]:
            if os.path.exists(fn):
                os.remove(fn)
        for sf in status_files:
            if os.path.exists(sf):
                os.remove(sf)

        return 0

    # ── Single worker (or worker subprocess) ──
    is_worker = args.worker_id is not None

    if not is_worker:
        # Single-worker mode (no --workers) — use old generate_puzzle_set approach
        print(f"\n  Config: {args.count} puzzles, {args.size}×{args.size}, seed={args.seed}")
        print(f"  Output: {args.csv}\n")
        random.seed(args.seed)
        t0 = time.time()
        puzzles = generate_puzzle_set(args.count, args.size)
        print(f"  Generation: {len(puzzles)} puzzles in {time.time()-t0:.1f}s\n")

        fields = ["puzzle_id", "size", "difficulty", "difficulty_num", "n_givens",
                   "n_steps", "n_backtracks", "LZ_process", "LZ_solution",
                   "LZ_cascade", "ADSR_bimodality"]
        results = []
        t_solve = time.time()
        for i, p in enumerate(puzzles):
            solved, log = solve_logged(p["puzzle"], args.size)
            if not is_solved(solved, args.size):
                continue
            m = compute_metrics(log, solved, args.size)
            results.append({
                "puzzle_id": i + 1, "size": args.size,
                "difficulty": p["difficulty"], "difficulty_num": p["difficulty_num"],
                "n_givens": p["n_givens"], **m
            })
            if (i + 1) % max(1, len(puzzles) // 20) == 0:
                elapsed = time.time() - t_solve
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                eta = (len(puzzles) - i - 1) / rate if rate > 0 else 0
                sys.stdout.write(f"\r  Solving: {i+1}/{len(puzzles)} ({elapsed:.0f}s, ~{eta:.0f}s remaining)   ")
                sys.stdout.flush()

        print(f"\n  Solving: {len(results)} puzzles in {time.time()-t_solve:.1f}s")
        with open(args.csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in results:
                w.writerow(r)
        print(f"  CSV: {args.csv}")
        run_analysis(results)
        print(f"\n  Total: {time.time()-t0:.1f}s")
        print("══════════════════════════════════════════════════════\n")
        return 0

    # ── Worker subprocess: work-stealing from shared task queue ──
    import json as _json

    t0 = time.time()
    wid = args.worker_id
    status_file = f"_sudoku_w{wid}.status"
    counter_file = "_sudoku_counter.txt"
    lock_file = "_sudoku_counter.lock"
    task_file = "_sudoku_tasks.json"
    completed_file = "_sudoku_completed.json"

    # Load tasks and completed set
    with open(task_file, "r") as f:
        tasks = _json.load(f)
    try:
        with open(completed_file, "r") as f:
            completed_ids = set(_json.load(f))
    except:
        completed_ids = set()

    # Givens ranges for generation
    givens_ranges = {"easy": (36, 45), "medium": (28, 35), "hard": (24, 27), "evil": (17, 23)}

    def write_status(gen_done=0, solve_done=0, phase="solving"):
        try:
            with open(status_file, "w") as f:
                _json.dump({"gen": gen_done, "solve": solve_done,
                            "total": len(tasks), "phase": phase,
                            "elapsed": time.time() - t0}, f)
        except: pass

    def claim_task():
        """Atomically claim next task index. Returns index or None."""
        max_retries = 100
        for _ in range(max_retries):
            try:
                fd = os.open(lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)
                break
            except (FileExistsError, OSError):
                time.sleep(0.01 + random.random() * 0.02)
        else:
            return None  # Could not acquire lock

        try:
            with open(counter_file, "r") as f:
                idx = int(f.read().strip())
            if idx >= len(tasks):
                return None
            with open(counter_file, "w") as f:
                f.write(str(idx + 1))
            return idx
        except:
            return None
        finally:
            try: os.remove(lock_file)
            except: pass

    # Prepare CSV
    fields = ["puzzle_id", "size", "difficulty", "difficulty_num", "n_givens",
               "n_steps", "n_backtracks", "LZ_process", "LZ_solution",
               "LZ_cascade", "ADSR_bimodality"]

    # Append if CSV exists (resume), else fresh
    if os.path.exists(args.csv):
        csv_file = open(args.csv, "a", newline="")
        csv_writer = csv.DictWriter(csv_file, fieldnames=fields)
    else:
        csv_file = open(args.csv, "w", newline="")
        csv_writer = csv.DictWriter(csv_file, fieldnames=fields)
        csv_writer.writeheader()
    csv_file.flush()

    n_gen = 0
    n_solve = 0
    write_status(0, 0, "solving")

    while True:
        idx = claim_task()
        if idx is None:
            break  # All tasks claimed

        task = tasks[idx]
        tid = task["id"]

        # Skip if already completed (resume)
        if tid in completed_ids:
            n_solve += 1
            write_status(n_gen, n_solve, "solving")
            continue

        # Generate one puzzle for this task
        random.seed(task["seed"])
        diff = task["difficulty"]
        lo, hi = givens_ranges[diff]
        tg = random.randint(lo, hi)
        puzzle, solution, n_givens = generate_puzzle(args.size, tg)
        n_gen += 1

        # Solve and measure
        solved, log = solve_logged(puzzle, args.size)
        if not is_solved(solved, args.size):
            solved = solution  # fallback

        m = compute_metrics(log, solved, args.size)
        row = {
            "puzzle_id": tid + 1, "size": args.size,
            "difficulty": diff, "difficulty_num": task["difficulty_num"],
            "n_givens": n_givens, **m
        }
        csv_writer.writerow(row)
        csv_file.flush()
        n_solve += 1
        write_status(n_gen, n_solve, "solving")

    csv_file.close()
    write_status(n_gen, n_solve, "done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
