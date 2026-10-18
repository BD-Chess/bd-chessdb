// Run the accepted, maintained browser scenarios against the promoted CURRENT
// source. Keep both staged channels for the authoritative PWA generator. These
// are disposable headless Chromium profiles, never BD's personal browser.
'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const repo=path.resolve(__dirname,'..');
for(const name of ['full-game-resume-browser.cjs','p3-active-analysis-browser.cjs','p4-gui-browser.cjs']){
  const source=path.join(repo,'public/chess-lab/research',name);
  const filename=path.join(repo,'public/chess/research',name);
  let code=fs.readFileSync(source,'utf8')
    .replaceAll('/chess-lab/','/chess/')
    .replaceAll('chess-lab/js/','chess/js/')
    .replaceAll('ChessBest:LAB:','ChessBest:CURRENT:');
  code=code.replaceAll("test('","test('CURRENT target · ");
  // The shorter CURRENT header changes smooth-scroll timing. Observe the
  // final hit-testable navigation position without scrolling it in the test.
  if(name==='p4-gui-browser.cjs')code=code.replace(
    "const reachable=await nav.evaluate(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&!!at&&(at===e||e.contains(at));});",
    "const reachable=await nav.evaluate(async e=>{for(let frame=0;frame<90;frame++){const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.top>=0&&r.bottom<=innerHeight&&!!at&&(at===e||e.contains(at)))return true;await new Promise(requestAnimationFrame);}return false;});");
  const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
  m._compile(code,filename);
}
