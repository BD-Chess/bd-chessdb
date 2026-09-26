#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const timestamp = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const finite = x => typeof x === 'number' && Number.isFinite(x);
const check = (condition, message) => { if (!condition) throw Error(message); };

export function validateAMAIL(data) {
  check(data?.schema === 'amail.observatory.v1', 'Unexpected AMAIL schema');
  check(timestamp(data.generated_at), 'Invalid generated_at');
  check(timestamp(data.sources?.email?.checked_at), 'Missing email observation time');
  check(Date.parse(data.sources.email.checked_at) <= Date.parse(data.generated_at), 'Observation is newer than generation time');
  check(Array.isArray(data.runs) && data.runs.length === 8, 'Expected eight email lines');
  check(new Set(data.runs.map(r => r.id)).size === 8, 'Duplicate email line');
  for (const r of data.runs) {
    check(/^[A-H]$/.test(r.id), 'Unknown email line');
    check(Number.isInteger(r.messages) && r.messages >= 0, `${r.id}: invalid message count`);
    check(Number.isInteger(r.turn) && r.turn >= r.messages, `${r.id}: invalid frontier`);
    check(timestamp(r.first_at) && timestamp(r.last_at) && Date.parse(r.first_at) <= Date.parse(r.last_at), `${r.id}: invalid event times`);
    check(Date.parse(r.last_at) <= Date.parse(data.sources.email.checked_at), `${r.id}: event newer than source observation`);
    check(Array.isArray(r.recent_timestamps) && r.recent_timestamps.every(timestamp), `${r.id}: invalid recent timestamps`);
    check(r.recent_timestamps.every((t, i, a) => i === 0 || Date.parse(t) >= Date.parse(a[i - 1])), `${r.id}: reversed timestamps`);
    if (r.recent_turns) {
      check(r.recent_turns.length === r.recent_timestamps.length, `${r.id}: recent turn/time mismatch`);
      check(r.recent_turns.every((t, i, a) => Number.isInteger(t) && (i === 0 || t === a[i - 1] + 1)), `${r.id}: recent cadence crosses missing turns`);
    }
    if (r.count_kind === 'LOWER_BOUND') {
      check(r.intervals === null && r.mean_interval_seconds === null, `${r.id}: incomplete sequence has invented cadence`);
    } else {
      check(r.intervals === Math.max(0, r.messages - 1), `${r.id}: wrong within-run interval count`);
      const expected = r.intervals ? (Date.parse(r.last_at) - Date.parse(r.first_at)) / 1000 / r.intervals : null;
      check(expected === null ? r.mean_interval_seconds === null : finite(r.mean_interval_seconds) && Math.abs(expected - r.mean_interval_seconds) < 1e-6, `${r.id}: wrong within-run mean`);
    }
    check(r.median_interval_seconds === null || finite(r.median_interval_seconds), `${r.id}: invalid median`);
    check(Array.isArray(r.blockers), `${r.id}: missing blockers`);
  }
  check(data.totals?.messages === data.runs.reduce((n, r) => n + r.messages, 0), 'Wrong total message count');
  if (data.runs.some(r => r.count_kind === 'LOWER_BOUND')) {
    check(data.totals.messages_kind === 'LOWER_BOUND' && data.totals.within_run_intervals === null, 'Incomplete totals must be labelled');
  }
  check(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(JSON.stringify(data)), 'Public aggregate contains an email address');
  return data;
}

export function validatePair(amail, preai) {
  validateAMAIL(amail);
  check(preai?.schema === 'preai8.public-status.v1', 'Unexpected PREAI8 schema');
  for (const id of ['A', 'B']) {
    const r = amail.runs.find(r => r.id === id), p = preai.email_plane?.[id], m = preai.observatory?.email?.runs?.[id];
    check(p?.verified_turn === r.turn && p?.updated_at === r.last_at, `${id}: PREAI8 frontier disagrees`);
    check(m?.messages === r.messages, `${id}: PREAI8 count disagrees`);
    check((m.count_kind === 'LOWER_BOUND') === (r.count_kind === 'LOWER_BOUND'), `${id}: PREAI8 count kind disagrees`);
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const amail = JSON.parse(fs.readFileSync(path.join(root, 'public/data/AMAIL_STATUS.json'), 'utf8'));
  const preai = JSON.parse(fs.readFileSync(path.join(root, 'public/data/PREAI8_STATUS.json'), 'utf8'));
  validatePair(amail, preai);
  console.log(JSON.stringify({ valid: true, source_checked_at: amail.sources.email.checked_at, lines: 8, messages: amail.totals.messages, count_kind: amail.totals.messages_kind || 'EXACT' }));
}
