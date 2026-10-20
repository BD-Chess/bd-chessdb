#!/usr/bin/env python3
"""Select frozen archive projections by COMPLETE mainline hash, never by names.

Usage: python tools/import-top-picks-frozen.py /path/to/CBTP_FINAL.zip
No network, engines, mutable workspace or arena effects.
"""
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA = 'd026c44a19fcd33abc4b78c22bfecc410232fe355e35e5d0175b00e07103c8e9'
TARGET = ROOT / 'docs/chessbest-evidence/top-picks-frozen-20261020.json'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def main():
    raw = Path(sys.argv[1]).read_bytes()
    assert sha(raw) == ARCHIVE_SHA, 'Unexpected final archive'
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert z.testzip() is None, 'ZIP CRC failure'
        manifest = json.loads(z.read('EXTRACT_MANIFEST.json'))
        assert set(z.namelist()) == set(manifest['files']) | {'EXTRACT_MANIFEST.json'}
        for name, info in manifest['files'].items():
            b = z.read(name)
            assert len(b) == info['bytes'] and sha(b) == info['sha256'], name
        grouped = collections.defaultdict(list)
        for row in csv.DictReader(io.StringIO(z.read('moves.csv').decode())):
            grouped[row['game_id']].append(row)
        games = {row['game_id']: row for row in csv.DictReader(io.StringIO(z.read('games.csv').decode()))}
        dcc = json.loads(z.read('DCC_EVIDENCE.json'))
        by_line = collections.defaultdict(list)
        for game_id, rows in grouped.items():
            rows.sort(key=lambda r: int(r['ply']))
            assert [int(r['ply']) for r in rows] == list(range(1, len(rows) + 1)), game_id
            by_line[sha(' '.join(r['move'] for r in rows).encode())].append((game_id, rows))
        catalog = json.loads((ROOT / 'public/chess-lab/Games/ChessBest_Top_Picks.catalog.json').read_text())
        selected = []
        for case in catalog['cases']:
            matches = by_line[case['source']['mainline_uci_sha256']]
            assert len(matches) == 1, (case['id'], 'ambiguous or absent complete line')
            gid, rows = matches[0]
            anchor = case['anchor']
            assert rows[anchor['ply_after']]['fen'] == anchor['fen_before_move']
            assert rows[anchor['ply_after']]['move'] == anchor['played_uci']
            if 'review_v4' in case['evidence']:
                continue  # Preserve the newer, better Dreev pilot byte-for-byte.
            selected.append({'id': case['id'], 'archive_game_id': gid,
                             'game_record': games[gid], 'game_record_sha256': sha(canonical(games[gid])),
                             'rows': [{'record': row, 'record_sha256': sha(canonical(row))} for row in rows],
                             'dcc': [{'record': record, 'record_sha256': sha(canonical(record))}
                                     for record in dcc if record['fen'] == anchor['fen_before_move']]})
        output = {'schema': 'chessbest-top-picks-frozen/1',
                  'archive': {'name': 'CBTP_FINAL_20260929T203724Z_dae09ebd.zip',
                              'drive_id': '1SzYJgVn-WQc5cS1SLgIkJMmFUlCvglo5',
                              'sha256': ARCHIVE_SHA, 'bytes': len(raw), 'snapshot': manifest['at'],
                              'extract_manifest_sha256': sha(z.read('EXTRACT_MANIFEST.json')),
                              'members': manifest['files'], 'crc_verified': True},
                  'interpretation': 'Parsed archive projections; original CDB HTTP bodies are not in this extract. Snapshot time is not the request time. Engine/backend versions are unknown.',
                  'games': selected}
        TARGET.write_text(json.dumps(output, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
        print('Verified ZIP + all manifest members; selected 9 exact complete lines:', sha(TARGET.read_bytes()))


if __name__ == '__main__':
    main()
