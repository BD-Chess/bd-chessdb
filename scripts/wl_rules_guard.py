"""WL rules v1: deterministic admission checks, not a semantic-safety oracle.

No networking, no writes and no execution of source/document content.
Caller verifies this helper's release hash BEFORE importing it.
"""
from __future__ import annotations
import base64
import gzip
import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from wl_codec import next_seq, validate_state, RECOVERY_SHA256
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

RULES_ID = 'WL-RULES'
LEGACY_THROUGH_SEQ = 8
LEGACY_DOCUMENT_SHA256 = 'd5d23bc18d0be3f67d6e448b416436ec04700d5bba7e35bc1dff39b5e126129f'
POLICY_SHA256 = '11701861e7fd363d0041ea0ca5047a9eb03584aaaca8f92008533ad8b2a550e8'
VERSION = '1.0.1'
DOCUMENT_SHA256 = 'a3e5709e5326b400b80d14e174e18ba09c4d44be216c9d7ed475e640ff8e7d32'
MANIFEST_SHA256 = 'b8c4c4e7144fd2264fbcaa40b759315ecc8e8d6532d434233b447dcba330c35c'
SCOPE = 'WL_RESEARCH_JOURNAL_ONLY'
RUN = 'WL-RHP11-20260912'
ROSTER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]
RULE_IDS = [f'R{i:02d}' for i in range(1, 17)]
CONTROL_URL = 'https://www.mdlxdcc.org/api/wl/runtime'


def canonical(value: Any) -> bytes:
    def check(x: Any) -> None:
        if isinstance(x, float):
            raise ValueError('use integers or explicitly unit-labelled strings, not floats')
        if isinstance(x, dict):
            require(all(isinstance(k, str) for k in x), 'string JSON keys required')
            for v in x.values():
                check(v)
        elif isinstance(x, list):
            for v in x:
                check(v)
    check(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def utc(value: str) -> datetime:
    require(isinstance(value, str), 'timestamp missing')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None and result.utcoffset().total_seconds() == 0,
            'UTC timestamp required')
    return result


def load_rules(manifest_bytes: bytes, envelope_bytes: bytes, key: bytes) -> dict:
    """Authenticate exact approved bytes. Caller must then READ markdown fully."""
    require(digest(manifest_bytes) == MANIFEST_SHA256, 'unapproved rules manifest')
    m = json.loads(manifest_bytes)
    require(m['schema'] == 'wl.rules.release.v1' and m['rules_id'] == RULES_ID
            and m['version'] == VERSION and m['scope'] == SCOPE, 'rules identity')
    require(digest(envelope_bytes) == m['envelope_sha256'], 'rules envelope changed')
    e = json.loads(envelope_bytes)
    require(e.get('format') == 'WL-ENC-2', 'rules encryption format')
    cipher = base64.b64decode(e['cipher'], validate=True)
    require(digest(cipher) == e['sha256'], 'rules cipher hash')
    plain = AESGCM(key).decrypt(base64.b64decode(e['iv'], validate=True),
                               cipher, m['aad'].encode('utf-8'))
    pack = json.loads(plain)
    require(pack.get('schema') == 'wl.rules.pack.v1' and pack.get('compression') == 'gzip',
            'rules compression format')
    raw = gzip.decompress(base64.b64decode(pack['data'], validate=True))
    require(len(raw) == pack['bytes'] == m['document_bytes'] and len(raw) <= 128000,
            'rules document size')
    doc = json.loads(raw)
    require(digest(canonical(doc)) == DOCUMENT_SHA256 == m['document_sha256'],
            'unapproved rules document')
    require(doc['schema'] == 'wl.rules.v1' and doc['id'] == RULES_ID
            and doc['version'] == VERSION and doc['scope'] == SCOPE,
            'rules content identity')
    require(doc['rule_ids'] == RULE_IDS, 'rules inventory')
    require(digest(doc['markdown'].encode('utf-8')) == m['markdown_sha256'],
            'rules markdown hash')
    return doc


def validate_receipt(event: dict) -> None:
    # Historical receipts retain their original version; new events cannot claim it.
    if type(event.get('seq')) is int and event['seq'] <= 4:
        return
    legacy = type(event.get('seq')) is int and event['seq'] <= LEGACY_THROUGH_SEQ
    version = '1.0.0' if legacy else VERSION
    document_sha = LEGACY_DOCUMENT_SHA256 if legacy else DOCUMENT_SHA256
    r = event.get('rules_receipt', {})
    require(r.get('schema') == 'wl.rules.receipt.v1' and r.get('id') == RULES_ID
            and r.get('version') == version and r.get('sha256') == document_sha
            and r.get('scope') == SCOPE, 'missing or unapproved rules receipt')
    require(r.get('assurance') == 'BYTES_VERIFIED_APPLICATION_ATTESTED',
            'receipt must not claim semantic proof')
    ids = r.get('applied_rule_ids', [])
    require(isinstance(ids, list) and len(ids) == len(set(ids))
            and set(ids) <= set(RULE_IDS), 'invalid applied rules')
    require(bool(set(ids) & set(RULE_IDS[2:9]))
            and bool(set(ids) & set(RULE_IDS[9:14])), 'reasoning and safety application required')
    a = r.get('application', '')
    require(isinstance(a, str) and 20 <= len(a) <= 1200, 'concrete application required')
    age = (utc(event['created_at']) - utc(r['read_at_utc'])).total_seconds()
    require(0 <= age <= 3600, 'rules must be read in this step before writing')


def validate_control(control: dict, now: datetime) -> None:
    require(now.tzinfo is not None, 'aware clock required')
    require(control.get('protocol') == 'WL-RUNTIME-2'
            and type(control.get('paused')) is bool, 'control identity')
    require(not control['paused'], 'paused')
    age = (now - utc(control['server_time'])).total_seconds()
    if control.get('schema') == 'wl.control.witness.v1':
        require(control.get('source') == CONTROL_URL, 'wrong control witness source')
        observed_age = (now - utc(control['observed_at'])).total_seconds()
        require(-180 <= age <= 900 and -180 <= observed_age <= 900, 'stale control witness')
    else:
        require(control.get('ok') is True and abs(age) <= 180, 'stale direct control')


def slot_utc(now: datetime) -> str:
    require(now.tzinfo is not None, 'aware clock required')
    now = now.astimezone(timezone.utc)
    return now.replace(minute=(now.minute // 15) * 15, second=0, microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')


def validate_policy(old: dict, now: datetime) -> dict:
    p = old.get('wake_policy', {})
    require(digest(canonical(p)) == POLICY_SHA256, 'unapproved wake policy')
    require(now < utc(p['expires_at_utc']), 'expired')
    if p.get('recovery_sha256'):
        require(digest(canonical(old.get('recovery'))) == p['recovery_sha256'] == RECOVERY_SHA256, 'recovery state changed')
    require(len(old['entries']) >= p['starts_after_seq'], 'migration frontier')
    require(old['execution'].get('mode') == 'NATIVE_GMAIL_WITH_HOURLY_FALLBACK', 'migration inactive')
    require(old['execution'].get('scheduled_enabled') is True
            and not old.get('control', {}).get('paused')
            and old.get('control', {}).get('status') != 'STOPPED', 'journal stopped')
    seen = old['execution'].get('gmail_seen_ids')
    require(isinstance(seen, list) and len(seen) <= 1024
            and all(isinstance(x, str) and 1 <= len(x) <= 256 for x in seen)
            and len(seen) == len(set(seen)), 'invalid Gmail dedupe ledger')
    return p


def validate_wake_evidence(old: dict, event: dict, evidence: dict, now: datetime) -> list:
    p = validate_policy(old, now)
    require(isinstance(evidence, dict), 'missing actual wake evidence')
    kind = evidence.get('kind')
    require(kind in ('gmail', 'hourly'), 'unknown wake source')
    invocation = evidence.get('invocation_id')
    require(isinstance(invocation, str) and 1 <= len(invocation) <= 256,
            'missing provider invocation identity')
    require(evidence.get('automation_id') == p[kind + '_task_id'], 'wrong task identity')
    origin = {k: evidence[k] for k in ('kind', 'invocation_id', 'automation_id')}
    seen = list(old['execution']['gmail_seen_ids'])
    if kind == 'gmail':
        require(evidence.get('profile_email', '').casefold() == p['account_email'].casefold()
                and evidence.get('sender', '').casefold() == p['account_email'].casefold(),
                'Gmail self identity mismatch')
        require(evidence.get('received') is True and evidence.get('sender_authenticated') is True,
                'Gmail sender or reception unverified')
        require(evidence.get('subject') == p['subject']
                and isinstance(evidence.get('body'), str)
                and evidence['body'].strip() == p['body'], 'Gmail condition mismatch')
        mid = evidence.get('message_id')
        require(isinstance(mid, str) and 1 <= len(mid) <= 256, 'missing webhook message ID')
        require(mid not in seen, 'duplicate Gmail message ID')
        origin['message_id'] = mid
        seen.append(mid)
    require(event.get('wake_origin') == origin, 'event wake provenance mismatch')
    expected_execution = 'event_driven_model_step' if kind == 'gmail' else 'scheduled_model_step'
    require(event.get('execution') == expected_execution, 'wrong execution provenance')
    return seen


def validate_transition(old: dict, event: dict, new: dict, paths: list[str],
                        control: dict, now: datetime, wake_evidence: dict) -> None:
    """Call immediately before atomic publication, after fresh main/control reads."""
    validate_control(control, now)
    seen = validate_wake_evidence(old, event, wake_evidence, now)
    require(old.get('schema') == new.get('schema') == 'wl.state.v2'
            and old.get('run_id') == new.get('run_id') == RUN, 'state identity')
    require(not old.get('control', {}).get('paused')
            and old.get('control', {}).get('status') != 'STOPPED'
            and old['execution'].get('scheduled_enabled') is True, 'journal stopped')
    require(new.get('control') == old.get('control'), 'research cannot alter control')
    require(sorted(m['id'] for m in new['members']) == ROSTER
            and sorted(m['id'] for m in old['members']) == ROSTER, 'roster changed')
    require(new['revision'] == old['revision'] + 1, 'revision must advance once')
    validate_state(old)
    validate_state(new)
    seq = next_seq(old)
    eid = f'e{seq:06d}'
    require(type(event.get('seq')) is int and event['seq'] == seq
            and event.get('event_id') == eid and event.get('schema') == 'wl.event.v2'
            and event.get('run_id') == RUN, 'event identity')
    if seq == 10 and old['entries'][-1]['seq'] == 8:
        require(event.get('recovery_sha256') == RECOVERY_SHA256, 'missing recovery attestation')
    expected_paths = {'public/WL/state.enc.json', f'public/WL/data/entries/{eid}.enc.json'}
    require(len(paths) == 2 and set(paths) == expected_paths, 'write scope exceeded')
    parent = old['entries'][-1]
    require(event.get('parent_event_id') == parent['event_id']
            and event.get('parent_sha256') == parent['plain_sha256'], 'wrong parent')
    require(event.get('author_id') == old['next_author_id'], 'wrong next author')
    require(isinstance(event.get('body'), str) and 1 <= len(event['body']) <= 24000,
            'invalid event body')
    created = utc(event['created_at'])
    require(abs((now-created).total_seconds()) <= 3600, 'invalid event time')
    slot = slot_utc(now)
    require(event.get('slot_utc') == slot and slot_utc(created) == slot
            and utc(slot) > utc(old['execution']['last_slot_utc']),
            'duplicate or wrong execution slot')
    require(created > utc(old['execution']['last_automatic_at']), 'event time must advance')
    require(created < utc(old['wake_policy']['expires_at_utc']), 'expired event')
    validate_receipt(event)
    ref = {'seq':seq, 'event_id':eid, 'path':f'data/entries/{eid}.enc.json',
           'plain_sha256':digest(canonical(event))}
    require(new['entries'] == old['entries'] + [ref], 'history must be append-only')
    ex = new['execution']
    require(set(ex) == set(old['execution']), 'unexpected execution field')
    require(ex['auto_steps'] == old['execution']['auto_steps'] + 1
            and ex['manual_steps'] == old['execution']['manual_steps']
            and ex['last_slot_utc'] == slot and ex['last_automatic_at'] == event['created_at']
            and ex.get('scheduled_enabled') is True
            and type(ex.get('fast_trigger_connected')) is bool
            and ex.get('fast_trigger_connected') == old['execution'].get('fast_trigger_connected')
            and ex.get('gmail_seen_ids') == seen,
            'invalid execution counters')
    require(new.get('next_author_id') in ROSTER, 'next author invalid')
    require(new.get('updated_at') == event['created_at'], 'state timestamp mismatch')
    require(event.get('author_name') == next(m['name'] for m in old['members']
                                            if m['id'] == event['author_id']), 'author name mismatch')
    for member in new['members']:
        original = next(m for m in old['members'] if m['id'] == member['id'])
        allowed = dict(original)
        if member['id'] == event['author_id']:
            allowed['last_event_id'] = eid
        require(member == allowed, 'member contract changed')
    mutable = {'revision','updated_at','phase','next_author_id','next_question',
               'retained','open_alternatives','members','entries','execution'}
    for field in set(old)-mutable:
        require(new.get(field) == old[field], 'immutable state field changed')
    for field in set(old['execution'])-{'auto_steps','last_slot_utc','last_automatic_at','note','gmail_seen_ids'}:
        require(ex.get(field) == old['execution'][field], 'execution authority changed')
    # No hidden minting of authority through new state top-level fields.
    require(set(new) == set(old), 'unexpected state field; needs explicit migration')


if __name__ == '__main__':
    raise SystemExit('Import after verifying release hash. Do not put credentials in argv.')
