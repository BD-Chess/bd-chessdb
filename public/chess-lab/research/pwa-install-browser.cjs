// Real Chromium manifest/icon/SW checks; root shell content and install events are controlled fixtures.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../../public'),records=[];
let browser,server,origin;
const parentHTML='<!doctype html><title>Controlled parent PWA fixture</title><link rel="manifest" href="manifest.webmanifest"><script>navigator.serviceWorker.register("sw.js",{scope:"./"}).then(()=>navigator.serviceWorker.ready).then(()=>window.parentReady=true)</script>';
test.before(async()=>{
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.ico':'image/x-icon'};
  server=http.createServer((req,res)=>{
    let rel=new URL(req.url,'http://localhost').pathname.replace(/^\/bd-chessdb(?=\/)/,'');
    if(rel==='/'||rel==='/index.html')return res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'}).end(parentHTML);
    const file=path.resolve(root,'.'+rel+(rel.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    fs.readFile(file,(err,bytes)=>{
      // The parent root worker precaches its shell. Only the parent shell's
      // unrelated media/CSS are stubs; LAB files must always exist as shipped.
      if(err){if(rel.startsWith('/assets/')||rel.startsWith('/PWA/')||rel==='/pwa-release.json')return res.writeHead(200,{'content-type':'text/plain'}).end('controlled parent shell fixture');return res.writeHead(404).end();}
      res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);
    });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHESS_BROWSER_EXECUTABLE||undefined});
});
test.after(async()=>{
  const dir=path.join(process.env.CHESS_RESUME_EVIDENCE_DIR||os.tmpdir(),'pwa-install');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'identity-browser.json'),JSON.stringify({schema:'chessbest-pwa-install-browser/1',physicalWindowsEdge:false,parentShellFixtures:true,installEventsFixtures:true,records},null,2)+'\n');
  await browser?.close();await new Promise(r=>server?.close(r));
});
for(const prefix of ['/','/bd-chessdb/'])test('LAB keeps its install identity, icon and offline game under an existing parent worker at '+prefix,{timeout:65000},async t=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}});t.after(()=>context.close());
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({cdbEnabled:false,dccEnabled:false,theme:'dark'}));
    if(!localStorage.getItem('ChessBest:LAB:v2:game'))localStorage.setItem('ChessBest:LAB:v2:game','[Event "PWA retained fixture"]\n[White "Saved White"]\n\n1. d4 d5 2. c4 *');
  });
  await page.goto(origin+prefix);await page.waitForFunction(()=>window.parentReady&&navigator.serviceWorker.controller);
  const parentController=await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL);
  await page.goto(origin+prefix+'chess-lab/');
  await page.waitForFunction(()=>window.ChessLabHost&&navigator.serviceWorker.controller?.scriptURL.endsWith('/chess-lab/engine-sw.js'),{},{timeout:40000});
  const cdp=await context.newCDPSession(page),app=await cdp.send('Page.getAppManifest');
  assert.equal(app.url,origin+prefix+'chess-lab/manifest.webmanifest');assert.deepEqual(app.errors,[]);
  const manifest=JSON.parse(app.data),identity=new URL(manifest.id,app.url).href;
  assert.equal(manifest.name,'ChessBest LAB');assert.equal(identity,origin+prefix+'chess-lab/');
  assert.equal(new URL(manifest.scope,app.url).href,identity);assert.equal(new URL(manifest.start_url,app.url).href,identity);
  assert.notEqual(identity,origin+prefix,'parent and LAB have distinct manifest IDs');
  const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
  const icons=await page.evaluate(async()=>{
    const out=[];for(const e of document.querySelectorAll('link[rel="icon"]')){const image=new Image();image.src=e.href;await image.decode();out.push({url:e.href,width:image.naturalWidth,height:image.naturalHeight});}return out;
  });
  assert.equal(icons.length,3);assert.deepEqual(icons.map(x=>x.width),[256,192,512]);
  assert(icons.some(x=>x.url.includes('/icons/ChessBest.ico?v=')),'the supplied ICO is the favicon');
  assert(manifest.icons.every(x=>x.src.includes('?v=')),'updated artwork refreshes cached launcher icons');
  const installIcon=page.locator('#chessPwaInstall img');await installIcon.evaluate(image=>image.decode());
  assert.equal(await installIcon.evaluate(image=>image.naturalWidth),192);
  const brandIcon=page.locator('.brand-line .chessbest-brand-mark');await brandIcon.evaluate(image=>image.decode());
  assert.equal(await brandIcon.evaluate(image=>image.naturalWidth),192);
  assert(icons.every(x=>x.url.startsWith(identity+'icons/')),'no fallback to the root-site icon');
  for(const language of ['en','sl'])for(const light of [false,true]){
    await page.evaluate(({language,light})=>{window.ChessLanguage.apply(language,false);document.body.classList.toggle('light-theme',light);},{language,light});
    assert.equal(await page.locator('#chessPwaInstall span').innerText(),language==='sl'?'Namesti LAB':'Install LAB');
    assert.equal((await page.locator('.sf-full-toggle').innerText()).trim(),language==='sl'?'SF':'SF Full');
    assert.equal(await page.locator('#analysisSource option[value="sf-full"]').textContent(),language==='sl'?'SF':'SF Full');
    assert.equal(await page.locator('#analysisSource option[value="sf-full"]').getAttribute('value'),'sf-full');
    assert(await brandIcon.isVisible());
    assert(await installIcon.isVisible());
    const rect=await page.locator('#chessPwaInstall').boundingBox();
    assert(rect.x>=0&&rect.x+rect.width<=1280&&rect.y>=0,'install control remains in the page header');
  }
  for(const width of [375,402,430]){
    await page.setViewportSize({width,height:900});
    await page.waitForFunction(()=>document.body.classList.contains('app-mobile'));
    const logo=page.locator('.app-brand-icon');await logo.evaluate(image=>image.decode());
    assert(await logo.isVisible());const rect=await logo.boundingBox();
    assert(rect.width===26&&rect.x>=0&&rect.x+rect.width<=width,'phone header keeps the same logo visible');
  }
  await page.setViewportSize({width:1280,height:900});
  await page.waitForFunction(()=>!document.body.classList.contains('app-mobile'));
  const before=await page.evaluate(()=>window.ChessLabHost.getReviewGame());assert.match(before.sourcePGN,/PWA retained fixture/);
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  assert.equal(await page.locator('#chessPwaInstall').evaluate(e=>e.hidden),true);
  assert.equal(await page.locator('#chessPwaInstall').isVisible(),false);
  assert.equal(await page.locator('#appPwaInstall').evaluate(e=>e.hidden),true);
  assert.deepEqual(await page.evaluate(()=>window.ChessLabHost.getReviewGame()),before);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.ChessLabHost);
  const after=await page.evaluate(()=>window.ChessLabHost.getReviewGame());assert.deepEqual(after,before);
  const controller=await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL);assert.equal(controller,identity+'engine-sw.js');
  assert.equal(await page.evaluate(async()=>{const r=await fetch('icons/icon-192.png');return r.ok&&r.headers.get('content-type').includes('image/png');}),true);
  assert.deepEqual(errors,[]);
  records.push({prefix,identity,parentController,controller,manifestURL:app.url,installabilityErrors:install.installabilityErrors,icons,brandLogo:true,phoneWidths:[375,402,430],slFullLabel:'SF',offlineGameRetained:true,errors});
});
