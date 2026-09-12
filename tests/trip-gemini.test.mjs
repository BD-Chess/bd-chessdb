import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/gemini.mjs';

globalThis.Netlify = { env: { get() {} } };

function request(body = { prompt: 'Plan a walk in Rome.' }, options = {}) {
  return new Request('https://www.mdlxdcc.org/.netlify/functions/gemini', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.mdlxdcc.org' },
    body: JSON.stringify(body), ...options
  });
}

function setup(t, fetcher, env = { GEMINI_API_KEY: 'test-server-key' }) {
  t.mock.method(Netlify.env, 'get', key => env[key]);
  return t.mock.method(globalThis, 'fetch', fetcher || (() => { throw new Error('Unexpected network request'); }));
}

test('configuration health performs no inference and exposes no credentials', async t => {
  const fetchMock = setup(t);
  const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/gemini'));
  const data = await response.json();
  assert.equal(data.configured, true);
  assert.equal(data.model, 'gemini-3.5-flash-lite');
  assert.equal(fetchMock.mock.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(data), /test-server-key/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('missing credentials fail clearly before contacting the provider', async t => {
  const fetchMock = setup(t, null, {});
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('rejects malformed, empty, excessive and foreign-origin requests without inference', async t => {
  const fetchMock = setup(t);
  const cases = [
    [request({}, { body: '{' }), 400],
    [request({ prompt: '' }), 400],
    [request({ prompt: 42 }), 400],
    [request({ prompt: 'x'.repeat(50001) }), 413],
    [request({}, { headers: { 'content-type': 'text/plain' } }), 415],
    [request({}, { headers: { 'content-type': 'application/json', origin: 'https://unrelated.example' } }), 403],
    [request({}, { method: 'PUT' }), 405]
  ];
  for (const [req, status] of cases) assert.equal((await handler(req)).status, status);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('joins answer parts, excludes thoughts, preserves itinerary and returns safe grounding sources', async t => {
  setup(t, async (url, options) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-server-key');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, 'Plan a walk in Rome.');
    assert.equal(body.tools, undefined);
    assert.match(body.systemInstruction.parts[0].text, /without live web access/);
    assert.match(body.systemInstruction.parts[0].text, /Optimize \(Fast\)/);
    assert.match(body.systemInstruction.parts[0].text, /Never include actions in ordinary help/);
    assert.equal(body.generationConfig.maxOutputTokens, 8192);
    return Response.json({ modelVersion: 'gemini-3.5-flash-lite', candidates: [{ finishReason: 'STOP',
      content: { parts: [{ thought: true, text: 'private thought' }, { text: 'Here is your trip.\n' },
        { text: '{REPLACE:\nRome | 41.9, 12.5 START\nColosseum | 41.89, 12.49\n}' }] },
      groundingMetadata: { groundingChunks: [{ web: { title: 'Rome', uri: 'https://example.org/rome' } },
        { web: { title: 'bad', uri: 'javascript:alert(1)' } }], searchEntryPoint: { renderedContent: '<div>Google Search</div>' } }
    }] });
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.text, /Here is your trip\.\n\{REPLACE:/);
  assert.doesNotMatch(data.text, /private thought/);
  assert.deepEqual(data.sources, [{ title: 'Rome', url: 'https://example.org/rome' }]);
  assert.equal(data.searchSuggestionsHtml, '<div>Google Search</div>');
});

test('uses the configured Gemini gateway and server-selected model', async t => {
  setup(t, async (url, options) => {
    assert.equal(String(url), 'https://gateway.example/google/v1beta/models/gemini-3.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'gateway-key');
    return Response.json({ candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] });
  }, { GEMINI_API_KEY: 'gateway-key', GOOGLE_GEMINI_BASE_URL: 'https://gateway.example/google/', TRIP_GEMINI_MODEL: 'gemini-3.5-flash' });
  const response = await handler(request({ prompt: 'OK', model: 'client-cannot-choose' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'OK');
});

for (const [upstream, status, code] of [[401, 503, 'PROVIDER_AUTH'], [403, 503, 'PROVIDER_AUTH'],
  [404, 503, 'MODEL_UNAVAILABLE'], [429, 429, 'RATE_LIMITED'], [500, 502, 'PROVIDER_ERROR']]) {
  test(`provider HTTP ${upstream} produces a useful sanitized error`, async t => {
    setup(t, async () => Response.json({ error: { message: 'test-server-key and private provider details' } }, { status: upstream }));
    const response = await handler(request());
    assert.equal(response.status, status);
    const data = await response.json();
    assert.equal(data.error.code, code);
    assert.doesNotMatch(JSON.stringify(data), /test-server-key|private provider details/);
  });
}

test('does not treat malformed, empty, blocked or truncated answers as successful trips', async t => {
  const outputs = [
    [() => new Response('<html>upstream error</html>'), 'INVALID_RESPONSE'],
    [() => Response.json({ candidates: [] }), 'EMPTY_RESPONSE'],
    [() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'RESPONSE_BLOCKED'],
    [() => Response.json({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'partial' }] } }] }), 'RESPONSE_BLOCKED'],
    [() => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{REPLACE: incomplete' }] } }] }), 'RESPONSE_TRUNCATED']
  ];
  const fetchMock = setup(t);
  for (const [output, code] of outputs) {
    fetchMock.mock.mockImplementation(async () => output());
    const response = await handler(request());
    const data = await response.json();
    assert.equal(data.ok, false);
    assert.equal(data.error.code, code);
    assert.equal(data.text, undefined);
  }
});

test('timeouts and unreachable providers produce distinct retryable errors', async t => {
  const fetchMock = setup(t);
  for (const [error, code, status] of [
    [new DOMException('Timed out', 'TimeoutError'), 'PROVIDER_TIMEOUT', 504],
    [new TypeError('Network failure with test-server-key'), 'PROVIDER_UNREACHABLE', 502]
  ]) {
    fetchMock.mock.mockImplementation(async () => { throw error; });
    const response = await handler(request());
    assert.equal(response.status, status);
    const data = await response.json();
    assert.equal(data.error.code, code);
    assert.doesNotMatch(JSON.stringify(data), /test-server-key/);
  }
});

 test('search tools require explicit server opt-in', async t => {
  setup(t, async (url, options) => {
    assert.deepEqual(JSON.parse(options.body).tools, [{ google_search: {} }]);
    return Response.json({ candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] });
  }, { GEMINI_API_KEY: 'test-server-key', TRIP_GEMINI_SEARCH: 'true' });
  assert.equal((await handler(request())).status, 200);
});

test('zero, daily and minute quotas give distinct guidance without exposing provider data', async t => {
  const fetchMock = setup(t);
  for (const [quotaId, message, expected] of [
    ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'Quota exceeded, limit: 0, model: hidden', 'QUOTA_UNAVAILABLE'],
    ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'Quota exceeded, limit: 20', 'DAILY_QUOTA_EXCEEDED'],
    ['GenerateRequestsPerMinutePerProjectPerModel-FreeTier', 'Quota exceeded, limit: 10', 'RATE_LIMITED']
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json({ error: {
      message: message + ' test-server-key',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId, subject: 'private-project' }] },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '42.7s' }
      ]
    } }, { status: 429 }));
    const response = await handler(request());
    const data = await response.json();
    assert.equal(response.status, 429);
    assert.equal(data.error.code, expected);
    assert.doesNotMatch(JSON.stringify(data), /test-server-key|private-project|hidden/);
    if (expected === 'RATE_LIMITED') assert.equal(data.retryAfterSeconds, 43);
    else assert.equal(data.retryAfterSeconds, undefined);
  }
});
