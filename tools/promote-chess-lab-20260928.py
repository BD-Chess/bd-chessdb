#!/usr/bin/env python3
"""Stage the authorized LAB to CURRENT copy and a sealed CURRENT archive 005.

Run only on the inspected source commit. The existing PREVIOUS, LAB, PWA and
numbered archives are outside this transaction; PWA is refreshed separately.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'public/chess'
LAB = APP / 'new'
ARCHIVE = APP / 'old/005'
EXPECTED = '2152f5bd15745287f39d531c76e2ebf8d985d204'
EXCLUDED = {'old', 'new', 'PWA'}
ARCHIVE_KEYS = {
    'chessLabSettings-v8': 'chessArchive005Settings-v1',
    'chessLabGame-v8': 'chessArchive005Game-v1',
    'chessLabTopPickCursor-v1': 'chessArchive005TopPickCursor-v1',
    'chessLabEvalCache-v8': 'chessArchive005EvalCache-v1',
    'chessLabStudy-v1': 'chessArchive005Study-v1',
    'chessLabTiming-v1': 'chessArchive005Timing-v1',
    '8zc-lab-layout-v1': '8zc-archive005-layout-v1',
    '8zc.evidence.v1': '8zc.archive005.evidence.v1',
    'ChessDCC-evidence': 'ChessDCC-archive005-evidence',
    'ChessBest-sim-v1': 'ChessBest-archive005-sim-v1',
    'chessSimRunnerLease-v1': 'chessArchive005SimRunnerLease-v1',
    'chessBestGame': 'chessArchive005LegacyGame-v1',
    'chessBestSettings': 'chessArchive005LegacySettings-v1',
    'chessBestLichessToken': 'chessArchive005LichessToken-v1',
    'chessBestAnthropicKey': 'chessArchive005AnthropicKey-v1',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def own_files(directory):
    return {p.relative_to(directory).as_posix(): p for p in directory.rglob('*')
            if p.is_file() and 'node_modules' not in p.relative_to(directory).parts and
            (directory != APP or
                p.relative_to(directory).parts[0] not in EXCLUDED and
                p.relative_to(directory).as_posix() != 'versions.json')}


def text_file(name):
    return Path(name).suffix in {'.html', '.js', '.cjs', '.mjs', '.css', '.xml', '.txt'}


def write_copy(source, target, transform):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not text_file(source):
        shutil.copy2(source, target)
        return
    raw = source.read_bytes()
    # Preserve CRLF in the legacy ES modules unless their content changes.
    txt = raw.decode('utf-8')
    after = transform(txt)
    target.write_bytes(raw if after == txt else after.encode('utf-8'))


def source_current(head):
    """Read the immutable inspected commit, including during a staging retry."""
    paths = subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', head,
                                     '--', 'public/chess'], cwd=ROOT).split(b'\0')
    result = {}
    for raw in paths:
        if not raw:
            continue
        full = raw.decode('utf-8')
        rel = full.removeprefix('public/chess/')
        if rel.split('/')[0] in EXCLUDED or rel == 'versions.json':
            continue
        result[rel] = subprocess.check_output(['git', 'show', f'{head}:{full}'], cwd=ROOT)
    return result


def for_archive(rel, value):
    if rel.endswith('.js') or rel == 'index.html':
        for before, after in ARCHIVE_KEYS.items():
            value = value.replace(before, after)
    if rel.endswith('.html'):
        value = value.replace('https://www.mdlxdcc.org/chess/',
                              'https://www.mdlxdcc.org/chess/old/005/')
        # CURRENT-relative links to the site home and author gain two levels.
        value = value.replace('href="../../BD/"', 'href="../../../../BD/"')
        value = value.replace('href="../../"', 'href="../../../../"')
        if rel in {'8zc-help.html', '8zc-about.html'}:
            value = value.replace('href="../"', 'href="../../"')
            value = value.replace('href="../old/"', 'href="../"')
            value = value.replace('href="./new/"', 'href="../../new/"')
            value = value.replace('href="./old/"', 'href="../"')
        if rel in {'facts.html', 'games-info.html', '8zc-pgn.html', '8zc-why.html'}:
            value = value.replace('href="../BD/"', 'href="../../../BD/"')
            value = value.replace('href="../"', 'href="../../../"')
    if rel == 'index.html':
        value = value.replace('<a href="./" aria-current="page">CURRENT</a>',
                              '<a href="../../">CURRENT</a>')
        value = value.replace('<a href="./old/">PREVIOUS</a>', '<a href="../">PREVIOUS</a>')
        value = value.replace('<a href="./new/">LAB</a>', '<a href="../../new/">LAB</a>')
        value = value.replace('<a href="./PWA/">PWA</a>', '<a href="../../PWA/">PWA</a>')
        value = value.replace('<a href="./new/">LAB</a>', '<a href="../../new/">LAB</a>')
        value = value.replace('CHESS ANALYSIS · BD × AI LAB</div>',
                              'CHESS ANALYSIS · ARCHIVE 005</div>')
        value = value.replace('<span class="brand-title">ChessBest.org</span>',
                              '<span class="brand-title">ChessBest.org · archive 005</span>')
    if rel == 'js/8zc-sim-core.js':
        value = value.replace('https://www.mdlxdcc.org/chess/new/',
                              'https://www.mdlxdcc.org/chess/old/005/')
    return value


def for_current(rel, value):
    if rel.endswith(('.html', '.js', '.css', '.cjs', '.mjs')):
        value = value.replace('ChessBest:LAB:v2:', 'ChessBest:CURRENT:v2:')
    if rel.startswith('research/') and rel.endswith(('.cjs', '.mjs')):
        value = value.replace('https://www.mdlxdcc.org/chess/new/', 'https://www.mdlxdcc.org/chess/')
        value = value.replace('https://example.test/chess/new/', 'https://example.test/chess/')
    if rel.endswith('.html'):
        value = value.replace('https://www.mdlxdcc.org/chess/new/',
                              'https://www.mdlxdcc.org/chess/')
    if rel == 'index.html':
        value = value.replace('<span class="development-label">DEVELOPMENT</span>', '')
        value = value.replace('CHESS ANALYSIS · BD × AI LAB </div>', 'CHESS ANALYSIS · BD × AI</div>')
        value = value.replace('<a href="../">CURRENT</a>', '<a href="./" aria-current="page">CURRENT</a>')
        value = value.replace('<a href="../old/">PREVIOUS</a>', '<a href="./old/">PREVIOUS</a>')
        value = value.replace('<a href="./" aria-current="page">LAB</a>', '<a href="./new/">LAB</a>')
        value = value.replace('<a href="../PWA/">PWA</a>', '<a href="./PWA/">PWA</a>')
        value = value.replace('Razvojni Analysis Lab. Trenutna potrjena stran je še vedno na <a href="../">/chess/</a>.',
                              'Potrjena različica ChessBest. Razvoj poteka na <a href="./new/">LAB</a>.')
        value = value.replace('Samostojni podatki LAB.', 'Samostojni podatki CURRENT.')
        value = value.replace('Obstoječi zapisi LAB imajo prednost; izvirniki CURRENT ostanejo ohranjeni.',
                              'Obstoječi zapisi CURRENT imajo prednost; prvotni podatki ostanejo ohranjeni.')
    elif rel == '8zc-help.html':
        value = value.replace('This guide describes the development version.',
                              'This guide describes the current release.')
        value = value.replace('On first use of this LAB release, existing browser data is copied into LAB-only storage and verified. Existing LAB data takes priority; the original CURRENT records are neither moved nor deleted.',
                              'On first use of this CURRENT release, your earlier browser data is copied into CURRENT-only storage and verified. Existing CURRENT data takes priority; the originals are neither moved nor deleted.')
        value = value.replace('restores LAB preferences', 'restores CURRENT preferences')
        value = value.replace('This release gives LAB its own copied workspace; later changes are independent from CURRENT and PWA.',
                              'CURRENT, LAB and PWA keep independent workspaces in this browser.')
        value = value.replace('<a href="8zc-about.html">About this lab</a><a href="../">Current version ↗</a>',
                              '<a href="8zc-about.html">About ChessBest</a><a href="./new/">LAB ↗</a>')
    elif rel == '8zc-about.html':
        value = value.replace('BD × AI LAB · DEVELOPMENT WORKSPACE', 'BD × AI · CURRENT WORKSPACE')
        value = value.replace('<a href="./">Development board</a><a href="../">Current version ↗</a><a href="../old/">Old version ↗</a>',
                              '<a href="./">Current board</a><a href="./new/">LAB ↗</a><a href="./old/">Previous ↗</a>')
    if rel == 'js/8zc-lab-storage.js':
        source_line = '              copyLocal(journal, source, destination);'
        fallback_line = '''              // The older CURRENT ES module used chessBest* before 8zc-utils
              // used chessLab*. Preserve the first available source, never
              // delete either original and never override an existing target.
              const earlier = target === KEYS.settings ? 'chessBestSettings'
                : target === KEYS.game ? 'chessBestGame' : null;
              const chosen = earlier && storage.getItem(source) === null
                && storage.getItem(earlier) !== null ? earlier : source;
              copyLocal(journal, chosen, destination);'''
        if source_line not in value:
            raise ValueError('CURRENT legacy migration insertion point changed')
        value = value.replace(source_line, fallback_line, 1)
        value = value.replace('No LAB writes', 'No CURRENT writes')
        value = value.replace('LAB data copy needs attention', 'CURRENT data copy needs attention')
        value = value.replace('LAB data migration', 'CURRENT data migration')
        value = value.replace('LAB migration', 'CURRENT migration')
        value = value.replace('LAB archive', 'CURRENT archive')
        value = value.replace('LAB data copy', 'CURRENT data copy')
        value = value.replace('Existing LAB', 'Existing CURRENT')
        value = value.replace('CURRENT remains available for exporting your original data.',
                              'Original data remains available for export after resolving the issue.')
        value = value.replace("link.href = '../'; link.textContent = 'Open CURRENT';", "link.href = './old/005/'; link.textContent = 'Open archived release';")
        value = value.replace('LAB', 'CURRENT')
        value = value.replace('CURRENT and CURRENT share that quota', 'CURRENT, LAB and PWA share that quota')
    if rel == 'js/8zc-study-ui.js':
        value = value.replace('only LAB Studies', 'only CURRENT Studies')
        value = value.replace('selected LAB Study', 'selected CURRENT Study')
        value = value.replace('chess-lab-', 'chess-current-')
    if rel == 'js/8zc-sim-core.js':
        value = value.replace('ChessBest LAB tournament', 'ChessBest tournament')
        value = value.replace('https://www.mdlxdcc.org/chess/new/', 'https://www.mdlxdcc.org/chess/')
    if rel == 'js/8zc-deep-engine.js':
        value = value.replace('http://localhost/chess/new/', 'http://localhost/chess/')
    return value


def main():
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    if head != EXPECTED:
        raise SystemExit(f'Expected inspected main {EXPECTED}, found {head}')
    if ARCHIVE.exists():
        raise SystemExit('Archive 005 already exists: never replace a numbered snapshot')
    old = source_current(head)
    new = own_files(LAB)
    if len(old) != 149 or len(new) != 166 or set(old) - set(new):
        raise SystemExit('Unexpected CURRENT/LAB source inventory; inspect before promoting')
    archive_source = {rel: hashlib.sha256(data).hexdigest() for rel, data in sorted(old.items())}
    for rel, data in old.items():
        out = ARCHIVE / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if text_file(rel):
            before = data.decode('utf-8')
            after = for_archive(rel, before)
            data = data if before == after else after.encode('utf-8')
        out.write_bytes(data)
    # No old CURRENT own files are deleted: its own runtime paths are a subset
    # of LAB, and their replacements are staged only after the backup exists.
    for rel, source in new.items():
        write_copy(source, APP / rel, lambda value, r=rel: for_current(r, value))
    archived = {rel: digest(source) for rel, source in sorted(own_files(ARCHIVE).items())}
    modified = [rel for rel in archive_source if archive_source[rel] != archived[rel]]
    manifest = {
        'schema': 'chess-archive/1', 'archive_id': '005', 'path': '/chess/old/005/',
        'purpose': 'Immutable prepromotion CURRENT application snapshot; PREVIOUS legacy is preserved',
        'source_channel': 'CURRENT', 'source_commit': head,
        'source_repository_tree': subprocess.check_output(['git', 'rev-parse', f'{head}:public/chess'], cwd=ROOT, text=True).strip(),
        'excluded_channel_roots': ['old/', 'new/', 'PWA/', 'versions.json'],
        'created_utc': datetime.now(timezone.utc).isoformat(),
        'source_file_sha256': archive_source, 'file_sha256': archived,
        'intentional_rewrites': {
            'files': modified,
            'reason': 'Archive-relative navigation/canonical URL and 005-only browser storage names, to avoid writes to retained CURRENT legacy data.',
            'storage': ARCHIVE_KEYS,
            'archive_data': 'Fresh namespace. No personal browser records are moved, copied or deleted; prepromotion records are copied into CURRENT v2 on first use.'
        },
        'external_services': ['ChessDB', 'Lichess', 'Gemini', 'online token lookup'],
    }
    (ARCHIVE / 'ARCHIVE_MANIFEST.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'source': head, 'current_files': len(new), 'archive_files': len(old),
                      'archive_manifest_sha256': digest(ARCHIVE / 'ARCHIVE_MANIFEST.json'),
                      'archive_rewrites': len(modified)}, indent=2))


if __name__ == '__main__':
    main()
