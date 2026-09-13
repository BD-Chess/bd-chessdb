"""Owner-only, on-demand WL control witness and encrypted-input transport.
No model, decryption, runtime control mutation or research journal writes.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPRedirectHandler

REPO = 'BD-Chess/bd-chessdb'
OWNER_ID = 208290645
ISSUE = 17
BRANCH = 'ops/wl-runtime-state'
RUNTIME = 'https://www.mdlxdcc.org/api/wl/runtime'
FIXED = ('scripts/wl_codec.py', 'scripts/wl_rules_guard.py', 'public/WL/vault.json',
         'public/WL/rules.manifest.json', 'public/WL/rules/v1.0.0.enc.json',
         'public/WL/state.enc.json')
PINS = {
    'scripts/wl_codec.py': '552d164bc420d42ed1c4bf3694b3973dbe29beefa10cb560e8f927be1668de1e',
    'scripts/wl_rules_guard.py': '1d0f991ddcf3f35d1dc3c8e048b3584b7b3d5f1bc727bfa714eb05db2ad9aaf6',
    'public/WL/rules.manifest.json': 'e39662d7d5287a2ae61a6f3de7e5ba3fbed483b0a0a6295f3e67b28e5cdb46a2',
    'public/WL/rules/v1.0.0.enc.json': '17b857895a2d511260369d062e1f4a9c661671f8f76bdb6cfb3783f281cb81fe',
}

class ProbeError(ValueError):
    pass

def need(ok, code):
    if not ok:
        raise ProbeError(code)

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def parse_request(event):
    need(event.get('repository', {}).get('full_name') == REPO, 'WRONG_REPOSITORY')
    issue, comment = event.get('issue', {}), event.get('comment', {})
    need(event.get('action') == 'created' and issue.get('number') == ISSUE
         and not issue.get('pull_request') and issue.get('state') == 'open', 'WRONG_ISSUE_EVENT')
    need(comment.get('user', {}).get('id') == OWNER_ID
         and event.get('sender', {}).get('id') == OWNER_ID, 'UNTRUSTED_SENDER')
    need(type(comment.get('id')) is int and comment['id'] > 0, 'INVALID_COMMENT_ID')
    body = comment.get('body')
    need(isinstance(body, str), 'INVALID_REQUEST')
    match = re.fullmatch(r'WL_PROBE_V1 ([0-9a-f]{32}) (SNAPSHOT|CONTROL)', body.strip())
    need(match is not None, 'INVALID_REQUEST')
    return match[1], match[2], comment['id']

def validate_control(value, now):
    need(value.get('ok') is True and value.get('protocol') == 'WL-RUNTIME-2'
         and type(value.get('paused')) is bool, 'INVALID_RUNTIME_CONTROL')
    try:
        at = datetime.fromisoformat(value['server_time'].replace('Z', '+00:00'))
        age = (now - at).total_seconds()
    except (KeyError, TypeError, ValueError):
        raise ProbeError('INVALID_RUNTIME_TIMESTAMP') from None
    need(at.tzinfo is not None and at.utcoffset().total_seconds() == 0
         and abs(age) <= 180, 'STALE_RUNTIME_CONTROL')
    return value

def validate_file(path, obj):
    allowed = path in FIXED or re.fullmatch(r'public/WL/data/entries/e[0-9]{6}\.enc\.json', path)
    need(bool(allowed) and obj.get('type') == 'file' and obj.get('path') == path
         and obj.get('encoding') == 'base64', 'INVALID_SNAPSHOT_PATH')
    try:
        raw = base64.b64decode(''.join(obj['content'].split()), validate=True)
    except (KeyError, ValueError):
        raise ProbeError('INVALID_SNAPSHOT_BYTES') from None
    need(len(raw) == obj.get('size') and len(raw) <= 2 * 1024 * 1024, 'INVALID_SNAPSHOT_SIZE')
    sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    need(sha == obj.get('sha'), 'GIT_BLOB_MISMATCH')
    need(path not in PINS or digest(raw) == PINS[path], 'PIN_MISMATCH')
    if path.endswith('.enc.json'):
        box = json.loads(raw)
        need(box.get('format') == 'WL-ENC-2', 'INVALID_ENCRYPTED_INPUT')
        cipher = base64.b64decode(box['cipher'], validate=True)
        need(digest(cipher) == box['sha256'], 'CIPHER_MISMATCH')
    if path.endswith('vault.json'):
        need(json.loads(raw).get('format') == 'WL-VAULT-2', 'INVALID_VAULT')
    return raw

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class Client:
    def __init__(self, token):
        self.token = token
        self.opener = build_opener(NoRedirect())

    def fetch(self, url, method='GET', body=None, github=True, missing=False):
        headers = {'Accept': 'application/vnd.github+json' if github else 'application/json',
                   'User-Agent': 'WL-Legacy-Probe/1', 'Cache-Control': 'no-cache'}
        if github:
            headers['Authorization'] = 'Bearer ' + self.token
        raw = None if body is None else json.dumps(body, separators=(',', ':')).encode()
        if raw is not None:
            headers['Content-Type'] = 'application/json'
        req = Request(url, data=raw, headers=headers, method=method)
        try:
            with self.opener.open(req, timeout=20) as response:
                need(response.status == 200 or response.status == 201, 'HTTP_STATUS')
                data = response.read(4 * 1024 * 1024 + 1)
        except HTTPError as error:
            if missing and error.code == 404:
                return None
            raise ProbeError('HTTP_' + str(error.code)) from None
        need(len(data) <= 4 * 1024 * 1024, 'RESPONSE_TOO_LARGE')
        return json.loads(data)

    def api(self, path, **kwargs):
        return self.fetch('https://api.github.com/repos/' + REPO + path, **kwargs)

    def control(self):
        last = None
        for attempt in range(2):
            try:
                value = self.fetch(RUNTIME + '?probe=' + str(time.time_ns()), github=False)
                return validate_control(value, datetime.now(timezone.utc))
            except Exception as error:
                last = error
                if attempt == 0:
                    time.sleep(2)
        raise ProbeError('RUNTIME_UNREACHABLE_OR_INVALID') from last


def main():
    need(os.environ.get('GITHUB_REPOSITORY') == REPO, 'WRONG_RUNNER')
    need(os.environ.get('GITHUB_EVENT_NAME') == 'issue_comment', 'WRONG_TRIGGER')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    nonce, mode, comment_id = parse_request(event)
    token = os.environ.get('GITHUB_TOKEN')
    need(bool(token), 'MISSING_RUNNER_TOKEN')
    client = Client(token)
    receipt_path = 'probes/' + nonce + '.json'
    existing = client.api('/contents/' + receipt_path + '?ref=' + BRANCH, missing=True)
    need(existing is None, 'PROBE_ALREADY_EXISTS_USE_NEW_NONCE')
    # This confirms the branch exists; the probe is not authorized to create it.
    client.api('/branches/' + BRANCH)
    head = client.api('/git/ref/heads/main')['object']['sha']
    need(re.fullmatch(r'[0-9a-f]{40}', head) is not None, 'INVALID_MAIN_SHA')
    records = []
    root = Path(os.environ['RUNNER_TEMP']) / 'wl-legacy-probe' / nonce
    root.mkdir(parents=True, exist_ok=False)
    if mode == 'SNAPSHOT':
        listing = client.api('/contents/public/WL/data/entries?ref=' + head)
        need(isinstance(listing, list) and 1 <= len(listing) <= 1000, 'INVALID_HISTORY_LIST')
        names = sorted(item['name'] for item in listing)
        need(names == [f'e{i:06d}.enc.json' for i in range(1, len(names) + 1)], 'HISTORY_GAP')
        # Nine records give the last eight events plus their predecessor.
        paths = list(FIXED) + ['public/WL/data/entries/' + n for n in names[-9:]]
        for path in paths:
            obj = client.api('/contents/' + path + '?ref=' + head)
            raw = validate_file(path, obj)
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            records.append({'path': path, 'bytes': len(raw), 'sha256': digest(raw), 'git_blob_sha': obj['sha']})
        manifest = {'schema': 'wl.legacy.input-snapshot.v1', 'source_sha': head,
                    'workflow_run': os.environ['GITHUB_RUN_ID'], 'probe_nonce': nonce,
                    'request_comment_id': comment_id, 'generated_at': stamp(),
                    'total_events': len(names), 'history_coverage': 'LATEST_NINE_AT_SNAPSHOT',
                    'files': records, 'contains_plaintext_research': False}
        (root / 'INPUT_MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    # Measure last, not before a potentially slow snapshot transfer.
    control = client.control()
    witness = {'schema': 'wl.control.witness.v1', 'observed_at': stamp(), 'source': RUNTIME,
               'protocol': control['protocol'], 'server_time': control['server_time'],
               'paused': control['paused'], 'control_updated_at': control.get('control_updated_at'),
               'last_pulse_at': control.get('last_pulse_at'), 'workflow_run': os.environ['GITHUB_RUN_ID'],
               'workflow_source_sha': os.environ['GITHUB_SHA'], 'source_sha': head,
               'request_comment_id': comment_id, 'probe_nonce': nonce, 'mode': mode,
               'artifact_name': 'wl-inputs-' + nonce if mode == 'SNAPSHOT' else None}
    (root / 'CONTROL_WITNESS.json').write_text(json.dumps(witness, indent=2) + '\n')
    # Immutable nonce path: an old measurement cannot be relabelled as fresh.
    client.api('/contents/' + receipt_path, method='PUT', body={
        'message': 'WL: on-demand control observation', 'branch': BRANCH,
        'content': base64.b64encode(json.dumps(witness, separators=(',', ':')).encode()).decode()})
    with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
        out.write('snapshot=' + str(mode == 'SNAPSHOT').lower() + '\n')
        out.write('snapshot_path=' + str(root) + '\n')
        out.write('artifact_name=wl-inputs-' + nonce + '\n')
    print(json.dumps({'status': 'PROBE_RECORDED', 'mode': mode, 'probe_nonce': nonce,
                      'workflow_run': os.environ['GITHUB_RUN_ID'], 'source_sha': head,
                      'paused': control['paused'], 'files': len(records)}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never print provider response bodies, requests, headers, tokens or input data.
        print(json.dumps({'status': 'PROBE_FAILED', 'reason': str(error) if isinstance(error, ProbeError)
                          else type(error).__name__}))
        raise SystemExit(1)
