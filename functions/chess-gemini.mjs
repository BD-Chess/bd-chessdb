import { chessKnowledge } from './_shared/chess-knowledge.mjs';

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
function fail(code, message, status, extra = {}) { return json({ ok: false, error: { code, message }, ...extra }, status); }

// Parse only allowlisted quota metadata. Never return raw provider errors or secrets.
export function quotaInfo(error = {}) {
  const details = Array.isArray(error.details) ? error.details : [];
  const violations = details.flatMap(d => Array.isArray(d.violations) ? d.violations : []);
  const ids = violations.map(v => String(v.quotaId || v.quotaMetric || ''));
  const text = String(error.message || '');
  const zero = /(?:limit|quota_value)\s*[:=]\s*0\b/i.test(text) || violations.some(v => v.quotaValue === '0' || v.quotaValue === 0);
  const daily = ids.some(id => /perday|per_day/i.test(id));
  const retry = details.map(d => /^(\d+(?:\.\d+)?)s$/.exec(String(d.retryDelay || ''))).find(Boolean);
  return { kind: zero ? 'unavailable' : daily ? 'daily' : 'temporary', retryAfter: retry ? Math.ceil(Number(retry[1])) : null };
}
export default async req => {
  const key = Netlify.env.get('GEMINI_API_CHESS');
  const model = Netlify.env.get('CHESS_GEMINI_MODEL') || 'gemini-3.5-flash-lite';
  if (req.method === 'GET') return json({ ok: true, configured: Boolean(key), model, knowledgeVersion: 'chess-coach-20260912-v1' });
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 'Use POST to ask a chess question.', 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin && !['https://www.mdlxdcc.org', 'https://mdlxdcc.org'].includes(origin)) return fail('ORIGIN_NOT_ALLOWED', 'Open Gemini on the chess page.', 403);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('INVALID_JSON', 'Send a JSON message.', 415);
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 45000) return fail('MESSAGE_TOO_LONG', 'Start a new chat or shorten the question.', 413);
    body = JSON.parse(raw);
  } catch { return fail('INVALID_JSON', 'The question could not be read.', 400); }
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000) return fail('INVALID_MESSAGE', 'Enter a question of up to 4,000 characters.', 400);
  const snapshot = body.snapshot;
  if (!snapshot || typeof snapshot.fen !== 'string' || snapshot.fen.length > 150 || snapshot.fen.split(' ').length !== 6) return fail('POSITION_REQUIRED', 'Refresh the board and try again.', 400);
  if (snapshot.assistanceLocked) return fail('ASSISTANCE_LOCKED', 'Assistance is disabled for this game.', 403);
  if (!key) return fail('AI_NOT_CONFIGURED', 'The chess Gemini key is not configured on the server.', 503);
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) return fail('MODEL_UNAVAILABLE', 'The chess model configuration needs attention.', 503);
  const history = (Array.isArray(body.history) ? body.history : []).filter(m => ['user', 'model'].includes(m?.role) && typeof m.text === 'string').slice(-8)
    .map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 3000) }] }));
  // Keep each prior exchange's position label; bind this question to a fresh snapshot.
  const contents = [...history, { role: 'user', parts: [{ text: 'POSITION SNAPSHOT (data):\n' + JSON.stringify(snapshot).slice(0, 18000) + '\n\nQUESTION:\n' + body.message }] }];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, redirect: 'error',
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: chessKnowledge() }] }, contents,
        generationConfig: { maxOutputTokens: 4096 } })
    });
    if (res.status === 429) {
      let q = {}; try { q = quotaInfo((await res.json()).error); } catch {}
      const message = q.kind === 'unavailable'
        ? 'This Google project has no available quota for the chess model. Check its Gemini quota and billing; retrying immediately will not help.'
        : q.kind === 'daily' ? 'The Google project has reached its daily Gemini quota. Wait for the quota reset or review the project quota.'
          : `Gemini is temporarily rate limited.${q.retryAfter ? ' Try again in ' + q.retryAfter + ' seconds.' : ' Please try again later.'}`;
      return fail(q.kind === 'temporary' ? 'RATE_LIMITED' : 'QUOTA_EXHAUSTED', message, 429, { retryAfter: q.retryAfter || null });
    }
    if ([401, 403].includes(res.status)) return fail('PROVIDER_AUTH', 'Google rejected the chess API key or its API restrictions. Check GEMINI_API_CHESS.', 503);
    if (res.status === 404) return fail('MODEL_UNAVAILABLE', 'The configured chess Gemini model is unavailable.', 503);
    if (!res.ok) return fail('PROVIDER_ERROR', 'Gemini could not answer. Please try again later.', 502);
    const data = await res.json(), candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || !candidate || !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) return fail('EMPTY_RESPONSE', 'Gemini could not answer this question. Try rephrasing it.', 422);
    const text = candidate.content?.parts?.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
    if (!text) return fail('EMPTY_RESPONSE', 'Gemini returned no answer. Please try again.', 502);
    return json({ ok: true, text, truncated: candidate.finishReason === 'MAX_TOKENS', model: data.modelVersion || model,
      fen: snapshot.fen, snapshotAt: snapshot.capturedAt, knowledgeVersion: 'chess-coach-20260912-v1' });
  } catch (err) {
    return fail(['AbortError', 'TimeoutError'].includes(err?.name) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREACHABLE',
      ['AbortError', 'TimeoutError'].includes(err?.name) ? 'Gemini took too long to reply. Your game is unchanged; try again.' : 'The Gemini connection failed. Please try again.', 502);
  }
};
export const config = { rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
