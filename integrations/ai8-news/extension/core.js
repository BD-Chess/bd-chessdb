/* Shared, network-free validation. Loaded only in the extension's isolated world. */
(() => {
  'use strict';
  if (globalThis.AI8NewsCore) return;
  const MAX_TEXT_CHARS = 59999;
  const KINDS = new Set(['ground-summary', 'article', 'selection', 'manual']);
  const TYPES = new Set(['ready', 'accepted', 'progress', 'result', 'error']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };
  function string(value, max, label, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail('Invalid ' + label);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('Invalid control character in ' + label);
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const n = value.charCodeAt(++i);
        if (!(n >= 0xdc00 && n <= 0xdfff)) fail('Invalid Unicode in ' + label);
      } else if (c >= 0xdc00 && c <= 0xdfff) fail('Invalid Unicode in ' + label);
    }
    return value;
  }
  function cleanUrl(value) {
    string(value, 4096, 'URL');
    let url;
    try { url = new URL(value); } catch { fail('Invalid article URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) fail('Article URL must be HTTP(S) without credentials');
    return url.href;
  }
  function isGroundUrl(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.port && u.hostname === 'ground.news' && !u.username && !u.password; } catch { return false; }
  }
  function isGroundArticleUrl(value) {
    try { return isGroundUrl(value) && /^\/article\/[^/]+/.test(new URL(value).pathname); } catch { return false; }
  }
  function isOwnedNewsUrl(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.port && ['www.mdlxdcc.org', 'mdlxdcc.org'].includes(u.hostname) && /^\/news(?:\/|$)/.test(u.pathname) && !u.username && !u.password; } catch { return false; }
  }
  function truncateText(value, max = MAX_TEXT_CHARS) {
    if (typeof value !== 'string') fail('Invalid text');
    let text = value.slice(0, max);
    if (/[\ud800-\udbff]$/.test(text)) text = text.slice(0, -1);
    return text;
  }
  // Include Python str.strip's additional whitespace; the host sees the same bytes.
  const trimText = value => value.replace(/^[\s\u0085\u001c-\u001f]+|[\s\u0085\u001c-\u001f]+$/gu, '');
  function normalizeArticle(raw) {
    if (!object(raw) || Object.keys(raw).some(k => !['url', 'title', 'text', 'inputKind', 'capturedAt'].includes(k))) fail('Invalid article fields');
    const url = cleanUrl(raw.url);
    const title = string(raw.title, 500, 'title').trim();
    if (!KINDS.has(raw.inputKind)) fail('Invalid input kind');
    if (raw.inputKind === 'ground-summary' && !isGroundArticleUrl(url)) fail('Ground summary requires a Ground News story URL');
    if (typeof raw.text !== 'string') fail('Invalid article text');
    const text = string(trimText(raw.text), MAX_TEXT_CHARS, 'article text');
    if (new TextEncoder().encode(text).length > 256000) fail('Article text is too large');
    const capturedAt = string(raw.capturedAt, 40, 'capture time');
    if (!/^\d{4}-\d\d-\d\dT/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) fail('Invalid capture time');
    return {url, title, text, inputKind: raw.inputKind, capturedAt};
  }
  function requestId(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail('Invalid request ID');
    return value;
  }
  function normalizeModels(value) {
    if (value === undefined) return ['gpt', 'claude'];
    if (!Array.isArray(value) || value.length < 1 || value.length > 2 || new Set(value).size !== value.length || value.some(x => !['gpt', 'claude'].includes(x))) fail('Invalid requested models');
    return ['gpt', 'claude'].filter(x => value.includes(x));
  }
  function normalizeSourceInfo(value) {
    if (!object(value) || Object.keys(value).some(k => !['url', 'title'].includes(k)) || !isGroundUrl(value.url)) fail('Invalid Ground source metadata');
    return {url: cleanUrl(value.url), title: string(value.title, 500, 'source title', true).trim()};
  }
  function analysis(value) {
    if (!object(value)) fail('Invalid analysis');
    const out = {};
    for (const k of ['summary', 'opinion']) out[k] = string(value[k], 12000, k, true);
    for (const k of ['reasons', 'uncertainties', 'questions']) {
      if (!Array.isArray(value[k]) || value[k].length > 16) fail('Invalid ' + k);
      out[k] = value[k].map(x => string(x, 3000, k, true));
    }
    return out;
  }
  function normalizeNativeMessage(raw, expectedRequestId) {
    if (!object(raw) || raw.v !== 1 || !TYPES.has(raw.type) || JSON.stringify(raw).length > 250000) fail('Invalid native response');
    const id = requestId(raw.requestId);
    if (expectedRequestId !== undefined && id !== expectedRequestId) fail('Native request ID mismatch');
    const out = {v: 1, type: raw.type, requestId: id};
    if (raw.jobId !== undefined) out.jobId = string(raw.jobId, 100, 'job ID');
    if (raw.message !== undefined) out.message = string(raw.message, 2000, 'message', true);
    if (raw.model !== undefined) { if (!['gpt', 'claude'].includes(raw.model)) fail('Invalid model'); out.model = raw.model; }
    if (raw.status !== undefined) out.status = string(raw.status, 80, 'status');
    if (raw.type === 'error') {
      out.error = string(raw.error ?? raw.message ?? 'Native analysis failed', 2000, 'error');
    }
    if (raw.type === 'result') {
      if (!object(raw.results) || !object(raw.article) || typeof raw.cached !== 'boolean') fail('Invalid result');
      out.results = {};
      out.requestedModels = normalizeModels(raw.requestedModels);
      if (raw.cachedModels !== undefined) {
        if (!Array.isArray(raw.cachedModels) || new Set(raw.cachedModels).size !== raw.cachedModels.length || raw.cachedModels.some(x => !out.requestedModels.includes(x))) fail('Invalid cached models');
        out.cachedModels = ['gpt', 'claude'].filter(x => raw.cachedModels.includes(x));
      }
      for (const model of ['gpt', 'claude']) {
        const r = raw.results[model];
        if (!object(r) || !['ok', 'error', 'timeout', 'not-requested'].includes(r.status)) fail('Invalid model result');
        if (out.requestedModels.includes(model) === (r.status === 'not-requested')) fail('Requested model/result mismatch');
        if (r.status === 'not-requested' && r.analysis != null) fail('Unexpected unrequested analysis');
        out.results[model] = {status: r.status, analysis: r.analysis == null ? null : analysis(r.analysis)};
        if (r.status === 'ok' && out.results[model].analysis === null) fail('Missing successful analysis');
        if (r.error !== undefined) out.results[model].error = string(r.error, 2000, 'model error', true);
      }
      if (!KINDS.has(raw.article.inputKind) || !/^[a-f0-9]{64}$/.test(raw.article.sha256)) fail('Invalid result source');
      out.article = {url: cleanUrl(raw.article.url), title: string(raw.article.title, 500, 'source title'), inputKind: raw.article.inputKind, sha256: raw.article.sha256};
      out.cached = raw.cached;
      out.createdAt = string(raw.createdAt, 40, 'creation time');
      if (!Number.isFinite(Date.parse(out.createdAt))) fail('Invalid creation time');
    }
    return out;
  }
  function verifyResultBinding(message, article, sha256, models) {
    if (message.type !== 'result' || message.article.url !== article.url || message.article.inputKind !== article.inputKind || message.article.sha256 !== sha256) fail('Native result does not match the submitted article');
    if (JSON.stringify(message.requestedModels) !== JSON.stringify(normalizeModels(models))) fail('Native result model selection mismatch');
    return true;
  }
  globalThis.AI8NewsCore = Object.freeze({MAX_TEXT_CHARS, normalizeArticle, normalizeModels, normalizeSourceInfo, normalizeNativeMessage, verifyResultBinding, isGroundUrl, isGroundArticleUrl, isOwnedNewsUrl, truncateText, requestId});
})();
