import {lookup as resolveHost} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {isIP} from 'node:net';
import {createGunzip, createInflate, createBrotliDecompress} from 'node:zlib';
import {parseHTML} from 'linkedom';
import readability from '@mozilla/readability';

const MAX_HTML = 2_000_000;
const MAX_TEXT = 59999;
const TIMEOUT = 12000;
export class SourceError extends Error {
  constructor(code, message, status = 422) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new SourceError(code, message, status); };

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const n = address.split('.').map(Number);
    if ([0, 10, 127].includes(n[0]) || n[0] >= 224) return false;
    if (n[0] === 100 && n[1] >= 64 && n[1] <= 127) return false;
    if (n[0] === 169 && n[1] === 254 || n[0] === 172 && n[1] >= 16 && n[1] <= 31) return false;
    if (n[0] === 192 && (n[1] === 168 || n[1] === 0 && [0, 2].includes(n[2]) || n[1] === 88 && n[2] === 99)) return false;
    if (n[0] === 198 && ([18, 19].includes(n[1]) || n[1] === 51 && n[2] === 100)) return false;
    if (n[0] === 203 && n[1] === 0 && n[2] === 113) return false;
    return true;
  }
  if (isIP(address) !== 6 || address.includes('.')) return false;
  // Only ordinary global unicast. Excludes loopback, mapped IPv4, link-local,
  // ULA, multicast, NAT64 and special/documentation/transition allocations.
  const first = parseInt(address.split(':')[0], 16);
  const second = parseInt(address.split(':')[1] || '0', 16);
  if (!(first >= 0x2000 && first <= 0x3fff)) return false;
  if (first === 0x2001 && (second < 0x200 || second === 0xdb8) || first === 0x2002) return false;
  if (first === 0x3fff && second < 0x1000) return false;
  return true;
}

export function sourceUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u0020\u007f]/.test(value)) {
    fail('INVALID_URL', 'Vnesi veljavno spletno povezavo.', 400);
  }
  let url;
  try { url = new URL(value); } catch { fail('INVALID_URL', 'Povezave ni mogoče prebrati.', 400); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    fail('INVALID_URL', 'Dovoljena je spletna povezava brez prijavnih podatkov ali posebnih vrat.', 400);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname.endsWith('.') || /(?:^|\.)(?:localhost|local|internal|home|lan|onion|invalid|test)$/.test(hostname)) {
    fail('NON_PUBLIC_URL', 'Podprte so samo javne spletne strani.', 400);
  }
  if (isIP(hostname) && !publicAddress(hostname)) fail('NON_PUBLIC_URL', 'Podprte so samo javne spletne strani.', 400);
  url.hash = '';
  return url;
}

function withSignal(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new SourceError('SOURCE_TIMEOUT', 'Vir se ni pravočasno odzval.', 504));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, {once: true});
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function resolvePublic(url, signal, resolver = resolveHost) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const entries = isIP(hostname) ? [{address: hostname, family: isIP(hostname)}]
    : await withSignal(resolver(hostname, {all: true, verbatim: true}), signal);
  if (!entries.length || entries.length > 32 || entries.some(x => !publicAddress(x.address))) {
    fail('NON_PUBLIC_URL', 'Vir ni dosegljiv kot javna spletna stran.', 400);
  }
  return entries;
}

export function pinnedRequest(url, addresses, signal) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    let responseStarted = false;
    const req = transport.request(url, {
      method: 'GET', signal, agent: false,
      headers: {'User-Agent': 'AI8-News-Reader/0.2 (+https://www.mdlxdcc.org/news/)',
        Accept: 'text/html,text/plain;q=0.8', 'Accept-Encoding': 'identity'},
      // Pin the already-validated DNS answers to this connection. A second DNS
      // lookup cannot change an approved hostname into an internal address.
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
    }, response => {
      responseStarted = true;
      const status = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy(); resolve({status, location}); return;
      }
      if (status < 200 || status >= 300) {
        response.destroy(); reject(new SourceError('SOURCE_HTTP_ERROR', `Vir je vrnil odziv ${status}. Odpri ga v brskalniku.`, 422)); return;
      }
      const type = response.headers['content-type'] || '';
      if (!/^text\/(?:html|plain)(?:\s*;|$)/i.test(type)) {
        response.destroy(); reject(new SourceError('UNSUPPORTED_CONTENT', 'Povezava ne vodi do besedilne spletne strani.')); return;
      }
      if (Number(response.headers['content-length']) > MAX_HTML) {
        response.destroy(); reject(new SourceError('SOURCE_TOO_LARGE', 'Stran je prevelika za samodejen zajem. Izberi odlomek v brskalniku.')); return;
      }
      const encoding = (response.headers['content-encoding'] || 'identity').trim().toLowerCase();
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress()
        : encoding === 'deflate' ? createInflate() : null;
      if (!decoder && encoding !== 'identity') {
        response.destroy(); reject(new SourceError('UNSUPPORTED_ENCODING', 'Kodiranja strani ni mogoče prebrati.')); return;
      }
      let wireBytes = 0, bytes = 0, settled = false, wireEnded = false;
      const chunks = [];
      const stream = decoder ? response.pipe(decoder) : response;
      const stop = error => {
        if (settled) return;
        settled = true; response.destroy(); decoder?.destroy(); reject(error);
      };
      response.on('data', chunk => { wireBytes += chunk.length; if (wireBytes > MAX_HTML) stop(new SourceError('SOURCE_TOO_LARGE', 'Stran presega omejitev za zajem.')); });
      response.on('error', () => stop(new SourceError('SOURCE_UNAVAILABLE', 'Prenos strani je bil prekinjen.')));
      response.on('aborted', () => stop(new SourceError('SOURCE_UNAVAILABLE', 'Prenos strani je bil prekinjen.')));
      response.on('end', () => { wireEnded = true; });
      response.on('close', () => {
        // A complete compressed wire response may close before its decoder has
        // emitted end. A close before wire end must never accept partial text.
        if (!wireEnded) stop(new SourceError('SOURCE_UNAVAILABLE', 'Prenos strani je bil prekinjen.'));
      });
      stream.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX_HTML) stop(new SourceError('SOURCE_TOO_LARGE', 'Razširjena stran presega omejitev za zajem.'));
        else chunks.push(chunk);
      });
      stream.on('error', () => stop(new SourceError('SOURCE_UNREADABLE', 'Vsebine ni mogoče razbrati.')));
      if (decoder) decoder.on('close', () => {
        if (!settled) stop(new SourceError('SOURCE_UNREADABLE', 'Vsebine ni mogoče razbrati.'));
      });
      stream.on('end', () => {
        if (settled) return;
        settled = true;
        const charset = /charset\s*=\s*["']?([\w-]+)/i.exec(type)?.[1] || 'utf-8';
        let text;
        try { text = new TextDecoder(charset).decode(Buffer.concat(chunks)); }
        catch { text = Buffer.concat(chunks).toString('utf8'); }
        resolve({status, type, text});
      });
    });
    req.on('error', error => reject(signal.aborted
      ? new SourceError('SOURCE_TIMEOUT', 'Vir se ni pravočasno odzval.', 504)
      : new SourceError('SOURCE_UNAVAILABLE', 'Strani ni mogoče pridobiti. Odpri jo v brskalniku.')));
    req.on('close', () => {
      if (!responseStarted) reject(new SourceError('SOURCE_UNAVAILABLE', 'Prenos strani je bil prekinjen.'));
    });
    req.end();
  });
}

const plain = value => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
function boundedText(text, max = MAX_TEXT) {
  let result = text.slice(0, max);
  if (/[\ud800-\udbff]$/.test(result)) result = result.slice(0, -1);
  return result;
}
function blockText(root) {
  if (!root) return '';
  const chunks = [], stack = [{node: root}];
  const block = new Set(['P', 'LI', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'BR', 'BLOCKQUOTE']);
  while (stack.length) {
    const {node, close} = stack.pop();
    if (close) { chunks.push('\n'); continue; }
    if (node.nodeType === 3) chunks.push(node.textContent);
    else if (node.nodeType === 1) {
      if (block.has(node.tagName)) { chunks.push('\n'); stack.push({node, close: true}); }
      const children = [...node.childNodes];
      for (let i = children.length - 1; i >= 0; i--) stack.push({node: children[i]});
    }
  }
  return chunks.join('').split('\n').map(plain).filter(Boolean).join('\n\n');
}
function hasPaidArticle(document) {
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(node.textContent); } catch { continue; }
    const rows = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.['@graph']) ? data['@graph'] : [])];
    if (rows.some(row => row && /(?:NewsArticle|Article|Reportage)/.test(String(row['@type']))
      && (row.isAccessibleForFree === false || String(row.isAccessibleForFree).toLowerCase() === 'false'))) return true;
  }
  return false;
}

export function extractArticle(html, source, type = 'text/html') {
  const url = sourceUrl(source).href;
  if (Buffer.byteLength(html) > MAX_HTML) fail('SOURCE_TOO_LARGE', 'Stran presega omejitev za zajem.');
  if (/^text\/plain/i.test(type)) {
    const text = plain(html);
    if (text.length < 80) fail('NO_ARTICLE', 'Vir nima dovolj besedila za analizo.');
    return {url, title: new URL(url).hostname, text: boundedText(text), inputKind: 'article',
      capturedAt: new Date().toISOString(), extraction: {method: 'plain-text', truncated: text.length > MAX_TEXT, scope: 'public-response-only'}};
  }
  if ((html.match(/</g) || []).length > 45000) fail('SOURCE_TOO_COMPLEX', 'Stran je prezapletena za samodejen zajem.');
  const {document} = parseHTML(html);
  Object.defineProperty(document, 'documentURI', {value: url});
  Object.defineProperty(document, 'baseURI', {value: url});
  let title = plain(document.querySelector('h1')?.textContent
    || document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title);
  if (/^(?:just a moment|access denied|attention required|verify (?:you|your)|captcha)/i.test(title)) {
    fail('SOURCE_REQUIRES_BROWSER', 'Vir zahteva preverjanje ali prijavo. Odpri ga v brskalniku.');
  }
  if (hasPaidArticle(document)) fail('SOURCE_REQUIRES_SUBSCRIPTION', 'Vir označuje naročniški članek. Odpri ga s svojo prijavo in izberi dostopno besedilo.');
  for (const node of document.querySelectorAll('script,style,template,noscript,nav,footer,aside,form,button,iframe,svg,canvas,[hidden],[aria-hidden="true"]')) node.remove();
  for (const node of document.querySelectorAll('[style]')) {
    if (/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))(?:\s*!important)?\s*(?:;|$)/i.test(node.getAttribute('style'))) node.remove();
  }
  let text, method;
  if (new URL(url).hostname === 'ground.news') {
    const summaries = [];
    for (const list of document.querySelectorAll('main article ul.list-disc')) {
      if (list.closest('#article-summary')) continue;
      let header = list.parentElement;
      while (header && header.tagName !== 'ARTICLE' && !/(?:^|;)\s*grid-area\s*:\s*header\s*(?:;|$)/i.test(header.getAttribute('style') || '')) header = header.parentElement;
      if (!header || header.tagName === 'ARTICLE') continue;
      const textBlock = list.parentElement, box = textBlock?.parentElement;
      if (!box || ![...box.children].some(sibling => sibling !== textBlock && /\bInsights by Ground AI\b/.test(plain(sibling.textContent)))) continue;
      const items = [...list.children];
      if (!items.length || items.some(x => x.tagName !== 'LI')) continue;
      summaries.push(items.map(x => plain(x.textContent)).filter(Boolean).join('\n'));
    }
    const unique = [...new Set(summaries)].filter(Boolean);
    if (unique.length !== 1) fail('SOURCE_REQUIRES_BROWSER', 'Groundovega povzetka ni mogoče zanesljivo prepoznati. Izberi novico v okvirju z dodatkom AI8 view.');
    text = unique[0]; method = 'ground-public-summary';
  } else {
    let article;
    try { article = new readability.Readability(document.cloneNode(true), {maxElemsToParse: 40000, charThreshold: 120}).parse(); }
    catch { /* A semantic article can still be usable without scoring. */ }
    if (article?.content) {
      text = blockText(parseHTML('<html><body>' + article.content + '</body></html>').document.body);
      title = plain(article.title) || title; method = 'readability';
    }
    if (!text || text.length < 80) {
      text = blockText(document.querySelector('article') || document.querySelector('main'));
      method = 'semantic-article';
    }
  }
  if (!title || !text || text.length < 80) fail('NO_ARTICLE', 'Naslova ali besedila ni mogoče zanesljivo pridobiti. Odpri članek in izberi besedilo.');
  return {url, title: boundedText(title, 500), text: boundedText(text), inputKind: method === 'ground-public-summary' ? 'ground-summary' : 'article',
    capturedAt: new Date().toISOString(), extraction: {method, truncated: text.length > MAX_TEXT, scope: 'public-response-only'}};
}

export async function loadSource(value, {resolver = resolveHost, request = pinnedRequest, timeout = TIMEOUT} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let url = sourceUrl(value);
    for (let redirect = 0; redirect <= 3; redirect++) {
      const addresses = await resolvePublic(url, controller.signal, resolver);
      const result = await withSignal(request(url, addresses, controller.signal), controller.signal);
      if (result.location) {
        if (redirect === 3 || result.location.length > 4096) fail('REDIRECT_LIMIT', 'Vir ima preveč preusmeritev.');
        const next = sourceUrl(new URL(result.location, url).href);
        if (url.protocol === 'https:' && next.protocol !== 'https:') fail('UNSAFE_REDIRECT', 'Vir se preusmerja na nezaščiteno povezavo.');
        url = next; continue;
      }
      return extractArticle(result.text, url.href, result.type);
    }
    fail('REDIRECT_LIMIT', 'Vir ima preveč preusmeritev.');
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (controller.signal.aborted) fail('SOURCE_TIMEOUT', 'Vir se ni pravočasno odzval.', 504);
    fail('SOURCE_UNAVAILABLE', 'Vira ni mogoče prebrati. Odpri ga v brskalniku.');
  } finally { clearTimeout(timer); }
}
