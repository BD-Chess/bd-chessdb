// Promoted CURRENT in disposable Chromium contexts: /chess/ and domain-root overlay.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../public/chess');
test('CURRENT desktop, phone and APP omit channel links in SL/EN and both themes',{timeout:90000},async t=>{
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://fixture').pathname).replace(/^\/chess\//,'/'),p=path.resolve(root,'.'+rel+(rel.endsWith('/')?'index.html':''));
    if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'}).end(b);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
  const records=[],errors=[];
  for(const spec of [{name:'desktop',route:'/chess/',width:1440,height:1000},{name:'short-desktop',route:'/chess/',width:1280,height:520},{name:'phone',route:'/chess/',width:402,height:874,mobile:true},{name:'APP-preview',route:'/chess/?view=app',width:1440,height:1000,app:true},{name:'domain-root',route:'/',width:1280,height:900}]){
    const c=await browser.newContext({viewport:{width:spec.width,height:spec.height},serviceWorkers:'block',...(spec.mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'}:{})});
    await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
    await p.goto(origin+spec.route);await p.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessLabLayout);
    const app=spec.mobile||spec.app;
    for(const light of [false,true])for(const lang of ['en','sl']){
      await p.evaluate(v=>document.body.classList.toggle('light-theme',v),light);
      await p.locator((app?'.app-language':'.desktop-language')+' [data-app-lang="'+lang+'"]').click();
      await p.locator(app?'[data-app-tab="deep"]':'button[data-desktop-view="deep"]').click();
      const state=await p.evaluate(()=>({channel:document.body.dataset.channel,lang:document.documentElement.lang,
        selectors:document.querySelectorAll('.bd-version-selector,.app-channel-nav,.app-preview-nav,nav[aria-label="Application versions"]').length,
        links:[...document.querySelectorAll('a')].filter(a=>/^(CURRENT|PREVIOUS|LAB|APP)$/.test(a.textContent.trim())).length,
        title:document.querySelector('.deep-configuration>summary strong').textContent,collapsed:!document.querySelector('.deep-configuration').open,
        width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
        install:document.querySelector('#chessPwaInstall').textContent,namespace:window.ChessLabStorage.KEYS.game,
        source:document.querySelector('script[src*="8zc-utils"]').getAttribute('src'),board:document.querySelector('#board').getBoundingClientRect().toJSON()}));
      assert.equal(state.channel,'current');assert.equal(state.lang,lang);assert.equal(state.selectors,0);assert.equal(state.links,0);
      assert.equal(state.title,lang==='sl'?'Nastavitve analize':'Analysis settings');assert.equal(state.collapsed,true);
      assert.equal(state.namespace,'ChessBest:CURRENT:v2:game');assert.doesNotMatch(state.source,/chess-lab/);assert.doesNotMatch(state.install,/LAB/);
      assert(state.scrollWidth<=state.width+2,JSON.stringify(state));
      if(!app)assert(state.board.width>=200,JSON.stringify(state));
      const nav=await p.locator(app?'[data-app-tab="deep"]':'button[data-desktop-view="deep"]').boundingBox();assert(nav&&nav.height>=40);
      records.push({case:spec.name,light,lang,state,nav});
      if(app){await p.locator('[data-app-tab="board"]').click();assert((await p.locator('#board').boundingBox()).width>=200);}
    }
    const dir=process.env.CHESS_CURRENT_EVIDENCE_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,spec.name+'.png'),fullPage:false});}
    await c.close();
  }
  assert.deepEqual(errors,[]);
  const dir=process.env.CHESS_CURRENT_EVIDENCE_DIR;if(dir)fs.writeFileSync(path.join(dir,'surface.json'),JSON.stringify({records,errors,physicalDevice:false},null,2)+'\n');
});
