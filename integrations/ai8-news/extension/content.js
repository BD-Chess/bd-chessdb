(() => {
  'use strict';
  if (globalThis.__ai8NewsContent) return;
  globalThis.__ai8NewsContent = true;
  const C = globalThis.AI8NewsCore;
  const V = globalThis.AI8NewsView;
  let panel = null;
  let nativeReady = false;
  let activeRequest = null;
  let selectedArticle = null;
  let pendingSelection = null;
  let groundButton = null;
  const boundButtons = new WeakSet();
  function post(type, payload) {
    if (C.isOwnedNewsUrl(location.href)) window.postMessage({source: 'ai8-news-extension', type, payload}, location.origin);
  }
  function subscribe() { chrome.runtime.sendMessage({type: 'subscribe'}).catch(() => { show({type: 'ready', nativeHostAvailable: false, message: 'Razširitev ni povezana. Ponovno odprite stran.'}); }); }
  function ensurePanel() {
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
  function ownedArticle() {
    return C.normalizeArticle({url: value('ai8-url'), title: value('ai8-title'), text: value('ai8-text'), inputKind: value('ai8-kind'), capturedAt: new Date().toISOString()});
  }
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
  function submit(articleInput) {
    const article = C.normalizeArticle(articleInput);
    if (activeRequest) throw Error('Analiza že teče.');
    if (!nativeReady) throw Error('Native host še ni pripravljen.');
    selectedArticle = article;
    const requestId = crypto.randomUUID(); activeRequest = requestId;
    const view = ensurePanel(); view.output.replaceChildren(); view.source.textContent = article.title + ' · ' + article.inputKind;
    if (groundButton) groundButton.disabled = true;
    show({type: 'progress', requestId, message: 'Pošiljam isto besedilo v ločeno analizo GPT in Claude …'});
    chrome.runtime.sendMessage({type: 'analyze', requestId, article}).catch(() => {
      if (activeRequest !== requestId) return;
      activeRequest = null; refreshButtons();
      localError('Povezava z razširitvijo se je prekinila. Izid ni potrjen; analiza se ni ponovila.', requestId);
    });
  }
  function refreshButtons() {
    if (panel) panel.analyze.disabled = !nativeReady || Boolean(activeRequest);
    if (groundButton) groundButton.disabled = !nativeReady || Boolean(activeRequest);
  }
  function bindOwned() {
    if (!C.isOwnedNewsUrl(location.href)) return;
    const button = document.getElementById('ai8-analyze');
    if (!button || boundButtons.has(button)) return;
    boundButtons.add(button);
    button.addEventListener('click', event => {
      if (!event.isTrusted) return;
      if (activeRequest) { show({type: 'progress', requestId: activeRequest, message: 'Analiza že teče.'}); return; }
      try { submit(ownedArticle()); } catch (error) { localError(error.message); }
    });
    post('ready', {installed: true, nativeHostAvailable: nativeReady});
  }
  function mountGround() {
    if (!C.isGroundArticleUrl(location.href) || groundButton) return;
    const host = document.createElement('div'); const shadow = host.attachShadow({mode: 'closed'});
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
    if (message.type === 'selection') {
      try {
        if (activeRequest) { show({type: 'progress', requestId: activeRequest, message: 'Analiza že teče. Izbrano besedilo še ni bilo poslano.'}); return; }
        selectedArticle = C.normalizeArticle(message.article); ensurePanel();
        if (nativeReady) submit(selectedArticle);
        else { pendingSelection = selectedArticle; panel.source.textContent = selectedArticle.title + ' · označeno besedilo'; panel.status.textContent = 'Čakam na native povezavo; analiza še ni bila poslana.'; subscribe(); }
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
    if (!payload || payload.requestId !== activeRequest) return;
    if (['result', 'error'].includes(payload.type)) { activeRequest = null; refreshButtons(); }
    ensurePanel(); show(payload);
  });
  bindOwned(); mountGround(); subscribe();
  // Ground News navigates between stories without always reloading the document.
  let lastUrl = location.href;
  new MutationObserver(() => {
    bindOwned();
    if (location.href !== lastUrl) { lastUrl = location.href; selectedArticle = null; pendingSelection = null; if (groundButton) groundButton.hidden = !C.isGroundArticleUrl(lastUrl); mountGround(); }
  }).observe(document.documentElement, {childList: true, subtree: true});
})();
