#!/usr/bin/env python3
"""Build self-contained offline shells for active ChessBest channels only.

The explicit runtime allowlist excludes private token files and source-only engine
artifacts. Run with --check in CI to detect a stale offline release.
"""
import argparse
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PUBLIC = REPO / 'public/chess'
TEMPLATES = REPO / 'tools/chess-pwa'
CHANNELS = {
    'CURRENT': (PUBLIC, '/chess/', 'ChessBest', 'ChessBest'),
    'LAB': (PUBLIC / 'new', '/chess/new/', 'ChessBest LAB', 'ChessBest LAB'),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def runtime_asset(name):
    pieces = name.split('/')
    if len(pieces) == 1:
        return name.endswith('.html') or name in {'manifest.webmanifest', 'pwa.js'}
    if name.startswith('css/') and len(pieces) == 2:
        return name.endswith('.css')
    if name.startswith('js/') and len(pieces) == 2:
        return name.endswith('.js')
    if name.startswith('Games/'):
        return name.endswith('.pgn') or name == 'Games/ChessBest_Top_Picks_TCEC.LICENSE.md'
    if name.startswith('img/chesspieces/wikipedia/') and len(pieces) == 4:
        return name.endswith('.png')
    if name.startswith('icons/') and len(pieces) == 2:
        return name.endswith('.png')
    if name.startswith('config/') and len(pieces) == 2:
        return name.endswith('.json')
    if name == 'research/benchmark-fixtures.json':
        return True
    if name.startswith('vendor/stockfish/') and len(pieces) == 3:
        return name in {'vendor/stockfish/stockfish-18-lite-single.js',
                        'vendor/stockfish/stockfish-18-lite-single.wasm'}
    return False


def manifest(name, short_name):
    return {
        'id': './', 'name': name, 'short_name': short_name,
        'description': 'ChessBest analysis, DCC, local Stockfish, game library and saved studies.',
        'start_url': './', 'scope': './', 'display': 'standalone',
        'background_color': '#16382b', 'theme_color': '#16382b', 'lang': 'en',
        'icons': [
            {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
            {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'},
        ],
    }


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def put(path, data, check):
    if check:
        if not path.is_file() or path.read_bytes() != data:
            raise ValueError(f'Outdated ChessBest offline artifact: {path.relative_to(REPO)}')
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def build(channel, check):
    base, route, name, short_name = CHANNELS[channel]
    put(base / 'manifest.webmanifest', json_bytes(manifest(name, short_name)), check)
    put(base / 'pwa.js', (TEMPLATES / 'pwa.js').read_bytes(), check)
    assets = {}
    for path in base.rglob('*'):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(base).as_posix()
        if runtime_asset(rel):
            assets[rel] = digest(path.read_bytes())
    assets = dict(sorted(assets.items()))
    for required in ('index.html', 'manifest.webmanifest', 'pwa.js', 'icons/icon-192.png',
                     'icons/icon-512.png', 'vendor/stockfish/stockfish-18-lite-single.js',
                     'vendor/stockfish/stockfish-18-lite-single.wasm',
                     'Games/ChessBest_Top_Picks.pgn', 'Games/ChessBest_Top_Picks_TCEC.pgn'):
        if required not in assets:
            raise ValueError(f'Missing required {channel} offline asset: {required}')
    version = channel.lower() + '-' + digest(json_bytes(assets))[:16]
    prefix = 'chessbest-chess-' + channel.lower() + '-'
    header = ('/* Generated from tools/chess-pwa/sw-runtime.js. ' + channel + ' only. */\n'
              + "'use strict';\n"
              + 'const RELEASE = ' + json.dumps(version) + ';\n'
              + 'const PREFIX = ' + json.dumps(prefix) + ';\n'
              + 'const ASSETS = ' + json.dumps(list(assets), indent=2) + ';\n')
    worker = (header + (TEMPLATES / 'sw-runtime.js').read_text()).encode()
    put(base / 'sw.js', worker, check)
    release = {
        'schema': 'chessbest-channel-pwa/1', 'version': version,
        'channel': channel, 'path': route, 'storage_namespace': f'ChessBest:{channel}:v2:',
        'assets_sha256': assets, 'worker_sha256': digest(worker),
    }
    put(base / 'release.json', json_bytes(release), check)
    print(f'{channel}: {version}, {len(assets)} offline assets')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    options = parser.parse_args()
    for active in CHANNELS:
        build(active, options.check)
