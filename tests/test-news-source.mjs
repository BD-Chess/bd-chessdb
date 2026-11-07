import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {gzipSync, deflateSync, brotliCompressSync} from 'node:zlib';
import {extractArticle, publicAddress, sourceUrl, resolvePublic, loadSource, pinnedRequest} from '../functions/lib/news-source.mjs';
import handler, {config, createNewsSourceHandler, createWarmThrottle} from '../functions/news-source.mjs';

const paragraph = 'A public report describes a new community library, its funding, public access and questions still awaiting an answer. '.repeat(8);
const html = `<html><head><title>Library report</title></head><body><nav>Navigation and account menus</nav><main><article><h1>Library report</h1><p>${paragraph}</p><p>${paragraph}</p></article></main><footer>Footer menu</footer></body></html>`;
const publicDns = async () => [{address: '93.184.216.34', family: 4}];
const code = expected => error => error?.code === expected;

test('only public IPv4 and ordinary global IPv6 addresses are accepted', () => {
  for (const address of ['0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '100.127.255.254', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '192.0.0.9', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.19.1.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fc00::1', 'fe80::1', 'fec0::1', 'ff02::1', '64:ff9b::7f00:1', '2001::1', '2001:2::1', '2001:20::1', '2001:0db8::1', '2002:7f00:1::1', '3fff::1', 'not-an-ip']) {
    assert.equal(publicAddress(address), false, address);
  }
  for (const address of ['93.184.216.34', '8.8.8.8', '100.128.0.1', '172.32.0.1', '2001:4860:4860::8888', '2606:4700:4700::1111', '2a00:1450:4001::1']) {
    assert.equal(publicAddress(address), true, address);
  }
});

test('URL validation rejects alternative private IP spelling, credentials and special ports', () => {
  for (const value of ['file:///etc/passwd', 'data:text/html,test', 'javascript:alert(1)', 'https://user:secret@example.org/', 'https://example.org:8443/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://[::1]/', 'http://[::ffff:7f00:1]/', 'https://metadata.google.internal/', 'https://localhost/', 'https://service.local/', 'https://example.org./', 'https://example.org/\nsecret']) {
    assert.throws(() => sourceUrl(value), undefined, value);
  }
  assert.equal(sourceUrl('https://example.org:443/story#part').href, 'https://example.org/story');
});

test('DNS validation rejects mixed public/private answers and excessive answers', async () => {
  const signal = new AbortController().signal;
  const url = sourceUrl('https://example.org/story');
  for (const rows of [[], [{address: '127.0.0.1', family: 4}], [{address: '93.184.216.34', family: 4}, {address: '::1', family: 6}], Array.from({length: 33}, () => ({address: '8.8.8.8', family: 4}))]) {
    await assert.rejects(resolvePublic(url, signal, async () => rows), code('NON_PUBLIC_URL'));
  }
  let calls = 0;
  const entries = await resolvePublic(sourceUrl('https://8.8.8.8/'), signal, async () => { calls++; });
  assert.equal(calls, 0);
  assert.deepEqual(entries, [{address: '8.8.8.8', family: 4}]);
});

test('loadSource revalidates redirects and never calls request on private DNS', async () => {
  const requested = [], resolved = [];
  const article = await loadSource('https://example.org/start#fragment', {
    resolver: async hostname => { resolved.push(hostname); return publicDns(); },
    request: async (url, addresses) => {
      requested.push({url: url.href, addresses});
      return requested.length === 1 ? {status: 302, location: 'https://publisher.example.org/story'} : {status: 200, type: 'text/html', text: html};
    },
  });
  assert.deepEqual(resolved, ['example.org', 'publisher.example.org']);
  assert.equal(article.url, 'https://publisher.example.org/story');
  assert.equal(article.inputKind, 'article');
  assert.ok(requested.every(row => row.addresses[0].address === '93.184.216.34'));
  let calls = 0;
  await assert.rejects(loadSource('https://example.org/', {
    resolver: async hostname => hostname === 'example.org' ? publicDns() : [{address: '10.0.0.1', family: 4}],
    request: async () => { calls++; return {status: 302, location: 'https://changed.example.org/'}; },
  }), code('NON_PUBLIC_URL'));
  assert.equal(calls, 1);
});

test('redirect target scheme, credentials, private literals and chain length are bounded', async () => {
  for (const [location, expected] of [['http://example.org/insecure', 'UNSAFE_REDIRECT'], ['https://u:p@example.org/', 'INVALID_URL'], ['https://127.0.0.1/', 'NON_PUBLIC_URL'], ['file:///etc/passwd', 'INVALID_URL']]) {
    let calls = 0;
    await assert.rejects(loadSource('https://example.org/', {resolver: publicDns, request: async () => { calls++; return {status: 302, location}; }}), code(expected));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(loadSource('https://example.org/', {resolver: publicDns, request: async () => ({status: 302, location: `/hop-${++calls}`})}), code('REDIRECT_LIMIT'));
  assert.equal(calls, 4);
});

test('DNS and request timeouts use the same finite budget and errors omit underlying details', async () => {
  await assert.rejects(loadSource('https://example.org/', {resolver: async () => new Promise(() => {}), timeout: 15}), code('SOURCE_TIMEOUT'));
  let signal;
  await assert.rejects(loadSource('https://example.org/', {resolver: publicDns, request: async (_url, _addresses, value) => { signal = value; return new Promise(() => {}); }, timeout: 15}), code('SOURCE_TIMEOUT'));
  assert.equal(signal.aborted, true);
  await assert.rejects(loadSource('https://example.org/', {resolver: async () => { throw new Error('PRIVATE DNS CREDENTIAL secret'); }}), error => error.code === 'SOURCE_UNAVAILABLE' && !error.message.includes('secret'));
});

async function fakeHttp({body = Buffer.from(html), headers = {}, status = 200, failure, inspect, lifecycle}, run) {
  const originals = [http.request, https.request];
  const replacement = (url, options, callback) => {
    inspect?.(url, options);
    const req = new EventEmitter();
    req.end = () => queueMicrotask(() => {
      if (failure) { req.emit('error', new Error(failure)); return; }
      if (lifecycle === 'request-close') { req.emit('close'); return; }
      if (lifecycle) {
        const response = new Readable({read() {}});
        Object.assign(response, {statusCode: status, headers: {'content-type': 'text/html; charset=utf-8', ...headers}});
        callback(response);
        response.push(Buffer.from('<html><title>Partial</title><body>'));
        queueMicrotask(() => {
          if (lifecycle === 'aborted') response.emit('aborted');
          else if (lifecycle === 'close') response.destroy();
        });
        return;
      }
      const response = Readable.from(Array.isArray(body) ? body : [body]);
      Object.assign(response, {statusCode: status, headers: {'content-type': 'text/html; charset=utf-8', ...headers}});
      callback(response);
    });
    return req;
  };
  http.request = https.request = replacement;
  try { return await run(); } finally { [http.request, https.request] = originals; }
}

test('native HTTP options pin validated DNS and send no user authorization or cookies', async () => {
  let inspected = false;
  await fakeHttp({inspect(url, options) {
    inspected = true;
    assert.equal(url.hostname, 'example.org');
    assert.equal(options.agent, false);
    assert.equal(options.headers['Accept-Encoding'], 'identity');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Accept-Encoding', 'User-Agent']);
    const addresses = [{address: '93.184.216.34', family: 4}];
    options.lookup('example.org', {}, (error, address, family) => { assert.equal(error, null); assert.equal(address, addresses[0].address); assert.equal(family, 4); });
    options.lookup('example.org', {all: true}, (error, all) => { assert.equal(error, null); assert.deepEqual(all, addresses); });
  }}, async () => {
    const result = await pinnedRequest(sourceUrl('https://example.org/'), [{address: '93.184.216.34', family: 4}], new AbortController().signal);
    assert.equal(result.text, html);
  });
  assert.equal(inspected, true);
});

test('HTTP reader rejects status, nontext, declared and streamed oversized bodies', async () => {
  const cases = [
    [{status: 403}, 'SOURCE_HTTP_ERROR'],
    [{headers: {'content-type': 'application/pdf'}}, 'UNSUPPORTED_CONTENT'],
    [{headers: {'content-length': '2000001'}}, 'SOURCE_TOO_LARGE'],
    [{body: [Buffer.alloc(1_000_001), Buffer.alloc(1_000_001)]}, 'SOURCE_TOO_LARGE'],
    [{headers: {'content-encoding': 'unknown'}}, 'UNSUPPORTED_ENCODING'],
    [{failure: 'PRIVATE UPSTREAM SECRET'}, 'SOURCE_UNAVAILABLE'],
  ];
  for (const [fixture, expected] of cases) {
    await fakeHttp(fixture, async () => assert.rejects(pinnedRequest(sourceUrl('https://example.org/'), [{address: '8.8.8.8', family: 4}], new AbortController().signal), code(expected)));
  }
});

test('gzip, deflate and Brotli decode correctly while expanded payloads remain bounded', async () => {
  for (const [encoding, compress] of [['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]]) {
    await fakeHttp({body: compress(Buffer.from(html)), headers: {'content-encoding': encoding}}, async () => {
      const result = await pinnedRequest(sourceUrl('https://example.org/'), [{address: '8.8.8.8', family: 4}], new AbortController().signal);
      assert.equal(result.text, html);
    });
  }
  await fakeHttp({body: gzipSync(Buffer.alloc(2_000_001, 65)), headers: {'content-encoding': 'gzip'}}, async () => assert.rejects(pinnedRequest(sourceUrl('https://example.org/'), [{address: '8.8.8.8', family: 4}], new AbortController().signal), code('SOURCE_TOO_LARGE')));
  await fakeHttp({body: Buffer.from('not valid gzip'), headers: {'content-encoding': 'gzip'}}, async () => assert.rejects(pinnedRequest(sourceUrl('https://example.org/'), [{address: '8.8.8.8', family: 4}], new AbortController().signal), code('SOURCE_UNREADABLE')));
});

test('aborted or prematurely closed HTTP streams reject promptly instead of waiting for the global timeout', async () => {
  for (const lifecycle of ['aborted', 'close', 'request-close']) {
    for (const encoding of lifecycle === 'request-close' ? ['identity'] : ['identity', 'gzip']) {
      await fakeHttp({lifecycle, headers: {'content-encoding': encoding}}, async () => {
        let deadline;
        try {
          const pending = pinnedRequest(sourceUrl('https://example.org/'), [{address: '8.8.8.8', family: 4}], new AbortController().signal);
          await assert.rejects(Promise.race([pending, new Promise((_, reject) => {
            deadline = setTimeout(() => reject(new Error('The HTTP reader did not settle after premature close')), 200);
          })]), code('SOURCE_UNAVAILABLE'));
        } finally { clearTimeout(deadline); }
      });
    }
  }
});

function groundPage(summary, extra = '') {
  return `<html><title>Ground story</title><body><nav>Subscription and navigation</nav><main><article><div style="grid-area: header"><h1>Ground story</h1><div><div><ul class="list-disc"><li>${summary}</li></ul></div><div>Insights by Ground AI</div></div>${extra}</div><section id="article-summary"><ul class="list-disc"><li>Another UI summary that must be excluded</li></ul></section></article></main></body></html>`;
}

test('Ground extraction identifies its one summary and rejects ambiguous or ordinary UI lists', () => {
  const result = extractArticle(groundPage(paragraph), 'https://ground.news/article/story');
  assert.equal(result.inputKind, 'ground-summary');
  assert.equal(result.extraction.method, 'ground-public-summary');
  assert.equal(result.text, paragraph.trim());
  assert.ok(!result.text.includes('navigation'));
  const extra = `<div><div><ul class="list-disc"><li>${paragraph}Second distinct summary</li></ul></div><div>Insights by Ground AI</div></div>`;
  assert.throws(() => extractArticle(groundPage(paragraph, extra), 'https://ground.news/article/story'), code('SOURCE_REQUIRES_BROWSER'));
  assert.throws(() => extractArticle(`<html><title>Home</title><main><article><ul class="list-disc"><li>${paragraph}</li></ul></article></main></html>`, 'https://ground.news/'), code('SOURCE_REQUIRES_BROWSER'));
});

test('generic extraction drops scripts and navigation; markup stays inert plain text', () => {
  const malicious = html.replace('</article>', '<script>globalThis.__AI8_SOURCE_EXECUTED = true;</script><p>&lt;img src=x onerror=alert(1)&gt; Visible quotation.</p></article>');
  const result = extractArticle(malicious, 'https://example.org/story');
  assert.equal(result.title, 'Library report');
  assert.equal(result.inputKind, 'article');
  assert.ok(result.text.includes('community library'));
  assert.ok(!result.text.includes('Navigation and account'));
  assert.ok(!result.text.includes('globalThis'));
  assert.equal(globalThis.__AI8_SOURCE_EXECUTED, undefined);
  assert.ok(!result.text.includes('<p>'));
  assert.equal(result.extraction.scope, 'public-response-only');
});

test('paywall metadata, browser challenges, absent articles and size limits fail explicitly', () => {
  for (const metadata of [{'@type': 'NewsArticle', isAccessibleForFree: false}, {'@graph': [{'@type': 'Article', isAccessibleForFree: 'false'}]}]) {
    const page = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(metadata)}</script></head>`);
    assert.throws(() => extractArticle(page, 'https://example.org/story'), code('SOURCE_REQUIRES_SUBSCRIPTION'));
  }
  assert.throws(() => extractArticle('<html><head><title>Just a moment...</title></head><body><main>Waiting</main></body></html>', 'https://example.org/'), code('SOURCE_REQUIRES_BROWSER'));
  assert.throws(() => extractArticle('<html><title>Empty</title></html>', 'https://example.org/'), code('NO_ARTICLE'));
  assert.throws(() => extractArticle('x'.repeat(2_000_001), 'https://example.org/', 'text/plain'), code('SOURCE_TOO_LARGE'));
  const truncated = extractArticle('x'.repeat(59998) + '😀', 'https://example.org/', 'text/plain');
  assert.equal(truncated.extraction.truncated, true);
  assert.equal(truncated.text.length, 59998);
  assert.ok(!/[\ud800-\udbff]$/.test(truncated.text));
  const longTitle = 'x'.repeat(499) + '😀';
  const titled = extractArticle(groundPage(paragraph).replaceAll('Ground story', longTitle), 'https://ground.news/article/story');
  assert.equal(titled.title.length, 499);
  assert.ok(!/[\ud800-\udbff]$/.test(titled.title));
});

test('function rejects POST, foreign origins, duplicate URLs and private targets without CORS', async () => {
  const cases = [
    [new Request('https://www.mdlxdcc.org/api/news-source', {method: 'POST'}), 405],
    [new Request('https://www.mdlxdcc.org/api/news-source?url=https://example.org/', {headers: {Origin: 'https://evil.example'}}), 403],
    [new Request('https://www.mdlxdcc.org/api/news-source'), 400],
    [new Request('https://www.mdlxdcc.org/api/news-source?url=https://example.org/&url=https://example.net/'), 400],
    [new Request('https://www.mdlxdcc.org/api/news-source?url=http://127.0.0.1/', {headers: {Origin: 'https://www.mdlxdcc.org'}}), 400],
  ];
  for (const [request, status] of cases) {
    const response = await handler(request);
    assert.equal(response.status, status);
    assert.equal((await response.json()).ok, false);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
});

test('the URL loader exposes its route without adding a provider edge rule', () => {
  assert.equal(config.path, '/api/news-source');
  assert.equal(config.rateLimit, undefined);
});

test('warm-instance request budgets use trusted context IP, return 429, and recover after the window', async () => {
  let now = 0, calls = 0;
  const throttle = createWarmThrottle({now: () => now});
  const local = createNewsSourceHandler({throttle, load: async () => { calls++; return {title: 'Public story'}; }});
  const request = () => new Request('https://www.mdlxdcc.org/api/news-source?url=https://example.org/story',
    {headers: {'X-Forwarded-For': '9.9.9.9'}});
  for (let i = 0; i < 20; i++) assert.equal((await local(request(), {ip: '8.8.8.8'})).status, 200);
  const rejected = await local(request(), {ip: '8.8.8.8'});
  assert.equal(rejected.status, 429);
  assert.equal(rejected.headers.get('Retry-After'), '60');
  assert.equal((await rejected.json()).code, 'SOURCE_RATE_LIMIT');
  assert.equal(calls, 20);
  // A forged header cannot change the trusted client's bucket.
  const anotherHeader = new Request('https://www.mdlxdcc.org/api/news-source?url=https://example.org/story',
    {headers: {'X-Forwarded-For': '1.1.1.1'}});
  assert.equal((await local(anotherHeader, {ip: '8.8.8.8'})).status, 429);
  assert.equal((await local(request(), {ip: '1.1.1.1'})).status, 200);
  now = 60000;
  assert.equal((await local(request(), {ip: '8.8.8.8'})).status, 200);
});

test('warm-instance budget storage is pruned and capped, while absent context does not trust headers', async () => {
  let now = 0;
  const throttle = createWarmThrottle({now: () => now, capacity: 3});
  for (const ip of ['8.8.8.8', '1.1.1.1', '9.9.9.9', '4.2.2.2']) assert.equal(throttle.take(ip).allowed, true);
  assert.equal(throttle.size(), 3);
  now = 60000;
  assert.equal(throttle.take('8.8.8.8').allowed, true);
  assert.equal(throttle.size(), 1);
  assert.equal(throttle.take(undefined).allowed, true);
  assert.equal(throttle.take('not-an-ip').allowed, true);
  assert.equal(throttle.size(), 1);
  let received;
  const local = createNewsSourceHandler({load: async () => ({}), throttle: {take(ip) { received = ip; return {allowed: true}; }}});
  await local(new Request('https://www.mdlxdcc.org/api/news-source?url=https://example.org/story', {headers: {'X-Forwarded-For': '8.8.8.8'}}));
  assert.equal(received, undefined);
});
