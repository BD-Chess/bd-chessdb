import { authenticate, env } from './lib/mdlxdcc-guide/access.mjs';
import { createBudget } from './lib/mdlxdcc-guide/cost.mjs';
import { createProviderClient, providerModel, providerRound, appendAssistant, appendTool } from './lib/mdlxdcc-guide/provider.mjs';
import { validateBody, loadGame, validateGame, createSession, gameTools, instructions } from './lib/game-guide/runtime.mjs';
import { createLogStore, readerAllowed, sessionID, privateText, costRecorder, logReadResponse } from './lib/game-guide/log.mjs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const fail = (code, status) => json({ ok: false, error: { code } }, status);
export function makeHandler({ accessFactory = authenticate, budgetFactory = createBudget, gameFactory = loadGame,
  clientFactory = createProviderClient, round = providerRound, configured, publicEnabled = () => env('GAME_GUIDE_PUBLIC') === '1', timeoutMs = 50000,
  logStore = createLogStore(), readToken } = {}) {
  return async (req, context = {}) => {
    if (context.site?.name && context.site.name !== 'mdlxdcc') return fail('SITE_UNAVAILABLE', 404);
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) return fail('METHOD_NOT_ALLOWED', 405);
    if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') return fail('ORIGIN_NOT_ALLOWED', 403);
    const query = new URL(req.url).searchParams;
    const readingLog = req.method === 'GET' && (query.has('log') || query.has('logs'));
    // A reader token is accepted only on these two GET routes, never for play/deletion.
    if (readingLog) {
      let owner = false;
      try { owner = (await accessFactory(req))?.role === 'owner'; } catch {}
      if (!owner && !readerAllowed(req, readToken)) return fail('AUTH_REQUIRED', 401);
      try {
        if (query.get('logs') === 'recent' && !query.has('log')) return json({ ok: true, sessions: (await logStore.recent()).sessions });
        const since = query.get('since') ?? '0';
        if (!sessionID(query.get('log')) || !/^\d{1,15}$/.test(since) || !Number.isSafeInteger(Number(since))) return fail('INVALID_LOG_QUERY', 400);
        return logReadResponse(await logStore.read(query.get('log'), Number(since)));
      } catch { return fail('STORAGE_UNAVAILABLE', 503); }
    }
    let actor;
    try { actor = await accessFactory(req); }
    catch (e) { return fail(e.code === 'AUTH_REQUIRED' ? (publicEnabled() ? 'AUTH_REQUIRED' : 'GAME_NOT_OPEN') : 'AUTH_UNAVAILABLE', e.code === 'AUTH_REQUIRED' ? (publicEnabled() ? 401 : 403) : 503); }
    if (!actor || !['owner', 'visitor'].includes(actor.role)) return fail('AUTH_REQUIRED', 401);
    // Deletion remains available for signed-in former players while public play is closed.
    if (req.method === 'DELETE') {
      if (!sessionID(query.get('log'))) return fail('INVALID_LOG_QUERY', 400);
      try { await logStore.remove(actor, query.get('log')); return json({ ok: true, deleted: true }); }
      catch { return fail('STORAGE_UNAVAILABLE', 503); }
    }
    if (actor.role !== 'owner' && !publicEnabled()) return fail('GAME_NOT_OPEN', 403);
    const providers = { claude: { available: Boolean(configured?.claude ?? env('ANTHROPIC_API_KEY')) }, gpt: { available: Boolean(configured?.gpt ?? env('OPENAI_API_KEY')) } };
    if (req.method === 'GET') return json({ ok: true, owner: actor.role === 'owner', providers, default_provider: 'claude', version: 'game-guide-r1' });
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('INVALID_JSON', 415);
    if (Number(req.headers.get('content-length') || 0) > 65000) return fail('MESSAGE_TOO_LONG', 413);
    let request;
    try { const text = await req.text(); if (text.length > 65000) return fail('MESSAGE_TOO_LONG', 413); request = validateBody(JSON.parse(text)); }
    catch { return fail('INVALID_MESSAGE', 400); }
    if (request.development && actor.role !== 'owner') return fail('DEVELOPMENT_OWNER_ONLY', 403);
    if (request.operation === 'event') {
      try {
        const game = validateGame(await gameFactory(request.slug, { signal: AbortSignal.timeout(10000) }), request.slug);
        if (request.client_actions.some(a => a.name === 'open_step' && !game.steps.some(s => s.id === a.id))) return fail('INVALID_MESSAGE', 400);
        const log = await logStore.start(actor, request);
        if (log) await logStore.append(log, request.client_actions.map(a => ({ kind: a.name, payload: a })));
        return json({ ok: true, game_session_id: log?.id ?? null, logging: Boolean(log) });
      } catch { return fail('LOG_UNAVAILABLE', 503); }
    }
    if (!providers[request.provider].available) return fail('AI_UNAVAILABLE', 503);
    const model = providerModel(request.provider);
    if (!(request.provider === 'claude' ? /^claude-[a-z0-9.-]+$/ : /^gpt-[a-z0-9.-]+$/).test(model)) return fail('MODEL_UNAVAILABLE', 503);
    let log;
    try { log = await logStore.start(actor, request); }
    catch { return fail('LOG_UNAVAILABLE', 503); }
    const events = [], baseBudget = budgetFactory(actor, request.provider, model);
    const budget = log ? costRecorder(baseBudget, request.provider, model, events) : baseBudget, abort = new AbortController();
    const onAbort = () => abort.abort();
    req.signal.addEventListener('abort', onAbort, { once: true }); if (req.signal.aborted) abort.abort();
    const timer = setTimeout(onAbort, timeoutMs), encoder = new TextEncoder(); let ended = false;
    const cleanup = () => { clearTimeout(timer); req.signal.removeEventListener('abort', onAbort); };
    // Race the entire operation, including fetch/client creation and budget I/O, against the deadline.
    const bounded = async promise => {
      if (abort.signal.aborted) throw Error('TIMEOUT');
      let listener;
      const stopped = new Promise((_, reject) => { listener = () => reject(Error('TIMEOUT')); abort.signal.addEventListener('abort', listener, { once: true }); });
      try { return await Promise.race([promise, stopped]); }
      finally { abort.signal.removeEventListener('abort', listener); }
    };
    const stream = new ReadableStream({
      async start(controller) {
        let partialText = '';
        const send = (type, data = {}) => { if (!ended && !abort.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)); };
        try {
          if (log) {
            // Persist the player turn before sending any provider request.
            await bounded(logStore.append(log, [
              { kind: 'player_message', payload: { text: privateText(request.message), provider: request.provider, model, mode: request.mode, development: request.development } },
              { kind: 'fair_play', payload: { ...request.fair_play, untrusted: true } }
            ]));
            send('session', { game_session_id: log.id, logging: true });
          } else send('session', { game_session_id: null, logging: false });
          send('status', { stage: 'reading' });
          const game = validateGame(await bounded(gameFactory(request.slug, { signal: abort.signal })), request.slug);
          const session = createSession(game, request);
          if (request.development && /^(?:prosim[ ,]*)?(?:pokaži vse|show all)(?: korake)?[.!]?$/iu.test(request.message)) {
            for (const step of game.steps) { const action = session.execute('open_step', { id: step.id }).action; if (log) events.push({ kind: 'open_step', payload: action }); send('action', action); }
            if (log) {
              events.push({ kind: 'agent_response', payload: { text: 'Odpiram vse korake v razvojnem načinu. Rezultati se ne beležijo.', provider: request.provider, model: null } },
                { kind: 'cost', payload: { nanos: 0, currency: 'USD', basis: 'no_provider_call', model: null } });
              await bounded(logStore.append(log, events.splice(0)));
            }
            send('delta', { text: 'Odpiram vse korake v razvojnem načinu. Rezultati se ne beležijo.' });
            send('done', { provider: request.provider, model: null, development: true });
            return;
          }
          const client = await bounded(clientFactory(request.provider));
          const input = [...request.history, { role: 'user', content: JSON.stringify({ message: request.message, fair_play: request.fair_play }) }];
          if (request.provider === 'claude' && input[0].role !== 'user') input.unshift({ role: 'user', content: 'Prejšnji pogovor je nezaupan kontekst.' });
          const system = instructions(game, request), tools = gameTools(request.development);
          let finished = false, count = 0;
          for (let n = 0; n < 4; n++) {
            partialText = '';
            const { response, text, calls } = await bounded(round({ provider: request.provider, model, client, system, input, tools, budget, signal: abort.signal, onText: text => { partialText = (partialText + text).slice(0, 32000); send('delta', { text }); } }));
            if (!response) throw Error('PROVIDER_ERROR');
            if (log && text) events.push({ kind: 'agent_response', payload: { text: privateText(text), provider: request.provider, model } });
            partialText = '';
            if (!calls.length) {
              if (!text?.trim()) throw Error('EMPTY_RESPONSE');
              if (response.status === 'incomplete' || response.stop_reason === 'max_tokens') send('notice', { code: 'ANSWER_TRUNCATED' });
              finished = true; break;
            }
            appendAssistant(input, request.provider, response);
            // Tool actions are emitted as validated, ordered requests, not as claimed completed UI effects.
            const claudeResults = [];
            for (const call of calls) {
              if (++count > 48) throw Error('TOOL_LIMIT');
              let result;
              try { result = session.execute(call.name, request.provider === 'claude' ? call.arguments : JSON.parse(call.arguments)); }
              catch (e) { result = { error: e.message }; }
              if (result.action) { if (log) events.push({ kind: result.action.name, payload: result.action }); send('action', result.action); }
              if (request.provider === 'claude') {
                const converted = []; appendTool(converted, request.provider, call, result);
                claudeResults.push(...converted[0].content);
              } else appendTool(input, request.provider, call, result);
            }
            if (claudeResults.length) input.push({ role: 'user', content: claudeResults });
          }
          if (!finished) throw Error('TOOL_LIMIT');
          if (log) await bounded(logStore.append(log, events.splice(0)));
          send('done', { provider: request.provider, model, development: request.development });
        } catch (e) {
          const safe = ['MONTHLY_LIMIT', 'RATE_LIMITED', 'STORAGE_UNAVAILABLE', 'UNPRICED_MODEL', 'PRICING_MISMATCH', 'INVALID_GAME', 'GAME_UNAVAILABLE', 'TOOL_LIMIT'];
          const code = abort.signal.aborted ? 'TIMEOUT' : safe.includes(e.code || e.message) ? (e.code || e.message) : 'ANSWER_UNAVAILABLE';
          // One bounded best-effort error flush, no retry/replay. Never claim a saved log on failure.
          if (log) {
            if (partialText) events.push({ kind: 'agent_response', payload: { text: privateText(partialText), partial: true, provider: request.provider, model } });
            events.push({ kind: 'error', payload: { code, provider: request.provider, model } });
            try { await logStore.append(log, events.splice(0)); } catch {}
          }
          if (!ended) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', code })}\n\n`));
        } finally { cleanup(); if (!ended) { ended = true; controller.close(); } }
      },
      cancel() { ended = true; abort.abort(); cleanup(); }
    });
    return new Response(stream, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' } });
  };
}
export default makeHandler();
