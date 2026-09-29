#!/usr/bin/env python3
"""Bounded APP-only repair and regression-harness corrections for this task.
No CURRENT/LAB/PREVIOUS, engines, game data, or PWA activation changes.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'public/chess/app'
def digest(data): return hashlib.sha256(data).hexdigest()
def encoded(value): return (json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode()
def replace(path,old,new):
    text=path.read_text()
    if old in text: path.write_text(text.replace(old,new,1))
    elif new not in text: raise RuntimeError('Patch anchor changed: '+str(path))

release=json.loads((APP/'release.json').read_text())
for name,expected in release['assets_sha256'].items():
    if digest((APP/name).read_bytes())!=expected:
        raise RuntimeError('Unreconciled APP runtime change: '+name)
replace(APP/'css/app-mobile.css',
    '.app-board-controls > #analysisSourceStatus {\n  min-width: 0;',
    '.app-board-controls > #analysisSourceStatus {\n  /* In this column, inherited flex-basis:130px would reserve empty height. */\n  flex: 0 0 auto; height: auto; min-height: 0;\n  min-width: 0;')
replace(APP/'index.html',
    "      const phoneBrowser = navigator.userAgentData?.mobile === true ||\n        /iPhone|iPod|Windows Phone|Android.+Mobile|Mobile.+Safari/i.test(ua);",
    "      const tabletBrowser = /iPad|Tablet|PlayBook|Silk/i.test(ua);\n      const phoneBrowser = !tabletBrowser && (navigator.userAgentData?.mobile === true ||\n        /iPhone|iPod|Windows Phone|Android.+Mobile/i.test(ua));")
# outside-only JSDOM deliberately does not execute inline scripts automatically.
replace(ROOT/'tests/chess-app-pwa.test.cjs',
    "  assert.equal(phone.window.location.pathname, '/chess/app/');",
    "  for (const script of phone.window.document.querySelectorAll('script:not([src])')) phone.window.eval(script.textContent);\n  assert.equal(phone.window.location.pathname, '/chess/app/');")
# Test the completed scroll, not an arbitrary point during inherited smooth motion.
review=ROOT/'tools/chess-app-browser-review.py'
replace(review,
    "frame.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');frame.wait_for_timeout(100)",
    "frame.evaluate(\"window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})\");frame.wait_for_timeout(100)")
assets={name:digest((APP/name).read_bytes()) for name in sorted(release['assets_sha256'])}
version='app-'+digest(encoded(assets))[:16]
header=('/* Generated from tools/chess-pwa/sw-runtime.js. APP only. */\n'
    +"'use strict';\n"+'const RELEASE = '+json.dumps(version)+';\n'
    +'const PREFIX = '+json.dumps('chessbest-chess-app-')+';\n'
    +'const ASSETS = '+json.dumps(list(assets),indent=2)+';\n'
    +'const INTEGRITY = '+json.dumps({name:'sha256-'+base64.b64encode(bytes.fromhex(sha)).decode() for name,sha in assets.items()},indent=2)+';\n')
worker=(header+(ROOT/'tools/chess-pwa/app-sw-runtime.js').read_text()).encode()
(APP/'sw.js').write_bytes(worker)
release.update(version=version,assets_sha256=assets,worker_sha256=digest(worker))
(APP/'release.json').write_bytes(encoded(release))
print(json.dumps({'release':version,'assets':len(assets)},indent=2))
