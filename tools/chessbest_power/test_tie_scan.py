"""Focused offline tie-scan regressions: provider order, legality and zero scores."""
import io
import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

import chess
import chess.pgn

from tie_scan import HERE, fen4, scan_games


class TieScanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo = HERE.parent.parent

    def test_scanner_preserves_provider_order_and_skips_mate_and_illegal(self):
        game = chess.pgn.Game()
        game.headers['White'], game.headers['Black'] = 'A', 'B'
        game.add_main_variation(chess.Move.from_uci('e2e4'))
        root = chess.Board()
        qa = [{'move': 'e2e4', 'score': 0, 'rank': 2},
              {'move': 'd2d4', 'score': 0, 'rank': 2},
              {'move': 'a1a8', 'score': 500, 'rank': 2},
              {'move': 'g1f3', 'score': 24997, 'rank': 1}]
        cache = {'qa:' + fen4(root.fen()): {'moves': qa}}
        for move in ('e2e4', 'd2d4'):
            b = root.copy()
            b.push_uci(move)
            cache['pv:' + fen4(b.fen(en_passant='fen'))] = {'score': 0, 'depth': 5, 'pv': []}
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'fixture.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('Games/test.pgn', str(game) + '\n')
            with zipfile.ZipFile(path) as archive:
                rows, counts = scan_games(archive, cache, margin=0,
                                          min_ply=1, max_ply=1, per_game=5)
        self.assertEqual(counts['tied_root_with_two_child_pvs'], 1)
        self.assertEqual([(r['move'], r['sourceOrder']) for r in rows[0]['root_moves']],
                         [('e2e4', 0), ('d2d4', 1)])

    def test_bridge_keeps_legitimate_zero_and_root_order(self):
        root = chess.Board()
        cache = {}
        for move, continuation in [('e2e4', ('e7e5', 'g1f3')),
                                   ('d2d4', ('d7d5', 'g1f3'))]:
            b = root.copy()
            b.push_uci(move)
            cache['pv:' + fen4(b.fen(en_passant='fen'))] = {'score': 0, 'depth': 5,
                                             'pv': list(continuation)}
            for follow in continuation:
                b.push_uci(follow)
                cache['sc:' + fen4(b.fen(en_passant='fen'))] = 0
        item = {'fen': root.fen(), 'root_moves': [
            {'move': 'd2d4', 'score': 0, 'rank': 2, 'sourceOrder': 0},
            {'move': 'e2e4', 'score': 0, 'rank': 2, 'sourceOrder': 1}]}
        with tempfile.TemporaryDirectory() as temp:
            cache_path, input_path = Path(temp) / 'cache.json', Path(temp) / 'input.json'
            cache_path.write_text(json.dumps(cache), encoding='utf8')
            input_path.write_text(json.dumps([item]), encoding='utf8')
            result = subprocess.run(['node', str(HERE / 'tie_scan_bridge.cjs'), str(self.repo),
                                     str(cache_path), str(input_path)], capture_output=True,
                                    text=True, check=True, timeout=10,
                                    env={**os.environ, 'CHESSBEST_TIE_DCC_DEPTH': '3'})
        row = json.loads(result.stdout)[0]
        self.assertEqual(row['raw_best'], 'd2d4')
        self.assertEqual(row['dcc_pick'], 'd2d4')
        self.assertEqual(row['dcc_status'], 'complete')
        self.assertTrue(all(c['eval_sequence_cp_mover'] == [0, 0, 0]
                            for c in row['candidates']))
        self.assertTrue(all(c['samples'][1]['source'] == 'archived-sc'
                            for c in row['candidates']))


if __name__ == '__main__':
    unittest.main()
