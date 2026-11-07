(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const kinds = {
    'ground-summary': ['Povzetek z Ground News', 'Analiza obravnava povzetek Ground News, ne celotnega članka.'],
    article: ['Besedilo članka', 'Analiza obravnava pridobljeno ali dodano besedilo članka.'],
    selection: ['Izbrani odlomek', 'Analiza obravnava samo izbrani odlomek, ne preostalega članka.'],
    manual: ['Moje besedilo ali vprašanje', 'Besedilo je označeno kot ročni vnos.']
  };
  const MAX_TEXT = 59999;
  const analysisButtons = ['ai8-gpt', 'ai8-claude', 'ai8-analyze'];
  let connected = false, addonAvailable = false, busy = false, importing = false, activeRequestId = null;
  let requestedModels = ['gpt', 'claude'];
  let importSequence = 0, importController = null, pasteTimer = null, importingUrl = null, loadedUrl = null;
  let readerVisible = false;
  let pendingFrameSource = null;
  const plain = (value, max = 20000) => {
    if (typeof value !== 'string') return '';
    const text = value.slice(0, max);
    return /[\ud800-\udbff]$/.test(text) ? text.slice(0, -1) : text;
  };
  const kind = value => Object.hasOwn(kinds, value) ? kinds[value] : kinds.manual;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch (_) { return null; }
  }
  function isGround(url) {
    return url.protocol === 'https:' && ['ground.news', 'www.ground.news'].includes(url.hostname) && (!url.port || url.port === '443');
  }
  function setStatus(text, error = false) {
    $('analysis-status').textContent = text;
    $('analysis-status').title = text;
    $('analysis-status').className = 'analysis-status' + (error ? ' error' : '');
    $('drawer-status').textContent = error ? text : '';
    $('drawer-status').hidden = !error;
  }
  function buttonState() {
    analysisButtons.forEach(id => { $(id).disabled = !connected || busy || importing; $(id).setAttribute('aria-busy', String(busy)); });
    $('ai8-current').disabled = !addonAvailable || busy;
    $('ai8-load').setAttribute('aria-busy', String(importing));
  }
  function drawer(open) {
    $('analysis-drawer').hidden = !open;
    $('ai8-panel').setAttribute('aria-expanded', String(open));
  }
  function setMode(mode) {
    $('ai8-source-mode').value = mode;
    if (mode !== 'frame') pendingFrameSource = null;
    $('source-mode-label').textContent = mode === 'frame' ? 'Trenutna novica v Ground News' : 'Pridobljeno ali dodano besedilo';
  }
  function viewReader(open) {
    readerVisible = open;
    $('reader-view').hidden = !open;
    $('ground-frame').hidden = open;
    $('ai8-reader').setAttribute('aria-pressed', String(open));
    $('ai8-reader').textContent = open ? 'Ground News' : 'Branje';
  }
  function inputScope() {
    $('input-scope').textContent = kind($('ai8-kind').value)[1];
    $('url-hint').textContent = $('ai8-kind').value === 'ground-summary' ? 'Za povzetek Ground News uporabi povezavo ground.news/article/…' : 'Povezava označuje izvor dodanega besedila.';
    $('input-count').textContent = Math.min($('ai8-text').value.length, MAX_TEXT).toLocaleString('sl-SI') + ' / 59.999';
  }
  function readerContent() {
    const url = safeUrl($('ai8-url').value.trim());
    const text = $('ai8-text').value.trim();
    $('reader-title').textContent = $('ai8-title').value.trim() || 'Izberi novico';
    $('reader-url').hidden = !url || !text;
    $('reader-url').removeAttribute('href');
    $('reader-url').textContent = text && url ? url : '';
    if (url && text) $('reader-url').href = url;
    $('reader-text').textContent = text;
    $('reader-empty').hidden = Boolean(text);
    $('reader-method').textContent = $('source-extraction').textContent;
  }
  function clearSource() {
    $('ai8-title').value = ''; $('ai8-text').value = ''; $('ai8-kind').value = 'ground-summary';
    $('source-extraction').textContent = ''; inputScope(); readerContent();
  }
  function extractionLabel(value) {
    if (typeof value === 'string') return plain(value, 300);
    if (!value || typeof value !== 'object') return '';
    const method = plain(value.method, 100) || plain(value.type, 100);
    return [method ? 'Pridobivanje: ' + method : '', value.truncated === true ? 'Besedilo je skrajšano.' : ''].filter(Boolean).join(' · ');
  }
  function applyArticle(article, mode) {
    const url = safeUrl(article.url);
    if (!url || !Object.hasOwn(kinds, article.inputKind) || typeof article.title !== 'string' || !article.title.trim() || typeof article.text !== 'string' || !article.text.trim() || article.text.length > MAX_TEXT) throw Error('Vir ni vrnil uporabnega naslova in besedila. Dodaj besedilo ročno ali uporabi lokalni dodatek.');
    $('ai8-url').value = url;
    $('ai8-title').value = plain(article.title.trim(), 400);
    $('ai8-text').value = article.text.trim();
    $('ai8-kind').value = article.inputKind;
    $('source-extraction').textContent = extractionLabel(article.extraction);
    setMode(mode); inputScope(); readerContent();
  }
  function cancelImport() {
    importSequence++;
    if (importController) importController.abort();
    importController = null; importingUrl = null; importing = false; buttonState();
  }
  function cancelPaste() { if (pasteTimer !== null) { clearTimeout(pasteTimer); pasteTimer = null; } }
  async function loadSource({automatic = false} = {}) {
    cancelPaste();
    const url = safeUrl($('ai8-url').value.trim());
    if (url && importing && importingUrl === url) return;
    if (automatic && url && loadedUrl === url && $('ai8-source-mode').value === 'url'
      && $('ai8-title').value.trim() && $('ai8-text').value.trim()) return;
    cancelImport();
    if (!url) { setStatus('Vnesi veljavno povezavo http ali https, brez prijavnih podatkov.', true); return; }
    $('ai8-url').value = url; clearSource();
    const parsed = new URL(url); const ground = isGround(parsed);
    if (ground) {
      $('ground-frame').src = url; $('ground-external').href = url; viewReader(false); setMode('frame');
      if (!/^\/article\/.+/.test(parsed.pathname)) { setStatus('Ground News je odprt. Izberi zgodbo in klikni »Trenutna novica«.'); return; }
    } else { $('ai8-kind').value = 'article'; inputScope(); setMode('url'); viewReader(true); }
    const sequence = importSequence;
    importController = typeof AbortController === 'function' ? new AbortController() : null;
    importing = true; importingUrl = url; buttonState(); setStatus('Pridobivam javno dostopno besedilo članka …');
    try {
      const options = {headers: {Accept: 'application/json'}, credentials: 'omit'};
      if (importController) options.signal = importController.signal;
      const response = await fetch('/api/news-source?url=' + encodeURIComponent(url), options);
      const payload = await response.json();
      if (sequence !== importSequence) return;
      if (!response.ok || payload.ok !== true) {
        const error = typeof payload.error === 'string' ? payload.error : plain(payload.error?.message, 350);
        throw Error(error || 'Besedila ni bilo mogoče pridobiti. Poskusi »Trenutna novica« ali dodaj besedilo ročno.');
      }
      applyArticle(payload.article || {}, 'url');
      loadedUrl = url;
      setStatus('Vir je pridobljen. Izberi GPT, Claude ali obe analizi.');
    } catch (error) {
      if (sequence !== importSequence) return;
      setStatus(plain(error.message, 500) || 'Pridobivanje ni uspelo. Dodaj besedilo ročno.', true);
      $('source-inspector').open = true; drawer(true);
    } finally {
      if (sequence === importSequence) { importing = false; importingUrl = null; importController = null; buttonState(); }
    }
  }
  function validInput() {
    if ($('ai8-source-mode').value === 'frame') return true;
    const url = safeUrl($('ai8-url').value.trim()); const title = $('ai8-title').value.trim(); const text = $('ai8-text').value.trim();
    $('ai8-url').setAttribute('aria-invalid', String(!url)); $('ai8-title').setAttribute('aria-invalid', String(!title)); $('ai8-text').setAttribute('aria-invalid', String(!text));
    if (!url) { setStatus('Vnesi veljavno povezavo http ali https, brez prijavnih podatkov.', true); return false; }
    if ($('ai8-kind').value === 'ground-summary') {
      const source = new URL(url);
      if (!isGround(source) || !/^\/article\/.+/.test(source.pathname)) { setStatus('Za povzetek Ground News uporabi povezavo ground.news/article/…', true); return false; }
    }
    if (!title) { setStatus('Dodaj naslov zgodbe.', true); return false; }
    if (!text) { setStatus('Najprej pridobi ali dodaj besedilo za analizo.', true); return false; }
    if (!Object.hasOwn(kinds, $('ai8-kind').value)) { setStatus('Izberi vrsto dodanega besedila.', true); return false; }
    if (text.length > MAX_TEXT) { setStatus('Besedilo omeji na 59.999 znakov.', true); return false; }
    return true;
  }
  function addSection(body, title, value, list = false) {
    const values = list ? (Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()).slice(0, 8) : []) : plain(value, 2400);
    if (!values.length) return;
    const section = element('section'); section.append(element('h4', title));
    if (list) { const ul = element('ul'); values.forEach(item => ul.append(element('li', plain(item, 2400)))); section.append(ul); }
    else section.append(element('p', values));
    body.append(section);
  }
  function renderVoice(id, value, models) {
    const card = $(id + '-opinion'); const body = card.querySelector('.voice-body'); const status = card.querySelector('.voice-status');
    body.replaceChildren();
    const answer = value && typeof value === 'object' ? value : {};
    card.hidden = answer.status === 'not-requested' || !models.includes(id);
    if (card.hidden) return;
    const analysis = answer.analysis && typeof answer.analysis === 'object' ? answer.analysis : null;
    const labels = {ok: 'Pripravljeno', running: 'V pripravi', pending: 'Čakam na odgovor', error: 'Ni uspelo', timeout: 'Čas je potekel', unavailable: 'Ni na voljo'};
    status.textContent = labels[answer.status] || (analysis ? 'Odgovor prejet' : 'Odgovor ni na voljo');
    if (analysis) { addSection(body, 'Povzetek', analysis.summary); addSection(body, 'Mnenje', analysis.opinion); addSection(body, 'Razlogi', analysis.reasons, true); addSection(body, 'Negotovosti', analysis.uncertainties, true); addSection(body, 'Vprašanja', analysis.questions, true); }
    const error = plain(answer.error, 1500) || plain(answer.error?.message, 1500);
    if (error) body.append(element('p', error, 'voice-error'));
    if (!body.children.length) body.append(element('p', 'Za ta glas ni uporabnega odgovora.', 'voice-error'));
  }
  function modelList(value, fallback = requestedModels) {
    const list = Array.isArray(value) ? ['gpt', 'claude'].filter(id => value.includes(id)) : [];
    return list.length ? list : fallback;
  }
  function renderResult(payload) {
    const article = payload.article && typeof payload.article === 'object' ? payload.article : {};
    const results = payload.results && typeof payload.results === 'object' ? payload.results : {};
    const url = safeUrl(article.url); const models = modelList(payload.requestedModels);
    $('result-title').textContent = plain(article.title, 400) || 'Dodano besedilo';
    $('result-url').hidden = !url; $('result-url').removeAttribute('href'); $('result-url').textContent = url || ''; if (url) $('result-url').href = url;
    $('result-scope').textContent = 'Vhod: ' + kind(article.inputKind)[0] + '. Analiza obravnava navedeno besedilo.';
    const sha = typeof article.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(article.sha256) ? article.sha256 : '';
    $('result-sha').textContent = sha; $('result-integrity').hidden = !sha;
    let when = '';
    if (typeof payload.createdAt === 'string') { const date = new Date(payload.createdAt); if (Number.isFinite(date.getTime())) when = new Intl.DateTimeFormat('sl-SI', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Ljubljana'}).format(date); }
    $('result-time').textContent = [payload.cached === true ? 'Shranjena analiza' : 'Analiza', when].filter(Boolean).join(' · ');
    renderVoice('gpt', results.gpt, models); renderVoice('claude', results.claude, models);
    $('ai8-results').hidden = false; drawer(true);
  }
  function receiveSource(payload) {
    const requestId = plain(payload.requestId, 160);
    // The Ground frame can navigate while the user reads an imported source.
    // Only an explicitly selected frame source may replace those fields.
    if ($('ai8-source-mode').value !== 'frame' || importing) return;
    if (busy) {
      if (!requestId) { pendingFrameSource = payload; return; }
      if (!activeRequestId || requestId !== activeRequestId) return;
    }
    const article = payload.article && typeof payload.article === 'object' ? payload.article : null;
    const sourceUrl = safeUrl(article?.url || payload.url);
    if (!article && !sourceUrl && !payload.error) return;
    if (sourceUrl && !isGround(new URL(sourceUrl))) return;
    if (requestId) { cancelImport(); cancelPaste(); }
    if (article) {
      try { applyArticle(article, 'frame'); } catch (error) { setStatus(plain(error.message, 500), true); return; }
    } else if (sourceUrl) {
      // A genuine navigation invalidates the previous article body. A title
      // refresh for the same URL keeps an already captured summary usable.
      if (sourceUrl !== safeUrl($('ai8-url').value.trim())) clearSource();
      $('ai8-url').value = sourceUrl;
      if (typeof payload.title === 'string' && payload.title.trim()) $('ai8-title').value = plain(payload.title, 400);
      readerContent();
    }
    if (sourceUrl) $('ground-external').href = sourceUrl;
    if (payload.error) { setStatus(plain(typeof payload.error === 'string' ? payload.error : payload.error.message, 500) || 'Zajem vira ni uspel. Označi besedilo v Ground News.', true); $('source-inspector').open = true; drawer(true); }
    else if (!busy) setStatus(article ? 'Trenutna novica je zajeta. Izberi želeno analizo.' : 'Trenutna stran Ground News. Dodatek ob analizi zajame njeno besedilo.');
  }
  function applyPendingFrameSource() {
    const pending = pendingFrameSource;
    pendingFrameSource = null;
    if (pending) receiveSource(pending);
  }
  function receive(event) {
    if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== 'ai8-news-extension') return;
    const message = event.data; const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
    if (message.type === 'source') { receiveSource(payload); return; }
    if (message.type === 'ready') {
      const present = payload.installed === true || payload.nativeHostAvailable === true;
      const frameCapable = payload.capabilities?.frameCapture === true;
      const modelCapable = payload.capabilities?.modelSelection === true;
      const updateNeeded = present && (!frameCapable || payload.nativeHostAvailable === true && !modelCapable);
      addonAvailable = present && frameCapable;
      connected = payload.nativeHostAvailable === true && addonAvailable && modelCapable;
      $('connection-dot').className = 'connection-dot' + (connected ? ' ready' : '');
      $('connection-state').textContent = updateNeeded ? 'Posodobi AI8 view' : connected ? 'Povezovalnik dosegljiv' : present ? 'Povezovalnik ni dosegljiv' : 'Dodatek ni povezan';
      $('connection-title').textContent = updateNeeded ? 'Posodobi AI8 view' : connected ? 'Povezovalnik je pripravljen' : present ? 'Dodatek potrebuje povezovalnik' : 'Poveži svoja agenta';
      $('connection-message').textContent = updateNeeded
        ? frameCapable ? 'Lokalni povezovalnik še ne podpira izbire GPT ali Claude. Posodobi povezovalnik in znova naloži dodatek AI8 view.' : 'Ta različica dodatka še ne podpira nove vrstice in zajema iz okvirja. Namesti posodobitev AI8 view in osveži stran.'
        : plain(payload.message, 1500) || (connected ? 'Lokalni povezovalnik je dosegljiv. Izberi novico in enega ali oba agenta.' : 'Za analizi namesti lokalni dodatek in povezovalnik ter se prijavi v svoja agenta.');
      if (!busy && !importing) setStatus(updateNeeded ? 'Posodobi AI8 view za zajem trenutne novice in izbiro agenta. Pridobivanje vira iz URL-ja ostaja na voljo.' : connected ? 'Pripravljeno. Izberi zgodbo ali prilepi povezavo do članka.' : 'Brskanje in pridobivanje vira delujeta brez dodatka. Za analizi poveži agenta.');
      buttonState(); return;
    }
    const requestId = plain(payload.requestId, 160); if (!requestId) return;
    if (message.type === 'progress') {
      if (busy && activeRequestId && requestId !== activeRequestId) return;
      activeRequestId = requestId; busy = true; requestedModels = modelList(payload.requestedModels); buttonState(); drawer(true);
      setStatus(plain(payload.message, 1500) || 'Izbrani agenti pripravljajo analizo …'); return;
    }
    if (!activeRequestId || requestId !== activeRequestId) return;
    if (message.type === 'result') { busy = false; activeRequestId = null; buttonState(); applyPendingFrameSource(); renderResult(payload); setStatus('Izbrana analiza je pripravljena v stranskem pogledu.'); }
    else if (message.type === 'error') {
      busy = false; activeRequestId = null; buttonState(); applyPendingFrameSource(); if (payload.results) renderResult(payload);
      const error = typeof payload.error === 'string' ? payload.error : payload.error?.message;
      setStatus(plain(payload.message, 1500) || plain(error, 1500) || 'Analize ni bilo mogoče dokončati. Preveri povezavo in prijavi agentov.', true);
    }
  }
  async function archiveLink() {
    try { const response = await fetch('catalog.json', {cache: 'no-store'}); if (!response.ok) return; const catalog = await response.json(); const date = catalog.latest_published_date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      $('archive-latest').href = 'archive.html?date=' + encodeURIComponent(date); $('archive-date').textContent = 'Zadnja lastna izdaja: ' + date.split('-').reverse().join('. ') + '.';
    } catch (_) { /* The archive remains reachable without its optional date. */ }
  }
  if (new URLSearchParams(location.search).has('date')) { location.replace(new URL('archive.html' + location.search + location.hash, location.href).href); return; }
  $('ai8-load').addEventListener('click', loadSource);
  $('ai8-url').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadSource(); } });
  $('ai8-url').addEventListener('change', () => loadSource({automatic: true}));
  $('ai8-url').addEventListener('input', () => { cancelImport(); clearSource(); setMode('url'); });
  $('ai8-url').addEventListener('paste', () => { cancelPaste(); pasteTimer = setTimeout(() => loadSource({automatic: true}), 220); });
  $('ai8-current').addEventListener('click', () => { cancelImport(); cancelPaste(); setMode('frame'); viewReader(false); $('source-inspector').open = true; drawer(true); setStatus(addonAvailable ? 'Pridobivam trenutno novico iz Ground News …' : 'Za zajem trenutne novice poveži lokalni dodatek.', !addonAvailable); });
  $('ai8-reader').addEventListener('click', () => { readerContent(); viewReader(!readerVisible); });
  $('ai8-panel').addEventListener('click', () => drawer($('analysis-drawer').hidden));
  $('ai8-drawer-close').addEventListener('click', () => drawer(false));
  $('ai8-setup').addEventListener('click', () => { drawer(true); $('setup-details').open = true; });
  $('ai8-kind').addEventListener('change', () => { setMode('url'); inputScope(); });
  ['ai8-title', 'ai8-text'].forEach(id => $(id).addEventListener('input', () => { setMode('url'); inputScope(); readerContent(); }));
  analysisButtons.forEach(id => $(id).addEventListener('click', () => {
    if (!connected) { setStatus('Najprej poveži lokalni dodatek AI8 News.', true); return; }
    if (busy || importing || !validInput()) return;
    requestedModels = id === 'ai8-gpt' ? ['gpt'] : id === 'ai8-claude' ? ['claude'] : ['gpt', 'claude'];
    activeRequestId = null; $('ai8-results').hidden = true; drawer(true); setStatus('Čakam na lokalni povezovalnik …');
    // Trusted button clicks are handled by the installed extension. The public
    // page does not read frame DOM, invoke a CLI or post a model request.
  }));
  window.addEventListener('message', receive);
  if (typeof ResizeObserver === 'function') new ResizeObserver(entries => { const height = entries[0]?.target?.getBoundingClientRect().height; if (height) document.documentElement.style.setProperty('--toolbar-h', Math.ceil(height) + 'px'); }).observe($('news-toolbar'));
  inputScope(); buttonState(); archiveLink();
})();
