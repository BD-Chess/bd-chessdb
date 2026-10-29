// Game UI: plain text only, no model-generated HTML, URLs or executable code.
export async function mountGameGuide() {
  const match = location.pathname.match(/^\/game\/(dayton1903|faraday1831|_fixture)\/(?:index\.html)?$/);
  if (!match || document.getElementById('game-guide')) return;
  const slug = match[1], page = document.querySelector('[data-game-page]') || document.querySelector('main');
  if (!page) return;
  const panel = document.createElement('aside'); panel.id = 'game-guide'; panel.setAttribute('aria-label', 'Vodnik igre');
  panel.innerHTML = `<header class="gg-head"><div><small>PRED IZUMOM</small><strong>Vodnik igre</strong></div><div class="gg-providers" aria-label="Ponudnik odgovora"><button type="button" data-provider="claude" aria-pressed="true">Claude</button><button type="button" data-provider="gpt" aria-pressed="false">GPT</button></div></header>
    <div class="gg-controls"><label>Način <select id="gg-mode"><option value="ZGODBA">Zgodba</option><option value="IZUMLJAJ">Izumljaj z njim</option></select></label><label id="gg-development-wrap" hidden><input id="gg-development" type="checkbox" checked> Razvoj · brez rezultatov</label></div>
    <div id="gg-dev-tools" hidden><select id="gg-jump" aria-label="Skok na korak"></select><button id="gg-all" type="button">Pokaži vse</button></div>
    <form id="gg-login" hidden><strong>Prijava lastnika</strong><label>E-pošta<input name="email" type="email" autocomplete="username" required></label><label>Geslo<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>Prijava</button></form>
    <div id="gg-messages" role="log" aria-label="Pogovor z vodnikom"><div class="gg-welcome"><span>✦</span><h2>Stopi v čas <br>pred izumom.</h2><p>Poslušaj zgodbo ali razmišljaj z izumiteljem. Korake odpirava skupaj.</p></div></div>
    <div id="gg-status" role="status">Preverjam dostop …</div>
    <form id="gg-compose"><label class="gg-sr" for="gg-input">Tvoje sporočilo</label><div class="gg-input-wrap"><textarea id="gg-input" rows="2" maxlength="4000" placeholder="Kam greva najprej?" required></textarea><button id="gg-send" aria-label="Pošlji" disabled>↑</button></div><p class="gg-fine">Pošljemo le število in dolžino lepljenj ter čas tipkanja in odsotnosti. Ti signali niso dokaz pomoči.</p></form>`;
  document.body.append(panel); page.classList.add('gg-page');
  const $ = id => panel.querySelector('#' + id), input = $('gg-input'), status = $('gg-status');
  let game, owner = false, development = false, mode = 'ZGODBA', provider = 'claude', busy = false, allowed = false, history = [], opened = new Set(), results = {};
  let signals = { paste_events: 0, paste_length: 0, typing_ms: 0, blur_ms: 0 }, lastKey = 0, away = null;
  const key = () => `ai8.game.v1:${slug}:${development ? 'development' : 'play'}`;
  const say = (role, text) => { const item = document.createElement('div'); item.className = 'gg-message'; item.dataset.role = role; item.textContent = text; $('gg-messages').append(item); $('gg-messages').scrollTop = $('gg-messages').scrollHeight; return item; };
  const save = () => { try { sessionStorage.setItem(key(), JSON.stringify({ mode, opened: [...opened], ...(!development ? { results } : {}) })); } catch {} };
  function restore() {
    opened = new Set([game.steps[0].id]); results = {}; mode = 'ZGODBA';
    try {
      const data = JSON.parse(sessionStorage.getItem(key()) || 'null');
      if (data) {
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
  async function probe() {
    const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    allowed = response.ok; $('gg-login').hidden = response.ok;
    if (!response.ok) { status.textContent = data.error?.code === 'GAME_NOT_OPEN' ? 'Igra je za zdaj odprta samo lastniku (BD).' : 'Za igro je potrebna prijava.'; return; }
    owner = data.owner === true; development = owner; $('gg-development').checked = development;
    $('gg-development-wrap').hidden = !owner; $('gg-dev-tools').hidden = !development;
    panel.querySelectorAll('[data-provider]').forEach(button => { button.disabled = !data.providers?.[button.dataset.provider]?.available; });
    if (!data.providers?.[provider]?.available && data.providers?.gpt?.available) provider = 'gpt';
    panel.querySelectorAll('[data-provider]').forEach(button => button.setAttribute('aria-pressed', String(provider === button.dataset.provider)));
    const r = await fetch(`/game/${slug}/game.json`, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!r.ok) throw Error('GAME_UNAVAILABLE'); game = await r.json();
    if (game.schema !== 'ai8.game.v1' || game.slug !== slug || !Array.isArray(game.steps)) throw Error('INVALID_GAME');
    $('gg-jump').replaceChildren(...game.steps.map(s => { const option = document.createElement('option'); option.value = s.id; option.textContent = `${s.id} · ${s.title}`; return option; }));
    restore(); $('gg-send').disabled = !data.providers?.[provider]?.available;
    status.textContent = development ? 'Razvoj lastnika · rezultati se ne beležijo.' : 'Pripravljen. Napredek ostane v tej seji brskalnika.';
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
  $('gg-mode').addEventListener('change', () => { if (busy || !game) { $('gg-mode').value = mode; return; } mode = $('gg-mode').value; save(); restore(); });
  $('gg-development').addEventListener('change', () => {
    if (!owner || busy || !game) { $('gg-development').checked = development; return; }
    development = $('gg-development').checked; history = []; $('gg-dev-tools').hidden = !development; restore();
    status.textContent = development ? 'Razvoj lastnika · brez rezultatov.' : 'Igralni način · učne oznake samo v tej seji.';
  });
  $('gg-jump').addEventListener('change', () => { if (development && !busy) open($('gg-jump').value); });
  $('gg-all').addEventListener('click', () => { if (development && !busy) for (const s of game.steps) open(s.id, false); });
  $('gg-compose').addEventListener('submit', async event => {
    event.preventDefault(); const message = input.value.trim(); if (!message || busy || !allowed || !game) return;
    busy = true; $('gg-send').disabled = true; $('gg-mode').disabled = true; $('gg-development').disabled = true;
    const now = performance.now(), fair_play = { ...signals, blur_ms: signals.blur_ms + (away === null ? 0 : Math.round(now - away)) };
    signals = { paste_events: 0, paste_length: 0, typing_ms: 0, blur_ms: 0 }; lastKey = 0; if (away !== null) away = now;
    say('user', message); const answer = say('assistant', ''); input.value = ''; status.textContent = `${provider === 'claude' ? 'Claude' : 'GPT'} razmišlja …`;
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 55000); let done = false, reader;
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ slug, message, provider, mode, development, opened: [...opened], history: history.map(m => ({ ...m, content: m.content.slice(0, 3500) })), fair_play }) });
      if (!response.ok) { const d = await response.json(); throw Error(d.error?.code || 'ANSWER_UNAVAILABLE'); }
      if (!response.headers.get('content-type')?.includes('text/event-stream')) throw Error('INVALID_STREAM');
      reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      function consume(frame) {
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (!data) return;
        const item = JSON.parse(data);
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
      history.push({ role: 'user', content: message }, { role: 'assistant', content: `[${provider === 'claude' ? 'Claude' : 'GPT'}] ${answer.textContent}` }); history = history.slice(-12);
      status.textContent = development ? 'Razvoj · brez beleženja rezultatov.' : 'Na vrsti si ti.';
    } catch (e) {
      abort.abort(); if (reader) try { await reader.cancel(); } catch {}
      const messages = { GAME_NOT_OPEN: 'Igra je odprta samo lastniku.', MONTHLY_LIMIT: 'Mesečni proračun je porabljen.', RATE_LIMITED: 'Omejitev pogostosti. Poskusi pozneje.', TIMEOUT: 'Odgovor je trajal predolgo.', AUTH_REQUIRED: 'Ponovno se prijavi.' };
      status.textContent = messages[e.message] || 'Odgovor ni dokončan. Poskusi znova.'; input.value = message;
    } finally { clearTimeout(timer); busy = false; $('gg-send').disabled = false; $('gg-mode').disabled = false; $('gg-development').disabled = false; }
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('gg-compose').requestSubmit(); } });
  try { await probe(); } catch { status.textContent = 'Vodnik trenutno ni dosegljiv.'; $('gg-send').disabled = true; }
}
if (typeof document !== 'undefined') mountGameGuide();
