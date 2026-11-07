import './core.js';
const C = globalThis.AI8NewsCore;
const HOST = 'org.ai8.news';
let nativePort = null;
let hostReady = false;
const subscribers = new Map();
const requests = new Map();
const pings = new Set();
const contextKey = c => `${c.tabId}:${c.documentId || c.frameId}`;
const publicError = (id, message, uncertain = false) => ({v: 1, type: 'error', requestId: id, message, error: message, uncertain});
function deliver(context, payload) {
  const options = context.documentId ? {documentId: context.documentId} : {frameId: context.frameId};
  chrome.tabs.sendMessage(context.tabId, {channel: 'ai8-news', type: 'native', payload}, options).catch(() => {});
}
function availability(message = '') {
  const payload = {type: 'ready', installed: true, nativeHostAvailable: hostReady, message};
  for (const context of subscribers.values()) deliver(context, payload);
}
function disconnect() {
  nativePort = null;
  hostReady = false;
  pings.clear();
  for (const [id, request] of requests) deliver(request.context, publicError(id, 'Povezava z native hostom se je prekinila. Izid ni potrjen; analiza se ni samodejno ponovila.', true));
  requests.clear();
  availability('Native host ni na voljo. Preverite lokalno namestitev in ponovno odprite stran.');
}
function connect() {
  if (nativePort) return;
  const port = chrome.runtime.connectNative(HOST);
  nativePort = port;
  port.onDisconnect.addListener(() => { void chrome.runtime.lastError; if (nativePort === port) disconnect(); });
  port.onMessage.addListener(raw => {
    if (nativePort !== port) return;
    // The unsolicited startup handshake has no job authority and carries no result.
    if (raw && raw.v === 1 && raw.type === 'ready' && raw.requestId == null) { hostReady = true; availability(); return; }
    const id = raw?.requestId;
    if (pings.has(id)) {
      try { const message = C.normalizeNativeMessage(raw, id); if (message.type !== 'ready') return; pings.delete(id); hostReady = true; availability(); } catch { /* Ignore malformed handshakes. */ }
      return;
    }
    const request = requests.get(id);
    if (!request) return;
    try {
      const message = C.normalizeNativeMessage(raw, id);
      if (!['accepted', 'progress', 'result', 'error'].includes(message.type)) throw Error('Unexpected native response');
      if (message.type === 'result') C.verifyResultBinding(message, request.article, request.sha256);
      deliver(request.context, message);
      if (['result', 'error'].includes(message.type)) requests.delete(id);
    } catch {
      requests.delete(id);
      deliver(request.context, publicError(id, 'Native odgovor ni prestal preverjanja vira ali oblike. Analiza se ni ponovila.', true));
    }
  });
  const id = crypto.randomUUID();
  pings.add(id);
  port.postMessage({v: 1, action: 'ping', requestId: id});
}
function contextFrom(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || !/^https?:\/\//.test(sender.url || '')) throw Error('Unsupported extension sender');
  return {tabId: sender.tab.id, frameId: 0, documentId: sender.documentId};
}
async function analyze(context, articleInput, id) {
  C.requestId(id);
  const article = C.normalizeArticle(articleInput);
  if (!nativePort || !hostReady) { deliver(context, publicError(id, 'Native host še ni pripravljen.')); return; }
  if (requests.size) { deliver(context, publicError(id, 'Ena analiza že teče. Počakajte na njen zaključek.')); return; }
  const request = {context, article, sha256: null};
  requests.set(id, request);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(article.text));
    request.sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (!nativePort || !hostReady || requests.get(id) !== request) return;
    nativePort.postMessage({v: 1, action: 'analyze', requestId: id, article});
  } catch {
    requests.delete(id);
    deliver(context, publicError(id, 'Zahteve ni bilo mogoče potrditi. Analiza se ni samodejno ponovila.', true));
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  let context;
  try {
    context = contextFrom(sender);
    if (message?.type === 'subscribe' && Object.keys(message).length === 1) {
      for (const [key, previous] of subscribers) if (previous.tabId === context.tabId && key !== contextKey(context)) subscribers.delete(key);
      if (subscribers.size >= 64) subscribers.delete(subscribers.keys().next().value);
      subscribers.set(contextKey(context), context);
      deliver(context, {type: 'ready', installed: true, nativeHostAvailable: hostReady});
      connect(); respond({ok: true}); return;
    }
    if (message?.type !== 'analyze' || Object.keys(message).some(k => !['type', 'requestId', 'article'].includes(k))) throw Error('Unsupported request');
    analyze(context, message.article, message.requestId).then(() => respond({ok: true})).catch(() => {
      deliver(context, publicError(typeof message.requestId === 'string' ? message.requestId.slice(0, 80) : '', 'Zahteva ni veljavna. Preverite URL in izbrano besedilo.'));
      respond({ok: false});
    });
    return true;
  } catch { respond({ok: false}); }
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const [key, context] of subscribers) if (context.tabId === tabId) subscribers.delete(key);
  // Keep running native work: closing a tab is not permission to retry or cancel.
});
async function ensureContent(tabId) {
  try { await chrome.tabs.sendMessage(tabId, {channel: 'ai8-news', type: 'probe'}, {frameId: 0}); }
  catch { await chrome.scripting.executeScript({target: {tabId, frameIds: [0]}, files: ['core.js', 'view.js', 'content.js']}); }
}
function registerMenu() {
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create({id: 'ai8-view-selection', title: 'AI8 view', contexts: ['selection'], documentUrlPatterns: ['https://*/*', 'http://*/*']});
  });
}
chrome.runtime.onInstalled.addListener(registerMenu);
chrome.runtime.onStartup.addListener(registerMenu);
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'ai8-view-selection' || !tab?.id || !info.selectionText) return;
  try {
    await ensureContent(tab.id);
    // This trusted browser-menu event only supplies literal selected text.
    await chrome.tabs.sendMessage(tab.id, {channel: 'ai8-news', type: 'selection', article: {url: info.pageUrl || tab.url, title: C.truncateText(tab.title || 'Izbrano besedilo', 500), text: C.truncateText(info.selectionText), inputKind: 'selection', capturedAt: new Date().toISOString()}}, {frameId: 0});
  } catch { /* Restricted browser pages cannot be injected. No native job was sent. */ }
});
chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id) return;
  try { await ensureContent(tab.id); await chrome.tabs.sendMessage(tab.id, {channel: 'ai8-news', type: 'open-panel'}, {frameId: 0}); } catch { /* Browser-protected page. */ }
});
