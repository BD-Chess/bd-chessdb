#!/usr/bin/env python3
"""Refresh the independent PWA from LAB; retain PWA identity and local data keys."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/chess/new'
TARGET = ROOT / 'public/chess/PWA'
KEYS = {
    'chessLabSettings-v8': 'chessPwaLabSettings-v1',
    'chessLabGame-v8': 'chessPwaLabGame-v1',
    'chessLabEvalCache-v8': 'chessPwaLabEvalCache-v1',
    'chessBestLichessToken': 'chessPwaLabLichessToken-v1',
    'chessBestAnthropicKey': 'chessPwaLabAnthropicKey-v1',
    'chessLabStudy-v1': 'chessPwaLabStudy-v1',
    'chessLabTiming-v1': 'chessPwaLabTiming-v1',
    '8zc-lab-layout-v1': '8zc-pwa-lab-layout-v1',
    '8zc.evidence.v1': '8zc.pwa.evidence.v1',
    'ChessDCC-evidence': 'ChessDCC-pwa-evidence',
    'chessBestGame': 'chessPwaLegacyGame-v1',
    'chessBestSettings': 'chessPwaLegacySettings-v1',
    'ChessBest-sim-v1': 'ChessBest-pwa-sim-v1',
    'chessSimRunnerLease-v1': 'chessPwaSimRunnerLease-v1',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build():
    before = (TARGET / 'index.html').read_text()
    source_files = {}
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(SOURCE).as_posix()
        # Explicit runtime allowlist: never copy token files, tools, redirects or
        # dated research test/results as if they described this PWA release.
        if not (path.suffix == '.html' and '/' not in rel or
                rel.split('/')[0] in {'js', 'css', 'Games', 'img', 'config', 'vendor'} or
                rel == 'research/benchmark-fixtures.json'):
            continue
        if path.suffix.lower() == '.url':
            continue
        if rel.startswith('Games/') and path.suffix.lower() != '.pgn':
            continue
        data = path.read_bytes()
        source_files[rel] = digest(data)
        if path.suffix in {'.js', '.html'}:
            text = data.decode('utf-8')
            for old, new in KEYS.items():
                text = text.replace("'" + old + "'", "'" + new + "'")
            # Retain existing online-only token lookup; never precache it.
            text = text.replace("const LICHESS_PUBLIC_TOKEN_URL = 'Lichess-API.txt';",
                                "const LICHESS_PUBLIC_TOKEN_URL = '../new/Lichess-API.txt';")
            text = text.replace('https://www.mdlxdcc.org/chess/new/',
                                'https://bd-chess.github.io/bd-chessdb/chess/PWA/')
            if rel == 'index.html':
                text = text.replace('<title>ChessBest.org — DCC Analysis Lab</title>',
                                    '<title>ChessBest.org PWA — DCC Analysis Lab</title>')
                meta = before[before.index('  <meta name="theme-color"'):before.index('\n\n  <!--')]
                text = text.replace('</title>', '</title>\n' + meta, 1)
                text = text.replace('<span class="development-label">DEVELOPMENT</span>',
                    '<span class="development-label">PWA</span> <span id="chessPwaReady" role="status" hidden>· Offline ready</span> <button id="chessPwaUpdate" type="button" hidden>Update ready · reload</button>')
                text = text.replace('<a href="./" aria-current="page">LAB</a>', '<a href="../new/">LAB</a>')
                text = text.replace('<a href="../PWA/">PWA</a>', '<a href="./" aria-current="page">PWA</a>')
                text = text.replace('  <div id="pageSubtitle">',
                    '  <p id="chessPwaNotice" role="status" hidden>Offline: board, game library and local Stockfish work. ChessDB, Lichess and Gemini need internet access.</p>\n  <div id="pageSubtitle">')
                text = text.replace('  </style>', '''    #chessPwaNotice{margin:0;padding:8px 16px;color:#f4eed7;background:#493714;font:600 14px/1.4 system-ui,sans-serif;text-align:center}
    body.light-theme #chessPwaNotice{color:#513700;background:#ffecb2}
    #chessPwaReady{font-size:12px}
    #chessPwaUpdate{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:4px 8px;cursor:pointer}
  </style>''', 1)
                text = '\n'.join(line.rstrip() for line in text.split('\n'))
                text = text.replace('</body>', '  <script src="pwa.js"></script>\n</body>')
            # Preserve legacy mixed line endings for unchanged modular helpers.
            if rel in {'js/state.js', 'js/boardManager.js'}:
                text = re.sub(r"(.*chessPwaLegacy.*)\r\n", lambda m: m.group(1) + '\n', text)
            data = text.encode('utf-8')
        out = TARGET / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
    # Runtime files plus preserved PWA packaging; source-only historical files
    # already present under research remain unmodified and are never cached.
    assets = sorted(set(source_files) | {
        'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
        'manifest.webmanifest', 'pwa.js',
    })
    hashes = {name: digest((TARGET / name).read_bytes()) for name in assets}
    worker = (TARGET / 'sw.js').read_text()
    logic = worker.split('// END GENERATED PRECACHE\n', 1)[1]
    version = '20260926-' + digest((json.dumps(hashes, sort_keys=True) + logic).encode())[:12]
    header = "const RELEASE = " + json.dumps(version) + ";\nconst ASSETS = " + json.dumps(assets, indent=2) + ";\n"
    worker = re.sub(r'const RELEASE = .*?// END GENERATED PRECACHE\n', lambda _: header + '// END GENERATED PRECACHE\n', worker, flags=re.S)
    (TARGET / 'sw.js').write_text(worker)
    manifest = {
        'schema': 'chessbest-pwa-release/1', 'version': version,
        'source_channel': 'LAB', 'source_path': 'public/chess/new',
        'source_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD:public/chess/new'], cwd=ROOT, text=True).strip(),
        'source_files_sha256': source_files, 'pwa_assets_sha256': hashes,
        'worker_sha256': digest(worker.encode()),
        'storage': 'Preserve existing PWA keys; isolated PWA SIM archive and runner lease.',
    }
    (TARGET / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'version': version, 'assets': len(assets), 'bytes': sum((TARGET / a).stat().st_size for a in assets)}))


if __name__ == '__main__':
    build()
