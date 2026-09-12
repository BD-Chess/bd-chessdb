import { test } from 'node:test';
import assert from 'node:assert/strict';
import endpoint, { quotaInfo } from '../../../../functions/chess-gemini.mjs';
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const request = body => new Request('https://www.mdlxdcc.org/.netlify/functions/chess-gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('quota metadata distinguishes zero quota, daily exhaustion and temporary limits', () => {
  assert.equal(quotaInfo({ message: 'Quota exceeded, limit: 0' }).kind, 'unavailable');
  assert.equal(quotaInfo({ details: [{ violations: [{ quotaId: 'GenerateRequestsPerDay' }] }] }).kind, 'daily');
  assert.deepEqual(quotaInfo({ details: [{ retryDelay: '23.5s' }] }), { kind: 'temporary', retryAfter: 24 });
});
test('chess endpoint uses only its chess secret, server knowledge and supplied FEN; health never leaks the key', async () => {
  const realFetch = globalThis.fetch, realNetlify = globalThis.Netlify;
  const used = []; globalThis.Netlify = { env: { get: name => { used.push(name); return name === 'GEMINI_API_CHESS' ? 'test-chess-secret' : undefined; } } };
  let sent;
  globalThis.fetch = async (url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Consider e4.' }] } }] }); };
  try {
    const health = await (await endpoint(new Request('https://www.mdlxdcc.org/.netlify/functions/chess-gemini'))).text();
    assert.doesNotMatch(health, /test-chess-secret/);
    const res = await endpoint(request({ message: 'Explain', snapshot: { fen, sideToMove: 'w', capturedAt: 'now' }, history: [] }));
    const data = await res.json(); assert.equal(data.ok, true); assert.equal(data.fen, fen);
    assert.equal(sent.opts.headers['x-goog-api-key'], 'test-chess-secret');
    assert.match(sent.body.systemInstruction.parts[0].text, /Dynamic Complexity Controller/);
    assert.match(sent.body.systemInstruction.parts[0].text, /NOT win probability/);
    assert.match(sent.body.contents[0].parts[0].text, /rnbqkbnr/);
    assert.equal(used.includes('GEMINI_API_KEY'), false);
    const blocked = await endpoint(request({ message: 'help', snapshot: { fen, assistanceLocked: true } })); assert.equal(blocked.status, 403);
  } finally { globalThis.fetch = realFetch; globalThis.Netlify = realNetlify; }
});
test('provider quota failures expose a useful code without returning raw error text or credentials', async () => {
  const realFetch = globalThis.fetch, realNetlify = globalThis.Netlify;
  globalThis.Netlify = { env: { get: () => 'gemini-test' } };
  globalThis.fetch = async () => Response.json({ error: { message: 'secret-detail token=private limit: 0' } }, { status: 429 });
  try {
    const res = await endpoint(request({ message: 'Explain', snapshot: { fen } }));
    const data = await res.json(); assert.equal(res.status, 429); assert.equal(data.error.code, 'QUOTA_EXHAUSTED');
    assert.doesNotMatch(JSON.stringify(data), /secret-detail|token=private/);
  } finally { globalThis.fetch = realFetch; globalThis.Netlify = realNetlify; }
});
