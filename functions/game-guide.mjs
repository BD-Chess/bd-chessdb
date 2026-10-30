import { authenticate, env } from './lib/mdlxdcc-guide/access.mjs';
import { createBudget } from './lib/mdlxdcc-guide/cost.mjs';
import { createProviderClient, providerModel, providerRound, appendAssistant, appendTool } from './lib/mdlxdcc-guide/provider.mjs';
import { validateBody, loadGame, validateGame, createSession, gameTools, instructions, unsafeReply, invitation } from './lib/game-guide/runtime.mjs';
import { sealContinuation, openContinuation } from './lib/game-guide/continuation.mjs';
import { createLogStore, readerAllowed, sessionID, privateText, costRecorder, logReadResponse } from './lib/game-guide/log.mjs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const fail = (code, status) => json({ ok: false, error: { code } }, status);
export function makeHandler({ accessFactory = authenticate, budgetFactory = createBudget, gameFactory = loadGame,
  clientFactory = createProviderClient, round = providerRound, configured, publicEnabled = () => env('GAME_GUIDE_PUBLIC') === '1', timeoutMs = 50000,
  logStore = createLogStore(), readToken, continuationSecret = () => env('MDLXDCC_GUIDE_SESSION_SECRET') } = {}) {
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
    if (req.method === 'GET') return json({ ok: true, owner: actor.role === 'owner', providers, default_provider: 'claude', version: 'game-guide-p0-r1' });
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('INVALID_JSON', 415);
    if (Number(req.headers.get('content-length') || 0) > 240000) return fail('MESSAGE_TOO_LONG', 413);
    let request, body, continuation;
    try {
      const text = await req.text(); if (text.length > 240000) return fail('MESSAGE_TOO_LONG', 413);
      body = JSON.parse(text);
      if (body.continuation) {
        continuation = openContinuation(body.continuation, actor, continuationSecret());
        request = validateBody(continuation.request);
        if (!Array.isArray(body.receipts) || body.receipts.length !== continuation.pending.filter(p => p.result.action).length) throw Error('INVALID_RECEIPTS');
      } else request = validateBody(body);
    }
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
    // A stale client cannot acknowledge tools; refuse before provider calls or UI effects.
    if (request.protocol !== 'game-guide-tools-v1') return fail('REFRESH_REQUIRED', 409);
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
    const deadline = continuation?.deadline ?? Date.now() + timeoutMs;
    const timer = setTimeout(onAbort, Math.max(1, deadline - Date.now())), encoder = new TextEncoder(); let ended = false;
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
          if (log && !continuation) {
            // Persist the player turn before sending any provider request.
            await bounded(logStore.append(log, [
              { kind: 'player_message', payload: { text: privateText(request.message), provider: request.provider, model, mode: request.mode, development: request.development } },
              { kind: 'fair_play', payload: { ...request.fair_play, untrusted: true } }
            ]));
            send('session', { game_session_id: log.id, logging: true });
          } else send('session', { game_session_id: log?.id ?? null, logging: Boolean(log) });
          send('status', { stage: 'reading' });
          const game = validateGame(await bounded(gameFactory(request.slug, { signal: abort.signal })), request.slug);
          const session = createSession(game, request);
          if (continuation?.openedThisTurn) session.restoreTurn(continuation.openedThisTurn);
          if (request.development && /^(?:prosim[ ,]*)?(?:pokaži vse|show all)(?: korake)?[.!]?$/iu.test(request.message)) {
            // Explicit owner-only local navigation; never routed through the model.
            for (const step of game.steps) { const action = { name: 'open_step', id: step.id, owner_navigation: true }; if (log) events.push({ kind: 'open_step', payload: action }); send('action', action); }
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
          const input = continuation?.input ?? [...request.history, { role: 'user', content: JSON.stringify({ message: request.message, fair_play: request.fair_play }) }];
          if (request.provider === 'claude' && input[0].role !== 'user') input.unshift({ role: 'user', content: 'Prejšnji pogovor je nezaupan kontekst.' });
          const tools = gameTools(request.development);
          let finished = false, count = continuation?.count ?? 0, noOpOnly = continuation?.noOpOnly ?? false;
          const appendResults = entries => {
            const claudeResults = [];
            for (const { call, result } of entries) {
              if (request.provider === 'claude') {
                const converted = []; appendTool(converted, request.provider, call, result); claudeResults.push(...converted[0].content);
              } else appendTool(input, request.provider, call, result);
            }
            if (claudeResults.length) input.push({ role: 'user', content: claudeResults });
          };
          if (continuation) {
            const receipts = new Map(body.receipts.map(r => [r?.call_id, r]));
            if (receipts.size !== body.receipts.length) throw Error('INVALID_RECEIPTS');
            for (const entry of continuation.pending) {
              if (!entry.result.action) continue;
              const a = entry.result.action, receipt = receipts.get(entry.call.call_id);
              if (!receipt || receipt.name !== a.name || (a.name === 'open_step' && receipt.opened !== a.id)) throw Error('INVALID_RECEIPTS');
              const ok = receipt.ok === true && (a.name !== 'open_step' || receipt.visible === true);
              entry.result = { ok, ...(a.name === 'open_step' ? { opened: a.id, visible: ok, already_open: receipt.already_open === true } : {}), client_reported: true, ...(!ok ? { error: 'DISPLAY_FAILED' } : {}) };
              if (a.name === 'open_step') {
                if (!ok) { session.opened.delete(a.id); session.restoreTurn(null); }
                else session.restoreTurn(receipt.already_open === true ? null : a.id);
              }
              if (log) events.push({ kind: a.name, payload: { ...a, ...entry.result } });
            }
            if (continuation.pending.every(p => p.result.already_open === true)) noOpOnly = true;
            appendResults(continuation.pending);
          }
          for (let n = continuation?.rounds ?? 0; n < 4; n++) {
            partialText = '';
            // Buffer provider prose until its transitions and disclosure are checked.
            const { response, text, calls } = await bounded(round({ provider: request.provider, model, client, system: instructions(game, request, session), input, tools, budget, signal: abort.signal, onText: text => { partialText = (partialText + text).slice(0, 32000); } }));
            if (!response) throw Error('PROVIDER_ERROR');
            partialText = '';
            if (!calls.length) {
              let output = session.openedThisTurn ? invitation(game, session) : session.question || (noOpOnly ? '' : text?.trim());
              const violation = !session.openedThisTurn && !session.question && !noOpOnly && (unsafeReply(output || '', game, session) || (session.needsReveal() || session.needsAdvance() ? 'OPEN_STEP_REQUIRED' : null));
              if (violation) {
                if (log) events.push({ kind: 'error', payload: { code: violation, suppressed: true } });
                // Do not echo rejected prose (which may contain a sealed answer) back into history.
                input.push({ role: 'user', content: `Popravi potezo (${violation}). Za prehod pokliči open_step na dovoljen naslednji korak ali postavi kratko vprašanje brez ključa. Ne opisuj odprtja brez klica. Ne dodajaj tehnike ali id-jev v besedilo igralcu.` });
                continue;
              }
              if (!output && !noOpOnly) throw Error('EMPTY_RESPONSE');
              if (output) { send('delta', { text: output }); if (log) events.push({ kind: 'agent_response', payload: { text: privateText(output), provider: request.provider, model } }); }
              if (response.status === 'incomplete' || response.stop_reason === 'max_tokens') send('notice', { code: 'ANSWER_TRUNCATED' });
              finished = true; break;
            }
            appendAssistant(input, request.provider, response);
            const pending = [];
            for (const call of calls) {
              if (++count > 48) throw Error('TOOL_LIMIT');
              let result;
              try { result = session.execute(call.name, request.provider === 'claude' ? call.arguments : JSON.parse(call.arguments)); }
              catch (e) { result = { error: e.message }; }
              pending.push({ call, result });
            }
            noOpOnly = pending.every(p => p.result.already_open === true);
            if (pending.some(p => p.result.action)) {
              if (n >= 3) throw Error('TOOL_LIMIT');
              const nextRequest = { ...session.snapshot(), game_session_id: log?.id ?? request.game_session_id };
              const token = sealContinuation({ request: nextRequest, input, pending, rounds: n + 1, count, noOpOnly, deadline, openedThisTurn: session.openedThisTurn }, actor, continuationSecret());
              if (log && events.length) await bounded(logStore.append(log, events.splice(0)));
              for (const p of pending) if (p.result.action) send('action', { ...p.result.action, call_id: p.call.call_id });
              send('continue', { token });
              return;
            }
            appendResults(pending);
          }
          if (!finished) throw Error('TOOL_LIMIT');
          if (log) await bounded(logStore.append(log, events.splice(0)));
          send('state', { learning: session.learning });
          send('done', { provider: request.provider, model, development: request.development });
        } catch (e) {
          const safe = ['MONTHLY_LIMIT', 'RATE_LIMITED', 'STORAGE_UNAVAILABLE', 'UNPRICED_MODEL', 'PRICING_MISMATCH', 'INVALID_GAME', 'GAME_UNAVAILABLE', 'TOOL_LIMIT'];
          const code = abort.signal.aborted ? 'TIMEOUT' : safe.includes(e.code || e.message) ? (e.code || e.message) : 'ANSWER_UNAVAILABLE';
          // One bounded best-effort error flush, no retry/replay. Never claim a saved log on failure.
          if (log) {
            // Unvalidated provider prose is neither displayed nor saved as an answer.
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

