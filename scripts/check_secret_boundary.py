#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_NAME_PARTS = (
    'bd_sef_unlocked_private',
    'sef_unlocked_private',
)
FORBIDDEN_EXACT_PATH_SUFFIXES = (
    '/cockpit/sef.html',
    '/rclone.conf',
)

# Build sensitive marker regexes without storing any real credential values here.
GOOGLE_SECRET = re.compile('GOC' + r'SPX-[A-Za-z0-9_-]{10,}')
HARDCODED_SECRET = re.compile(
    r'(?i)(client[_ -]?secret|refresh[_ -]?token)\s*[:=]\s*["\'][^"\']{12,}["\']'
)
GOOGLE_CLIENT_ID = re.compile(r'\b\d{10,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com\b', re.I)

TEXT_SUFFIXES = {'.py','.md','.txt','.json','.html','.js','.mjs','.bat','.cmd','.yml','.yaml','.toml','.ini','.cfg'}
SKIP = {
    Path('scripts/check_secret_boundary.py'),
    Path('docs/BD_SEF_SECRET_BOUNDARY_v1_0.md'),
}

errors = []
for p in ROOT.rglob('*'):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT)
    rel_s = '/' + rel.as_posix().lower()
    name = p.name.lower()
    if any(part in name for part in FORBIDDEN_NAME_PARTS) or any(rel_s.endswith(x) for x in FORBIDDEN_EXACT_PATH_SUFFIXES):
        errors.append(f'forbidden file: {rel}')
        continue
    if rel in SKIP or p.suffix.lower() not in TEXT_SUFFIXES:
        continue
    try:
        text = p.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue
    if GOOGLE_SECRET.search(text):
        errors.append(f'Google OAuth secret marker: {rel}')
    if HARDCODED_SECRET.search(text):
        errors.append(f'hard-coded OAuth secret/token: {rel}')
    # A raw Google OAuth client ID should not be committed for Sef/rclone use.
    if GOOGLE_CLIENT_ID.search(text) and ('rclone' in text.lower() or 'sef' in text.lower()):
        errors.append(f'raw OAuth client id in Sef/rclone context: {rel}')

if errors:
    print('SECRET BOUNDARY FAIL')
    for item in errors:
        print(item)
    sys.exit(2)

print('SECRET BOUNDARY PASS')
