"""Reconstruct only the exact already-published function sources and dependencies."""
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile

BASE = 'e8c7505f222ec3f8c1403b57a002a36222d041cf'
NAV = '9ecdc55093d32277fbccd6fa4f747c801ca7a3fe'
ROOT = Path(os.environ['ALBUM_FROZEN_ROOT'])
assert not ROOT.exists(), 'Use a fresh isolated preparation directory'
ROOT.mkdir()
subprocess.run(['git', 'fetch', '--depth=1', '--filter=blob:none', 'origin', BASE, NAV], check=True)


def extract(ref, paths):
    data = subprocess.check_output(['git', 'archive', ref, *paths])
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(ROOT, filter='data')


extract(BASE, ['functions', 'package.json', 'package-lock.json', 'netlify.toml',
    'public/ai/skills', 'public/Nara/dualframe-lab/core.mjs',
    'public/Trip/new/air-distance.js', 'public/Trip/new/deep-search.js', 'public/Trip/new/road-matrix.js'])
registry_path = ROOT / 'public/ai/skills/registry.json'
registry = json.loads(registry_path.read_text())
extract(NAV, ['functions/andaluzija-auth.mjs', 'functions/andaluzija-state.mjs',
    'functions/andaluzija-ai.mjs', 'functions/lib/andaluzija-access.mjs',
    'functions/lib/andaluzija-ai-knowledge.mjs', 'functions/lib/mdlxdcc-guide/provider.mjs',
    'public/BD/O/izleti/andaluzija-page.mjs', 'public/ai/skills/andaluzija-2027-guide',
    'package.json', 'package-lock.json', 'netlify.toml'])
incoming = json.loads(subprocess.check_output(['git', 'show', NAV + ':public/ai/skills/registry.json']))
entry, = [s for s in incoming['skills'] if s['id'] == 'andaluzija-2027-guide']
original = copy.deepcopy(registry)
registry['skills'] = [s for s in registry['skills'] if s['id'] != entry['id']] + [entry]
assert [s for s in registry['skills'] if s['id'] != entry['id']] == [s for s in original['skills'] if s['id'] != entry['id']]
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n')
# git archive honors the local umask. Match GitHub checkout's file permissions
# so the ZIPs, including their permission headers, match the published SHA256.
for path in ROOT.rglob('*'):
    if path.is_file():
        path.chmod(0o755 if path.stat().st_mode & 0o111 else 0o644)
print('Prepared pinned published sources; exact ZIP hashes are checked before any deploy is created.')
