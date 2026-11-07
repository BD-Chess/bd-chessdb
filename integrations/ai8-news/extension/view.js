/* All publisher/model content is literal text; never HTML. */
(() => {
  'use strict';
  if (globalThis.AI8NewsView) return;
  function element(document, tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function createPanel(document, handlers = {}) {
    const host = element(document, 'div');
    host.setAttribute('data-ai8-news-extension', 'panel');
    const root = host.attachShadow({mode: 'closed'});
    const style = element(document, 'style');
    style.textContent = ':host{all:initial;position:fixed;right:16px;top:70px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 90px);z-index:2147483647;font:15px/1.55 system-ui,sans-serif;color:#e9edf6}*{box-sizing:border-box}.panel{background:#101722;border:1px solid #41516a;border-radius:14px;box-shadow:0 12px 40px #0009;overflow:auto;max-height:calc(100vh - 90px);padding:20px}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:21px;margin:0}h3{font-size:18px;margin:0 0 8px}h4{font-size:14px;margin:16px 0 4px;color:#a9c9ff}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}button{background:#244675;color:white;border:1px solid #6386b6;border-radius:8px;padding:8px 13px;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:wait}.close{background:transparent}.status,.source{font-size:13px;color:#b9c8db}.model{border-top:1px solid #344257;margin-top:18px;padding-top:16px}ul{padding-left:22px}li{white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#ffb6aa}.hint{font-size:12px;color:#a6b4c8}.toolbar{margin:12px 0;display:flex;gap:8px}';
    const panel = element(document, 'section', undefined, 'panel');
    panel.setAttribute('aria-label', 'AI8 view');
    const header = element(document, 'header');
    header.append(element(document, 'h2', 'AI8 view'));
    const close = element(document, 'button', 'Zapri', 'close'); close.type = 'button';
    close.addEventListener('click', event => { if (event.isTrusted) { host.hidden = true; handlers.close?.(); } });
    header.append(close);
    const source = element(document, 'p', 'Izberite Ground News zgodbo ali označite besedilo članka.', 'source');
    const toolbar = element(document, 'div', undefined, 'toolbar');
    const analyze = element(document, 'button', 'GPT + Claude'); analyze.type = 'button'; analyze.disabled = true;
    analyze.addEventListener('click', event => { if (event.isTrusted) handlers.analyze?.(); });
    const reconnect = element(document, 'button', 'Preveri povezavo'); reconnect.type = 'button';
    reconnect.addEventListener('click', event => { if (event.isTrusted) handlers.reconnect?.(); });
    toolbar.append(analyze, reconnect);
    const status = element(document, 'p', 'Preverjam lokalno povezavo …', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const output = element(document, 'div');
    const hint = element(document, 'p', 'Ločeni mnenji. Groundov povzetek ni celotno besedilo izvirnih člankov.', 'hint');
    panel.append(header, source, toolbar, status, output, hint); root.append(style, panel);
    document.documentElement.append(host);
    return {document, host, root, source, analyze, status, output};
  }
  function section(panel, parent, title, value) {
    const {document} = panel;
    parent.append(element(document, 'h4', title));
    if (Array.isArray(value)) {
      const list = element(document, 'ul');
      for (const text of value) list.append(element(document, 'li', text));
      if (!value.length) list.append(element(document, 'li', '—'));
      parent.append(list);
    } else parent.append(element(document, 'p', value));
  }
  function renderMessage(panel, message) {
    panel.host.hidden = false;
    if (message.type === 'ready') {
      panel.status.textContent = message.nativeHostAvailable ? 'Native povezava je pripravljena.' : (message.message || 'Native host še ni pripravljen.');
      return;
    }
    if (['accepted', 'progress'].includes(message.type)) {
      panel.status.textContent = message.message || 'Pripravljam ločeni mnenji GPT in Claude …';
      return;
    }
    if (message.type === 'error') {
      panel.status.textContent = message.message || message.error || 'Analiza ni potrjena.';
      return;
    }
    if (message.type !== 'result') return;
    panel.output.replaceChildren();
    const labels = {'ground-summary': 'Ground News povzetek', article: 'Besedilo članka', selection: 'Označeno besedilo', manual: 'Ročno vneseno besedilo'};
    panel.source.textContent = `${message.article.title} · ${labels[message.article.inputKind]}`;
    for (const [model, label] of [['gpt', 'GPT / Codex'], ['claude', 'Claude']]) {
      const result = message.results[model];
      const card = element(panel.document, 'section', undefined, 'model'); card.append(element(panel.document, 'h3', label));
      if (result.status !== 'ok' || !result.analysis) card.append(element(panel.document, 'p', result.error || result.status, 'error'));
      else {
        section(panel, card, 'Povzetek', result.analysis.summary);
        section(panel, card, 'Mnenje', result.analysis.opinion);
        section(panel, card, 'Razlogi', result.analysis.reasons);
        section(panel, card, 'Negotovosti', result.analysis.uncertainties);
        section(panel, card, 'Vprašanja', result.analysis.questions);
      }
      panel.output.append(card);
    }
    panel.status.textContent = (message.cached ? 'Predpomnjeni rezultat' : 'Analiza zaključena') + ' · ' + message.createdAt;
  }
  globalThis.AI8NewsView = Object.freeze({createPanel, renderMessage});
})();
