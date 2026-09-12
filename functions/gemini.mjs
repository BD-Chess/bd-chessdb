// Trip Optimizer's same-origin Gemini endpoint. Provider credentials stay server-side.
function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function failure(code, message, status, extra = {}) {
  return json({ ok: false, error: { code, message }, ...extra }, status);
}

function settings() {
  // Netlify injects both variables when an existing AI Gateway is available.
  // A user-supplied Gemini key overrides that setup; no Maps key is reused.
  const key = Netlify.env.get('GEMINI_API_KEY');
  const base = (Netlify.env.get('GOOGLE_GEMINI_BASE_URL') ||
    'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const model = Netlify.env.get('TRIP_GEMINI_MODEL') || 'gemini-2.5-flash';
  return { key, base, model };
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export default async (req) => {
  const { key, base, model } = settings();
  const transport = base === 'https://generativelanguage.googleapis.com' ? 'google-direct' : 'netlify-ai-gateway';
  if (req.method === 'GET') {
    return json({ ok: true, configured: Boolean(key), model, transport });
  }
  if (req.method !== 'POST') return failure('METHOD_NOT_ALLOWED', 'Use POST to send a message.', 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin &&
      !['https://www.mdlxdcc.org', 'https://mdlxdcc.org'].includes(origin)) {
    return failure('ORIGIN_NOT_ALLOWED', 'Open the chatbot on MDLxDCC.org.', 403);
  }
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return failure('INVALID_JSON', 'Send a JSON message.', 415);
  }
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 65000) return failure('PROMPT_TOO_LONG', 'This conversation is too long. Please start a new one.', 413);
    body = JSON.parse(raw);
  } catch { return failure('INVALID_JSON', 'The message could not be read. Please try again.', 400); }
  if (typeof body?.prompt !== 'string' || !body.prompt.trim()) {
    return failure('EMPTY_PROMPT', 'Enter a message first.', 400);
  }
  if (body.prompt.length > 50000) return failure('PROMPT_TOO_LONG', 'This conversation is too long. Please start a new one.', 413);
  if (!key) return failure('AI_NOT_CONFIGURED', 'The chatbot connection is awaiting server configuration. Please contact the site owner.', 503);
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) {
    return failure('MODEL_NOT_CONFIGURED', 'The chatbot model configuration needs attention from the site owner.', 503);
  }
  let upstream;
  try {
    upstream = new URL(`${base}/v1beta/models/${model}:generateContent`);
    if (upstream.protocol !== 'https:' || upstream.username || upstream.password) throw new Error('Invalid base URL');
  } catch { return failure('AI_NOT_CONFIGURED', 'The chatbot connection needs attention from the site owner.', 503); }

  try {
    const res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
        tools: [{ google_search: {} }]
      }),
      signal: AbortSignal.timeout(50000),
      redirect: 'error'
    });
    // Never pass raw provider errors, headers or URLs back to the browser.
    if (res.status === 429) return failure('RATE_LIMITED', 'Gemini is at its usage limit. Please wait a minute and try again.', 429);
    if (res.status === 401 || res.status === 403) return failure('PROVIDER_AUTH', 'Gemini rejected the server credentials or access permissions. Please contact the site owner.', 503);
    if (res.status === 404) return failure('MODEL_UNAVAILABLE', 'The configured Gemini model is unavailable. The site owner needs to update it.', 503);
    if (!res.ok) return failure('PROVIDER_ERROR', 'Gemini could not complete this request. Please try again shortly.', 502, { upstreamStatus: res.status });
    let data;
    try { data = await res.json(); } catch { return failure('INVALID_RESPONSE', 'Gemini returned an unreadable response. Please try again.', 502); }
    if (data.error) return failure('PROVIDER_ERROR', 'Gemini could not complete this request. Please try again shortly.', 502);
    const candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || (candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason))) {
      return failure('RESPONSE_BLOCKED', 'Gemini could not answer this message. Please rephrase it.', 422);
    }
    if (candidate?.finishReason === 'MAX_TOKENS') return failure('RESPONSE_TRUNCATED', 'The answer was too long to finish. Please ask for a shorter itinerary.', 502);
    const text = candidate?.content?.parts?.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
    if (!text) return failure('EMPTY_RESPONSE', 'Gemini returned no answer. Please try again.', 502);
    const grounding = candidate.groundingMetadata || {};
    const sources = (grounding.groundingChunks || []).flatMap(chunk => {
      const url = safeLink(chunk.web?.uri);
      return url ? [{ title: String(chunk.web.title || 'Source'), url }] : [];
    });
    return json({ ok: true, text, model: data.modelVersion || model, transport, sources,
      searchSuggestionsHtml: typeof grounding.searchEntryPoint?.renderedContent === 'string' ? grounding.searchEntryPoint.renderedContent : '' });
  } catch (error) {
    if (['TimeoutError', 'AbortError'].includes(error?.name)) {
      return failure('PROVIDER_TIMEOUT', 'Gemini took too long to answer. Please try again.', 504);
    }
    return failure('PROVIDER_UNREACHABLE', 'The connection to Gemini failed. Please try again shortly.', 502);
  }
};

export const config = {
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
