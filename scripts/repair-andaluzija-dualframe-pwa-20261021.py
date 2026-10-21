"""Repair only the two live PWA metadata files; preserve the entire album deploy."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
import urllib.error

SITE = '17b4124d-c197-4c0a-a711-8b2c08d91088'
BASE = '6ad88643df77f0aa7c7847b2'
DF = 'nara/dualframe-lab/'
OUT = Path('album-release-evidence')
OUT.mkdir(exist_ok=True)


def sha(data, kind='sha256'):
    return hashlib.new(kind, data).hexdigest()


def api(path, data=None, method=None):
    request = urllib.request.Request('https://api.netlify.com/api/v1/' + path,
        data=json.dumps(data).encode() if isinstance(data, dict) else data, method=method,
        headers={'Authorization': 'Bearer ' + os.environ['NETLIFY_AUTH_TOKEN'],
                 'Content-Type': 'application/json' if isinstance(data, dict) else 'application/octet-stream'})
    attempts = 4 if request.get_method() in ['GET', 'PUT'] else 1
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except (urllib.error.URLError, ConnectionResetError, TimeoutError) as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in [429, 500, 502, 503, 504]:
                raise
            if attempt + 1 == attempts:
                raise
            time.sleep(2 ** attempt)


def public(path, deploy=BASE):
    url = 'https://' + deploy + '--mdlxdcc.netlify.app/' + urllib.parse.quote(path.lower(), safe='/')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                return response.read()
        except (urllib.error.URLError, ConnectionResetError, TimeoutError) as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in [429, 500, 502, 503, 504]:
                raise
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def guard():
    assert api('sites/' + SITE)['published_deploy']['id'] == BASE, 'Production changed'


def asset_path(asset):
    path = DF + asset.removeprefix('./').split('?')[0]
    return path + 'index.html' if path.endswith('/') else path


def package_hash(assets, data):
    h = hashlib.sha256()
    for asset in assets:
        path = asset_path(asset)
        if path == DF + 'release.json':
            continue
        h.update((asset + '\0' + sha(data[path]) + '\n').encode())
    return h.hexdigest()


guard()
before = api('deploys/' + BASE)
assert before['state'] == 'ready' and before['context'] == 'production'
worker = public(DF + 'sw.js').decode()
release = json.loads(public(DF + 'release.json'))
assets = json.loads(re.search(r'const ASSETS=(\[[\s\S]*?\]);', worker)[1])
assert './sw.js' not in assets
paths = sorted({asset_path(a) for a in assets if asset_path(a) != DF + 'release.json'})
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    data = dict(zip(paths, pool.map(public, paths)))
assert 'DualFrame in practice' in data[DF + 'index.html'].decode()
digest = package_hash(assets, data)
assert digest != release['pwa']['offline_package_sha256'], 'No repair necessary'
release['pwa']['offline_package_sha256'] = digest
worker = re.sub(r"const PACKAGE_SHA='[^']+';", "const PACKAGE_SHA='" + digest + "';", worker)
overlay = {DF + 'release.json': (json.dumps(release, ensure_ascii=False, indent=2) + '\n').encode(),
           DF + 'sw.js': worker.encode()}
files = {f['path'].lstrip('/').lower(): f['sha'] for f in api('sites/' + SITE + '/files')}
original_files = dict(files)
for path, contents in overlay.items():
    assert path in files
    files[path] = sha(contents, 'sha1')
functions = {f['n']: f['d'] for f in before['available_functions']}
bundles = {f['name']: f for f in json.loads((Path(os.environ['ALBUM_FROZEN_ROOT']) / 'bundled-functions.json').read_text())}
assert {name: f['sha256'] for name, f in bundles.items()} == functions and len(functions) == 30
for name, bundle in bundles.items():
    assert sha(Path(bundle['path']).read_bytes()) == functions[name]
assert {f.get('m') for f in before['available_functions']} == {1024}
assert {f.get('rg') for f in before['available_functions']} == {'us-east-2'}
config = {}
for f in before['available_functions']:
    config[f['n']] = {long: f[short] for long, short in {
        'display_name': 'dn', 'generator': 'g', 'build_data': 'bd',
        'priority': 'p', 'traffic_rules': 'tr'}.items() if f.get(short) is not None}
    if f.get('ro'):
        config[f['n']]['routes'] = [{long: route[short] for long, short in {
            'pattern': 'p', 'literal': 'l', 'expression': 'e', 'methods': 'm', 'prefer_static': 'ps',
        }.items() if route.get(short) is not None} for route in f['ro']]
    assert not f.get('ero'), 'Unexpected excluded routes'
guard()
title = 'DualFrame live PWA checksum correction ' + os.environ['GITHUB_SHA'] + ' album=' + BASE
deploy = api('sites/' + SITE + '/deploys?title=' + urllib.parse.quote(title) + '&commit_ref=' + os.environ['GITHUB_SHA'],
    {'files': files, 'functions': functions, 'functions_config': config,
     'function_schedules': before['function_schedules'], 'branch': 'main', 'async': True, 'draft': False}, 'POST')
deploy_id = deploy['id']
(OUT / 'created.json').write_text(json.dumps({'deploy_id': deploy_id, 'source': os.environ['GITHUB_SHA']}) + '\n')
for _ in range(90):
    deploy = api('deploys/' + deploy_id)
    assert deploy['state'] != 'error'
    if deploy['state'] not in ['preparing', 'enqueued', 'building']:
        break
    time.sleep(3)
by_sha = {sha(contents, 'sha1'): (path, contents) for path, contents in overlay.items()}
assert all(h in by_sha for h in deploy.get('required', []))
assert not deploy.get('required_edge_functions') and not deploy.get('required_server')
guard()
for h in deploy.get('required', []):
    path, contents = by_sha[h]
    api('deploys/' + deploy_id + '/files/' + urllib.parse.quote(path, safe='/'), contents, 'PUT')
by_function_sha = {b['sha256']: b for b in bundles.values()}
for h in deploy.get('required_functions', []):
    bundle = by_function_sha[h]
    query = {'runtime': bundle.get('runtimeVersion') or bundle['runtime']}
    if bundle.get('invocationMode'):
        query['invocation_mode'] = bundle['invocationMode']
    if bundle.get('timeout'):
        query['timeout'] = bundle['timeout']
    api('deploys/' + deploy_id + '/functions/' + bundle['name'] + '?' + urllib.parse.urlencode(query),
        Path(bundle['path']).read_bytes(), 'PUT')
for _ in range(120):
    deploy = api('deploys/' + deploy_id)
    if deploy['state'] in ['ready', 'error']:
        break
    time.sleep(3)
assert deploy['state'] == 'ready' and deploy['context'] == 'production'
assert api('sites/' + SITE)['published_deploy']['id'] == deploy_id
for key in ['d', 'bd', 'p', 'tr', 'ro', 'ero', 'r', 'rg', 'm', 'im']:
    assert {f['n']: f.get(key) for f in before['available_functions']} == {f['n']: f.get(key) for f in deploy['available_functions']}, key
assert deploy['function_schedules'] == before['function_schedules']
after_files = {f['path'].lstrip('/').lower(): f['sha'] for f in api('sites/' + SITE + '/files')}
assert after_files == files, 'Unexpected static delta'
for path, contents in overlay.items():
    assert public(path, deploy_id) == contents
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    actual_data = dict(zip(paths, pool.map(lambda path: public(path, deploy_id), paths)))
assert package_hash(assets, actual_data) == digest
receipt = {'deploy_id': deploy_id, 'state': deploy['state'], 'published_at': deploy['published_at'],
    'source': os.environ['GITHUB_SHA'], 'previous_album_deploy': BASE, 'changed_files': list(overlay),
    'all_other_static_files_identical': True, 'static_file_count': len(files),
    'all_30_function_packages_and_configuration_identical': True,
    'live_offline_package_sha256': digest, 'offline_assets_verified': len(paths),
    'url': 'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027#slike'}
(OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
