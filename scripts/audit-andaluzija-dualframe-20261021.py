"""Read-only completion audit for the already-published, BD-authorized album."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

SITE = '17b4124d-c197-4c0a-a711-8b2c08d91088'
DEPLOY = '6ad88643df77f0aa7c7847b2'
BASE = '6ad7f1f75aa407c6d162b971'
OUT = Path('album-release-evidence')
OUT.mkdir(exist_ok=True)
scope = json.loads((OUT / 'scope.json').read_text())
assert scope['previous_deploy'] == BASE and scope['source'] == '58c2255162cc4fa3d130286515c8f78fd58cc515'


def api(path):
    request = urllib.request.Request('https://api.netlify.com/api/v1/' + path,
        headers={'Authorization': 'Bearer ' + os.environ['NETLIFY_AUTH_TOKEN']})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def public(path, deploy=DEPLOY):
    url = 'https://' + deploy + '--mdlxdcc.netlify.app/' + urllib.parse.quote(path.lower(), safe='/')
    with urllib.request.urlopen(url, timeout=45) as response:
        return response.read(), {key.lower(): value for key, value in response.headers.items()}


before, after = api('deploys/' + BASE), api('deploys/' + DEPLOY)
assert after['state'] == 'ready' and after['context'] == before['context'] == 'production'
assert api('sites/' + SITE)['published_deploy']['id'] == DEPLOY
assert {f['n']: f['d'] for f in after['available_functions']} == scope['preserved_functions']
for key in ['d', 'bd', 'p', 'tr', 'ro', 'ero', 'r', 'rg', 'm', 'im']:
    assert {f['n']: f.get(key) for f in before['available_functions']} == {f['n']: f.get(key) for f in after['available_functions']}, key
assert after['function_schedules'] == before['function_schedules']
files = {f['path'].lstrip('/'): f['sha'] for f in api('sites/' + SITE + '/files')}
assert len(files) == len({path.lower() for path in files}), 'Case collision'
canonical = {path.lower(): value for path, value in files.items()}
expected = scope['overlay_sha256']
assert len(expected) == 92 and len(canonical) == scope['preserved_static_files'] + 87


def check(item):
    path, wanted = item
    data, _ = public(path)
    actual = hashlib.sha256(data).hexdigest()
    assert actual == wanted, 'Published content differs: ' + path
    assert canonical[path.lower()] == hashlib.sha1(data).hexdigest(), path
    return {'path': path, 'published_path': path.lower(), 'sha256': actual, 'bytes': len(data)}


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    checked = list(pool.map(check, expected.items()))
page = 'bd/o/izleti/andaluzija-2027.html'
_, old_headers = public(page, BASE)
_, new_headers = public(page)
for key in ['Content-Security-Policy', 'X-Robots-Tag', 'Cache-Control', 'Referrer-Policy', 'X-Content-Type-Options']:
    assert old_headers.get(key.lower()) and new_headers.get(key.lower()) == old_headers.get(key.lower()), 'Security header changed: ' + key
private, _ = public('bd/o/izleti/andaluzija-private.8zs.json')
assert hashlib.sha256(private).hexdigest() == '873c812e4182bcc8e2633e805f1e0ae62665965a40b3f16e927542663616afaa'
receipt = {'deploy_id': DEPLOY, 'state': after['state'], 'published_at': after['published_at'],
    'context': after['context'], 'source': scope['source'], 'audit_source': os.environ['GITHUB_SHA'],
    'baseline': BASE, 'changed_public_files': len(checked), 'preserved_functions': 30,
    'verified_file_count': len(canonical), 'all_92_published_overlay_hashes_match': True,
    'function_code_allocation_routes_limits_schedules_unchanged': True,
    'page_security_headers_and_private_cipher_unchanged': True,
    'verification_correction': 'Netlify canonicalized 85 new BD asset paths to lowercase; public content hashes match.',
    'url': 'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027#slike'}
(OUT / 'published-asset-checks.json').write_text(json.dumps(checked, indent=2) + '\n')
(OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
