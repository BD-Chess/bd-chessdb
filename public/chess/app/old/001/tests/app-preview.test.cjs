const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(base, 'js/app-preview.js'), 'utf8');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
function setup(phone = false) {
  const dom = new JSDOM(html, { url: 'https://example.test/chess/app/', runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  if (phone) d.documentElement.classList.add('app-phone-browser');
  Object.defineProperty(w, 'innerHeight', { value: 1080, writable: true });
  const main = d.querySelector('main');
  main.getBoundingClientRect = () => ({ top: 76 });
  Object.defineProperty(main, 'clientWidth', { get: () => w.innerWidth });
  w.requestAnimationFrame = f => { f(); return 1; };
  const iframe = d.querySelector('iframe');
  iframe.contentDocument.open();
  iframe.contentDocument.write('<!doctype html><html><body class="app-mobile"></body></html>');
  iframe.contentDocument.close();
  w.eval(script);
  return { dom, w, d, iframe, stage: d.getElementById('previewStage'), frame: d.getElementById('phoneFrame'), select: d.getElementById('previewWidth') };
}
test('preview defaults to 402x874 and scales its shell without navigating or changing the phone viewport', () => {
  const x = setup();
  assert.equal(x.select.value, '402');
  for (const [width,height] of [[1280,720],[1920,1080],[3840,2160],[640,480]]) {
    x.w.innerWidth = width; x.w.innerHeight = height;
    x.w.dispatchEvent(new x.w.Event('resize'));
    assert.equal(x.stage.dataset.viewport, '402x874');
    assert.equal(x.frame.style.getPropertyValue('--phone-height'), '874px');
    assert(+x.stage.dataset.previewScale > 0 && +x.stage.dataset.previewScale <= 1);
    assert(parseFloat(x.stage.style.height) <= height - 76);
    assert.equal(x.w.location.pathname, '/chess/app/');
  }
  x.dom.window.close();
});
test('preview insets survive frame load and width changes, without modifying another channel', () => {
  const x = setup(); const root = x.iframe.contentDocument.documentElement;
  assert.equal(root.style.getPropertyValue('--app-preview-safe-top'), '52px');
  assert.equal(root.style.getPropertyValue('--app-preview-safe-bottom'), '34px');
  for (const width of ['375','390','402','430']) {
    x.select.value = width; x.select.dispatchEvent(new x.w.Event('change'));
    assert.equal(x.stage.dataset.viewport, width+'x'+Math.round(Number(width)*874/402));
  }
  root.style.removeProperty('--app-preview-safe-top');
  x.iframe.dispatchEvent(new x.w.Event('load'));
  assert.equal(root.style.getPropertyValue('--app-preview-safe-top'), '52px');
  x.iframe.contentDocument.body.classList.remove('app-mobile');
  root.style.removeProperty('--app-preview-safe-top');
  x.iframe.dispatchEvent(new x.w.Event('load'));
  assert.equal(root.style.getPropertyValue('--app-preview-safe-top'), '');
  x.dom.window.close();
});
test('normal phone browsers bypass preview size, safe-area simulation and scaling', () => {
  const x = setup(true);
  assert.equal(x.frame.style.transform, '');
  assert.equal(x.stage.dataset.viewport, undefined);
  assert.equal(x.iframe.contentDocument.documentElement.style.getPropertyValue('--app-preview-safe-top'), '');
  x.dom.window.close();
});
