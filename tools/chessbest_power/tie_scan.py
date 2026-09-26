#!/usr/bin/env python3
"""Bounded, offline CDB tie scan with the actual ChessDCC 0.8 LAB core.

The September 2026 archive is historical, and the DCC rank is a heuristic.
This deliberately does not use the old depth-40 tiebreak/EndEval verdicts:
that archived scorer mixed opposite score perspectives.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import os
import subprocess
import tempfile
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import chess
import chess.pgn

logging.getLogger('chess.pgn').setLevel(logging.CRITICAL)
HERE = Path(__file__).resolve().parent
CACHE_NAME = 'Games/8zc_cache/cache.json'


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fen4(fen: str) -> str:
    return ' '.join(fen.split()[:4])


def corpus_files(names: set[str]) -> list[str]:
    return sorted(n for n in names if n.startswith('Games/') and
                  n.count('/') == 1 and n.endswith('.pgn') and
                  n != 'Games/Chess_Openings_Top_Lines.pgn')


def scan_games(archive: zipfile.ZipFile, cache: dict, *, margin: int,
               min_ply: int, max_ply: int, per_game: int) -> tuple[list[dict], dict]:
    matches, counts, seen = [], Counter(), set()
    for name in corpus_files(set(archive.namelist())):
        content = archive.read(name)
        if len(content) > 2_000_000:
            counts['oversize_pgn_skipped'] += 1
            continue
        stream = io.StringIO(content.decode('utf-8-sig', errors='replace'))
        number = 0
        while (game := chess.pgn.read_game(stream)) is not None:
            number += 1
            counts['games_read'] += 1
            if game.errors:
                counts['bad_pgn_skipped'] += 1
                continue
            # Several old multi-game fixtures concatenate PGN tag lines;
            # python-chess can parse the moves while silently losing identity.
            if (any(game.headers.get(k, '?') == '?' for k in ('White', 'Black')) or
                    any('"] [' in str(v) for v in game.headers.values())):
                counts['bad_headers_skipped'] += 1
                continue
            board = game.board()
            moves = list(game.mainline_moves())
            game_id = sha((board.fen() + ' ' + ' '.join(m.uci() for m in moves)).encode())
            in_game = []
            for ply, played in enumerate(moves, start=1):
                # The archived headless runner and LAB chess.js keep the
                # target of every double-pawn push in FEN. python-chess's
                # default omits it when no legal en passant capture exists.
                fen = board.fen(en_passant='fen')
                if min_ply <= ply <= max_ply:
                    entry = cache.get('qa:' + fen4(fen))
                    raw = entry.get('moves', []) if isinstance(entry, dict) else []
                    valid = [{**m, 'sourceOrder': i} for i, m in enumerate(raw)
                             if isinstance(m, dict) and isinstance(m.get('score'), int)
                             and abs(m['score']) < 10000 and isinstance(m.get('move'), str)
                             and len(m['move']) in (4, 5)]
                    # All alternatives must be evaluated at the same root FEN.
                    valid = [m for m in valid if _legal(board, m['move'])]
                    valid.sort(key=lambda x: (-x['score'], x.get('rank', 999), x['sourceOrder']))
                    tied = [m for m in valid if valid and valid[0]['score'] - m['score'] <= margin]
                    if len(tied) >= 2 and fen not in seen:
                        available = sum('pv:' + fen4(_after(board, m['move'])) in cache for m in tied)
                        if available >= 2:
                            played_san = board.san(played)
                            in_game.append({'source': name, 'source_index': number,
                                            'source_pgn_sha256': sha(content), 'game_id': game_id,
                                            'headers': {k: game.headers.get(k, '') for k in
                                                        ('Event', 'Date', 'Round', 'White', 'Black', 'Result')},
                                            'ply': ply, 'fen': fen, 'played_uci': played.uci(),
                                            'played_san': played_san,
                                            'root_moves': valid,
                                            'cdb_tied': tied,
                                            'cdb_spread_cp': tied[0]['score'] - tied[-1]['score'],
                                            'pv_child_coverage': available,
                                            'source_set': 'TCEC' if 'tcec' in name.casefold() or
                                            'stockfish' in name.casefold() else 'human'})
                            seen.add(fen)
                            counts['tied_root_with_two_child_pvs'] += 1
                        else:
                            counts['tie_without_two_child_pvs'] += 1
                board.push(played)
            # Prefer middle games, include both human and TCEC; bound one game.
            in_game.sort(key=lambda x: (-x['pv_child_coverage'],
                                        abs(x['ply'] - 65), x['cdb_spread_cp'], x['ply']))
            matches.extend(in_game[:per_game])
    return matches, dict(counts)


def _legal(board: chess.Board, move: str) -> bool:
    try:
        return chess.Move.from_uci(move) in board.legal_moves
    except ValueError:
        return False


def _after(board: chess.Board, uci: str) -> str:
    copy = board.copy(stack=False)
    copy.push_uci(uci)
    return copy.fen(en_passant='fen')


def choose(rows: list[dict], maximum: int) -> list[dict]:
    buckets = defaultdict(list)
    for row in rows:
        buckets[(row['source_set'], row['source'], row['source_index'])].append(row)
    # Round robin prevents a single file or game from swallowing the budget.
    keys = sorted(buckets, key=lambda k: (k[0] != 'TCEC', k))
    selected = []
    while keys and len(selected) < maximum:
        next_keys = []
        for key in keys:
            selected.append(buckets[key].pop(0))
            if buckets[key]:
                next_keys.append(key)
            if len(selected) >= maximum:
                break
        keys = next_keys
    return selected


def run(args: argparse.Namespace) -> dict:
    archive_path, repo = Path(args.pack).resolve(), Path(args.repo).resolve()
    if not (repo / 'public/chess/new/js/8zc-dcc-core.js').is_file():
        raise ValueError('Actual ChessDCC 0.8 core unavailable in LAB checkout')
    archive_sha = sha(archive_path.read_bytes())
    with zipfile.ZipFile(archive_path) as archive:
        info = archive.getinfo(CACHE_NAME)
        if info.file_size > 32_000_000:
            raise ValueError('Historical CDB cache exceeds 32 MiB budget')
        raw_cache = archive.read(CACHE_NAME)
        cache = json.loads(raw_cache)
        rows, counts = scan_games(archive, cache, margin=args.margin_cp,
                                  min_ply=args.min_ply, max_ply=args.max_ply,
                                  per_game=args.per_game)
    selected = choose(rows, args.max_positions)
    if not selected:
        raise ValueError('No legal same-root ties with two candidate child PVs')
    with tempfile.TemporaryDirectory(prefix='chessbest-tie-') as temp:
        cache_file, input_file = Path(temp) / 'cache.json', Path(temp) / 'inputs.json'
        cache_file.write_bytes(raw_cache)
        input_file.write_text(json.dumps(selected), encoding='utf8')
        result = subprocess.run(['node', str(HERE / 'tie_scan_bridge.cjs'), str(repo),
                                 str(cache_file), str(input_file)], capture_output=True,
                                text=True, check=True, timeout=args.timeout,
                                env={**os.environ, 'CHESSBEST_TIE_DCC_DEPTH': str(args.dcc_depth)})
    measured = json.loads(result.stdout)
    complete_disagreements = [r for r in measured if r.get('dcc_status') == 'complete' and
                              r.get('dcc_pick') != r.get('raw_best') and r.get('dcc_pick') and
                              all(c['status'] == 'complete' and len(c['eval_sequence_cp_mover']) >= 3
                                  for c in r['candidates'])]
    conflicts = [r for r in complete_disagreements if any(
        c['child_source_disagreement_cp'] is not None and c['child_source_disagreement_cp'] > 20
        for c in r['candidates'])]
    complete = [r for r in complete_disagreements if r not in conflicts]
    complete.sort(key=lambda x: (x['cdb_spread_cp'],
                                 x['source_set'] != 'TCEC',
                                 -abs(next(c['dcc_rank_score'] for c in x['candidates']
                                           if c['move'] == x['dcc_pick']) -
                                      next(c['dcc_rank_score'] for c in x['candidates']
                                           if c['move'] == x['raw_best'])), x['game_id']))
    results = {'status': 'OFFLINE_HISTORICAL_CANDIDATES_NOT_VALIDATED',
               'purpose': 'Near-equal archived CDB root scores discriminated by current ChessDCC 0.8',
               'provenance': {'source_archive': str(archive_path), 'archive_sha256': archive_sha,
                              'cache_inner_sha256': sha(raw_cache),
                              'core_sha256': measured[0].get('core_sha256'),
                              'chessdcc_version': measured[0].get('chessdcc_version'),
                              'bridge_sha256': sha((HERE / 'tie_scan_bridge.cjs').read_bytes()),
                              'script_sha256': sha(Path(__file__).read_bytes()),
                              'chess_library': chess.__version__},
               'settings': {'margin_cp': args.margin_cp, 'min_ply': args.min_ply,
                            'max_ply': args.max_ply, 'max_positions': args.max_positions,
                            'per_game': args.per_game, 'dcc_depth': args.dcc_depth,
                            'dcc_policy': 'balanced', 'dcc_guard_cp': 10},
               'counts': {**counts, 'game_positions_preselected': len(rows),
                          'positions_measured': len(measured),
                          'complete_dcc_disagreements': len(complete_disagreements),
                          'conflicted_child_sources_excluded': len(conflicts),
                          'consistent_complete_disagreements': len(complete)},
               'limitations': ['CDB cache uses four-field FEN from 2026-09-04; root and all sampled PV scores are historical.',
                               'DCC preference score is a heuristic and is not centipawn evaluation or a proof of better play.',
                               'Old depth-40/EndEval results were excluded due to historical perspective mixing.',
                               'When archived querypv and queryscore at the same child FEN disagree by over 20 cp, the case is excluded from the shortlist; a smaller discrepancy is still historical uncertainty.',
                               'Only up to the bounded number of game positions were measured; selection is not an unbiased strength test.'],
               'candidates': complete[:args.display],
               'all_measured': measured if args.include_all else None}
    output = Path(args.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pack', required=True)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--margin-cp', type=int, default=10)
    parser.add_argument('--min-ply', type=int, default=30)
    parser.add_argument('--max-ply', type=int, default=120)
    parser.add_argument('--per-game', type=int, default=5)
    parser.add_argument('--dcc-depth', type=int, choices=(3, 5), default=5)
    parser.add_argument('--max-positions', type=int, default=280)
    parser.add_argument('--timeout', type=int, default=120)
    parser.add_argument('--display', type=int, default=12)
    parser.add_argument('--include-all', action='store_true')
    args = parser.parse_args()
    if not 0 <= args.margin_cp <= 10 or args.max_positions < 1 or args.per_game < 1:
        parser.error('margin must be 0..10 cp; counts must be positive')
    result = run(args)
    print(json.dumps({'out': str(Path(args.out).resolve()), 'counts': result['counts'],
                      'examples': [{k: r[k] for k in ('source', 'source_index', 'ply',
                              'raw_best', 'dcc_pick', 'cdb_spread_cp', 'dcc_status')}
                                   for r in result['candidates'][:5]]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
