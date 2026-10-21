"""BD-authorized one-shot album release; preserve the published snapshot by digest.

Uses Netlify's file-digest API, including its existing serialized netlify.toml,
cached function digests/configuration and schedules. No provider calls or secrets
are written. Only the explicitly listed public album and backlink are overlaid.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

SITE = '17b4124d-c197-4c0a-a711-8b2c08d91088'
BASE = '6ad7f1f75aa407c6d162b971'
HOST = 'https://' + BASE + '--mdlxdcc.netlify.app'
PAGE = 'BD/O/izleti/andaluzija-2027.html'
DF = 'Nara/dualframe-lab/'
PUBLIC = Path('public')
EVIDENCE = Path('album-release-evidence')
EVIDENCE.mkdir(exist_ok=True)


def sha(data, kind='sha256'):
    return hashlib.new(kind, data).hexdigest()


def api(path, data=None, method=None, content_type='application/json'):
    req = urllib.request.Request('https://api.netlify.com/api/v1/' + path,
        data=json.dumps(data).encode() if isinstance(data, dict) else data,
        method=method, headers={'Authorization': 'Bearer ' + os.environ['NETLIFY_AUTH_TOKEN'],
                              'Content-Type': content_type})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def read_public(path):
    with urllib.request.urlopen(HOST + '/' + urllib.parse.quote(path, safe='/'), timeout=45) as response:
        assert response.status == 200
        return response.read()


def guard():
    current = api('sites/' + SITE)['published_deploy']['id']
    assert current == BASE, 'Production changed; no deployment attempted'


def section(text):
    match = re.search(r'<section\b[^>]*\bid=[\'"]slike[\'"][^>]*>[\s\S]*?</section>', text)
    assert match, 'Gallery section missing'
    return match.group()


guard()
published = api('deploys/' + BASE)
assert published['state'] == 'ready' and not published.get('edge_functions_present') and not published.get('server')
before = api('sites/' + SITE + '/files')
guard()
assert isinstance(before, list) and len(before) > 500
files = {x['path'].lstrip('/'): x['sha'] for x in before}
assert len(files) == len(before) and all(re.fullmatch('[0-9a-f]{40}', h) for h in files.values())
assert 'netlify.toml' in files, 'Must preserve existing serialized redirects and security headers'
overlay = {}


def put(path, data):
    # Keep the baseline spelling when Netlify has canonicalized a path.
    matches = [p for p in files if p.lower() == path.lower()]
    assert len(matches) <= 1, 'Ambiguous published asset'
    key = matches[0] if matches else path
    overlay[key] = data


# Modify the exact already-published HTML, retaining its password-manager changes.
page = read_public(PAGE).decode()
incoming = (PUBLIC / PAGE).read_text()
page = page.replace(section(page), section(incoming))
new_resources = '\n'.join(re.findall(r'<(?:link|script)[^>]*(?:src|href)="../../../shared/dualframe-album[^>]+>(?:</script>)?', incoming))
assert 'dualframe-album.mjs' in new_resources and 'dualframe-album.css' in new_resources
assert 'dualframe-album.mjs' not in page
page = page.replace('</head>', new_resources + '\n</head>')
page = page.replace('andaluzija-2027.js?v=20261021-shield2', 'andaluzija-2027.js?v=20261021-dualframe1')
put(PAGE, page.encode())

js_path = 'BD/O/izleti/andaluzija-2027.js'
old_js = read_public(js_path).decode()
new_js = (PUBLIC / js_path).read_text()
assert new_js.replace("if(!$('photo-gallery').dataset.dualframeReady)", '') == old_js, 'Unexpected page-script change'
put(js_path, new_js.encode())
for name in ['dualframe-album.mjs', 'dualframe-album.css']:
    path = 'shared/' + name
    put(path, (PUBLIC / path).read_bytes())
album_dir = PUBLIC / 'BD/O/izleti/assets/andaluzija-2027/dualframe'
catalog = json.loads((album_dir / 'album.json').read_text())
assert len(catalog['items']) == 21
for item in catalog['items']:
    for variant in item['variants'].values():
        assert sha((album_dir / variant['src']).read_bytes()) == variant['sha256']
for path in sorted(album_dir.iterdir()):
    assert path.is_file() and path.suffix in ['.webp', '.json'] and path.stat().st_size > 0
    put(path.relative_to(PUBLIC).as_posix(), path.read_bytes())

# The live DualFrame has a different release than main: add only this backlink.
live_index = read_public(DF + 'index.html').decode()
card = re.search(r'<section class="panel" aria-label="DualFrame in practice"[\s\S]*?</section>', (PUBLIC / DF / 'index.html').read_text()).group()
assert 'DualFrame in practice' not in live_index
live_index, count = re.subn(r'(?=<section\b[^>]*\bid=[\'"]reference-gallery[\'"])', card + '\n', live_index)
assert count == 1
put(DF + 'index.html', live_index.encode())
release = json.loads(read_public(DF + 'release.json'))
worker = read_public(DF + 'sw.js').decode()
assets = json.loads(re.search(r'const ASSETS=(\[[\s\S]*?\]);', worker)[1])
package = hashlib.sha256()
for asset in assets:
    path = DF + asset.removeprefix('./').split('?')[0]
    if path == DF + 'release.json':
        continue
    data = overlay.get(path)
    if data is None:
        data = read_public(path)
    package.update((asset + '\0' + sha(data) + '\n').encode())
digest = package.hexdigest()
label = '20261021-dualframe-embedded-album-r35'
release['pwa'].update(build_label=label, offline_package_sha256=digest)
worker = re.sub(r"const BUILD_LABEL='[^']+';", "const BUILD_LABEL='" + label + "';", worker)
worker = re.sub(r"const PACKAGE_SHA='[^']+';", "const PACKAGE_SHA='" + digest + "';", worker)
put(DF + 'release.json', (json.dumps(release, ensure_ascii=False, indent=2) + '\n').encode())
put(DF + 'sw.js', worker.encode())

# All files and all functions start with the currently published digest map.
before_files = dict(files)
for path, data in overlay.items():
    files[path] = sha(data, 'sha1')
functions = {f['n']: f['d'] for f in published['available_functions']}
assert len(functions) == 30
config = {}
for f in published['available_functions']:
    config[f['n']] = {long: f[short] for long, short in {
        'display_name': 'dn', 'generator': 'g', 'build_data': 'bd', 'memory': 'm',
        'priority': 'p', 'region': 'rg', 'traffic_rules': 'tr',
    }.items() if f.get(short) is not None}
    if f.get('ro'):
        config[f['n']]['routes'] = [{long: route[short] for long, short in {
            'pattern': 'p', 'literal': 'l', 'expression': 'e', 'methods': 'm', 'prefer_static': 'ps',
        }.items() if route.get(short) is not None} for route in f['ro']]
    if f.get('ero'):
        raise AssertionError('Excluded function routes require explicit preservation')
assert all(files[p] == value for p, value in before_files.items() if p not in overlay)
scope = {'previous_deploy': BASE, 'source': os.environ['GITHUB_SHA'],
    'preserved_static_files': len(before_files), 'preserved_functions': functions,
    'overlay_sha256': {p: sha(b) for p, b in overlay.items()}, 'source_functions_changed': False,
    'live_dualframe_policy': 'only backlink and matching offline package; preserve current deployed features'}
(EVIDENCE / 'scope.json').write_text(json.dumps(scope, indent=2) + '\n')

# One creation attempt. An unknown POST outcome must never be blindly retried.
guard()
title = 'Andaluzija DualFrame album ' + os.environ['GITHUB_SHA'] + ' baseline=' + BASE
deploy = api('sites/' + SITE + '/deploys?title=' + urllib.parse.quote(title), {
    'files': files, 'functions': functions, 'functions_config': config,
    'function_schedules': published.get('function_schedules') or [],
    'branch': 'main', 'framework': published.get('framework') or 'unknown', 'async': True,
})
deploy_id = deploy['id']
(EVIDENCE / 'created.json').write_text(json.dumps({'deploy_id': deploy_id, 'source': os.environ['GITHUB_SHA']}) + '\n')
for _ in range(90):
    deploy = api('deploys/' + deploy_id)
    assert deploy['state'] != 'error', 'Deploy failed'
    if deploy['state'] not in ['preparing', 'enqueued', 'building']:
        break
    time.sleep(3)
else:
    raise AssertionError('Deploy preparation timed out; retain existing ID')
assert not deploy.get('required_functions'), 'Cached functions unavailable; no function replacement allowed'
assert not deploy.get('required_edge_functions') and not deploy.get('required_server')
by_sha = {sha(data, 'sha1'): (path, data) for path, data in overlay.items()}
required = deploy.get('required') or []
assert all(h in by_sha for h in required), 'Baseline digest was not preserved by server'
guard()
for h in required:
    path, data = by_sha[h]
    api('deploys/' + deploy_id + '/files/' + urllib.parse.quote(path, safe='/'), data, 'PUT', 'application/octet-stream')
for _ in range(120):
    deploy = api('deploys/' + deploy_id)
    if deploy['state'] in ['ready', 'error']:
        break
    time.sleep(3)
assert deploy['state'] == 'ready'
assert api('sites/' + SITE)['published_deploy']['id'] == deploy_id
assert {f['n']: f['d'] for f in deploy['available_functions']} == functions, 'Production functions changed'
after = {f['path'].lstrip('/'): f['sha'] for f in api('sites/' + SITE + '/files')}
assert after == files, 'Unexpected published static changes'
receipt = {'deploy_id': deploy_id, 'state': deploy['state'], 'published_at': deploy.get('published_at'),
    'source': os.environ['GITHUB_SHA'], 'baseline': BASE, 'changed_public_files': len(overlay),
    'preserved_functions': len(functions), 'unchanged_static_files_verified': True,
    'url': 'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027#slike'}
(EVIDENCE / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
