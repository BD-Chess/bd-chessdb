import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(app,'../..');
const donor=JSON.parse(fs.readFileSync(path.join(app,'donor.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ledger=[];
function replace(text, pattern, replacement, expected, name) {
  const count=[...text.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))].length;
  if(count!==expected) throw Error(`Transform ${name}: expected ${expected}, found ${count}`);
  ledger.push({name,count}); return text.replace(pattern,replacement);
}
const output=new Map();
for(const [file,hash] of Object.entries(donor.assets_sha256)) {
  if(file.includes('..') || /(?:token|Lichess-API|\/old\/|\/new\/|\/PWA\/)/i.test(file)) throw Error('Disallowed donor path: '+file);
  const data=fs.readFileSync(path.join(repo,donor.root,file));
  if(sha(data)!==hash) throw Error('Pinned donor changed: '+file);
  output.set(file,data);
}
const release=fs.readFileSync(path.join(repo,donor.root,'release.json'));
if(sha(release)!==donor.release_sha256) throw Error('Donor release changed');
for(const [file,data] of output) {
  if(!/\.(js|html|css)$/.test(file) || file.startsWith('vendor/')) continue;
  let s=data.toString('utf8');
  if(file==='js/8zc-utils.js') {
    s=replace(s,/  \/\/ The LAB promotion kept CURRENT[\s\S]*?  if \(!ENABLE_COACH\)/,'  // Native storage has no web-channel migration.\n  if (!ENABLE_COACH)',1,'remove appearance migration');
    s=replace(s,/  const LICHESS_PUBLIC_TOKEN_URL = 'Lichess-API\.txt';/,'',1,'remove public token locator');
    s=replace(s,/  async function fetchPublicLichessToken\(\) \{[\s\S]*?  async function ensureAnthropicKey/,
      "  async function ensureLichessToken() { throw Error('Lichess is unavailable in this private native candidate. No token is requested or imported.'); }\n\n  async function ensureAnthropicKey",1,'remove public and manual token acquisition');
    s=replace(s,/  window\.ChessLabHost = labHost;/,`  window.ChessLabHost = labHost;
  window.ChessNativeHost = {
    async pause() {
      window.__CHESSBEST_BACKGROUND__ = true;
      annotationRequestId++;
      if (replayRunning) stopReplay(); else activityEpoch++;
      invalidateDCCAnalysis(); deepUI?.stop(); researchUI?.close();
      clearInterval(evalRetryTimer); evalRetryTimer = null;
      for (const controller of simRequests) controller.abort();
      if (playState.active) leaveActiveSession('Training stopped in background; game retained. Start training explicitly to continue.');
      workspace.pause();
      let saveError;
      try { persistGame(); tournamentRunner?.checkpoint(); } catch (error) { saveError = error; }
      if (tournamentRunner) await tournamentRunner.pause('App backgrounded; resume explicitly');
      simRunning = false; simAbort = true;
      setBoardThinking(false); refreshPlayUi();
      if (saveError) throw saveError;
      return { paused: true };
    }
  };`,1,'native lifecycle host');
    s=replace(s,/(async function startLichessSession\([^\n]*\) \{)/,
      "$1\n  updateSimStatus('Lichess is unavailable in this native candidate. Your game is unchanged.'); return;",1,'reject Lichess before workspace mutation');
    s=replace(s,/      onLichess\(\) \{ playState\.launchMode = 'sim';[\s\S]*?syncSimModalState\(\); \}/,
      "      // Lichess launch is unavailable; the tournament UI hides the absent callback.",1,'hide tournament Lichess launcher');
    s=replace(s,/(async function fetchAnnotations\([^)]*\)\s*\{)/,'$1\n    if (window.__CHESSBEST_BACKGROUND__) return;',1,'prevent background analysis');
    s=replace(s,/if \(unhurried\) simRequests\.add\(controller\);/,'simRequests.add(controller);',1,'abort all provider requests on background');
    s=replace(s,/\? '\/\.netlify\/functions\/queryall\?'/,"? 'https://www.chessdb.cn/cdb.php?action=queryall&'",1,'native CDB endpoint');
    // A proxy preference must not survive as a false provenance label.
    s=replace(s,/  settings\.sfAnalysisDepth = normalizeSFDepth\(settings\.sfAnalysisDepth\);/,
      "  settings.sfAnalysisDepth = normalizeSFDepth(settings.sfAnalysisDepth);\n  settings.evalMode = 'direct';",1,'force explicit CDB transport');
    s=replace(s,/settings\.evalMode = e\.target\.value === 'proxy' \? 'proxy' : 'direct'/,"settings.evalMode = 'direct'",1,'fix direct provider label');
  }
  if(file==='js/8zc-workspace.js') {
    s=replace(s,/function pause\(\) \{ T\.pause/, 'function pause() { reviewEpoch++; T.pause',1,'cancel queued local reviews on pause');
    s=replace(s,/setInterval\(render, 250\);/,'setInterval(() => { if (!document.hidden && !window.__CHESSBEST_BACKGROUND__) render(); }, 250);',1,'suspend background clock rendering');
  }
  if(file==='js/8zc-lab-layout.js') s=replace(s,/    \/\/ A saved CURRENT workspace[\s\S]*?    if \(elements \|\|/,'    // Native layout stays within the APP namespace.\n    if (elements ||',1,'remove layout migration');
  if(file==='js/8zc-gemini.js') s=replace(s,/    async function send\(text\) \{/,
    "    async function send(text) {\n      message('system','Gemini is unavailable in this private native candidate. No approved native backend is configured.'); return;",1,'disable paid assistant');
  if(file==='js/8zc-study-ui.js') s=replace(s,/host\.draftStorage \|\| root\.sessionStorage/,'host.draftStorage || root.localStorage',1,'retain unsaved native draft after process kill');
  s=s.replaceAll('ChessBest:CURRENT:v2:', 'ChessBest:APP:v1:');
  s=s.replaceAll('root.navigator?.locks','(root.ChessNativeLocks || root.navigator?.locks)');
  if(file.endsWith('.html')) {
    s=s.replace(/<link[^>]*rel="(?:manifest|canonical)"[^>]*>/g,'');
    s=s.replace(/<meta[^>]*(?:property="og:|name="twitter:)[^>]*>/g,'');
    s=s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
    // Donor references that leave the bundle open the website explicitly.
    s=s.replace(/href="(?:\.\.\/)+([^"#]*)"/g,'href="https://www.mdlxdcc.org/$1"');
  }
  if(file==='index.html') {
    s=replace(s,/<input type="radio" name="simOpponent" value="lichess">/,'<input type="radio" name="simOpponent" value="lichess" disabled>',1,'disable unavailable Lichess choice');
    s=replace(s,/<span>Lichess Bot<\/span>/,'<span>Lichess Bot · unavailable in APP</span>',1,'label unavailable Lichess');
    s=replace(s,/<option value="proxy">Proxy<\/option>/,'',1,'remove unavailable CDB proxy option');
    s=replace(s,/<nav class="bd-version-selector"[\s\S]*?<\/nav>/,'',1,'remove web channel navigation');
    s=replace(s,/<button id="chessPwaInstall"[\s\S]*?<\/button>/,'<button id="nativeInfo" type="button">APP info</button><button id="nativeBack" type="button">Back</button>',1,'native actions');
    s=replace(s,/<button id="chessPwaUpdate"[\s\S]*?<\/button>/,'',1,'remove web update');
    s=replace(s,/<script src="pwa.js"><\/script>/,'',1,'remove PWA runtime');
    s=replace(s,/<span class="brand-title">ChessBest.org<\/span>/,'<span class="brand-title">ChessBest</span>',1,'native brand');
    s=replace(s,/<head>/,'<head>\n  <script src="native.js"></script>',1,'early native bridge');
    s=s.replace('width=device-width, initial-scale=1','width=device-width, initial-scale=1, viewport-fit=cover');
    s=replace(s,/<\/head>/,'<link rel="stylesheet" href="native.css"></head>',1,'safe area CSS');
    s=replace(s,/<main id="main"/,'<p id="nativeStatus" role="status" aria-live="polite"></p>\n  <main id="main"',1,'native status');
    s=replace(s,/<\/body>/,fs.readFileSync(path.join(app,'src/dialogs.html'),'utf8')+'\n<script src="smoke.js"></script>\n</body>',1,'native privacy and diagnostic probe');
  }
  output.set(file,Buffer.from(s));
}
output.set('js/8zc-lab-storage.js',fs.readFileSync(path.join(app,'src/storage.js')));
output.set('native.css',fs.readFileSync(path.join(app,'src/native.css')));
output.set('smoke.js',fs.readFileSync(path.join(app,'src/smoke.js')));
const compiled=await build({entryPoints:[path.join(app,'src/native.js')],bundle:true,write:false,format:'iife',platform:'browser',target:['safari16'],legalComments:'inline'});
output.set('native.js',Buffer.from(compiled.outputFiles[0].contents));
const manifest={schema:'chessbest-native-assets/1',donor_commit:donor.commit,namespace:'ChessBest:APP:v1:',files:Object.fromEntries([...output].sort(([a],[b])=>a.localeCompare(b)).map(([f,b])=>[f,{sha256:sha(b),bytes:b.length}]))};
const encoded=JSON.stringify(manifest,null,2)+'\n';
const transforms=JSON.stringify({schema:'chessbest-native-transforms/1',donor_commit:donor.commit,transforms:ledger},null,2)+'\n';
const web=path.join(app,'web');
if(process.argv.includes('--verify')) {
  if(fs.readFileSync(path.join(app,'asset-manifest.json'),'utf8')!==encoded || fs.readFileSync(path.join(app,'transform-ledger.json'),'utf8')!==transforms) throw Error('Generated manifest differs');
  const walk=(dir,prefix='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);
  if(JSON.stringify(walk(web).sort())!==JSON.stringify([...output.keys()].sort())) throw Error('Generated closure has missing or extra assets');
  for(const [f,b] of output) if(!fs.readFileSync(path.join(web,f)).equals(b)) throw Error('Generated bytes differ: '+f);
  console.log('PASS: pinned donor, transforms and every generated byte');
} else {
  fs.rmSync(web,{recursive:true,force:true}); fs.mkdirSync(web,{recursive:true});
  for(const [f,b] of output) {fs.mkdirSync(path.dirname(path.join(web,f)),{recursive:true});fs.writeFileSync(path.join(web,f),b);}
  fs.writeFileSync(path.join(app,'asset-manifest.json'),encoded);fs.writeFileSync(path.join(app,'transform-ledger.json'),transforms);
  console.log(`Generated ${output.size} pinned native assets; manifest SHA-256 ${sha(encoded)}`);
}
