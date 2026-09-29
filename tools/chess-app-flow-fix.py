#!/usr/bin/env python3
"""One bounded APP-only repair; run in the task branch before browser verification.
Does not change CURRENT/LAB/PREVIOUS, engines, game data, or PWA activation policy.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'public/chess/app'
def digest(data):
    return hashlib.sha256(data).hexdigest()
def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False)+'\n').encode()

release = json.loads((APP/'release.json').read_text())
# Check existing runtime integrity before applying this narrow source repair.
for name, expected in release['assets_sha256'].items():
    if digest((APP/name).read_bytes()) != expected:
        raise RuntimeError('Unreconciled APP runtime change: '+name)
css = APP/'css/app-mobile.css'
old = '.app-board-controls > #analysisSourceStatus {\n  min-width: 0;'
new = '.app-board-controls > #analysisSourceStatus {\n  /* In this column, inherited flex-basis:130px would reserve empty height. */\n  flex: 0 0 auto; height: auto; min-height: 0;\n  min-width: 0;'
text = css.read_text()
if old in text:
    text = text.replace(old,new,1)
    css.write_text(text)
elif new not in text:
    raise RuntimeError('APP status selector changed; manual reconciliation required')
assets = {name:digest((APP/name).read_bytes()) for name in sorted(release['assets_sha256'])}
version = 'app-'+digest(encoded(assets))[:16]
header = ('/* Generated from tools/chess-pwa/sw-runtime.js. APP only. */\n'
          + "'use strict';\n"
          + 'const RELEASE = '+json.dumps(version)+';\n'
          + 'const PREFIX = '+json.dumps('chessbest-chess-app-')+';\n'
          + 'const ASSETS = '+json.dumps(list(assets),indent=2)+';\n'
          + 'const INTEGRITY = '+json.dumps({name:'sha256-'+base64.b64encode(bytes.fromhex(sha)).decode() for name,sha in assets.items()},indent=2)+';\n')
worker = (header+(ROOT/'tools/chess-pwa/app-sw-runtime.js').read_text()).encode()
(APP/'sw.js').write_bytes(worker)
release.update(version=version,assets_sha256=assets,worker_sha256=digest(worker))
(APP/'release.json').write_bytes(encoded(release))
print(json.dumps({'release':version,'assets':len(assets),'changed_runtime':['css/app-mobile.css','sw.js','release.json']},indent=2))
