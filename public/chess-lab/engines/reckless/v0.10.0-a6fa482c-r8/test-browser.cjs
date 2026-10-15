/* Browser smoke for the public, independently hosted Reckless package.
 * Run: CHESSBEST_BASE_URL=http://127.0.0.1:8191/chess-lab/ node test-browser.cjs
 * Requires Playwright and Chromium only in the test environment.
 * SPDX-License-Identifier: AGPL-3.0-only
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async () => {
  const publicRoot=path.resolve(__dirname,'../../..');
  const server=process.env.CHESSBEST_BASE_URL?null:http.createServer((request,response)=>{
    const filename=path.resolve(publicRoot,'.'+new URL(request.url,'http://localhost').pathname);
    if(!filename.startsWith(publicRoot+path.sep)){response.writeHead(403);response.end();return;}
    fs.stat(filename,(error,stat)=>{
      if(error || !stat.isFile()){response.writeHead(404);response.end();return;}
      response.writeHead(200,{'Content-Type':/\.(?:m?js)$/.test(filename)?'text/javascript':'text/plain','Content-Length':stat.size});fs.createReadStream(filename).pipe(response);
    });
  });
  if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || chromium.executablePath(),args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    const base=process.env.CHESSBEST_BASE_URL || `http://127.0.0.1:${server.address().port}/chess-lab/`;
    await page.goto(base+'engines/reckless/v0.10.0-a6fa482c-r8/SOURCE.md');
    await page.addScriptTag({url:base+'js/chess.min.js'});
    const result = await page.evaluate(async base => {
      const {create} = await import(base+'engines/reckless/adapter.mjs');
      const e=create({Chess:window.Chess}); const events=[];
      const start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const black='rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const mate='7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';
      const init=performance.now(); await e.prepare(); const initializationMs=performance.now()-init;
      const white=await e.analyze({fen:start,movetime:150,multiPV:3,onInfo:(_,s)=>events.push(s)});
      const blackResult=await e.analyze({fen:black,depth:6,multiPV:2});
      const mateResult=await e.analyze({fen:mate,depth:5,multiPV:1});
      const combined=await e.analyze({fen:start,depth:80,movetime:120,multiPV:2});
      const depthFirst=await e.analyze({fen:start,depth:4,movetime:5000,multiPV:2});
      const before=performance.now(); const infinite=e.analyze({fen:start,infinite:true,multiPV:1});
      setTimeout(()=>e.stop(),100); const stopped=await infinite; const stopElapsedMs=performance.now()-before;
      const aborter=new AbortController(); const cancelled=e.analyze({fen:start,movetime:30000,signal:aborter.signal,multiPV:1});
      setTimeout(()=>aborter.abort(),20); let abortName;try{await cancelled}catch(error){abortName=error.name}
      e.destroy();return {initializationMs,white,black:blackResult,mate:mateResult,combined,depthFirst,events:events.length,stopped,stopElapsedMs,abortName};
    },base);
    assert.ok(result.events>0,'real engine must emit live search info');
    assert.match(result.white.bestMove,/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    assert.equal(result.white.lines.length,3);
    assert.ok(result.white.nodes>0);
    assert.ok(result.white.searchElapsedMs>=90 && result.white.searchElapsedMs<1500,'timed search must use its own warm search clock');
    assert.equal(result.black.lines[0].score.white,-result.black.lines[0].score.root,'Black score must invert for White');
    assert.equal(result.mate.lines[0].score.type,'mate');
    assert.equal(result.mate.lines[0].score.root,1);
    assert.equal(result.combined.stopReason,'time');
    assert.equal(result.combined.forcedStop,true);
    assert.equal(result.combined.partial,true);
    assert.ok(result.combined.searchElapsedMs>=100 && result.combined.searchElapsedMs<1500);
    assert.equal(result.depthFirst.stopReason,'depth');
    assert.equal(result.depthFirst.forcedStop,false);
    assert.equal(result.stopped.stopped,true);
    assert.equal(result.stopped.stopReason,'user');
    assert.ok(result.stopElapsedMs<1500,'stop must terminate a blocked worker promptly');
    assert.equal(result.abortName,'AbortError');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',...result},null,2));
  } finally { await browser.close();server?.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
