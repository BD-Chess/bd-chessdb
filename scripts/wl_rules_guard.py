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
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

RULES_ID = 'WL-RULES'
VERSION = '1.0.0'
DOCUMENT_SHA256 = 'd5d23bc18d0be3f67d6e448b416436ec04700d5bba7e35bc1dff39b5e126129f'
MANIFEST_SHA256 = 'e39662d7d5287a2ae61a6f3de7e5ba3fbed483b0a0a6295f3e67b28e5cdb46a2'
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
    r = event.get('rules_receipt', {})
    require(r.get('schema') == 'wl.rules.receipt.v1' and r.get('id') == RULES_ID
            and r.get('version') == VERSION and r.get('sha256') == DOCUMENT_SHA256
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


def validate_transition(old: dict, event: dict, new: dict, paths: list[str],
                        control: dict, now: datetime) -> None:
    """Call immediately before atomic publication, after fresh main/control reads."""
    validate_control(control, now)
    require(old.get('schema') == new.get('schema') == 'wl.state.v2'
            and old.get('run_id') == new.get('run_id') == RUN, 'state identity')
    require(not old.get('control', {}).get('paused')
            and old.get('control', {}).get('status') != 'STOPPED'
            and old['execution'].get('scheduled_enabled') is True, 'journal stopped')
    require(new.get('control') == old.get('control'), 'research cannot alter control')
    require(sorted(m['id'] for m in new['members']) == ROSTER
            and sorted(m['id'] for m in old['members']) == ROSTER, 'roster changed')
    require(new['revision'] == old['revision'] + 1, 'revision must advance once')
    seq = len(old['entries']) + 1
    eid = f'e{seq:06d}'
    require(type(event.get('seq')) is int and event['seq'] == seq
            and event.get('event_id') == eid and event.get('schema') == 'wl.event.v2'
            and event.get('run_id') == RUN, 'event identity')
    expected_paths = {'public/WL/state.enc.json', f'public/WL/data/entries/{eid}.enc.json'}
    require(len(paths) == 2 and set(paths) == expected_paths, 'write scope exceeded')
    parent = old['entries'][-1]
    require(event.get('parent_event_id') == parent['event_id']
            and event.get('parent_sha256') == parent['plain_sha256'], 'wrong parent')
    require(event.get('author_id') == old['next_author_id'], 'wrong next author')
    require(event.get('execution') == 'scheduled_model_step', 'wrong execution provenance')
    require(isinstance(event.get('body'), str) and 1 <= len(event['body']) <= 24000,
            'invalid event body')
    created = utc(event['created_at'])
    require(abs((now-created).total_seconds()) <= 3600, 'invalid event time')
    slot = now.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:00:00Z')
    require(event.get('slot_utc') == slot and old['execution'].get('last_slot_utc') != slot,
            'duplicate or wrong execution slot')
    validate_receipt(event)
    ref = {'seq':seq, 'event_id':eid, 'path':f'data/entries/{eid}.enc.json',
           'plain_sha256':digest(canonical(event))}
    require(new['entries'] == old['entries'] + [ref], 'history must be append-only')
    ex = new['execution']
    require(set(ex) == set(old['execution']), 'unexpected execution field')
    require(ex['auto_steps'] == old['execution']['auto_steps'] + 1
            and ex['manual_steps'] == old['execution']['manual_steps']
            and ex['last_slot_utc'] == slot and ex['last_automatic_at'] == event['created_at']
            and ex.get('scheduled_enabled') is True and ex.get('fast_trigger_connected') is False,
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
    for field in set(old['execution'])-{'auto_steps','last_slot_utc','last_automatic_at','note'}:
        require(ex.get(field) == old['execution'][field], 'execution authority changed')
    # No hidden minting of authority through new state top-level fields.
    require(set(new) == set(old), 'unexpected state field; needs explicit migration')


if __name__ == '__main__':
    raise SystemExit('Import after verifying release hash. Do not put credentials in argv.')
