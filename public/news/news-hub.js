(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const kinds = {
    'ground-summary': ['Povzetek z Ground News', 'Mnenji bosta temeljili na dodanem povzetku, ne na celotnem članku.'],
    article: ['Besedilo članka', 'Dodaj besedilo članka. Povezava označuje vir; sama po sebi ne potrjuje njegove vsebine.'],
    selection: ['Izbrani odlomek', 'Mnenji bosta obravnavali izbrani odlomek. Preostali članek ni del tega vnosa.'],
    manual: ['Moje besedilo ali vprašanje', 'Dodaj svoje besedilo ali vprašanje. Izvor bo jasno označen kot ročni vnos.']
  };
  const MAX_TEXT = 59999;
  let connected = false;
  let busy = false;
  let activeRequestId = null;
  const plain = (value, max = 20000) => typeof value === 'string' ? value.slice(0, max) : '';
  const kind = value => Object.hasOwn(kinds, value) ? kinds[value] : kinds.manual;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  };
  function setStatus(text, error = false) {
    $('analysis-status').textContent = text;
    $('analysis-status').className = 'analysis-status' + (error ? ' error' : '');
  }
  function buttonState() {
    $('ai8-analyze').disabled = !connected || busy;
    $('ai8-analyze').setAttribute('aria-busy', String(busy));
  }
  function inputScope() {
    $('input-scope').textContent = kind($('ai8-kind').value)[1];
    $('url-hint').textContent = $('ai8-kind').value === 'ground-summary' ? 'Za povzetek z Ground News dodaj povezavo do zgodbe na ground.news/article/…' : 'Dodaj povezavo do vira, na katerega se nanaša besedilo ali vprašanje.';
    $('input-count').textContent = Math.min($('ai8-text').value.length, MAX_TEXT).toLocaleString('sl-SI') + ' / 59.999';
  }
  function validInput() {
    const url = $('ai8-url').value.trim();
    const text = $('ai8-text').value.trim();
    const validUrl = Boolean(safeUrl(url));
    const title = $('ai8-title').value.trim();
    $('ai8-url').setAttribute('aria-invalid', String(!validUrl));
    $('ai8-title').setAttribute('aria-invalid', String(!title));
    $('ai8-text').setAttribute('aria-invalid', String(!text));
    if (!validUrl) { setStatus('Vnesi veljavno povezavo http ali https, brez prijavnih podatkov.', true); return false; }
    if ($('ai8-kind').value === 'ground-summary') {
      const source = new URL(url);
      if (!['ground.news', 'www.ground.news'].includes(source.hostname) || !/^\/article\/.+/.test(source.pathname)) {
        setStatus('Za povzetek Ground News uporabi povezavo do zgodbe na ground.news/article/…', true); return false;
      }
    }
    if (!title) { setStatus('Dodaj naslov zgodbe.', true); return false; }
    if (!text) { setStatus('Najprej dodaj besedilo, ki naj ga GPT in Claude obravnavata.', true); return false; }
    if (!Object.hasOwn(kinds, $('ai8-kind').value)) { setStatus('Izberi vrsto dodanega besedila.', true); return false; }
    if (text.length > MAX_TEXT) { setStatus('Besedilo omeji na 59.999 znakov.', true); return false; }
    return true;
  }
  function addSection(body, title, value, list = false) {
    const values = list ? (Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()).slice(0, 20) : []) : plain(value);
    if (!values.length) return;
    const section = element('section');
    section.append(element('h4', title));
    if (list) {
      const ul = element('ul');
      values.forEach(item => ul.append(element('li', plain(item, 6000))));
      section.append(ul);
    } else section.append(element('p', values));
    body.append(section);
  }
  function renderVoice(id, value) {
    const card = $(id + '-opinion');
    const body = card.querySelector('.voice-body');
    const status = card.querySelector('.voice-status');
    body.replaceChildren();
    const answer = value && typeof value === 'object' ? value : {};
    const analysis = answer.analysis && typeof answer.analysis === 'object' ? answer.analysis : null;
    const labels = {ok: 'Pripravljeno', success: 'Pripravljeno', completed: 'Pripravljeno', done: 'Pripravljeno', running: 'V pripravi', pending: 'Čakam na odgovor', error: 'Ni uspelo', failed: 'Ni uspelo', unavailable: 'Ni na voljo', skipped: 'Ni izvedeno'};
    status.textContent = Object.hasOwn(labels, answer.status) ? labels[answer.status] : analysis ? 'Odgovor prejet' : 'Odgovor ni na voljo';
    if (analysis) {
      addSection(body, 'Povzetek', analysis.summary);
      addSection(body, 'Mnenje', analysis.opinion);
      addSection(body, 'Razlogi', analysis.reasons, true);
      addSection(body, 'Negotovosti', analysis.uncertainties, true);
      addSection(body, 'Vprašanja', analysis.questions, true);
    }
    const error = plain(answer.error, 1500) || (answer.error && typeof answer.error === 'object' ? plain(answer.error.message, 1500) : '');
    if (error) body.append(element('p', error, 'voice-error'));
    if (!body.children.length) body.append(element('p', 'Za ta glas ni uporabnega odgovora. Drugo mnenje je prikazano ločeno.', 'voice-error'));
  }
  function renderResult(payload) {
    const article = payload.article && typeof payload.article === 'object' ? payload.article : {};
    const results = payload.results && typeof payload.results === 'object' ? payload.results : {};
    const url = safeUrl(article.url);
    $('result-title').textContent = plain(article.title, 400) || 'Dodano besedilo';
    $('result-url').hidden = !url;
    $('result-url').removeAttribute('href');
    $('result-url').textContent = url || '';
    if (url) $('result-url').href = url;
    $('result-scope').textContent = 'Vhod: ' + kind(article.inputKind)[0] + '. Analiza obravnava dodano besedilo.';
    const sha = typeof article.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(article.sha256) ? article.sha256 : '';
    $('result-sha').textContent = sha;
    $('result-integrity').hidden = !sha;
    let when = '';
    if (typeof payload.createdAt === 'string') {
      const date = new Date(payload.createdAt);
      if (Number.isFinite(date.getTime())) when = new Intl.DateTimeFormat('sl-SI', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana'}).format(date);
    }
    $('result-time').textContent = [payload.cached === true ? 'Shranjena analiza' : 'Analiza', when].filter(Boolean).join(' · ');
    renderVoice('gpt', results.gpt);
    renderVoice('claude', results.claude);
    $('ai8-results').hidden = false;
  }
  function receive(event) {
    if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== 'ai8-news-extension') return;
    const message = event.data;
    const payload = message.payload && typeof message.payload === 'object' ? message.payload : message;
    if (message.type === 'ready') {
      connected = payload.nativeHostAvailable === true;
      $('connection-dot').className = 'connection-dot' + (connected ? ' ready' : '');
      $('connection-title').textContent = connected ? 'Povezovalnik je pripravljen' : payload.installed === true ? 'Dodatek potrebuje povezovalnik' : 'Poveži svoja agenta';
      $('connection-message').textContent = plain(payload.message, 1500) || (connected ? 'Lokalni povezovalnik je dosegljiv. S klikom pošlješ dodano besedilo svojim prijavljenim agentom.' : 'Dodatek je zaznan, lokalni povezovalnik pa ni dosegljiv. Preveri namestitev po navodilih.');
      if (!busy) setStatus(connected ? 'Pripravljeno. Dodaj besedilo in pridobi oba pogleda.' : 'Lokalni povezovalnik še ni dosegljiv. Poglej navodila za povezavo.');
      buttonState();
      return;
    }
    const requestId = plain(payload.requestId, 160);
    if (!requestId) return;
    if (message.type === 'progress') {
      if (busy && activeRequestId && requestId !== activeRequestId) return;
      activeRequestId = requestId;
      busy = true;
      buttonState();
      setStatus(plain(payload.message, 1500) || 'GPT in Claude pripravljata vsak svoj pogled …');
      return;
    }
    if (!activeRequestId || requestId !== activeRequestId) return;
    if (message.type === 'result') {
      busy = false;
      buttonState();
      renderResult(payload);
      setStatus('Odgovora sta prikazana ločeno spodaj.');
    } else if (message.type === 'error') {
      busy = false;
      buttonState();
      if (payload.results) renderResult(payload);
      const error = typeof payload.error === 'string' ? payload.error : payload.error && typeof payload.error === 'object' ? payload.error.message : '';
      setStatus(plain(payload.message, 1500) || plain(error, 1500) || 'Analize ni bilo mogoče dokončati. Preveri povezovalnik in prijavi agentov.', true);
    }
  }
  async function archiveLink() {
    try {
      const response = await fetch('catalog.json', {cache: 'no-store'});
      if (!response.ok) return;
      const catalog = await response.json();
      if (typeof catalog.latest_published_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.latest_published_date)) return;
      const date = catalog.latest_published_date;
      $('archive-latest').href = 'archive.html?date=' + encodeURIComponent(date);
      $('archive-date').textContent = 'Zadnja lastna izdaja: ' + date.split('-').reverse().join('. ') + '.';
    } catch (_) { /* The archive link remains useful without its optional date. */ }
  }
  if (new URLSearchParams(location.search).has('date')) {
    location.replace(new URL('archive.html' + location.search + location.hash, location.href).href);
    return;
  }
  $('ai8-kind').addEventListener('change', inputScope);
  $('ai8-text').addEventListener('input', inputScope);
  $('ai8-analyze').addEventListener('click', () => {
    if (!connected) { setStatus('Najprej poveži lokalni dodatek AI8 News.', true); return; }
    if (busy || !validInput()) return;
    activeRequestId = null;
    $('ai8-results').hidden = true;
    setStatus('Čakam na lokalni povezovalnik …');
    // Only the extension's trusted click listener may invoke the native helper.
    // This page neither sends a model request nor reads CLI login credentials.
  });
  window.addEventListener('message', receive);
  inputScope();
  buttonState();
  archiveLink();
})();
