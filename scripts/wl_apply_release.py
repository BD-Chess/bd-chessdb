"""Apply this version's exact, owner-approved release bytes on a clean runner."""
import hashlib,json,subprocess,zipfile,base64,shutil
from pathlib import Path
ARCHIVE=Path('ops/wl-release-20260912.zip')
EXPECTED='e38281812d2fc2c17acc4c893c01431afba1e94d04039e2442a8712c533c4801'
parts=Path('ops/wl-release'); files=sorted(parts.glob('part*.b64'))
if len(files)!=5:raise SystemExit('incomplete release parts')
ARCHIVE.write_bytes(base64.b64decode(''.join(x.read_text() for x in files),validate=True))
if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()!=EXPECTED:raise SystemExit('release checksum mismatch')
allowed={'public/WL/index.html','public/WL/reader.js','public/WL/vault.json','public/WL/state.enc.json','public/WL/data/entries/e000001.enc.json','scripts/wl_codec.py','functions/wl-runtime.mjs','functions/wl-clock.mjs','tests/test_wl_codec.py','tests/wl_live_test.py','docs/WL_CONTINUITY_v2.md'}
with zipfile.ZipFile(ARCHIVE) as z:
    if set(z.namelist())!=allowed or len(z.namelist())!=len(allowed):raise SystemExit('unexpected release paths')
    for name in sorted(allowed):
        path=Path(name)
        # Do not replace an existing private journal or master-key envelope.
        if (name.endswith('.enc.json') or name.endswith('vault.json')) and path.exists():raise SystemExit('journal already exists; review required')
        data=z.read(name);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
config=Path('netlify.toml');s=config.read_text()
if '[build]' not in s:s='[build]\n  publish = "public"\n\n'+s
if 'for = "/WL/*"' not in s:
    s+='''\n# WL encrypted journal. No public navigation is added.\n[[headers]]\n  for = "/WL/*"\n  [headers.values]\n    Cache-Control = "no-store, no-cache, must-revalidate"\n    X-Robots-Tag = "noindex, nofollow, noarchive, nosnippet"\n    Referrer-Policy = "no-referrer"\n    X-Content-Type-Options = "nosniff"\n    Content-Security-Policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'"\n'''
config.write_text(s)
ARCHIVE.unlink()
shutil.rmtree(parts)
subprocess.run(['git','add','--',*sorted(allowed),'netlify.toml',str(parts)],check=True)
subprocess.run(['git','config','user.name','BD-AI8 Deployment'],check=True)
subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
subprocess.run(['git','commit','-m','Complete encrypted WL continuity journal and private reader'],check=True)
subprocess.run(['git','push','origin','HEAD:main'],check=True)
print('Release applied atomically; original unrelated paths preserved.')
