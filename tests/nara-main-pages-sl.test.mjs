import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nara = path.join(root, 'public/Nara');
const mainPages = ['index.html', 'nara.html', 'illuminara.html'];
// All four main episodes have Slovene editions.
const episodes = ['episode-01-ordinary-light.html', 'episode-02-the-answer-that-belonged-to-no-one.html',
  'episode-03-what-must-be-allowed-to-fall.html', 'illuminara-episode-01-let-me-leave-angry.html'];
const pages = [...mainPages, ...episodes];
const read = (name) => fs.readFileSync(path.join(nara, name), 'utf8');
const script = fs.readFileSync(path.join(nara, 'assets/js/nara-language.js'), 'utf8');

const PAIR = /<span data-language-content="en" lang="en">((?:(?!<\/span>)[\s\S])*?)<\/span><span data-language-content="sl" lang="sl" hidden>((?:(?!<\/span>)[\s\S])*?)<\/span>/g;
const LEAF = /<([a-z][a-z0-9]*)((?:\s[^>]*)?)>((?:(?!<(?!\/?(?:em|strong|br)\b))[\s\S])*?)<\/\1>/g;
// Text that is the same in both languages: names, episode codes, the brand and the text-size controls.
const SAME = new Set(['NARA', 'Nara', 'Illuminara', 'Nara 01', 'Nara 02', 'Nara 03', 'Illuminara 01', 'MDLxDCC.org',
  'A−', 'A+', 'A', '100%', '24', 'Nara Okafor', 'Silas Amaiu', 'Adaeze Okafor', '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12', 'Nara /Illuminara', 'Nara /', 'EN', 'SL', 'Tomas', 'Kila', 'Adaeze', 'Silas.', 'Kolu.', 'Alu', 'Ravi', 'Mere', 'Lani']);
const textOf = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

function body(html) {
  return html.slice(html.indexOf('<body>'), html.indexOf('</body>'))
    .replace(/<details class="reader-rating"[\s\S]*?<\/details>/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<div class="language-switch"[\s\S]*?<\/div>/, '')
    // The episode music button is labelled by its own script, in the page language.
    .replace(/<button[^>]*id="nara-audio-toggle"[\s\S]*?<\/button>/, '');
}

test('main pages carry the shared EN/SL switch, script and page metadata', () => {
  for (const name of pages) {
    const html = read(name);
    assert.equal((html.match(/data-language-switch/g) || []).length, 1, name + ': one switch');
    assert.match(html, /<div class="language-switch" data-language-switch role="group" aria-label="Language" data-aria-en="Language" data-aria-sl="Jezik" hidden>/, name);
    assert.match(html, /data-language="en" lang="en" aria-label="English" aria-pressed="true">EN</, name);
    assert.match(html, /data-language="sl" lang="sl" aria-label="Slovenščina" aria-pressed="false">SL</, name);
    const lang = html.indexOf('src="assets/js/nara-language.js"'), reader = html.indexOf('src="assets/js/nara-reader.js"');
    assert.ok(lang > 0 && reader > lang, name + ': language script loads before the reader script');
    assert.match(html, /<html lang="en" data-title-en="[^"]+" data-title-sl="[^"]+">/, name);
    assert.match(html, /name="description" data-description-en="[^"]+" data-description-sl="[^"]+"\/>/, name);
    assert.match(html, /nara-cinematic\.css\?v=main-sl-r1/, name);
  }
});

test('every English text on the main pages has a non-empty, different Slovene pair', () => {
  for (const name of pages) {
    const html = read(name);
    const pairs = [...html.matchAll(PAIR)];
    assert.ok(pairs.length > 80, name + ': bilingual pairs present');
    assert.equal((html.match(/data-language-content="sl"/g) || []).length, pairs.length, name + ': every SL span is paired');
    assert.equal((html.match(/data-language-content="en"/g) || []).length, pairs.length, name + ': every EN span is paired');
    for (const [, en, sl] of pairs) {
      assert.ok(textOf(sl), name + ': empty Slovene for ' + en);
      assert.notEqual(textOf(sl), textOf(en), name + ': untranslated ' + en);
    }
    // Remaining visible leaf text outside the pairs may only be language-neutral.
    const rest = body(html).replace(PAIR, '');
    const left = [...rest.matchAll(LEAF)].map((m) => textOf(m[3])).filter((t) => /\p{L}/u.test(t) && !SAME.has(t));
    assert.deepEqual(left, [], name + ': English text without a Slovene pair');
    // Strict: no text with letters may stay outside a pair, including text beside inline elements.
    const bare = [...rest.matchAll(/>([^<>]+)</g)].map((m) => textOf(m[1])).filter((t) => /\p{L}/u.test(t) && !SAME.has(t));
    assert.deepEqual(bare, [], name + ': text outside SL pairs');
    for (const tag of body(html).match(/<[a-z][^>]*\saria-label="[^"]*"[^>]*>/g) || []) {
      assert.match(tag, /data-aria-en="[^"]+" data-aria-sl="[^"]+"/, name + ': aria-label without SL ' + tag);
    }
    for (const tag of body(html).match(/<img\b[^>]*>/g) || []) {
      assert.match(tag, /data-alt-sl="[^"]+"/, name + ': image alt without SL ' + tag);
    }
    for (const tag of body(html).match(/<[a-z][^>]*\sdata-lightbox-caption="[^"]*"[^>]*>/g) || []) {
      assert.match(tag, /data-lightbox-caption-sl="[^"]+"/, name + ': lightbox caption without SL ' + tag);
    }
  }
});

test('the switch sits with the text-size tools and hidden language blocks stay hidden', () => {
  const css = fs.readFileSync(path.join(nara, 'assets/css/nara-cinematic.css'), 'utf8');
  assert.match(css, /\[data-language-content\]\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.topbar-tools \{[^}]*margin-left: auto;/);
  assert.match(css, /@media \(max-width: 780px\) \{[^@]*\.topbar-tools \{ display: contents; \}/);
  for (const name of pages) {
    assert.match(read(name), /<div class="topbar-tools">\n<div class="language-switch"[^\n]*\n<div aria-label="Reader text size controls"[^>]*class="reader-tools" role="group">[\s\S]*?<\/div>\n<\/div>\n<\/div>\n<div aria-hidden="true" class="reading-progress">/, name);
  }
});

function page({href = 'https://www.mdlxdcc.org/nara/', storage = {}, throwingStorage = false, withSwitch = true} = {}) {
  const store = new Map(Object.entries(storage));
  const el = (props = {}) => ({hidden: false, dataset: {}, attrs: {}, listeners: {},
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'href') this.href = v; },
    getAttribute(k) { return k === 'href' ? this.href : k === 'alt' ? this.alt : this.attrs[k]; },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    click() { for (const fn of this.listeners.click || []) fn(); },
    ...props});
  const en = el({dataset: {languageContent: 'en'}}), sl = el({dataset: {languageContent: 'sl'}, hidden: true});
  const aria = el({dataset: {ariaEn: 'Primary navigation', ariaSl: 'Glavna navigacija'}});
  const img = el({alt: 'Portrait of Nara', dataset: {altSl: 'Portret Nare'}});
  const links = Object.fromEntries(Object.entries({
    profile: 'nara.html', episode: 'episode-01-ordinary-light.html#scene-2', hash: '#wide-window-title', site: '../',
    daily: 'https://bd-chess.github.io/bd-chessdb/Nara/Nara-AI-daily.html', other: 'https://example.com/nara/x.html',
    asset: 'assets/img/shared/nara.webp', pretty: '/nara/illuminara',
  }).map(([k, v]) => [k, el({href: v})]));
  const buttons = ['en', 'sl'].map((language) => el({dataset: {language}}));
  const switcher = el({hidden: true, querySelectorAll: () => buttons});
  const meta = el({content: 'EN description', dataset: {descriptionEn: 'EN description', descriptionSl: 'SL opis'}});
  const caption = el({dataset: {lightboxCaption: 'A yellow boot.', lightboxCaptionSl: 'Rumen škorenj.'}});
  const events = [];
  const rootEl = {lang: 'en', dataset: {titleEn: 'EN title', titleSl: 'SL naslov'}};
  const document = {
    documentElement: rootEl, title: 'EN title', dispatchEvent: (event) => events.push(event),
    querySelector: (s) => s === '[data-language-switch]' ? (withSwitch ? switcher : null) : s.startsWith('meta[name="description"]') ? meta : null,
    querySelectorAll: (s) => ({'[data-language-content]': [en, sl], '[data-aria-en]': [aria], 'img[data-alt-sl]': [img],
      '[data-lightbox-caption-sl]': [caption], 'a[href]': Object.values(links)})[s] || [],
  };
  const url = new URL(href);
  const replaced = [];
  const localStorage = {
    getItem(k) { if (throwingStorage) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (throwingStorage) throw new Error('blocked'); store.set(k, String(v)); },
  };
  const context = {document, location: url, localStorage, URL, URLSearchParams, CustomEvent,
    history: {state: null, replaceState: (_s, _t, u) => replaced.push(u)}};
  vm.runInNewContext(script, context);
  return {document, rootEl, en, sl, aria, img, links, buttons, switcher, meta, store, replaced, caption, events};
}

test('English is the default, the switch appears and the choice is stored', () => {
  const p = page();
  assert.equal(p.switcher.hidden, false);
  assert.equal(p.rootEl.lang, 'en');
  assert.equal(p.en.hidden, false);
  assert.equal(p.sl.hidden, true);
  assert.equal(p.store.get('nara-daily-lang'), 'en');
  assert.equal(p.buttons[0].attrs['aria-pressed'], 'true');
});

test('a Slovene choice made on Illuminara Daily carries over to the main pages', () => {
  const p = page({storage: {'nara-daily-lang': 'sl'}});
  assert.equal(p.rootEl.lang, 'sl');
  assert.equal(p.en.hidden, true);
  assert.equal(p.sl.hidden, false);
  assert.equal(p.document.title, 'SL naslov');
  assert.equal(p.meta.content, 'SL opis');
  assert.equal(p.aria.attrs['aria-label'], 'Glavna navigacija');
  assert.equal(p.img.alt, 'Portret Nare');
  assert.equal(p.buttons[1].attrs['aria-pressed'], 'true');
  assert.equal(p.links.profile.href, '/nara/nara.html?lang=sl');
  assert.equal(p.links.episode.href, '/nara/episode-01-ordinary-light.html?lang=sl#scene-2');
  assert.equal(p.links.pretty.href, '/nara/illuminara?lang=sl');
  assert.equal(p.links.daily.href, 'https://bd-chess.github.io/bd-chessdb/Nara/Nara-AI-daily.html?lang=sl');
  for (const k of ['hash', 'site', 'other', 'asset']) assert.equal(p.links[k].href, {hash: '#wide-window-title', site: '../',
    other: 'https://example.com/nara/x.html', asset: 'assets/img/shared/nara.webp'}[k], k + ' stays unchanged');
  assert.equal(page({storage: {'nara-daily-language': 'sl'}}).rootEl.lang, 'sl', 'legacy key is honoured');
});

test('?lang= opens a page directly in a language and overrides the stored choice', () => {
  const sl = page({href: 'https://bd-chess.github.io/bd-chessdb/Nara/illuminara.html?lang=sl'});
  assert.equal(sl.rootEl.lang, 'sl');
  assert.equal(sl.store.get('nara-daily-lang'), 'sl');
  assert.equal(sl.links.profile.href, '/bd-chessdb/Nara/nara.html?lang=sl');
  const en = page({href: 'https://www.mdlxdcc.org/nara/?lang=en', storage: {'nara-daily-lang': 'sl'}});
  assert.equal(en.rootEl.lang, 'en');
  assert.equal(en.store.get('nara-daily-lang'), 'en');
  assert.equal(page({href: 'https://www.mdlxdcc.org/nara/?lang=de', storage: {'nara-daily-lang': 'sl'}}).rootEl.lang, 'sl');
});

test('clicking SL switches, remembers and puts the language in the address', () => {
  const p = page();
  p.buttons[1].click();
  assert.equal(p.rootEl.lang, 'sl');
  assert.equal(p.sl.hidden, false);
  assert.equal(p.store.get('nara-daily-lang'), 'sl');
  assert.equal(p.store.get('nara-daily-language'), 'sl');
  assert.deepEqual(p.replaced, ['/nara/?lang=sl']);
  p.buttons[0].click();
  assert.equal(p.rootEl.lang, 'en');
  assert.equal(p.links.profile.href, '/nara/nara.html?lang=en');
});

test('blocked storage and pages without a switch fail safe', () => {
  const p = page({throwingStorage: true});
  assert.equal(p.rootEl.lang, 'en');
  p.buttons[1].click();
  assert.equal(p.rootEl.lang, 'sl');
  const none = page({withSwitch: false, storage: {'nara-daily-lang': 'sl'}});
  assert.equal(none.rootEl.lang, 'en');
  assert.equal(none.sl.hidden, true);
});

test('episode lightbox captions follow the language and page scripts hear the switch', () => {
  const p = page({storage: {'nara-daily-lang': 'sl'}});
  assert.equal(p.caption.dataset.lightboxCaption, 'Rumen škorenj.');
  assert.equal(p.events.at(-1).type, 'nara:language');
  assert.equal(p.events.at(-1).detail.language, 'sl');
  p.buttons[0].click();
  assert.equal(p.caption.dataset.lightboxCaption, 'A yellow boot.');
  assert.equal(p.events.at(-1).detail.language, 'en');
});
