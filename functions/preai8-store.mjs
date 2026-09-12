import { getStore } from '@netlify/blobs';
import { HISTORY_LIMIT, STORE_NAME } from './preai8-core.mjs';

const CONTROL_KEY = 'control.json';
const LATEST_KEY = 'latest.json';
const HISTORY_KEY = 'history.json';
const RHP_STREAM_KEY = 'rhp-stream.json';
const RHP_STATE_KEY = 'rhp-state.json';
const RHP_LIMIT = 440;

export function store() {
  return getStore(STORE_NAME, { consistency: 'strong' });
}

export async function readState() {
  const s = store();
  const [control, latest, history] = await Promise.all([
    s.get(CONTROL_KEY, { type:'json' }).catch(() => null),
    s.get(LATEST_KEY, { type:'json' }).catch(() => null),
    s.get(HISTORY_KEY, { type:'json' }).catch(() => null)
  ]);
  return {
    control: control || { paused:false, updated_at:null },
    latest: latest || null,
    history: Array.isArray(history) ? history : []
  };
}

export async function readRhp() {
  const s = store();
  const [stream, state] = await Promise.all([
    s.get(RHP_STREAM_KEY, { type:'json' }).catch(() => null),
    s.get(RHP_STATE_KEY, { type:'json' }).catch(() => null)
  ]);
  return {
    stream: Array.isArray(stream) ? stream : [],
    state: state && typeof state === 'object' ? state : {
      phase:'READY', round:0, execution:'NOT_CONNECTED', updated_at:null,
      retained:['RHP-11 roster loaded. Awaiting a verified executor/wake bridge.']
    }
  };
}

export async function appendRhp(entry, nextState = null) {
  const s = store();
  const current = await readRhp();
  const id = String(entry?.id || '');
  if (!id) throw new Error('missing rhp id');
  if (current.stream.some(x => x?.id === id)) return { stored:false, duplicate:true, count:current.stream.length };
  const stream = [...current.stream, entry].slice(-RHP_LIMIT);
  const state = nextState && typeof nextState === 'object' ? nextState : current.state;
  await Promise.all([s.setJSON(RHP_STREAM_KEY, stream), s.setJSON(RHP_STATE_KEY, state)]);
  return { stored:true, duplicate:false, count:stream.length };
}

export async function setPaused(paused, actor='owner') {
  const s = store();
  const value = { paused:Boolean(paused), actor, updated_at:new Date().toISOString() };
  await s.setJSON(CONTROL_KEY, value);
  return value;
}

export async function recordPulse(event) {
  const s = store();
  const state = await readState();
  const previous = state.history[state.history.length - 1] || null;
  const duplicate = Boolean(previous && previous.slot_utc === event.slot_utc && previous.source === event.source);
  if (duplicate) return { stored:false, duplicate:true, latest:previous, history_count:state.history.length };
  const history = [...state.history, event].slice(-HISTORY_LIMIT);
  await Promise.all([s.setJSON(LATEST_KEY, event), s.setJSON(HISTORY_KEY, history)]);
  return { stored:true, duplicate:false, latest:event, history_count:history.length };
}
