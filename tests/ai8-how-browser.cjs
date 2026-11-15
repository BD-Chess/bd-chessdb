/* Run only in the existing GitHub browser job; never on the measurement host. */
'use strict';
if (!process.env.CI) throw new Error('CI_ONLY: do not launch browsers on HOME');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium, webkit} = require('playwright');
const PUBLIC = path.resolve(__dirname, '../public');
const evidence = process.env.AI8_HOW_EVIDENCE;
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    pathname = pathname.replace(/^\/ai8(?=\/|$)/i, '/AI8');
    let file = path.resolve(PUBLIC, '.' + pathname);
    if (!file.startsWith(PUBLIC + path.sep)) { response.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    response.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(body);
  } catch { response.writeHead(404).end(); }
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const report = {status:'RUNNING', cases:[], errors:[], outboundBlocked:[]};
  if (evidence) await fs.mkdir(evidence, {recursive:true});
  async function contextFor(browser, options = {}) {
    const context = await browser.newContext({viewport:{width:options.width || 1440,height:1000},reducedMotion:'reduce',javaScriptEnabled:options.javaScriptEnabled !== false});
    const state = {geo:0};
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { report.outboundBlocked.push(url.origin); await route.abort(); return; }
      if (url.pathname === '/.netlify/functions/entry-locale') {
        state.geo++;
        if (options.geoDelay) await wait(options.geoDelay);
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({language:options.countryLanguage || 'en'})}).catch(() => {});
      } else await route.continue();
    });
    context.on('page', page => page.on('pageerror', error => report.errors.push(error.message)));
    return {context,state};
  }
  async function assertLayout(page, expectedLang) {
    try {
    assert.equal(await page.locator('html').getAttribute('lang'), expectedLang);
    assert.equal(await page.locator('h1').count(), 1);
    const horizontal = await page.evaluate(() => ({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    assert(horizontal.document <= horizontal.viewport + 1, JSON.stringify(horizontal));
    assert.equal(await page.locator('.process-list > li').count(), 6);
    const bounds = await page.locator('.workflow-svg:visible').evaluate(svg => [...svg.querySelectorAll('[data-flow-step]')].flatMap(group => {
      const box = group.querySelector('rect').getBBox();
      return [...group.querySelectorAll('text')].filter(text => getComputedStyle(text).display !== 'none').map(text => {
        const b = text.getBBox();
        return {text:text.textContent,inside:b.x >= box.x - 1 && b.x+b.width <= box.x+box.width+1 && b.y >= box.y-1 && b.y+b.height <= box.y+box.height+1};
      });
    }));
    assert(bounds.every(item => item.inside), JSON.stringify(bounds.filter(item => !item.inside)));
    const controls = await page.locator('[data-ai8-toolbar] button:visible').evaluateAll(buttons => buttons.map(button => {const b=button.getBoundingClientRect();return {text:button.textContent.trim(),w:b.width,h:b.height};}));
    assert(controls.every(b => b.w >= 43 && b.h >= 43), JSON.stringify(controls));
    } catch (error) {
      if (evidence) await page.screenshot({path:path.join(evidence,`layout-failure-${page.viewportSize().width}-${expectedLang}.png`)}).catch(() => {});
      throw error;
    }
  }
  try {
    for (const [engine, type] of [['chromium',chromium],['webkit',webkit]]) {
      const browser = await type.launch();
      try {
        for (const width of [320,390,754,1440,3840]) {
          for (const lang of ['sl','en']) {
            const {context,state} = await contextFor(browser, {width});
            const page = await context.newPage();
            await page.goto(`${base}/ai8/how/?lang=${lang}`);
            assert.equal(state.geo, 0, 'explicit language does not use location');
            assert.equal(await page.title(), lang === 'sl' ? 'Kako dela BD × AI Lab' : 'How BD × AI Lab works');
            assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
            await assertLayout(page, lang);
            await page.locator('[data-ai8-theme=light]').click();
            assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
            await assertLayout(page, lang);
            await page.evaluate(() => {document.body.style.zoom='2';});
            await assertLayout(page, lang);
            if (evidence && [320,1440].includes(width)) await page.screenshot({path:path.join(evidence,`${engine}-${width}-${lang}-zoom200.png`)});
            await page.evaluate(() => {document.body.style.zoom='';document.documentElement.style.fontSize='200%';});
            await assertLayout(page, lang);
            await page.evaluate(() => {document.documentElement.style.fontSize='';});
            if (evidence && ((width === 320) || (width === 1440) || (width === 3840 && lang === 'sl'))) {
              await page.locator('[data-ai8-theme=dark]').click();
              await page.screenshot({path:path.join(evidence,`${engine}-${width}-${lang}.png`)});
              if (width === 320) await page.locator('.workflow-figure').screenshot({path:path.join(evidence,`${engine}-${width}-${lang}-workflow.png`)});
            }
            report.cases.push(`${engine}: ${width}px ${lang}, dark/light, 200% zoom/text, reduced motion, SVG bounds`);
            await context.close();
          }
        }
        // Delayed geography must never undo a manual choice made meanwhile.
        {
          const {context} = await contextFor(browser,{countryLanguage:'sl',geoDelay:350});
          const page = await context.newPage();
          await page.goto(`${base}/ai8/how/`, {waitUntil:'domcontentloaded'});
          await page.locator('[data-ai8-lang=en]').click();
          await wait(500);
          assert.equal(await page.locator('html').getAttribute('lang'),'en');
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mdlxdcc-locale-v1')).source),'manual');
          await page.locator('[data-ai8-up]').click();
          await page.locator('[data-ai8-theme=light]').click();
          await page.reload();
          assert.equal(await page.locator('[data-ai8-reset]').textContent(),'105%');
          assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
          assert.equal(await page.locator('html').getAttribute('lang'),'en');
          const second = await context.newPage();
          await second.goto(`${base}/ai8/how/`);
          await second.locator('[data-ai8-lang=sl]').click();
          await page.waitForFunction(() => document.documentElement.lang === 'sl');
          await page.goto(`${base}/ai8/how/?lang=en`);
          assert.equal(await page.locator('html').getAttribute('lang'),'en', 'query overrides saved language');
          await context.close();
        }
        // Location default, timeout fallback, keyboard and storage-denied operation.
        for (const blocked of [false,true]) {
          const {context,state} = await contextFor(browser,{countryLanguage:'sl'});
          if (blocked) await context.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new Error('storage denied');}}));
          const page = await context.newPage();
          await page.goto(`${base}/ai8/how/`);
          await page.waitForFunction(() => document.documentElement.lang === 'sl');
          assert.equal(state.geo,1);
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.className),'skip');
          await page.keyboard.press('Enter');
          assert.equal(new URL(page.url()).hash,'#content');
          await page.locator('[data-ai8-lang=en]').click();
          await page.locator('[data-ai8-theme=light]').click();
          await assertLayout(page,'en');
          await context.close();
        }
        {
          const {context} = await contextFor(browser,{countryLanguage:'sl',geoDelay:2500});
          const page = await context.newPage();
          await page.goto(`${base}/ai8/how/`);
          await wait(2600);
          assert.equal(await page.locator('html').getAttribute('lang'),'en', 'location timeout falls back to English');
          await context.close();
        }
        {
          const {context} = await contextFor(browser,{width:320,javaScriptEnabled:false});
          const page = await context.newPage();
          await page.goto(`${base}/ai8/how/`);
          assert.equal(await page.locator('.process-list > li').count(),6);
          assert(await page.locator('.process-list [data-lang=sl]').first().isVisible());
          assert(await page.locator('.process-list [data-lang=en]').first().isVisible());
          assert.equal(await page.locator('[data-ai8-toolbar]').isVisible(),false);
          await context.close();
        }
        report.cases.push(`${engine}: manual/saved/location precedence, late geography, persistence, storage sync/denial, keyboard, timeout and no-script reading`);
      } finally { await browser.close(); }
    }
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.outboundBlocked,[]);
    report.status='PASS';
    console.log(JSON.stringify(report,null,2));
  } catch (error) {
    report.status='FAIL';report.failure=error.stack;
    throw error;
  } finally {
    if (evidence) await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2));
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});
