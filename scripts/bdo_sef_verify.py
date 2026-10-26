"""Read-only Sef regression: public-byte integrity + isolated synthetic browser session.
No actual user password, master key, decrypted archive, screenshot, or storage dump
is read, sent, logged, or placed in CI artifacts. Synthetic data never leaves the
intercepting test browser. Production HTML/JS and routing remain unmodified.
"""
from __future__ import annotations
import argparse, base64, gzip, hashlib, json, os, re, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from playwright.sync_api import sync_playwright

SITE = 'https://www.mdlxdcc.org'
ROOT = '/BD/O/'
OUT = Path('bdo-sef-verification.json')
REPORT = {'scope': 'read-only; synthetic credentials and content only', 'checks': []}

def record(name, **fields):
    row = {'check': name, **fields}
    REPORT['checks'].append(row)
    print(json.dumps(row, ensure_ascii=False), flush=True)

def h(data):
    return hashlib.sha256(data).hexdigest()

def b64(data):
    return base64.b64encode(data).decode('ascii')

def compact(obj):
    return json.dumps(obj, separators=(',', ':')).encode()

def get(path):
    with urlopen(Request(SITE + path, headers={'Cache-Control': 'no-cache', 'User-Agent': 'BD-O-readonly-regression/1'}), timeout=25) as r:
        return r.read(), r.geturl(), dict(r.headers)

def fixture():
    key, salt = os.urandom(32), os.urandom(16)
    password = 'synthetic-fixture-' + os.urandom(16).hex()
    vault, release = 'synthetic-bdo-browser-regression', 'synthetic-only'
    kek = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000, 32)
    wrap_iv, data_iv, sef_iv = os.urandom(12), os.urandom(12), os.urandom(12)
    portal_html = '<!doctype html><html lang="sl"><head><title>Synthetic portal test</title></head><body><div class="tools"></div><main id="fixturePortal">Synthetic portal</main></body></html>'
    bundle = compact({'format': 'BD-O-PAGES-2', 'fragments': [portal_html], 'pages': {'index.html': [0]}})
    encrypted = AESGCM(key).encrypt(data_iv, gzip.compress(bundle), ('BD/O:v2:data:' + release).encode())
    part = b64(encrypted).encode()
    portal = {'format': 'BD-O-VAULT-2', 'vault': vault, 'release': release,
              'kdf': {'iterations': 600000, 'salt': b64(salt)},
              'wrap': {'iv': b64(wrap_iv), 'cipher': b64(AESGCM(kek).encrypt(wrap_iv, key, ('BD/O:v2:wrap:' + vault).encode()))},
              'data': {'iv': b64(data_iv), 'sha256': h(encrypted), 'parts': [{'path': 'fixture-portal.enc.txt', 'sha256': h(part)}]},
              'pages': ['index.html']}
    html = '<main class="vault-wrap"><h1 id="fixtureSef">Synthetic Sef opened</h1><div class="toolbar2"><input id="vaultSearch"></div><article id="register"><p>alpha fixture</p><code class="secret-value" tabindex="0">NOT-A-REAL-SECRET</code></article><details id="all213"><summary>Fixture</summary><p>beta fixture</p></details></main>'
    plain = compact({'format': 'BD-O-SEF-PAYLOAD-1', 'html': html})
    aad = 'BD/O:sef:v2:' + vault
    sef_part = b64(AESGCM(key).encrypt(sef_iv, gzip.compress(plain), aad.encode())).encode()
    sef = {'format': 'BD-O-SEF-2', 'vault': vault, 'compression': 'gzip', 'plaintext_sha256': h(plain),
           'cipher': {'iv': b64(sef_iv), 'aad': aad},
           'data': {'sha256': h(sef_part), 'parts': [{'path': 'fixture-sef.enc.txt', 'sha256': h(sef_part)}]}}
    # Synthetic encrypted Start.me extension: validates the new extra-data path without real secrets.
    startme_iv = os.urandom(12)
    startme_html = ('<section id="fixtureStartme"><div id="startme-import">'
                    '<details class="sef-import-group" open><summary>Fixture import</summary>'
                    '<table><tbody><tr data-sef-category="exchange"><td>Synthetic provider</td>'
                    '<td><code class="secret-value" tabindex="0">NOT-REAL-SECRET</code></td>'
                    '</tr></tbody></table></details></div></section>')
    startme_plain = compact({'format': 'BD-O-SEF-EXTRA-1', 'html': startme_html})
    startme_aad = 'BD/O:sef:startme:synthetic:' + vault
    startme_part = b64(AESGCM(key).encrypt(startme_iv, gzip.compress(startme_plain), startme_aad.encode())).encode()
    startme = {'format': 'BD-O-SEF-EXTRA-CONFIG-1', 'vault': vault, 'compression': 'gzip',
               'plaintext_sha256': h(startme_plain),
               'cipher': {'iv': b64(startme_iv), 'aad': startme_aad},
               'data': {'path': 'fixture-startme.enc.txt', 'sha256': h(startme_part)}}
    cli_iv = os.urandom(12)
    cli_html = ('<section id="cli-inbox-secrets" data-sef-category="identity">'
                '<h2>8zListener GitHub Inbox fixture</h2><table><tbody><tr>'
                '<td>Synthetic Listener Inbox</td><td><code class="secret-value" '
                'role="button" tabindex="0" aria-label="Skrita vrednost; klikni za prikaz">'
                'NOT-REAL-CLI-SECRET</code></td></tr></tbody></table></section>')
    cli_plain = compact({'format': 'BD-O-SEF-EXTRA-1', 'html': cli_html})
    cli_aad = 'BD/O:sef:cli:synthetic:' + vault
    cli_part = b64(AESGCM(key).encrypt(cli_iv, gzip.compress(cli_plain), cli_aad.encode())).encode()
    cli = {'format': 'BD-O-SEF-EXTRA-CONFIG-1', 'vault': vault, 'compression': 'gzip',
           'plaintext_sha256': h(cli_plain), 'cipher': {'iv': b64(cli_iv), 'aad': cli_aad},
           'data': {'path': 'fixture-cli.enc.txt', 'sha256': h(cli_part)}}
    api_iv = os.urandom(12)
    api_html = ('<section id="api-keys-secrets" data-sef-category="other">'
                '<h2>API keys fixture</h2><table><tbody><tr>'
                '<td>Synthetic Gemini MAL CLI</td><td><code class="secret-value" '
                'role="button" tabindex="0" aria-label="Skrita vrednost; klikni za prikaz">'
                'NOT-REAL-GEMINI-SECRET</code></td></tr></tbody></table></section>')
    api_plain = compact({'format': 'BD-O-SEF-EXTRA-1', 'html': api_html})
    api_aad = 'BD/O:sef:api-keys:synthetic:' + vault
    api_part = b64(AESGCM(key).encrypt(api_iv, gzip.compress(api_plain), api_aad.encode())).encode()
    api_keys = {'format': 'BD-O-SEF-EXTRA-CONFIG-1', 'vault': vault, 'compression': 'gzip',
                'plaintext_sha256': h(api_plain), 'cipher': {'iv': b64(api_iv), 'aad': api_aad},
                'data': {'path': 'fixture-api-keys.enc.txt', 'sha256': h(api_part)}}
    return password, {'vault.json': compact(portal), 'sef-config.json': compact(sef),
                      'sef-api-keys.json': compact(api_keys), 'fixture-api-keys.enc.txt': api_part,
                      'sef-cli-inbox.json': compact(cli), 'fixture-cli.enc.txt': cli_part,
                      'sef-startme.json': compact(startme), 'fixture-startme.enc.txt': startme_part,
                      'fixture-portal.enc.txt': part, 'fixture-sef.enc.txt': sef_part}

def local_dom(browser):
    source = Path('public/BD/O/sef.html').read_text()
    source = re.sub(r'<script[^>]*src="/BD/O/sef.js"[^>]*></script>', '', source)
    for width, height in [(1440, 900), (1920, 1080), (390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.set_content(source)
        page.evaluate("document.getElementById('loading').hidden=true;document.getElementById('content').hidden=false;document.getElementById('content').textContent='Synthetic unlocked content';")
        state = page.evaluate("()=>({display:getComputedStyle(document.getElementById('loading')).display,height:document.getElementById('loading').getBoundingClientRect().height,top:document.getElementById('content').getBoundingClientRect().top})")
        assert state['display'] == 'none' and state['height'] == 0 and state['top'] < height, state
        record('local_hidden_state', viewport=[width, height], passed=True, **state)
        page.close()

def live_integrity():
    source = Path('public/BD/O/sef.html').read_bytes()
    deadline = time.monotonic() + 300
    while True:
        try:
            data, final, headers = get('/bd/o/sef')
            if h(data) == h(source):
                break
        except Exception:
            pass
        if time.monotonic() >= deadline:
            raise AssertionError('Live Sef bytes do not match checked-out repair after bounded deploy wait')
        time.sleep(10)
    record('live_html_exact', passed=True, final_url=final, sha256=h(data))
    for path in ['/BD/O/sef.html', '/bd/o/sef/', '/bd/o/sef.html']:
        data, final, _ = get(path)
        assert h(data) == h(source), 'Sef alias returned different HTML'
        record('live_alias', path=path, final_url=final, passed=True)
    for filename in ['sef.js', 'vault.js', 'vault.json', 'sef-config.json', 'sef-api-keys.json']:
        data, _, _ = get(ROOT + filename)
        expected = Path('public/BD/O', filename).read_bytes()
        assert h(data) == h(expected), filename + ' differs from checkout'
        record('live_asset_exact', file=filename, passed=True, sha256=h(data))
    for filename in ['vault.json', 'sef-config.json', 'sef-api-keys.json']:
        cfg = json.loads(Path('public/BD/O', filename).read_bytes())
        parts = cfg['data'].get('parts') or [cfg['data']]
        for part in parts:
            data, _, _ = get(ROOT + part['path'])
            assert h(data) == part['sha256'], 'Ciphertext part integrity failure'
        record('live_ciphertext_integrity', config=filename, parts=len(parts), passed=True)

def verify_browser(browser, live=False):
    mode = 'live' if live else 'local'
    source_root = Path('public/BD/O').resolve()
    for width, height in [(1440, 900), (390, 844)]:
        password, responses = fixture()
        context = browser.new_context(viewport={'width': width, 'height': height})
        def intercept(route):
            u = urlsplit(route.request.url)
            name = u.path.rsplit('/', 1)[-1]
            if u.hostname == 'www.mdlxdcc.org' and u.path.lower().startswith('/bd/o/') and name in responses:
                route.fulfill(status=200, content_type='application/json' if name.endswith('.json') else 'text/plain', body=responses[name])
            elif u.hostname == 'www.mdlxdcc.org' and u.path.lower().startswith('/bd/o/') and name in ['sef-extra.json', 'sef-kindle.json']:
                route.fulfill(status=404, body='Synthetic optional sidecar absent')
            elif route.request.method != 'GET':
                route.abort()
            elif not live:
                # Real prepared HTML/JS, synthetic origin/session, no external requests.
                relative = u.path[len('/bd/o/'):].strip('/') or 'index.html'
                if '.' not in relative.rsplit('/', 1)[-1]:
                    relative += '.html'
                candidate = (source_root / relative).resolve()
                if (u.hostname == 'www.mdlxdcc.org' and u.path.lower().startswith('/bd/o/')
                        and candidate.is_relative_to(source_root) and candidate.is_file()
                        and candidate.suffix in ['.html', '.js', '.css']):
                    mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'}[candidate.suffix]
                    route.fulfill(status=200, content_type=mime, body=candidate.read_bytes())
                else:
                    route.fulfill(status=404, body='Synthetic local resource absent')
            else:
                route.continue_()
        context.route('**/*', intercept)
        page = context.new_page()
        page.goto(SITE + '/BD/O/', wait_until='domcontentloaded')
        page.locator('#pw').fill(password)
        page.locator('#unlock').click()
        page.wait_for_selector('#fixturePortal', timeout=20000)
        page.locator('#bdoSefLink').click()
        page.wait_for_selector('#fixtureSef', timeout=20000)
        assert page.locator('#fixtureStartme').count() == 1, 'Encrypted Start.me fixture was not rendered'
        assert page.locator('#startme-import tr').count() == 1
        record(mode + '_synthetic_startme_aes_gcm_import', viewport=[width, height], passed=True)
        cli = page.locator('#cli-inbox-secrets')
        assert cli.count() == 1, 'Encrypted CLI Inbox fixture was not rendered'
        assert cli.locator('.secret-value.revealed').count() == 0
        assert cli.locator('.copy-secret').count() == 1
        page.locator('#vaultSearch').fill('Listener Inbox')
        assert cli.locator('tr.search-hidden').count() == 0
        page.locator('#vaultSearch').fill('NOT-REAL-CLI-SECRET')
        assert cli.locator('tr.search-hidden').count() == 1, 'Secret must stay outside the search index'
        page.locator('#vaultSearch').fill('')
        record(mode + '_synthetic_cli_inbox_encrypted_masked_search', viewport=[width, height], passed=True)
        api_keys = page.locator('#api-keys-secrets')
        assert api_keys.count() == 1, 'Encrypted API keys fixture was not rendered'
        assert api_keys.locator('.secret-value.revealed').count() == 0
        assert api_keys.locator('.copy-secret').count() == 1
        page.locator('#vaultSearch').fill('Gemini MAL CLI')
        assert api_keys.locator('tr.search-hidden').count() == 0
        page.locator('#vaultSearch').fill('NOT-REAL-GEMINI-SECRET')
        assert api_keys.locator('tr.search-hidden').count() == 1, 'API key must stay outside the search index'
        page.locator('#vaultSearch').fill('')
        record(mode + '_synthetic_api_keys_encrypted_masked_search', viewport=[width, height], passed=True)
        state = page.evaluate("()=>({display:getComputedStyle(document.getElementById('loading')).display,top:document.getElementById('content').getBoundingClientRect().top,sessionPresent:!!sessionStorage.getItem('bd-o-v2-session')})")
        assert state['display'] == 'none' and state['top'] < height and state['sessionPresent'], state
        record(mode + '_portal_to_sef_synthetic_session', viewport=[width, height], passed=True, **state)
        page.goto(SITE + '/bd/o/sef', wait_until='domcontentloaded')
        page.wait_for_selector('#fixtureSef', timeout=20000)
        assert not page.locator('#loading').is_visible()
        record(mode + '_clean_alias_session_reuse', passed=True, viewport=[width, height])
        page.locator('#fontPlus').click()
        assert page.locator('#fontReset').inner_text() == '110%'
        page.locator('#vaultSearch').fill('no-matching-row-xxxxx')
        assert page.locator('.no-results').is_visible()
        page.locator('#lockAll').click()
        page.wait_for_selector('#pw', timeout=20000)
        assert not page.evaluate("!!sessionStorage.getItem('bd-o-v2-session')")
        record(mode + '_controls_and_lock', passed=True, viewport=[width, height])
        context.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--local-browser', action='store_true')
    args = parser.parse_args()
    REPORT['commit'] = os.environ.get('VERIFIED_SOURCE_SHA') or os.environ.get('GITHUB_SHA')
    REPORT['mode'] = 'live' if args.live else 'local-browser' if args.local_browser else 'local-dom'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            local_dom(browser)
            if args.local_browser:
                verify_browser(browser)
            if args.live:
                live_integrity()
                verify_browser(browser, live=True)
            browser.close()
        REPORT['verdict'] = 'PASS'
    except Exception as exc:
        REPORT['verdict'] = 'FAIL'
        REPORT['error_type'] = type(exc).__name__
        # Do not include page HTML, storage values, or browser state dumps.
        record('verification_failure', error_type=type(exc).__name__)
        raise
    finally:
        OUT.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))

