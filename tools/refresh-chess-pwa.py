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
    'chessLabTopPickCursor-v1': 'chessPwaLabTopPickCursor-v1',
    'chessLabEvalCache-v8': 'chessPwaLabEvalCache-v1',
    'chessBestLichessToken': 'chessPwaLabLichessToken-v1',
    'chessBestAnthropicKey': 'chessPwaLabAnthropicKey-v1',
    'chessLabStudy-v1': 'chessPwaLabStudy-v1',
    'chessLabStudy-v1-recovery': 'chessPwaLabStudy-v1-recovery',
    'chessLabTiming-v1': 'chessPwaLabTiming-v1',
    '8zc-lab-layout-v1': '8zc-pwa-lab-layout-v1',
    '8zc.evidence.v1': '8zc.pwa.evidence.v1',
    'ChessDCC-evidence': 'ChessDCC-pwa-evidence',
    'chessBestGame': 'chessPwaLegacyGame-v1',
    'chessBestSettings': 'chessPwaLegacySettings-v1',
    'ChessBest-sim-v1': 'ChessBest-pwa-sim-v1',
    'ChessBest-sim-v1-fallback': 'ChessBest-pwa-sim-v1-fallback',
    'ChessBest-sim-v1-checkpoint': 'ChessBest-pwa-sim-v1-checkpoint',
    'chessSimRunnerLease-v1': 'chessPwaSimRunnerLease-v1',
}
PWA_PREFIX = 'ChessBest:PWA:v2:'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def replace_exact(text, old, new, location):
    if old not in text:
        raise ValueError(f'PWA refresh could not find expected {location} copy; inspect the LAB source before publishing.')
    return text.replace(old, new)


def source_tree_id(directory):
    """Use the verified tracked LAB tree, never transient test dependencies."""
    relative = directory.relative_to(ROOT).as_posix()
    if subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', relative], cwd=ROOT).returncode:
        raise ValueError('LAB tracked source differs from HEAD; commit and recheck it before refreshing PWA.')
    value = subprocess.check_output(['git', 'rev-parse', f'HEAD:{relative}'], cwd=ROOT, text=True).strip()
    if not re.fullmatch(r'[0-9a-f]{40}', value):
        raise ValueError('Could not verify the LAB Git source tree.')
    return value


def tracked_source_files():
    names = subprocess.check_output(['git', 'ls-files', '-z', '--', 'public/chess/new'], cwd=ROOT)
    return {name.decode('utf-8').removeprefix('public/chess/new/') for name in names.split(b'\0') if name}


def build():
    source_tree = source_tree_id(SOURCE)
    tracked = tracked_source_files()
    before = (TARGET / 'index.html').read_text()
    installed_manifest = json.loads((TARGET / 'manifest.webmanifest').read_text())
    if [installed_manifest.get(name) for name in ('id', 'start_url', 'scope')] != ['./', './', './']:
        raise ValueError('PWA install identity changed; inspect the existing manifest before refreshing.')
    source_files = {}
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(SOURCE).as_posix()
        if rel not in tracked:
            continue
        # Explicit runtime allowlist: never copy token files, tools, redirects or
        # dated research test/results as if they described this PWA release.
        if not (path.suffix == '.html' and '/' not in rel or
                rel.split('/')[0] in {'js', 'css', 'Games', 'img', 'config', 'vendor'} or
                rel == 'research/benchmark-fixtures.json'):
            continue
        if path.suffix.lower() == '.url':
            continue
        if rel.startswith('Games/') and path.suffix.lower() != '.pgn' and rel != 'Games/ChessBest_Top_Picks_TCEC.LICENSE.md':
            continue
        data = path.read_bytes()
        source_files[rel] = digest(data)
        if path.suffix in {'.js', '.html'}:
            text = data.decode('utf-8')
            for old, new in KEYS.items():
                text = text.replace("'" + old + "'", "'" + new + "'")
            # LAB v2 uses a dedicated localStorage/IndexedDB namespace. The
            # installed app gets its own v2 namespace and copies its existing
            # PWA v1 keys/databases on first load; neither LAB nor CURRENT is
            # read or written by that migration.
            text = text.replace('ChessBest:LAB:v2:', PWA_PREFIX)
            if rel == 'js/8zc-lab-storage.js':
                text = text.replace('LAB', 'PWA')
                text = replace_exact(text,
                    '              copyLocal(journal, source, destination);',
                    '''              // Older PWA ES modules used chessPwaLegacy* before the
              // workspace used chessPwaLab*. Prefer the modern source when
              // present, without moving either earlier PWA record.
              const earlier = target === KEYS.settings ? 'chessPwaLegacySettings-v1'
                : target === KEYS.game ? 'chessPwaLegacyGame-v1' : null;
              const chosen = earlier && storage.getItem(source) === null
                && storage.getItem(earlier) !== null ? earlier : source;
              copyLocal(journal, chosen, destination);''',
                    'PWA legacy ES module migration')
                text = text.replace('Stable keys/databases are strictly read-only.',
                                    'Earlier PWA keys/databases are strictly read-only.')
                text = text.replace('Never refill it from CURRENT.',
                                    'Never refill it from previous PWA storage.')
                text = text.replace('Stable CURRENT remains available for exporting your original data.',
                                    'Your previous PWA data remains in browser storage.')
                text = text.replace("        const link = root.document.createElement('a'); link.href = '../'; link.textContent = 'Open CURRENT'; link.style.color = '#a5d8ff'; panel.appendChild(link);\n", '')
            # Retain existing online-only token lookup; never precache it.
            text = text.replace("const LICHESS_PUBLIC_TOKEN_URL = 'Lichess-API.txt';",
                                "const LICHESS_PUBLIC_TOKEN_URL = '../new/Lichess-API.txt';")
            text = text.replace('https://www.mdlxdcc.org/chess/new/',
                                'https://bd-chess.github.io/bd-chessdb/chess/PWA/')
            if rel == '8zc-help.html':
                text = replace_exact(text, 'ANALYSIS LAB · FIELD GUIDE',
                    'CHESSBEST PWA · FIELD GUIDE', 'Help heading')
                text = replace_exact(text, 'This guide describes the development version.',
                    'This guide describes the installed PWA. The board, saved games and local Stockfish work offline; connected services require internet.',
                    'Help introduction')
                text = replace_exact(text, 'Sim igra sam s sabo; klik zgodovine ga ustavi.',
                    'Sim lahko odigra samodejno partijo ali odpre igro proti motorju; klik zgodovine ustavi samodejni tek.',
                    'Help Slovenian summary')
                text = replace_exact(text,
                    'On first use of this LAB release, existing browser data is copied into LAB-only storage and verified. Existing LAB data takes priority; the original CURRENT records are neither moved nor deleted. Separate names do not provide a separate browser quota. If copying fails, the page explains the problem before starting the workspace. Keep exported backups for portability.',
                    'On first use of this PWA release, data from the previous PWA is copied into this PWA’s new storage and verified. Existing new PWA data takes priority; earlier PWA records remain in place. LAB and CURRENT storage stay separate, but all apps on this origin share the browser quota. If copying fails, the page explains the problem before starting the workspace. Keep exported backups for portability.',
                    'Help migration')
                text = replace_exact(text, 'Reset Settings</strong> restores LAB preferences',
                    'Reset Settings</strong> restores PWA preferences', 'Help settings')
                text = replace_exact(text,
                    'This release gives LAB its own copied workspace; later changes are independent from CURRENT and PWA.',
                    'The installed PWA keeps its own workspace; LAB and CURRENT remain separate.',
                    'Help cross-device storage')
                text = replace_exact(text, 'About this lab', 'About this PWA', 'Help footer')
            if rel == '8zc-about.html':
                text = replace_exact(text, 'BD × AI LAB · DEVELOPMENT WORKSPACE',
                    'CHESSBEST · INSTALLED PWA', 'About heading')
                text = replace_exact(text,
                    'This development workspace is separate from the current and old versions.',
                    'This installed PWA keeps its own records, separate from CURRENT and LAB; the browser storage quota is shared on the same origin.',
                    'About storage')
                text = replace_exact(text, 'Open the Analysis Lab', 'Open the PWA board', 'About board link')
                text = replace_exact(text, '>Development board</a>', '>PWA board</a>', 'About footer')
            if rel == 'index.html':
                text = text.replace('<title>ChessBest.org — DCC Analysis Lab</title>',
                                    '<title>ChessBest.org PWA — DCC Analysis Lab</title>')
                meta = before[before.index('  <meta name="theme-color"'):before.index('\n\n  <!--')]
                text = text.replace('</title>', '</title>\n' + meta, 1)
                text = text.replace('<span class="development-label">DEVELOPMENT</span>',
                    '<span class="development-label">PWA</span> <span id="chessPwaReady" role="status" hidden>· Offline ready</span> <button id="chessPwaUpdate" type="button" hidden>Update ready · reload</button>')
                text = text.replace('CHESS ANALYSIS · BD × AI LAB <span class="development-label">PWA</span>',
                                    'CHESS ANALYSIS · BD × AI <span class="development-label">PWA</span>')
                text = text.replace('<a href="./" aria-current="page">LAB</a>', '<a href="../new/">LAB</a>')
                text = text.replace('<a href="../PWA/">PWA</a>', '<a href="./" aria-current="page">PWA</a>')
                text = replace_exact(text,
                    'Razvojni Analysis Lab. Trenutna potrjena stran je še vedno na <a href="../">/chess/</a>.',
                    'Nameščena PWA različica. Glavna spletna stran je na <a href="../">/chess/</a>.',
                    'PWA intro dialog')
                text = replace_exact(text,
                    '<strong>Samostojni podatki LAB.</strong> Ob prvem zagonu se obstoječi podatki preverjeno kopirajo v ločeno shrambo. Obstoječi zapisi LAB imajo prednost; izvirniki CURRENT ostanejo ohranjeni. Kvota brskalnika ostaja skupna.',
                    '<strong>Ohranjeni podatki PWA.</strong> Ob prvem zagonu se podatki prejšnje PWA preverjeno kopirajo v novo shrambo PWA. Obstoječi novi zapisi imajo prednost; izvirniki PWA ostanejo ohranjeni. LAB in CURRENT uporabljata ločeni shrambi, kvota brskalnika pa ostaja skupna.',
                    'PWA migration dialog')
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
    version = 'pwa-' + digest((json.dumps(hashes, sort_keys=True) + logic).encode())[:12]
    header = "const RELEASE = " + json.dumps(version) + ";\nconst ASSETS = " + json.dumps(assets, indent=2) + ";\n"
    worker = re.sub(r'const RELEASE = .*?// END GENERATED PRECACHE\n', lambda _: header + '// END GENERATED PRECACHE\n', worker, flags=re.S)
    (TARGET / 'sw.js').write_text(worker)
    manifest = {
        'schema': 'chessbest-pwa-release/1', 'version': version,
        'source_channel': 'LAB', 'source_path': 'public/chess/new',
        'source_tree': source_tree,
        'source_files_sha256': source_files, 'pwa_assets_sha256': hashes,
        'worker_sha256': digest(worker.encode()),
        'storage': 'Copy earlier PWA v1 records into isolated PWA v2 storage; retain source keys and databases; keep LAB and CURRENT separate.',
    }
    (TARGET / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'version': version, 'assets': len(assets), 'bytes': sum((TARGET / a).stat().st_size for a in assets)}))


if __name__ == '__main__':
    build()
