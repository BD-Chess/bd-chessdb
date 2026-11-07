import './core.js';
const C = globalThis.AI8NewsCore;
const HOST = 'org.ai8.news';
let nativePort = null;
let hostReady = false;
let hostModelSelection = false;
let sequence = 0;
const subscribers = new Map();
const groundFrames = new Map();
const userGrants = new Map();
const requests = new Map();
const captures = new Set();
const pings = new Set();
const contextKey = c => `${c.tabId}:${c.documentId}`;
const frameKey = c => `${c.tabId}:${c.frameId}`;
const publicError = (id, message, uncertain = false) => ({v: 1, type: 'error', requestId: id, message, error: message, uncertain});
const sameContext = (a, b) => a.tabId === b.tabId && a.documentId === b.documentId;
function send(context, message) {
  return chrome.tabs.sendMessage(context.tabId, {channel: 'ai8-news', ...message}, {documentId: context.documentId});
}
function deliver(context, payload) { send(context, {type: 'native', payload}).catch(() => {}); }
function deliverSource(context, payload) { send(context, {type: 'source', payload}).catch(() => {}); }
function ownedTop(tabId) { return [...subscribers.values()].find(c => c.tabId === tabId && c.kind === 'owned-top'); }
function frameCurrent(binding) {
  if (!binding) return true;
  const frame = groundFrames.get(binding.key);
  return frame && frame.documentId === binding.documentId && frame.revision === binding.revision && frame.source.url === binding.url;
}
function stale(request, id, message) {
  if (request.stale) return;
  request.stale = true;
  deliver(request.context, publicError(id, message, true));
  // Native work is neither repeated nor canceled. Keep the singleton until its terminal response.
}
function invalidateFrame(key) {
  for (const [id, request] of requests) if (request.frameBinding?.key === key) stale(request, id, 'Ground vir se je med analizo spremenil. Prejšnji rezultat ne bo prikazan.');
}
function readyPayload(message = '') {
  return {type: 'ready', installed: true, extensionVersion: chrome.runtime.getManifest().version,
    nativeHostAvailable: hostReady, capabilities: {frameCapture: true, modelSelection: hostModelSelection},
    message: message || (hostReady && !hostModelSelection ? 'Posodobi lokalni povezovalnik AI8 News za izbiro posameznega agenta.' : '')};
}
function availability(message = '') {
  for (const context of subscribers.values()) deliver(context, readyPayload(message));
}
function disconnect() {
  nativePort = null; hostReady = false; hostModelSelection = false; pings.clear();
  for (const [id, request] of requests) if (!request.stale) deliver(request.context, publicError(id, 'Native povezava se je prekinila. Izid ni potrjen; analiza se ni samodejno ponovila.', true));
  requests.clear(); availability('Native host ni na voljo. Preverite lokalno namestitev in ponovno odprite stran.');
}
function connect() {
  if (nativePort) return;
  const port = chrome.runtime.connectNative(HOST); nativePort = port;
  port.onDisconnect.addListener(() => { void chrome.runtime.lastError; if (nativePort === port) disconnect(); });
  port.onMessage.addListener(raw => {
    if (nativePort !== port) return;
    if (raw && raw.v === 1 && raw.type === 'ready' && raw.requestId == null) { hostReady = true; hostModelSelection = raw.capabilities?.modelSelection === true; availability(); return; }
    const id = raw?.requestId;
    if (pings.has(id)) {
      try { const message = C.normalizeNativeMessage(raw, id); if (message.type !== 'ready') return; pings.delete(id); hostReady = true; hostModelSelection = raw.capabilities?.modelSelection === true; availability(); } catch { /* Invalid handshake. */ }
      return;
    }
    const request = requests.get(id);
    if (!request) return;
    try {
      const message = C.normalizeNativeMessage(raw, id);
      if (!['accepted', 'progress', 'result', 'error'].includes(message.type)) throw Error('Unexpected native response');
      if (!frameCurrent(request.frameBinding)) stale(request, id, 'Ground vir ni več isti. Prejšnji rezultat ne bo prikazan.');
      if (message.type === 'result') C.verifyResultBinding(message, request.article, request.sha256, request.models);
      if (!request.stale) deliver(request.context, message);
      if (['result', 'error'].includes(message.type)) requests.delete(id);
    } catch {
      requests.delete(id);
      if (!request.stale) deliver(request.context, publicError(id, 'Native odgovor ni prestal preverjanja vira, izbire modelov ali oblike. Analiza se ni ponovila.', true));
    }
  });
  const id = crypto.randomUUID(); pings.add(id); port.postMessage({v: 1, action: 'ping', requestId: id});
}
async function contextFrom(sender) {
  if (sender.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) || !Number.isInteger(sender.frameId) || sender.frameId < 0 || typeof sender.documentId !== 'string' || !sender.documentId || sender.documentId.length > 128 || !/^https?:\/\//.test(sender.url || '') || (sender.documentLifecycle && sender.documentLifecycle !== 'active')) throw Error('Unsupported sender');
  const tab = await chrome.tabs.get(sender.tab.id);
  if (tab.id !== sender.tab.id) throw Error('Tab mismatch');
  const context = {tabId: tab.id, frameId: sender.frameId, documentId: sender.documentId, url: sender.url};
  if (sender.frameId > 0) {
    if (!C.isGroundUrl(sender.url) || !C.isOwnedNewsUrl(tab.url)) throw Error('Unsupported Ground frame');
    await verifyCurrentDocument(context, true);
    return {...context, kind: 'ground-frame'}; // May register metadata before the parent content script is ready.
  }
  if (new URL(sender.url).href !== new URL(tab.url).href) throw Error('Top document URL mismatch');
  if (C.isOwnedNewsUrl(tab.url)) { await verifyCurrentDocument(context); return {...context, kind: 'owned-top'}; }
  if (C.isGroundUrl(tab.url)) { await verifyCurrentDocument(context); return {...context, kind: 'ground-top'}; }
  const grant = userGrants.get(tab.id);
  if (!grant || grant.origin !== new URL(tab.url).origin || grant.until < Date.now()) throw Error('Missing explicit activeTab gesture');
  await verifyCurrentDocument(context);
  return {...context, kind: 'publisher-top'};
}
async function verifyCurrentDocument(context, directGroundFrame = false) {
  // The browser supplies documentId for the frame that is current *now*.
  // This rejects queued messages from a replaced document, including an old
  // Ground iframe arriving after its owned top document has been replaced.
  const results = await chrome.scripting.executeScript({target: {tabId: context.tabId, frameIds: [context.frameId]},
    func: () => ({url: location.href, directChild: window.parent === window.top})});
  const current = results?.length === 1 ? results[0] : null;
  if (!current || current.frameId !== context.frameId || current.documentId !== context.documentId
      || current.result?.url !== new URL(context.url).href || directGroundFrame && current.result?.directChild !== true) throw Error('Stale or unsupported document');
}
function registerFrame(context, sourceInput, updateOnly = false) {
  const source = C.normalizeSourceInfo(sourceInput);
  if (source.url !== new URL(context.url).href) throw Error('Ground source URL mismatch');
  const key = frameKey(context), old = groundFrames.get(key);
  if (updateOnly && (!old || old.documentId !== context.documentId)) throw Error('Stale Ground document');
  if (old && (old.documentId !== context.documentId || old.source.url !== source.url)) invalidateFrame(key);
  const revision = old?.documentId === context.documentId ? old.revision + (old.source.url === source.url ? 0 : 1) : 1;
  if (!old && groundFrames.size >= 128) { const oldest = groundFrames.keys().next().value; invalidateFrame(oldest); groundFrames.delete(oldest); }
  groundFrames.set(key, {...context, source, revision, sequence: ++sequence});
  const top = ownedTop(context.tabId);
  if (top) deliverSource(top, source); // URL/title only. Never automatically read article text.
}
async function captureFrame(context, id) {
  C.requestId(id);
  if (context.kind !== 'owned-top' || !sameContext(ownedTop(context.tabId) || {}, context)) throw Error('Owned top document required');
  if (captures.has(id) || captures.size >= 32) throw Error('Capture already pending');
  const candidates = [...groundFrames.values()].filter(f => f.tabId === context.tabId);
  if (candidates.length !== 1) throw Error('Ground okvir ni enoznačno povezan. Odprite Ground neposredno ali ponovno naložite stran.');
  const frame = candidates[0];
  const binding = {key: frameKey(frame), documentId: frame.documentId, revision: frame.revision, url: frame.source.url};
  captures.add(id);
  let timer;
  try {
    const response = await Promise.race([send(frame, {type: 'capture', requestId: id}), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Ground zajem je potekel.')), 8000); })]);
    if (!response || response.requestId !== id || Object.keys(response).some(k => !['requestId', 'article', 'error'].includes(k))) throw Error('Ground capture correlation mismatch');
    if (response.error) throw Error('Povzetka ni mogoče zanesljivo zajeti. Izberite Ground članek ali odprite Ground neposredno.');
    const article = C.normalizeArticle(response.article);
    if (article.inputKind !== 'ground-summary' || article.url !== binding.url || !frameCurrent(binding) || !sameContext(ownedTop(context.tabId) || {}, context)) throw Error('Ground vir se je med zajemom spremenil. Ponovno izberite trenutno novico.');
    return {article, frameBinding: binding};
  } finally { clearTimeout(timer); captures.delete(id); }
}
async function analyze(context, articleInput, id, modelsInput, frameBinding = null) {
  if (context.kind === 'ground-frame') throw Error('Frames cannot request models');
  C.requestId(id); const article = C.normalizeArticle(articleInput), models = C.normalizeModels(modelsInput);
  if (!nativePort || !hostReady) { deliver(context, publicError(id, 'Native host še ni pripravljen.')); return; }
  if (models.length === 1 && !hostModelSelection) { deliver(context, publicError(id, 'Lokalni povezovalnik še ne podpira izbire enega agenta. Posodobi ga pred analizo.')); return; }
  if (requests.size) { deliver(context, publicError(id, 'Ena analiza že teče. Počakajte na njen zaključek.')); return; }
  const request = {context, article, models, frameBinding, sha256: null, stale: false}; requests.set(id, request);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(article.text));
    request.sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (!nativePort || !hostReady || requests.get(id) !== request) return;
    if (!frameCurrent(frameBinding)) { requests.delete(id); deliver(context, publicError(id, 'Ground vir se je pred pošiljanjem spremenil. Analiza ni bila poslana.')); return; }
    nativePort.postMessage({v: 1, action: 'analyze', requestId: id, article, models});
  } catch { requests.delete(id); deliver(context, publicError(id, 'Zahteve ni bilo mogoče potrditi. Analiza se ni samodejno ponovila.', true)); }
}
function fields(message, allowed) { return message && Object.keys(message).every(k => allowed.includes(k)); }
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  let context;
  (async () => {
    context = await contextFrom(sender);
    if (context.kind === 'ground-frame') {
      if (message?.directChild !== true) throw Error('Only the direct Ground reader frame may register');
      if (message?.type === 'subscribe' && fields(message, ['type', 'source', 'directChild'])) registerFrame(context, message.source);
      else if (message?.type === 'source-update' && fields(message, ['type', 'source', 'directChild'])) registerFrame(context, message.source, true);
      else throw Error('Ground frames are capture-only');
      respond({ok: true}); return;
    }
    if (message?.type === 'subscribe' && fields(message, ['type'])) {
      for (const [key, previous] of subscribers) if (previous.tabId === context.tabId && key !== contextKey(context)) {
        subscribers.delete(key);
        for (const [frameId, frame] of groundFrames) if (frame.tabId === context.tabId) { invalidateFrame(frameId); groundFrames.delete(frameId); }
      }
      if (subscribers.size >= 64) subscribers.delete(subscribers.keys().next().value);
      subscribers.set(contextKey(context), context);
      deliver(context, readyPayload()); connect();
      if (context.kind === 'owned-top') chrome.tabs.sendMessage(context.tabId, {channel: 'ai8-news', type: 'source-probe'}).catch(() => {});
      respond({ok: true}); return;
    }
    C.requestId(message?.requestId);
    if (message?.type === 'capture-frame' && fields(message, ['type', 'requestId']) && context.kind === 'owned-top') {
      for (const [id, request] of requests) if (sameContext(request.context, context) && request.frameBinding) stale(request, id, 'Vir je bil ponovno zajet. Prejšnji rezultat ne bo prikazan.');
      const captured = await captureFrame(context, message.requestId); deliverSource(context, {requestId: message.requestId, article: captured.article}); respond({ok: true}); return;
    }
    if (message?.type === 'analyze-frame' && fields(message, ['type', 'requestId', 'models']) && context.kind === 'owned-top') {
      const models = C.normalizeModels(message.models); const captured = await captureFrame(context, message.requestId);
      deliverSource(context, {requestId: message.requestId, article: captured.article});
      await analyze(context, captured.article, message.requestId, models, captured.frameBinding); respond({ok: true}); return;
    }
    if (message?.type === 'analyze' && fields(message, ['type', 'requestId', 'article', 'models'])) {
      await analyze(context, message.article, message.requestId, message.models); respond({ok: true}); return;
    }
    throw Error('Unsupported request');
  })().catch(error => {
    const id = typeof message?.requestId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(message.requestId) ? message.requestId : null;
    if (context && context.kind !== 'ground-frame' && id) {
      if (message?.type === 'capture-frame') deliverSource(context, {requestId: id, error: 'Ground vira ni mogoče zajeti. Izberite trenutno Ground novico ali jo odprite neposredno.'});
      else deliver(context, publicError(id, 'Zahteva ali Ground zajem ni veljaven. Izberite trenutni vir in model.'));
    }
    respond({ok: false});
  });
  return true;
});
function clearFrames(tabId) {
  for (const [key, frame] of groundFrames) if (frame.tabId === tabId) { invalidateFrame(key); groundFrames.delete(key); }
}
function dropTab(tabId) {
  userGrants.delete(tabId);
  for (const [key, context] of subscribers) if (context.tabId === tabId) subscribers.delete(key);
  clearFrames(tabId);
}
chrome.tabs.onRemoved.addListener(dropTab);
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== 'loading') return;
  userGrants.delete(tabId); clearFrames(tabId);
  // Loading can be caused by the embedded reader. Retain the owned top's
  // exact document subscription; actual replacement is checked by Chrome's
  // current document identity and reconciled on its new subscribe message.
  for (const [key, context] of subscribers) {
    if (context.tabId === tabId && (context.kind !== 'owned-top' || tab?.url && !C.isOwnedNewsUrl(tab.url))) subscribers.delete(key);
  }
  if (ownedTop(tabId)) chrome.tabs.sendMessage(tabId, {channel: 'ai8-news', type: 'source-probe'}).catch(() => {});
});
async function ensureContent(tabId) {
  try { await chrome.tabs.sendMessage(tabId, {channel: 'ai8-news', type: 'probe'}, {frameId: 0}); }
  catch { await chrome.scripting.executeScript({target: {tabId, frameIds: [0]}, files: ['core.js', 'view.js', 'content.js']}); }
}
function grant(tab) { if (tab?.id && /^https?:\/\//.test(tab.url || '')) userGrants.set(tab.id, {origin: new URL(tab.url).origin, until: Date.now() + 15 * 60 * 1000}); }
function registerMenu() { chrome.contextMenus.removeAll(() => { void chrome.runtime.lastError; chrome.contextMenus.create({id: 'ai8-view-selection', title: 'AI8 view', contexts: ['selection'], documentUrlPatterns: ['https://*/*', 'http://*/*']}); }); }
chrome.runtime.onInstalled.addListener(registerMenu); chrome.runtime.onStartup.addListener(registerMenu);
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Selection actions remain top-level only; Ground iframe clicks cannot start a job.
  if (info.menuItemId !== 'ai8-view-selection' || !tab?.id || !info.selectionText || info.frameId > 0) return;
  try { grant(tab); await ensureContent(tab.id); await chrome.tabs.sendMessage(tab.id, {channel: 'ai8-news', type: 'selection', article: {url: info.pageUrl || tab.url, title: C.truncateText(tab.title || 'Izbrano besedilo', 500), text: C.truncateText(info.selectionText), inputKind: 'selection', capturedAt: new Date().toISOString()}}, {frameId: 0}); } catch { /* Restricted page. No job was sent. */ }
});
chrome.action.onClicked.addListener(async tab => { if (!tab?.id) return; try { grant(tab); await ensureContent(tab.id); await chrome.tabs.sendMessage(tab.id, {channel: 'ai8-news', type: 'open-panel'}, {frameId: 0}); } catch { /* Restricted page. */ } });
