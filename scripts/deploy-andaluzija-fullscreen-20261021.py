"""Publish only the photo-only fullscreen correction over the exact live snapshot."""
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request
import urllib.error

SITE = '17b4124d-c197-4c0a-a711-8b2c08d91088'
BASE = '6ad88b33fa605c1ea5781038'
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


guard()
before = api('deploys/' + BASE)
assert before['state'] == 'ready' and before['context'] == 'production'
sources = ['public/shared/dualframe-album.mjs', 'public/shared/dualframe-album.css']
expected_before = {
    "shared/dualframe-album.mjs": "f5f658b18c19b465f5f9054dbca8383c4b25f43cf3221dc870b0ee98fe0930e8",
    "shared/dualframe-album.css": "c5716a074f0c9ed4cb900f41a05beba94730250f81cc34d94527eb3f86d0a3be"
}
overlay = {p.removeprefix('public/').lower(): Path(p).read_bytes() for p in sources}
for path, contents in overlay.items():
    assert sha(public(path)) == expected_before[path], 'Live source drift: ' + path
    assert sha(contents) != expected_before[path], 'Missing change: ' + path
# The published HTML contains canonical links and password-manager preparation
# not present in source. Preserve every byte except these two cache keys.
page_path = 'bd/o/izleti/andaluzija-2027.html'
original_page = public(page_path)
page = original_page.decode()
for name in ['dualframe-album.css', 'dualframe-album.mjs']:
    old = name + '?v=20261021-r1'
    assert page.count(old) == 1, 'Unexpected live resource: ' + name
    page = page.replace(old, name + '?v=20261021-fullscreen2')
overlay[page_path] = page.encode()
files = {f['path'].lstrip('/').lower(): f['sha'] for f in api('sites/' + SITE + '/files')}
assert files[page_path] == sha(original_page, 'sha1'), 'HTML is not the exact static snapshot'
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
title = 'Andaluzija photo-only fullscreen and delayed place name ' + os.environ['GITHUB_SHA'] + ' album=' + BASE
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
receipt = {'deploy_id': deploy_id, 'state': deploy['state'], 'published_at': deploy['published_at'],
    'source': os.environ['GITHUB_SHA'], 'previous_deploy': BASE, 'changed_files': list(overlay),
    'all_other_static_files_identical': True, 'static_file_count': len(files),
    'all_30_function_packages_and_configuration_identical': True,
    'fullscreen': 'photo only; double tap enter/exit; place name after 2000ms from image load',
    'url': 'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027#slike'}
(OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
