import { error } from './identity.mjs';
export async function* readSSE(body, signal) {
  const reader = body.getReader(), decoder = new TextDecoder(); let buffer = '';
  const cancel = () => { try { reader.cancel().catch(() => {}); } catch {} };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw error('CANCELLED', 499);
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 1_000_000) throw error('PROVIDER_PROTOCOL');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (data && data !== '[DONE]') yield JSON.parse(data);
      }
      if (done) break;
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    // Cleanup must not hold a logical terminal while a transport cancellation is unsettled.
    cancel();
    reader.releaseLock();
  }
}

// One request, no automatic retry or model fallback. No user-controlled endpoint.
export async function callOpenAI({ payload, signal, onText, onIdentity, fetcher = fetch }) {
  const key = globalThis.Netlify?.env?.get('OPENAI_API_KEY') ?? process.env.OPENAI_API_KEY;
  if (!key) throw error('AI_UNAVAILABLE');
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) {
    try { response.body?.cancel().catch(() => {}); } catch {}
    throw error(response.status===429?'RATE_LIMITED':response.status===404?'MODEL_UNAVAILABLE':response.status===400||response.status===422?'MODEL_PROFILE_UNAVAILABLE':'AI_UNAVAILABLE',response.status===429?429:[400,404,422].includes(response.status)?response.status:503);
  }
  let final, observed;
  for await (const event of readSSE(response.body, signal)) {
    if (signal.aborted) throw error('CANCELLED', 499);
    if (event.response?.model) {
      if(typeof event.response.model!=='string'||!(event.response.model===payload.model||event.response.model.startsWith(payload.model+'-')))throw error('MODEL_IDENTITY_MISMATCH');
      if(event.response.reasoning?.effort&&event.response.reasoning.effort!==payload.reasoning?.effort)throw error('MODEL_REASONING_MISMATCH');
      observed = { model: event.response.model, reasoning: event.response.reasoning?.effort || 'UNKNOWN', providerRequestId: response.headers.get('x-request-id') || 'UNKNOWN', responseId: event.response.id || 'UNKNOWN' };
      onIdentity(observed);
    }
    if (event.type === 'response.output_text.delta') onText(event.delta);
    if (['response.completed', 'response.incomplete'].includes(event.type)) {
      const expected = event.type === 'response.completed' ? 'completed' : 'incomplete';
      if (!event.response || event.response.status !== expected) throw error('PROVIDER_PROTOCOL');
      final = event.response;
      break;
    }
    if (['response.failed', 'error'].includes(event.type)) throw error('ANSWER_UNAVAILABLE');
  }
  if (!final || !observed || signal.aborted) throw error(signal.aborted ? 'CANCELLED' : 'PROVIDER_PROTOCOL');
  return { ...observed, usage: final.usage || null, status: final.status === 'completed' ? 'complete' : 'partial', incompleteReason: final.incomplete_details?.reason || null };
}
