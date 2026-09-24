import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const repo = path.resolve(app, '../..');
const spec = JSON.parse(await readFile(path.join(app, 'donor.json'), 'utf8'));
const donor = await readFile(path.join(repo, spec.donor));
const icon = await readFile(path.join(repo, spec.iconDonor));
const iconAsset = await readFile(path.join(app, 'assets/icon.png'));
const hash = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex');
const blob = bytes => hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1');
for (const [name, data, sha256, gitBlob] of [
  ['game', donor, spec.sha256, spec.gitBlob],
  ['icon', icon, spec.iconSha256, spec.iconGitBlob],
]) {
  if (hash(data, 'sha256') !== sha256 || blob(data) !== gitBlob) {
    throw Error(`${name} donor changed: inspect the diff and update donor.json intentionally`);
  }
}
if (!iconAsset.equals(icon)) throw Error('Tracked mobile icon differs from the recorded PWA donor. Regenerate and review native icon/splash assets.');
if (process.argv.includes('--verify-only')) {
  console.log('Donors match recorded SHA-256 and git blob identities.');
  process.exit(0);
}
let html = donor.toString('utf8');
function replaceOnce(oldValue, newValue) {
  if (html.split(oldValue).length !== 2) throw Error(`Expected exactly one donor occurrence: ${oldValue.slice(0, 95)}`);
  html = html.replace(oldValue, newValue);
}
replaceOnce('<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
replaceOnce('<title>8zSudoku — DCC Navigator 0.2.0 | BD × AI Lab</title>', '<title>8zSudoku</title>');
replaceOnce('<h2>BD <span>Sudoku</span></h2>', '<h2><span>8zSudoku</span></h2>');
replaceOnce('const avail=Math.min(w-40,h*0.5);return Math.max(30,Math.floor((avail-20)/9.5))',
  'const avail=Math.min(w-24,h*0.57);return Math.max(30,Math.floor((avail-18)/9.1))');
replaceOnce("for(let i=0;i<81;i++){const cell=document.createElement('div');cell.className='cell';cell.dataset.index=i;cell.addEventListener('click',ev=>selectCell(i,ai8InputSource(ev)));grid.appendChild(cell)}",
  "for(let i=0;i<81;i++){const cell=document.createElement('button');cell.type='button';cell.className='cell';cell.dataset.index=i;cell.addEventListener('click',ev=>selectCell(i,ai8InputSource(ev)));grid.appendChild(cell)}");
replaceOnce("    else cell.innerHTML='';\n  });",
  "    else cell.innerHTML='';\n    cell.setAttribute('aria-label',`Row ${r+1}, column ${c+1}, ${v?(isG?'given ':'')+v:notes[r][c].size?'notes '+[...notes[r][c]].sort((a,b)=>a-b).join(', '):'empty'}`);cell.setAttribute('aria-pressed',String(selectedCell===i));\n  });");
// Relative website links would resolve inside the app. Make a deliberate user tap open a browser.
html = html.replace(/href=(['"])(\.\.\/[^'"\s]+)\1/g, (_match, quote, relative) => {
  const url = new URL(relative, 'https://bd-chess.github.io/bd-chessdb/S/new/');
  return `href=${quote}${url.href}${quote} target="_blank" rel="noopener noreferrer"`;
});
replaceOnce("function consentMachine(){memoryConsent=!memoryConsent;persist('consentMachine',memoryConsent);$('navLearn').textContent=memoryConsent?'Machine memory: ON':'Machine memory: session';if(memoryConsent){learningMode='ONLINE_PREQUENTIAL';$('navLearningMode').value=learningMode;persist('machine',{version:C.VERSION,observations:machine.observations});}updateMemory();}",
  "function consentMachine(){memoryConsent=!memoryConsent;persist('consentMachine',memoryConsent);$('navLearn').textContent=memoryConsent?'Machine memory: ON':'Machine memory: session';if(memoryConsent){learningMode='ONLINE_PREQUENTIAL';$('navLearningMode').value=learningMode;persist('machine',{version:C.VERSION,observations:machine.observations});}else{machine=C.emptyModel();localStorage.removeItem(NS+'.machine');learningMode='COLD';$('navLearningMode').value=learningMode;}updateMemory();}");
replaceOnce("function consentTutor(){tutorConsent=!tutorConsent;persist('consentTutor',tutorConsent);$('navTutor').textContent=tutorConsent?'Tutor profile: ON':'Enable tutor profile';updateMemory();}",
  "function consentTutor(){tutorConsent=!tutorConsent;persist('consentTutor',tutorConsent);if(!tutorConsent){tutor={version:C.VERSION,attempts:[]};localStorage.removeItem(NS+'.tutor');}$('navTutor').textContent=tutorConsent?'Tutor profile: ON':'Enable tutor profile';updateMemory();}");
replaceOnce("function download(text,name,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}",
  "function download(text,name,type){if(window.SudokuMobileBridge?.isNative){window.SudokuMobileBridge.exportFile(text,name,type).then(()=>notify('Share sheet closed. Confirm your saved destination.')).catch(e=>notify('Export failed: '+e.message));return;}const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}");
replaceOnce("window.addEventListener('beforeunload',()=>{try{if(humanTraceRecorder.hasTrace())humanTraceRecorder.exportObject();}catch(_){}});",
  "window.addEventListener('beforeunload',()=>{try{if(!window.SudokuMobileDeleting&&humanTraceRecorder.hasTrace())humanTraceRecorder.exportObject();}catch(_){}});");
replaceOnce("  const text=JSON.stringify(trace,null,2);const blob=new Blob([text+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob);\n  const a=document.createElement('a');a.href=url;a.download='AI8_SUDOKU_HUMAN_EVENT_V1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);\n  setStatus(`Human trace exported · ${trace.events.length} events`,'win');return trace;",
  "  const text=JSON.stringify(trace,null,2)+'\\n';if(window.SudokuMobileBridge?.isNative){window.SudokuMobileBridge.exportFile(text,'AI8_SUDOKU_HUMAN_EVENT_V1.json','application/json').then(()=>setStatus('Share sheet closed; confirm trace destination','')).catch(e=>setStatus('Trace export failed: '+e.message,''));return trace;}const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);\n  const a=document.createElement('a');a.href=url;a.download='AI8_SUDOKU_HUMAN_EVENT_V1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);\n  setStatus(`Human trace download requested · ${trace.events.length} events`,'');return trace;");
replaceOnce("  const blob=new Blob([JSON.stringify(report,null,2)+'\\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AI8_SUDOKU_GAME_REVIEW_PREVIEW_V1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);setStatus(`Game Review exported · ${moveReviews.length} moves`,'win');return report;",
  "  const text=JSON.stringify(report,null,2)+'\\n';if(window.SudokuMobileBridge?.isNative){window.SudokuMobileBridge.exportFile(text,'AI8_SUDOKU_GAME_REVIEW_PREVIEW_V1.json','application/json').then(()=>setStatus('Share sheet closed; confirm review destination','')).catch(e=>setStatus('Review export failed: '+e.message,''));return report;}const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AI8_SUDOKU_GAME_REVIEW_PREVIEW_V1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);setStatus(`Game Review download requested · ${moveReviews.length} moves`,'');return report;");
replaceOnce("function deleteAll(){if(!confirm('Delete only this development version’s saved game, machine memory and tutor profile? Production data is not touched.'))return;try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(NS+'.'))localStorage.removeItem(k);}}catch(e){notify('Could not delete local storage: '+e.message+'. No deletion success is claimed.');return;}machine=C.emptyModel();tutor={version:C.VERSION,attempts:[]};memoryConsent=false;tutorConsent=false;rows=[];assistance=[];learningMode='COLD';$('navLearningMode').value=learningMode;$('navLearn').textContent='Machine memory: session';$('navTutor').textContent='Enable tutor profile';storageWarning='';clearTimeout(saveTimer);updateMemory();renderReviews();notify('Navigator storage deleted. Current unsaved grid remains open; later play may create a new session save.');}",
  "function deleteAll(){if(!confirm('Delete all 8zSudoku saved games, statistics, optional human trace, machine memory, tutor history and consents on this device?'))return;window.SudokuMobileDeleting=true;clearTimeout(saveTimer);stopTimer();humanTraceRecorder.deleteAll();puzzle=null;playerGrid=null;try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith(NS+'.'))localStorage.removeItem(k);}if(Object.keys(localStorage).some(k=>k.startsWith(NS+'.')))throw Error('Some keys remain');}catch(e){notify('Deletion incomplete: '+e.message+'. Please retry.');return;}location.reload();}");
replaceOnce(" window.addEventListener('pagehide',()=>{if(puzzle)persist('session',snapshot());});",
` let mobilePaused=false,mobileTimerWasRunning=false;
 window.SudokuMobileSession={
  pause(){if(window.SudokuMobileDeleting)return;if(!mobilePaused){mobileTimerWasRunning=!!timerInterval;mobilePaused=true;}if(puzzle&&!booting){clearTimeout(saveTimer);persist('session',snapshot());}stopTimer();},
  resume(){if(window.SudokuMobileDeleting||!mobilePaused)return;mobilePaused=false;if(mobileTimerWasRunning&&puzzle&&playerGrid&&!booting&&!tracePaused&&!recoveryAwaitingContinue)resumeTimer();mobileTimerWasRunning=false;},
  back(){if(!$('navModal').hidden){closeDialog();return true;}if($('helpModal')?.style.display==='flex'){hideHelp();return true;}const open=[...document.querySelectorAll('details[open]')].at(-1);if(open){open.open=false;return true;}return false;},
  deleteAll
 };
 window.addEventListener('pagehide',()=>window.SudokuMobileSession.pause());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)window.SudokuMobileSession.pause();else window.SudokuMobileSession.resume();});`);
replaceOnce('</head>', `<style id="native-mobile-style">
:root{color-scheme:dark}
html{overscroll-behavior:none}
body{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);touch-action:pan-y;-webkit-tap-highlight-color:transparent}
button,.cell,select{touch-action:manipulation}
.cell{appearance:none;padding:0}
.mobile-input-panel{width:100%;max-width:530px;margin-top:10px}
button:focus-visible,.cell:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.nav-modal{padding-top:calc(12px + env(safe-area-inset-top,0px));padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}
.nav-dialog{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 24px)}
@media(max-width:760px){.topbar{position:relative}.main{padding:6px 10px}.grid-wrap{padding:4px}.header{padding:8px 12px 0}.title-block{padding-top:3px}.cell{min-width:0;min-height:0}.numpad button,.btn{min-height:44px}.footer{padding-bottom:20px}}
@media(prefers-reduced-motion:reduce){body::before,body::after,.cell,.welcome-card{animation:none!important;transition:none!important}}
</style>
</head>`);
replaceOnce('</body>', '<script type="module" src="./bridge.js"></script>\n</body>');
const output = path.join(app, 'web');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'index.html'), html);
await cp(path.join(app, 'assets/icon.png'), path.join(output, 'icon.png'));
await build({ entryPoints: [path.join(app, 'src/bridge.js')], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: path.join(output, 'bridge.js'), logLevel: 'silent', legalComments: 'none' });
console.log(`Bundled 8zSudoku (${hash(Buffer.from(html), 'sha256')}) from ${spec.gitBlob}`);
