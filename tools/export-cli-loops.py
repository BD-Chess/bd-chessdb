"""Read-only listener status export for explicitly approved public debate IDs.

Never imports listener code, reads PRIVATE/turn bodies, or starts processes.
Editorial text lives in the reviewed public feed, never in listener requests.
"""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import tempfile

APPROVED = frozenset({'aa80baa6', 'cb6e872a', '25bf1d08', 'd3f8f22b', '4c3670cb', '37eaccbf'})
# Existing reviewed editorial IDs, bound to one exact historical source.
APPROVED_ALIASES = {'cli-loop-nove-uporabe': '5f7e5552',
                    '8zlistener-021-max-rhp': 'b35f75f3'}
STATES = {
    'VALIDATED': 'queued', 'QUEUED': 'queued',
    'STARTING': 'running', 'RUNNING': 'running', 'READY_NEXT': 'running',
    'PAUSED_QUOTA': 'paused', 'PAUSED_USER': 'paused', 'COMPLETE': 'complete', 'PARTIAL': 'partial',
    'ARCHIVE_PENDING': 'pending', 'UNKNOWN': 'unknown',
    'FAILED': 'blocked', 'BLOCKED': 'blocked', 'CONFLICT': 'blocked',
    'STOPPED': 'partial', 'CANCELLED': 'partial',
}
EFFORTS = {'low', 'medium', 'high', 'xhigh', 'max', 'ultra'}
FIELDS = {'id', 'state', 'mode', 'rhp', 'observed_at', 'turns', 'title',
          'summary', 'outcome', 'events', 'next_step', 'executor_state',
          'active_seconds', 'next_author', 'effort', 'product_status','usage','full_rhp','deep','skeptics','seats','next_seat','stage','role_findings'}


SEATS={'GPT','CLAUDE','SA','SB','CX','CM'}
def public_usage(value):
    if not isinstance(value,dict) or value.get('schema')!='8zlistener.usage.v1':raise ValueError('Invalid typed usage source')
    result={k:value.get(k) for k in ('measured_tokens','attempts','measured_attempts','unknown_attempts','coverage')}
    if result['coverage'] not in ('COMPLETE','PARTIAL','UNKNOWN') or any(type(result[k]) is not int or result[k]<0 or result[k]>10**12 for k in ('measured_tokens','attempts','measured_attempts','unknown_attempts')):raise ValueError('Invalid measured usage')
    for key,allowed in [('by_provider',{'GPT','CLAUDE'}),('by_seat',SEATS),('by_phase',{'debate','build','review','startup'})]:
        result[key]={}
        for label,row in value.get(key,{}).items():
            if label not in allowed:raise ValueError('Unapproved usage group')
            result[key][label]={k:row.get(k) for k in ('input_tokens','output_tokens','cached_input_tokens','cache_write_input_tokens','reasoning_output_tokens','total_tokens')}
            if any(type(v) is not int or v<0 or v>10**12 for v in result[key][label].values()):raise ValueError('Invalid usage counter')
    return result


def safe_text(value):
    if not isinstance(value, str) or len(value) > 3000:
        raise ValueError('Invalid editorial text')
    # Defense in depth: refuse common private identifiers, even in editorial copy.
    if re.search(r'PRIVATE|[a-zA-Z]:[\\/]|\\\\|file:|https?://|www\.|[\w.+-]+@[\w.-]+|drive[_ -]?id|(?:/Users/|/home/)|[A-Za-z0-9_-]{25,}', value, re.I):
        raise ValueError('Public text contains a forbidden identifier')


def validate_public(data):
    if data.get('schema') != 'ai8.cli-loops.public.v1' or not 1 <= len(data['debates']) <= 100:
        raise ValueError('Invalid public feed')
    ids = set()
    for d in data['debates']:
        if set(d) - FIELDS or not re.fullmatch(r'[a-z0-9-]{1,80}', d['id']) or d['id'] in ids:
            raise ValueError('Unexpected public fields or IDs')
        ids.add(d['id'])
        if d['state'] not in set(STATES.values()) or d['mode'] not in {'AUTO', 'MIN', 'MAX'} or type(d['rhp']) is not bool:
            raise ValueError('Invalid public state or mode')
        if type(d['turns']) is not int or not 0 <= d['turns'] <= 100 or not isinstance(d['events'], list) or len(d['events']) > 100:
            raise ValueError('Invalid public turn count')
        if dt.datetime.fromisoformat(d['observed_at']).tzinfo is None:
            raise ValueError('Observation time must include timezone')
        for key in ['title', 'summary', 'outcome', 'next_step']:
            safe_text(d[key])
        if 'usage' in d:public_usage(dict(d['usage'],schema='8zlistener.usage.v1'))
        if 'seats' in d and d['seats'] not in (2,4,6):raise ValueError('Invalid seat count')
        if 'next_seat' in d and d['next_seat'] not in SEATS|{None}:raise ValueError('Invalid next seat')
        if 'stage' in d and d['stage'] not in (None,'map','alternatives','challenge','synthesis'):raise ValueError('Invalid stage')
        for flag in ('deep','full_rhp','skeptics'):
            if flag in d and type(d[flag]) is not bool:raise ValueError('Invalid public flag')
        for finding in d.get('role_findings',[]):safe_text(finding)
        if 'product_status' in d:
            safe_text(d['product_status'])
        for e in d['events']:
            if set(e) != {'author', 'label', 'text'} or e['author'] not in {'BD', 'GPT', 'Claude', '8zListener'}:
                raise ValueError('Invalid editorial event')
            safe_text(e['label'])
            safe_text(e['text'])


def read_statuses(journal, debates, observed_at):
    """One consistent SQL read transaction; only enum/number leaves are copied."""
    db = sqlite3.connect(journal.resolve().as_uri() + '?mode=ro', uri=True, timeout=2)
    try:
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        for d in debates:
            if d['id'] not in APPROVED and d['id'] not in APPROVED_ALIASES:
                continue
            if d['id'] in APPROVED_ALIASES:
                rows = db.execute('SELECT request_id,state,runtime_json FROM jobs WHERE substr(request_id,1,8)=?', (APPROVED_ALIASES[d['id']],)).fetchall()
            else:
                rows = db.execute('SELECT request_id,state,runtime_json FROM jobs WHERE substr(request_id,1,8)=?', (d['id'],)).fetchall()
            if len(rows) != 1:
                raise ValueError('Approved job missing or ambiguous')
            rid, state, raw_runtime = rows[0]
            if state not in STATES:
                raise ValueError('Unrecognized executor state; review required')
            runtime = json.loads(raw_runtime or '{}')
            turns = db.execute('SELECT author FROM turns WHERE request_id=? ORDER BY turn_id', (rid,)).fetchall()
            if len(turns) > 100 or any(t[0] not in SEATS for t in turns):
                raise ValueError('Invalid confirmed turns')
            req=runtime.get('effective_request',{})
            full=req.get('full_rhp') is True;skeptics=req.get('skeptics') is True
            d.update(full_rhp=full,skeptics=skeptics,deep=req.get('deep') is True,seats=6 if full else 4 if skeptics else 2,
                stage=runtime.get('flow_040',{}).get('stage'),next_seat=runtime.get('next_seat'))
            columns={r[1] for r in db.execute('PRAGMA table_info(jobs)')}
            if 'run_path' in columns:
                row=db.execute('SELECT run_path FROM jobs WHERE request_id=?',(rid,)).fetchone()
                # The only extra source is the typed numeric sidecar; never traverse PRIVATE or read turn bodies.
                path=Path(row[0])/'USAGE.json'
                if path.is_file():
                    if path.stat().st_size>65536:raise ValueError('Oversized usage source')
                    d['usage']=public_usage(json.loads(path.read_bytes()))
            tier = runtime.get('tier_state', {})
            mode = tier.get('mode', d['mode'])
            work = runtime.get('work_used_s', 0)
            if mode not in {'AUTO', 'MIN', 'MAX'} or type(work) not in {int, float} or not math.isfinite(work) or not 0 <= work <= 43200:
                raise ValueError('Invalid status value')
            effort = {}
            for author, label in [('GPT', 'GPT'), ('CLAUDE', 'Claude')]:
                applied = tier.get('applied', {}).get(author, {})
                requested, reported = applied.get('effort'), applied.get('client_reported_effort')
                if requested is not None and requested not in EFFORTS:
                    raise ValueError('Unknown requested effort')
                if reported is not None and reported not in EFFORTS:
                    raise ValueError('Unknown reported effort')
                effort[label] = {'requested': requested, 'reported': reported}
            next_author = None
            if STATES[state] in {'queued', 'running', 'paused'}:
                if not full and not skeptics:next_author = 'GPT' if not turns or turns[-1][0] == 'CLAUDE' else 'Claude'
                elif d['next_seat'] in ('GPT','CLAUDE'):next_author='GPT' if d['next_seat']=='GPT' else 'Claude'
            d.update(state=STATES[state], executor_state=state, turns=len(turns),
                     mode=mode, rhp=mode == 'MAX' or d['rhp'],
                     active_seconds=int(work), next_author=next_author,
                     effort=effort, observed_at=observed_at)
    finally:
        db.close()


def comparable(data):
    copy = json.loads(json.dumps(data))
    copy.pop('published_at', None)
    copy.pop('revision', None)
    for d in copy['debates']:
        d.pop('observed_at', None)
    return copy


def export(journal, output, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    original = json.loads(output.read_bytes())
    validate_public(original)
    candidate = json.loads(json.dumps(original))
    read_statuses(journal, candidate['debates'], now.isoformat())
    validate_public(candidate)
    if comparable(candidate) == comparable(original):
        return 'UNCHANGED'
    # No override flag: repeated runs cannot publish faster than 15 minutes.
    published = dt.datetime.fromisoformat(original['published_at'])
    if (now - published).total_seconds() < 900:
        return 'THROTTLED'
    candidate['published_at'] = now.isoformat()
    candidate['revision'] = original.get('revision', 0) + 1
    payload = (json.dumps(candidate, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    fd, temp = tempfile.mkstemp(prefix='.cli-loops-', suffix='.tmp', dir=output.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        # Preserve concurrent editorial work rather than overwriting it.
        if json.loads(output.read_bytes()) != original:
            raise ValueError('Public feed changed during export')
        os.replace(temp, output)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    return 'CHANGED'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--journal', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/AI8/cli-loops-data.json')
    args = parser.parse_args()
    # The output must never point into a listener runtime or run directory.
    if args.output.resolve().parent != Path(__file__).resolve().parents[1] / 'public/AI8':
        parser.error('Output must be the repository public/AI8 feed')
    if args.output.name != 'cli-loops-data.json':
        parser.error('Unexpected output filename')
    try:
        print(export(args.journal, args.output))
    except (ValueError, KeyError, TypeError, OSError, sqlite3.Error):
        parser.exit(1, 'Export refused: invalid/unavailable source or public feed; no source details emitted.\n')


if __name__ == '__main__':
    main()
