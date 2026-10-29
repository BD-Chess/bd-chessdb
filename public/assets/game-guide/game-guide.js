// Game UI: plain text only, no model-generated HTML, URLs or executable code.
export async function mountGameGuide() {
  const match = location.pathname.match(/^\/game\/(dayton1903|faraday1831|_fixture)\/(?:index\.html)?$/);
  if (!match || document.getElementById('game-guide')) return;
  const slug = match[1], page = document.querySelector('[data-game-page]') || document.querySelector('main');
  if (!page) return;
  const english = document.documentElement.lang.toLowerCase().startsWith('en');
  const readText = english ? {
    title: 'Read without an agent', next: 'Next step', all: 'Open all',
    warning: 'Reading without an agent reveals all solutions — the “Invent with AI” game loses its true purpose. Continue?',
    yes: 'Continue', no: 'Cancel', active: 'Reading without an agent · progress stays in this tab. No logging.',
    collapse: 'Minimize panel', expand: 'Expand panel'
  } : {
    title: 'Branje brez agenta', next: 'Naslednji korak', all: 'Odpri vse',
    warning: 'Branje brez agenta razkrije vse rešitve — igra ‘Izumljaj z AI’ s tem izgubi svoj pravi pomen. Nadaljuj?',
    yes: 'Nadaljuj', no: 'Prekliči', active: 'Branje brez agenta · napredek ostane v tem zavihku. Brez beleženja.',
    collapse: 'Zmanjšaj panel', expand: 'Razširi panel'
  };
  const panel = document.createElement('aside'); panel.id = 'game-guide'; panel.setAttribute('aria-label', 'Vodnik igre');
  panel.innerHTML = `<header class="gg-head"><div><small>PRED IZUMOM</small><strong>Vodnik igre</strong></div><div class="gg-providers" aria-label="Ponudnik odgovora"><button type="button" data-provider="claude" aria-pressed="true">Claude</button><button type="button" data-provider="gpt" aria-pressed="false">GPT</button></div></header>
    <button id="gg-collapse" type="button" aria-expanded="true" aria-controls="gg-body">${readText.collapse}</button><div id="gg-body">
    <section id="gg-read" class="gg-read" hidden aria-label="${readText.title}"><strong>${readText.title}</strong><div class="gg-read-buttons"><button id="gg-read-next" type="button" disabled>${readText.next}</button><button id="gg-read-all" type="button" disabled>${readText.all}</button></div><div id="gg-read-confirm" hidden role="group" aria-labelledby="gg-read-warning"><p id="gg-read-warning">${readText.warning}</p><button id="gg-read-yes" type="button">${readText.yes}</button><button id="gg-read-no" type="button">${readText.no}</button></div></section>
    <div class="gg-controls"><label>Način <select id="gg-mode"><option value="ZGODBA">Zgodba</option><option value="IZUMLJAJ">Izumljaj z njim</option></select></label><label id="gg-development-wrap" hidden><input id="gg-development" type="checkbox" checked> Razvoj · brez rezultatov</label></div>
    <div id="gg-dev-tools" hidden><select id="gg-jump" aria-label="Skok na korak"></select><button id="gg-all" type="button">Pokaži vse</button></div>
    <div class="gg-controls gg-log-controls"><label id="gg-consent-wrap" hidden><input id="gg-consent" type="checkbox"> Dovolim zasebno beleženje poteka (privzeto ne).</label><span id="gg-log-info"></span><button id="gg-export" type="button">Izvozi potek (.md)</button><button id="gg-delete" type="button">Izbriši moj zapis</button></div>
    <form id="gg-login" hidden><strong>Prijava lastnika</strong><label>E-pošta<input name="email" type="email" autocomplete="username" required></label><label>Geslo<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>Prijava</button></form>
    <div id="gg-messages" role="log" aria-label="Pogovor z vodnikom"><div class="gg-welcome"><span>✦</span><h2>Stopi v čas <br>pred izumom.</h2><p>Poslušaj zgodbo ali razmišljaj z izumiteljem. Korake odpirava skupaj.</p></div></div>
    <div id="gg-status" role="status">Preverjam dostop …</div>
    <form id="gg-compose"><label class="gg-sr" for="gg-input">Tvoje sporočilo</label><div class="gg-input-wrap"><textarea id="gg-input" rows="2" maxlength="4000" placeholder="Kam greva najprej?" required></textarea><button id="gg-send" aria-label="Pošlji" disabled>↑</button></div><p class="gg-fine">Pošljemo le število in dolžino lepljenj ter čas tipkanja in odsotnosti. Ti signali niso dokaz pomoči.</p></form></div>`;
  document.body.append(panel); page.classList.add('gg-page');
  const $ = id => panel.querySelector('#' + id), input = $('gg-input'), status = $('gg-status');
  let game, owner = false, development = false, mode = 'ZGODBA', provider = 'claude', busy = false, allowed = false, history = [], opened = new Set(), results = {};
  let gameSession = null, logConsent = false, eventQueue = Promise.resolve(), eventPending = 0;
  let agentAvailable = false, readActive = false, readConfirmed = false, pendingRead = null, readOpened = new Set();
  let signals = { paste_events: 0, paste_length: 0, typing_ms: 0, blur_ms: 0 }, lastKey = 0, away = null;
  const key = () => `ai8.game.v1:${slug}:${development ? 'development' : 'play'}`;
  const readKey = `ai8.game.read.v1:${slug}`;
  function updateReadControls() {
    $('gg-read').hidden = !game || (owner && allowed && agentAvailable && !readActive);
    const finished = !game || game.steps.every(s => readOpened.has(s.id));
    for (const id of ['gg-read-next', 'gg-read-all']) $(id).disabled = finished || busy || eventPending > 0;
    panel.dataset.reading = String(readActive);
  }
  function showReading() {
    for (const s of game.steps) {
      const node = document.getElementById(s.id);
      if (node?.matches('section.g-step') && node.dataset.kind === s.kind) node.hidden = !readOpened.has(s.id);
    }
    status.textContent = readText.active;
    updateReadControls();
  }
  function restoreReading() {
    readOpened = new Set([game.steps[0].id]); readActive = false; readConfirmed = false;
    try {
      const data = JSON.parse(sessionStorage.getItem(readKey) || 'null');
      if (data?.confirmed === true) {
        readConfirmed = true; readActive = true;
        for (const id of Array.isArray(data.opened) ? data.opened : []) if (game.steps.some(s => s.id === id)) readOpened.add(id);
      }
    } catch {}
    if (readActive) showReading();
    updateReadControls();
  }
  function readSteps(which) {
    if (!game || busy || eventPending || $('gg-read').hidden) return;
    if (!readConfirmed) { pendingRead = which; $('gg-read-confirm').hidden = false; $('gg-read-yes').focus(); return; }
    if (!readActive) for (const s of game.steps) {
      const node = document.getElementById(s.id);
      if (node?.matches('section.g-step') && node.dataset.kind === s.kind && !node.hidden) readOpened.add(s.id);
    }
    readActive = true;
    const next = game.steps.find(s => !readOpened.has(s.id));
    for (const s of which === 'all' ? game.steps : next ? [next] : []) readOpened.add(s.id);
    try { sessionStorage.setItem(readKey, JSON.stringify({ confirmed: true, opened: [...readOpened] })); } catch {}
    showReading();
    if (next) document.getElementById(next.id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  $('gg-read-next').addEventListener('click', () => readSteps('next'));
  $('gg-read-all').addEventListener('click', () => readSteps('all'));
  $('gg-read-yes').addEventListener('click', () => {
    if (!pendingRead || busy || eventPending) return;
    readConfirmed = true; const which = pendingRead; pendingRead = null; $('gg-read-confirm').hidden = true; readSteps(which);
    $('gg-read-next').focus();
  });
  $('gg-read-no').addEventListener('click', () => { pendingRead = null; $('gg-read-confirm').hidden = true; $('gg-read-next').focus(); });
  $('gg-collapse').addEventListener('click', () => {
    $('gg-body').hidden = !$('gg-body').hidden;
    $('gg-collapse').setAttribute('aria-expanded', String(!$('gg-body').hidden));
    $('gg-collapse').textContent = $('gg-body').hidden ? readText.expand : readText.collapse;
    panel.dataset.collapsed = String($('gg-body').hidden);
  });
  const say = (role, text) => { const item = document.createElement('div'); item.className = 'gg-message'; item.dataset.role = role; item.textContent = text; $('gg-messages').append(item); $('gg-messages').scrollTop = $('gg-messages').scrollHeight; return item; };
  const save = () => { try { sessionStorage.setItem(key(), JSON.stringify({ mode, opened: [...opened], game_session_id: gameSession, ...(!development ? { results } : {}) })); } catch {} };
  function restore() {
    opened = new Set([game.steps[0].id]); results = {}; mode = 'ZGODBA'; gameSession = null;
    try {
      const data = JSON.parse(sessionStorage.getItem(key()) || 'null');
      if (data) {
        if (/^[0-9a-f-]{36}$/i.test(data.game_session_id || '')) gameSession = data.game_session_id;
        if (['ZGODBA', 'IZUMLJAJ'].includes(data.mode)) mode = data.mode;
        for (const id of Array.isArray(data.opened) ? data.opened : []) if (game.steps.some(s => s.id === id)) opened.add(id);
        if (!development && data.results && typeof data.results === 'object') for (const s of game.steps.filter(s => s.kind === 'challenge')) if (['samostojno', 's_pomocjo', 'preskoceno'].includes(data.results[s.id])) results[s.id] = data.results[s.id];
      }
    } catch {}
    for (const s of game.steps) { const node = document.getElementById(s.id); if (node?.matches('section.g-step')) node.hidden = !opened.has(s.id) || (!development && mode === 'ZGODBA' && ['challenge', 'hint'].includes(s.kind)); }
    $('gg-mode').value = mode; save();
  }
  function open(id, scroll = true) {
    const s = game.steps.find(s => s.id === id), node = document.getElementById(id);
    if (!s || !node?.matches('section.g-step') || node.dataset.kind !== s.kind) return false;
    if (!development && mode === 'ZGODBA' && ['challenge', 'hint'].includes(s.kind)) return false;
    node.hidden = false; opened.add(id); save();
    if (scroll) node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    return true;
  }
  function action(a) {
    if (a.name === 'open_step') return open(a.id);
    if (a.name === 'set_mode' && ['ZGODBA', 'IZUMLJAJ'].includes(a.mode)) { mode = a.mode; save(); restore(); return true; }
    if (a.name === 'mark_result' && !development && game.steps.some(s => s.id === a.step && s.kind === 'challenge') && ['samostojno', 's_pomocjo', 'preskoceno'].includes(a.label)) { results[a.step] = a.label; save(); return true; }
    return false;
  }
  function focusChanged() {
    const isAway = document.hidden || !document.hasFocus();
    if (isAway && away === null) away = performance.now();
    if (!isAway && away !== null) { signals.blur_ms += Math.round(performance.now() - away); away = null; }
    lastKey = 0;
  }
  window.addEventListener('blur', focusChanged); window.addEventListener('focus', focusChanged); document.addEventListener('visibilitychange', focusChanged);
  input.addEventListener('paste', event => { signals.paste_events++; signals.paste_length += event.clipboardData?.getData('text/plain').length || 0; });
  input.addEventListener('keydown', () => { const now = performance.now(); if (lastKey) signals.typing_ms += Math.round(Math.min(now - lastKey, 2000)); lastKey = now; });
  const endpoint = '/.netlify/functions/game-guide';
  const logBody = () => ({ slug, provider, mode, development, game_session_id: gameSession, log_consent: logConsent });
  const rememberSession = data => { gameSession = data.game_session_id || null; save(); };
  function logAction(client_action) {
    if (readActive || !allowed || (!owner && !logConsent)) return Promise.resolve();
    eventPending++;
    for (const id of ['gg-mode', 'gg-development', 'gg-consent', 'gg-send']) $(id).disabled = true;
    // Serialize local UI events with the next turn so the first generated ID is reused.
    eventQueue = eventQueue.then(async () => {
      const r = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...logBody(), operation: 'event', message: 'UI event', client_actions: Array.isArray(client_action) ? client_action : [client_action] }), signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw Error('LOG_UNAVAILABLE'); rememberSession(await r.json());
    }).catch(() => { status.textContent = 'Zapisa dejanja ni bilo mogoče potrditi.'; }).finally(() => {
      eventPending--;
      if (!eventPending && !busy) for (const id of ['gg-mode', 'gg-development', 'gg-consent', 'gg-send']) $(id).disabled = false;
      updateReadControls();
    });
    return eventQueue;
  }
  $('gg-consent').addEventListener('change', async () => {
    logConsent = $('gg-consent').checked;
    if (!logConsent && gameSession) await deleteLog();
  });
  async function deleteLog() {
    if (busy || eventPending) return;
    await eventQueue;
    if (!gameSession) { status.textContent = 'V tej seji ni strežniškega zapisa.'; return; }
    const id = gameSession;
    try {
      const r = await fetch(`${endpoint}?log=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw Error(); gameSession = null; save();
      status.textContent = owner ? 'Zapis izbrisan. Naslednja igra dobi nov ID.' : 'Zapis izbrisan.';
    } catch { status.textContent = 'Brisanje ni potrjeno. Poskusi znova.'; }
  }
  $('gg-delete').addEventListener('click', async () => {
    if (busy || eventPending) return;
    if (!owner) { logConsent = false; $('gg-consent').checked = false; }
    await deleteLog();
  });
  $('gg-export').addEventListener('click', async () => {
    if (busy || eventPending) return;
    await eventQueue;
    try {
      let text = `# Potek igre: ${slug}\n\n`;
      if (owner && gameSession) {
        let since = 0;
        for (let page = 0; page < 200; page++) {
          const r = await fetch(`${endpoint}?log=${encodeURIComponent(gameSession)}&since=${since}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
          if (!r.ok) throw Error();
          const rows = (await r.text()).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
          for (const row of rows) text += `## ${row.seq} · ${row.kind}\n\n${row.at}\n\n${JSON.stringify(row.payload, null, 2).replace(/`/g, '\\`')}\n\n`;
          if (rows.length < 20) break;
          const next = rows.at(-1).seq; if (next <= since || page === 199) throw Error(); since = next;
        }
      } else {
        text += 'Lokalni prepis trenutnega panela.\n\n';
        for (const item of panel.querySelectorAll('.gg-message')) text += `## ${item.dataset.role}\n\n${item.textContent}\n\n`;
      }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = `game-${slug}-${gameSession || 'local'}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Potek izvožen.';
    } catch { status.textContent = 'Izvoz ni uspel. Poskusi znova.'; }
  });
  async function probe() {
    const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    allowed = response.ok; $('gg-login').hidden = response.ok;
    if (!response.ok) { owner = false; agentAvailable = false; updateReadControls(); status.textContent = data.error?.code === 'GAME_NOT_OPEN' ? 'Igra je za zdaj odprta samo lastniku (BD).' : 'Za igro je potrebna prijava.'; if (readActive) showReading(); return; }
    owner = data.owner === true; development = owner; $('gg-development').checked = development;
    $('gg-consent-wrap').hidden = owner; $('gg-log-info').textContent = owner ? 'Lastnikov potek se zasebno beleži; učne ocene v razvoju ne.' : 'Brez soglasja se potek ne shranjuje na strežniku.';
    $('gg-development-wrap').hidden = !owner; $('gg-dev-tools').hidden = !development;
    panel.querySelectorAll('[data-provider]').forEach(button => { button.disabled = !data.providers?.[button.dataset.provider]?.available; });
    if (!data.providers?.[provider]?.available && data.providers?.gpt?.available) provider = 'gpt';
    agentAvailable = Boolean(data.providers?.claude?.available || data.providers?.gpt?.available);
    panel.querySelectorAll('[data-provider]').forEach(button => button.setAttribute('aria-pressed', String(provider === button.dataset.provider)));
    restore(); $('gg-send').disabled = !data.providers?.[provider]?.available;
    status.textContent = development ? 'Razvoj lastnika · rezultati se ne beležijo.' : 'Pripravljen. Napredek ostane v tej seji brskalnika.';
    if (readActive) showReading();
    updateReadControls();
  }
  $('gg-login').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
    try {
      const r = await fetch('/.netlify/functions/mdlxdcc-guide-auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', email: form.elements.email.value, password: form.elements.password.value }), signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw Error('Prijava ni uspela.'); await probe();
    } catch { status.textContent = 'Prijava ni uspela ali dostop ni na voljo.'; }
    finally { form.elements.password.value = ''; button.disabled = false; }
  });
  panel.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => {
    if (busy) return; provider = button.dataset.provider; panel.querySelectorAll('[data-provider]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  $('gg-mode').addEventListener('change', () => { if (busy || !game) { $('gg-mode').value = mode; return; } mode = $('gg-mode').value; save(); restore(); logAction({ name: 'set_mode', mode }); });
  $('gg-development').addEventListener('change', () => {
    if (!owner || busy || eventPending || !game) { $('gg-development').checked = development; return; }
    development = $('gg-development').checked; history = []; $('gg-dev-tools').hidden = !development; restore();
    status.textContent = development ? 'Razvoj lastnika · brez rezultatov.' : 'Igralni način · učne oznake samo v tej seji.';
  });
  $('gg-jump').addEventListener('change', () => { if (development && !busy && !eventPending && open($('gg-jump').value)) logAction({ name: 'open_step', id: $('gg-jump').value }); });
  $('gg-all').addEventListener('click', () => { if (development && !busy && !eventPending) { const actions = []; for (const s of game.steps) if (open(s.id, false)) actions.push({ name: 'open_step', id: s.id }); if (actions.length) logAction(actions); } });
  $('gg-compose').addEventListener('submit', async event => {
    event.preventDefault(); const message = input.value.trim(); if (readActive || !message || busy || eventPending || !allowed || !game) return;
    busy = true; $('gg-send').disabled = true; $('gg-mode').disabled = true; $('gg-development').disabled = true; $('gg-consent').disabled = true;
    updateReadControls();
    const now = performance.now(), fair_play = { ...signals, blur_ms: signals.blur_ms + (away === null ? 0 : Math.round(now - away)) };
    signals = { paste_events: 0, paste_length: 0, typing_ms: 0, blur_ms: 0 }; lastKey = 0; if (away !== null) away = now;
    say('user', message); const answer = say('assistant', ''); input.value = ''; status.textContent = `${provider === 'claude' ? 'Claude' : 'GPT'} razmišlja …`;
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 55000); let done = false, reader;
    try {
      await eventQueue;
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ ...logBody(), message, opened: [...opened], history: history.map(m => ({ ...m, content: m.content.slice(0, 3500) })), fair_play }) });
      if (!response.ok) { const d = await response.json(); throw Error(d.error?.code || 'ANSWER_UNAVAILABLE'); }
      if (!response.headers.get('content-type')?.includes('text/event-stream')) throw Error('INVALID_STREAM');
      reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      function consume(frame) {
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (!data) return;
        const item = JSON.parse(data);
        if (item.type === 'session') rememberSession(item);
        if (item.type === 'delta') { answer.textContent += item.text; $('gg-messages').scrollTop = $('gg-messages').scrollHeight; }
        if (item.type === 'action' && !action(item)) throw Error('INVALID_ACTION');
        if (item.type === 'notice') status.textContent = 'Odgovor je dosegel omejitev dolžine.';
        if (item.type === 'error') throw Error(item.code);
        if (item.type === 'done') done = true;
      }
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let index; while ((index = buffer.indexOf('\n\n')) !== -1) { consume(buffer.slice(0, index)); buffer = buffer.slice(index + 2); }
        if (buffer.length > 100000) throw Error('INVALID_STREAM');
      }
      if (!done) throw Error('INCOMPLETE_STREAM');
      agentAvailable = true;
      history.push({ role: 'user', content: message }, { role: 'assistant', content: `[${provider === 'claude' ? 'Claude' : 'GPT'}] ${answer.textContent}` }); history = history.slice(-12);
      status.textContent = development ? 'Razvoj · brez beleženja rezultatov.' : 'Na vrsti si ti.';
    } catch (e) {
      agentAvailable = false;
      abort.abort(); if (reader) try { await reader.cancel(); } catch {}
      const messages = { GAME_NOT_OPEN: 'Igra je odprta samo lastniku.', MONTHLY_LIMIT: 'Mesečni proračun je porabljen.', RATE_LIMITED: 'Omejitev pogostosti. Poskusi pozneje.', TIMEOUT: 'Odgovor je trajal predolgo.', AUTH_REQUIRED: 'Ponovno se prijavi.' };
      status.textContent = messages[e.message] || 'Odgovor ni dokončan. Poskusi znova.'; input.value = message;
    } finally { clearTimeout(timer); busy = false; $('gg-send').disabled = false; $('gg-mode').disabled = false; $('gg-development').disabled = false; $('gg-consent').disabled = false; updateReadControls(); }
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('gg-compose').requestSubmit(); } });
  // Static story metadata is public; agent access must never gate local reading.
  try {
    const r = await fetch(`/game/${slug}/game.json`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!r.ok) throw Error('GAME_UNAVAILABLE'); game = await r.json();
    if (game.schema !== 'ai8.game.v1' || game.slug !== slug || !Array.isArray(game.steps) || !game.steps.length) throw Error('INVALID_GAME');
    $('gg-jump').replaceChildren(...game.steps.map(s => { const option = document.createElement('option'); option.value = s.id; option.textContent = `${s.id} · ${s.title}`; return option; }));
    restore(); restoreReading();
  } catch { game = null; status.textContent = 'Vsebina igre trenutno ni dosegljiva.'; return; }
  try { await probe(); } catch { allowed = false; agentAvailable = false; status.textContent = 'Vodnik trenutno ni dosegljiv.'; $('gg-send').disabled = true; updateReadControls(); if (readActive) showReading(); }
}
if (typeof document !== 'undefined') mountGameGuide();
