(() => {
  'use strict';
  if (globalThis.__ai8NewsContent) return;
  globalThis.__ai8NewsContent = true;
  const C = globalThis.AI8NewsCore;
  const V = globalThis.AI8NewsView;
  const embedded = window.top !== undefined && window.top !== window;
  const owned = C.isOwnedNewsUrl(location.href) && !embedded;
  function visibleText(node) {
    if (!node || node.closest('[hidden],[aria-hidden="true"],nav,footer,script,style')) return '';
    if (typeof node.getClientRects === 'function' && !node.getClientRects().length) return '';
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(node);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return '';
    }
    return (typeof node.innerText === 'string' ? node.innerText : node.textContent || '').trim();
  }
  function captureGround() {
    if (!C.isGroundArticleUrl(location.href)) throw Error('Na strani založnika označite besedilo in v meniju izberite AI8 view.');
    const title = visibleText(document.querySelector('h1'));
    // Public Ground article markup: a header bullet list with a nearby Ground AI
    // attribution. Publisher cards repeat #article-summary and are never input.
    const summaries = [...document.querySelectorAll('main article ul.list-disc')].map(list => {
      if (list.closest('#article-summary') || !visibleText(list)) return null;
      let header = list.parentElement;
      while (header && header.tagName !== 'ARTICLE' && header.style?.gridArea !== 'header') header = header.parentElement;
      if (!header || header.style?.gridArea !== 'header') return null;
      const textBlock = list.parentElement;
      const summaryBlock = textBlock?.parentElement;
      if (!summaryBlock || ![...summaryBlock.children].some(sibling =>
        sibling !== textBlock && /\bInsights by Ground AI\b/.test(visibleText(sibling)))) return null;
      const items = [...list.children];
      if (!items.length || items.some(item => item.tagName !== 'LI')) return null;
      const bullets = items.map(visibleText).filter(Boolean);
      return bullets.length ? bullets.join('\n') : null;
    }).filter(Boolean);
    if (summaries.length !== 1) throw Error('Povzetka ni mogoče zanesljivo prepoznati. Označite želeno besedilo in uporabite meni AI8 view.');
    const text = summaries[0];
    if (text.length < 40) throw Error('Povzetek je prekratek. Označite želeno besedilo in uporabite meni AI8 view.');
    return C.normalizeArticle({url: location.href, title: C.truncateText(title || document.title, 500), text: C.truncateText(text), inputKind: 'ground-summary', capturedAt: new Date().toISOString()});
  }

  function sourceInfo() {
    return C.normalizeSourceInfo({url: location.href, title: C.truncateText(visibleText(document.querySelector('h1')) || document.title || '', 500)});
  }
  // The iframe has one privilege: respond to the extension's document-targeted
  // capture and publish URL/title metadata. It cannot subscribe to native work.
  if (embedded) {
    if (!C.isGroundUrl(location.href) || window.parent !== window.top) return;
    let lastSource = '';
    function publish(type) {
      let source;
      try { source = sourceInfo(); } catch { return; }
      lastSource = JSON.stringify(source);
      chrome.runtime.sendMessage({type, source, directChild: true}).catch(() => {});
    }
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (sender.id !== chrome.runtime.id || message?.channel !== 'ai8-news') return;
      if (message.type === 'probe') { respond({ready: true}); return; }
      if (message.type === 'source-probe') { publish('subscribe'); respond({ready: true}); return; }
      if (message.type !== 'capture' || Object.keys(message).some(k => !['channel', 'type', 'requestId'].includes(k))) return;
      let id;
      try { id = C.requestId(message.requestId); respond({requestId: id, article: captureGround()}); }
      catch { if (id) respond({requestId: id, error: 'Groundov povzetek ni prepoznan. Izberite trenutno novico ali odprite Ground neposredno.'}); }
    });
    publish('subscribe');
    new MutationObserver(() => {
      try { if (JSON.stringify(sourceInfo()) !== lastSource) publish('source-update'); } catch { /* Navigated outside permitted Ground origin. */ }
    }).observe(document.documentElement, {childList: true, subtree: true});
    return;
  }
  let panel = null, nativeReady = false, activeRequest = null, activeCapture = null;
  let selectedArticle = null, pendingSelection = null, groundButton = null;
  let sourceEpoch = 0;
  const boundButtons = new WeakSet(), boundInputs = new WeakSet();
  const toolbarModels = [['ai8-gpt', ['gpt']], ['ai8-claude', ['claude']], ['ai8-analyze', ['gpt', 'claude']]];
  function post(type, payload) {
    if (owned) window.postMessage({source: 'ai8-news-extension', type, payload}, location.origin);
  }
  function subscribe() {
    chrome.runtime.sendMessage({type: 'subscribe'}).catch(() => show({type: 'ready', nativeHostAvailable: false, message: 'Razširitev ni povezana. Ponovno odprite stran.'}));
  }
  function ensurePanel() {
    if (owned) return null; // The owned page already has its own results drawer.
    if (!panel) panel = V.createPanel(document, {analyze: () => {
      try { submit(selectedArticle || captureGround()); } catch (error) { localError(error.message); }
    }, reconnect: subscribe, close: () => { pendingSelection = null; }});
    panel.host.hidden = false;
    panel.analyze.disabled = !nativeReady || Boolean(activeRequest);
    return panel;
  }
  function show(message) {
    if (panel) V.renderMessage(panel, message);
    post(message.type === 'accepted' ? 'progress' : message.type, message);
  }
  function localError(message, requestId = crypto.randomUUID()) {
    ensurePanel(); show({type: 'error', requestId, message, error: message});
  }
  function value(id) {
    const node = document.getElementById(id);
    if (!node) throw Error('Na strani manjkajo polja AI8 view.');
    return typeof node.value === 'string' ? node.value : node.textContent;
  }
  function sourceMode() { return document.getElementById('ai8-source-mode')?.value || 'url'; }
  function ownedArticle() {
    return C.normalizeArticle({url: value('ai8-url'), title: value('ai8-title'), text: value('ai8-text'), inputKind: value('ai8-kind'), capturedAt: new Date().toISOString()});
  }
  function refreshButtons() {
    if (panel) panel.analyze.disabled = !nativeReady || Boolean(activeRequest);
    if (groundButton) groundButton.disabled = !nativeReady || Boolean(activeRequest);
  }
  function begin(models) {
    if (activeRequest) throw Error('Analiza že teče.');
    if (!nativeReady) throw Error('Native host še ni pripravljen.');
    const id = crypto.randomUUID();
    activeRequest = {id, models: C.normalizeModels(models), epoch: sourceEpoch};
    refreshButtons();
    show({type: 'progress', requestId: id, requestedModels: activeRequest.models, message: activeRequest.models.length === 2 ? 'Pripravljam ločeni analizi GPT in Claude …' : 'Pripravljam izbrano analizo …'});
    return activeRequest;
  }
  function sendJob(message, request) {
    chrome.runtime.sendMessage(message).catch(() => {
      if (activeRequest !== request) return;
      activeRequest = null; refreshButtons();
      localError('Povezava z razširitvijo se je prekinila. Izid ni potrjen; analiza se ni ponovila.', request.id);
    });
  }
  function submit(articleInput, models) {
    const article = C.normalizeArticle(articleInput);
    const request = begin(models);
    selectedArticle = article;
    const view = ensurePanel();
    if (view) { view.output.replaceChildren(); view.source.textContent = article.title + ' · ' + article.inputKind; }
    sendJob({type: 'analyze', requestId: request.id, article, models: request.models}, request);
  }
  function submitFrame(models) {
    const request = begin(models);
    sendJob({type: 'analyze-frame', requestId: request.id, models: request.models}, request);
  }
  function captureFrame() {
    if (activeRequest) { show({type: 'progress', requestId: activeRequest.id, requestedModels: activeRequest.models, message: 'Analiza že teče.'}); return; }
    const node = document.getElementById('ai8-source-mode'); if (node) node.value = 'frame';
    const capture = {id: crypto.randomUUID(), epoch: sourceEpoch}; activeCapture = capture;
    chrome.runtime.sendMessage({type: 'capture-frame', requestId: capture.id}).catch(() => {
      if (activeCapture !== capture) return;
      activeCapture = null; post('source', {requestId: capture.id, error: 'Povezava z okvirjem ni dosegljiva.'});
    });
  }
  function invalidateSource() {
    sourceEpoch++; activeCapture = null; pendingSelection = null;
    if (!activeRequest) return;
    const id = activeRequest.id; activeRequest = null; refreshButtons();
    show({type: 'error', requestId: id, error: 'Vir je bil spremenjen. Prejšnja analiza se ne bo samodejno ponovila.', uncertain: true});
  }
  function bindOwned() {
    if (!owned) return;
    for (const [id, models] of toolbarModels) {
      const button = document.getElementById(id);
      if (!button || boundButtons.has(button)) continue;
      boundButtons.add(button);
      button.addEventListener('click', event => {
        if (!event.isTrusted) return;
        if (activeRequest) { show({type: 'progress', requestId: activeRequest.id, requestedModels: activeRequest.models, message: 'Analiza že teče.'}); return; }
        activeCapture = null;
        try { sourceMode() === 'frame' ? submitFrame(models) : submit(ownedArticle(), models); }
        catch (error) { localError(error.message); }
      });
    }
    const current = document.getElementById('ai8-current');
    if (current && !boundButtons.has(current)) { boundButtons.add(current); current.addEventListener('click', event => { if (event.isTrusted) captureFrame(); }); }
    for (const id of ['ai8-url', 'ai8-title', 'ai8-text', 'ai8-kind', 'ai8-load']) {
      const input = document.getElementById(id);
      if (!input || boundInputs.has(input)) continue;
      boundInputs.add(input);
      input.addEventListener(id === 'ai8-load' ? 'click' : id === 'ai8-kind' ? 'change' : 'input', event => { if (event.isTrusted) invalidateSource(); });
    }
  }
  function mountGround() {
    if (!C.isGroundArticleUrl(location.href) || groundButton) return;
    const host = document.createElement('div'), shadow = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style'); style.textContent = ':host{all:initial;position:fixed;right:18px;top:16px;z-index:2147483647}button{font:600 15px system-ui;color:#fff;background:#244675;border:1px solid #91b9ec;border-radius:10px;padding:11px 17px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}';
    groundButton = document.createElement('button'); groundButton.type = 'button'; groundButton.textContent = 'AI8 view'; groundButton.disabled = !nativeReady;
    groundButton.addEventListener('click', event => {
      if (!event.isTrusted) return;
      try { selectedArticle = null; submit(captureGround()); } catch (error) { localError(error.message); }
    });
    shadow.append(style, groundButton); document.documentElement.append(host);
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.channel !== 'ai8-news') return;
    if (message.type === 'probe') { respond({ready: true}); return; }
    if (message.type === 'open-panel') { ensurePanel(); return; }
    if (message.type === 'source' && owned) {
      const payload = message.payload;
      if (!payload || typeof payload !== 'object') return;
      if (payload.requestId) {
        const capture = activeCapture?.id === payload.requestId ? activeCapture : null;
        const request = activeRequest?.id === payload.requestId ? activeRequest : null;
        if ((!capture && !request) || (capture || request).epoch !== sourceEpoch || sourceMode() !== 'frame') return;
        if (capture) activeCapture = null;
      } else if (sourceMode() !== 'frame') return;
      post('source', payload); return;
    }
    if (message.type === 'selection') {
      try {
        if (activeRequest) { show({type: 'progress', requestId: activeRequest.id, requestedModels: activeRequest.models, message: 'Analiza že teče. Izbrano besedilo še ni bilo poslano.'}); return; }
        selectedArticle = C.normalizeArticle(message.article); const view = ensurePanel();
        if (nativeReady) submit(selectedArticle);
        else { pendingSelection = selectedArticle; if (view) { view.source.textContent = selectedArticle.title + ' · označeno besedilo'; view.status.textContent = 'Čakam na native povezavo; analiza še ni bila poslana.'; } subscribe(); }
      } catch (error) { localError(error.message); }
      return;
    }
    if (message.type !== 'native') return;
    const payload = message.payload;
    if (payload?.type === 'ready') {
      nativeReady = payload.nativeHostAvailable === true;
      refreshButtons(); show(payload);
      if (payload.message && !nativeReady) pendingSelection = null;
      if (nativeReady && pendingSelection) { const article = pendingSelection; pendingSelection = null; submit(article); }
      return;
    }
    if (!payload || payload.requestId !== activeRequest?.id || activeRequest.epoch !== sourceEpoch) return;
    if (payload.type === 'result') {
      let valid = false;
      try { valid = JSON.stringify(C.normalizeModels(payload.requestedModels)) === JSON.stringify(activeRequest.models); } catch { /* Invalid protocol payload. */ }
      if (!valid) { const id = activeRequest.id; activeRequest = null; refreshButtons(); localError('Izbira agentov v rezultatu ni potrjena.', id); return; }
    }
    if (['result', 'error'].includes(payload.type)) { activeRequest = null; refreshButtons(); }
    ensurePanel(); show(payload);
  });
  bindOwned(); mountGround(); subscribe();
  if (owned) post('ready', {installed: true, extensionVersion: chrome.runtime.getManifest().version,
    nativeHostAvailable: nativeReady, capabilities: {frameCapture: true, modelSelection: false}});
  let lastUrl = location.href;
  new MutationObserver(() => {
    bindOwned();
    if (location.href !== lastUrl) {
      lastUrl = location.href; selectedArticle = null; pendingSelection = null;
      invalidateSource(); if (groundButton) groundButton.hidden = !C.isGroundArticleUrl(lastUrl); mountGround();
    }
  }).observe(document.documentElement, {childList: true, subtree: true});
})();
