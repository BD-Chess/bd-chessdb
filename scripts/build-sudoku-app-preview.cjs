'use strict';
// Recreate the APP phone surface from the exact packaged LAB app. The copy is
// independent (storage, locale and presentation); no CURRENT files are read.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),lab=path.join(root,'public/S/new'),app=path.join(root,'public/S/app');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFileSync(file,'utf8');
const check=process.argv.includes('--check');
const expected=process.argv.find(arg=>arg.startsWith('--expected-lab-sha='))?.split('=')[1];
const donor=read(path.join(lab,'app.html'));
const labRelease=JSON.parse(read(path.join(lab,'release.json')));
const donorSha=sha(donor);
if(labRelease.channel!=='LAB'||labRelease.assets_sha256?.['app.html']!==donorSha)throw Error('LAB app does not match its release manifest');
if(expected&&expected!==donorSha)throw Error(`LAB donor SHA mismatch: expected ${expected}, got ${donorSha}`);
if(!donor.includes('<!-- BEGIN SUDOKU PRESENTATION -->')||!donor.includes('<!-- END SUDOKU PRESENTATION -->'))throw Error('LAB standalone presentation missing');
const css=read(path.join(app,'app.css')),ui=read(path.join(app,'app-ui.js')),index=read(path.join(app,'index.html'));
const pwa=read(path.join(app,'pwa.js')),workerTemplate=read(path.join(__dirname,'sudoku-channel-worker.js'));
const playback=read(path.join(app,'app-solve-playback.js'));
const once=(source,oldText,newText)=>{
 const parts=source.split(oldText);
 if(parts.length!==2)throw Error(`Expected exactly one donor anchor: ${oldText.slice(0,100)}`);
 return parts.join(newText);
};
let output=donor;
// The APP name is exactly 8zSudoku, including before scripts initialize.
const appHeading=/<(h[1-6])([^>]*class="title"[^>]*)>[\s\S]*?<\/\1>/g;
if([...output.matchAll(appHeading)].length!==1)throw Error('Expected one APP heading');
output=output.replace(appHeading,'<$1$2 data-no-i18n>8zSudoku</$1>');
output=once(output,'<title>8zSudoku — Play & Learn LAB | BD × AI Lab</title>','<title>8zSudoku APP · Play & Learn</title>');
output=once(output,'<meta name="viewport" content="width=device-width, initial-scale=1.0">','<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
output=once(output,'<body>','<body data-app-surface="true" data-app-panel="board">');
output=once(output,"const C=SudokuNavCore, NS='ai8SudokuNavigatorV020'","const C=SudokuNavCore, NS='ai8SudokuAppV030'");
output=output.replaceAll('ai8SudokuNavigatorV020.trace','ai8SudokuAppV030.trace').replaceAll('ai8SudokuNavigatorV020.stats','ai8SudokuAppV030.stats');
output=once(output,"const KEY='8zSudoku.ui.language'","const KEY='8zSudoku.app.ui.language'");
output=once(output,"const RELEASE='LAB-PLAY-LEARN-20260928-R1'","const RELEASE='APP-PLAY-LEARN-20260929-R1'");
output=output.replaceAll('Delete ALL local LAB games','Delete ALL local APP games')
 .replaceAll('Delete all LAB data','Delete all APP data')
 .replaceAll('Izbriši vse podatke LAB','Izbriši vse podatke APP')
 .replaceAll('LAB data deleted','APP data deleted');
output=once(output,"const base={seq:moveReviews.length+1,cell,value,at_s:timerSeconds,assisted:!!assisted,reasoning_status:'UNKNOWN_REASONING'};","const base={seq:moveReviews.length+1,cell,value,at_s:timerSeconds,assisted:!!assisted,pre_board:preGrid.flat(),reasoning_status:'UNKNOWN_REASONING'};");
output=once(output,
 "const row={id:(rows.at(-1)?.id||0)+1,kind:'placement',cell,value:n,pre,at_s:timerSeconds,help:J(help)",
 "const row={id:(rows.at(-1)?.id||0)+1,kind:'placement',cell,value:n,pre,pre_board:before.board.slice(),at_s:timerSeconds,help:J(help)"
);
output=once(output,
 "assistedSolveAll:()=>assistance.some(a=>a.type==='ai_assist_solve_all_answer'),canWrite:()=>!frozen&&!deleted",
 "assistedSolveAll:()=>assistance.some(a=>a.type==='ai_assist_solve_all_answer'),reviewRows:()=>J(rows.filter(r=>r.kind==='placement'&&(r.pre?.b||r.pre_board)).map(r=>{const expected=solution?.flat?.()[r.cell],proof=(r.result?.path||[]).find(q=>q.c===r.cell&&q.v===r.value)||r.result?.path?.at?.(-1),verdict=expected&&r.value!==expected?'mistake':r.result?.found?'verified':'unknown',preBoard=(r.pre?.b||r.pre_board);return{seq:r.id,cell:r.cell,value:r.value,at_s:r.at_s,assisted:!!(r.sessionAssisted||r.help?.length),pre_board:preBoard.slice(),verdict,technique:proof&&Number.isInteger(proof.t)?C.NAMES[proof.t]:null,label:verdict==='mistake'?'Wrong answer':verdict==='verified'?'Verified logic':'Correct · reasoning unknown'};})),canWrite:()=>!frozen&&!deleted"
);
output=once(output,"if(k?.startsWith(NS+'.')&&k!==EPOCH)localStorage.removeItem(k);}library={schema:SCHEMA","if(k?.startsWith(NS+'.')&&k!==EPOCH)localStorage.removeItem(k);}localStorage.removeItem('8zSudoku.app.ui.language');library={schema:SCHEMA");
output=once(output,'This is a product preview at <code>/S/new/</code>. The current <code>/S/</code> game remains untouched until manual review.','This is the APP web preview at <code>/S/app/</code>. The APP game and its saved data are separate from LAB and CURRENT.');
output=once(output,'<div style="text-align:center;padding:2rem 5vw 0.5rem;font-family:\'Cormorant Garamond\',serif;font-size:1.2rem;font-style:italic;color:rgba(226,232,244,0.35);letter-spacing:.03em">Less describes more.</div>\n\n','');
{
 const profileStart="if(g.status!=='GENERATED'){",profileEnd="  const priorGame=gameId;";
 const profileAt=output.indexOf(profileStart),profileNext=output.indexOf(profileStart,profileAt+1),profileAfter=output.indexOf(profileEnd,profileAt);
 if(profileAt<0||profileNext>=0||profileAfter<0)throw Error('APP profile fallback anchor mismatch');
 output=output.slice(0,profileAt)+"if(g.status!=='GENERATED'){if(target==null){const opened=await product.openProfileExample(diff);if(!opened)notify('New puzzle unavailable. Current game kept.');}else notify('Practice checkpoint unavailable. Current game kept.');return;}\n"+output.slice(profileAfter);
}
output=once(output,'</head>',`<meta name="theme-color" content="#08101d">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="8zSudoku">\n<link rel="manifest" href="./manifest.webmanifest">\n<link rel="apple-touch-icon" href="./icon-180.png">\n<style id="sudoku-app-style">\n${css}\n</style>\n</head>`);
output=once(output,'</body>',`<script id="sudoku-app-ui">\n${ui}\n</script>\n<script id="sudoku-app-solve-playback">\n${playback}\n</script>\n<script id="sudoku-app-pwa">\n${pwa}\n</script>\n</body>`);
if(output.includes('<script src=')||output.includes('<link rel="stylesheet"'))throw Error('APP game must be standalone');
// Parse the DELIVERED scripts, not just app-ui.js. Prevent a malformed
// generated Navigator from silently exposing the legacy base UI.
const vm=require('node:vm');let scriptCount=0;
for(const match of output.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 const type=match[1].match(/type=["']([^"']+)["']/i)?.[1]||'';
 if(type&&!/javascript|ecmascript/i.test(type))continue;
 const id=match[1].match(/id=["']([^"']+)["']/i)?.[1]||'inline-'+scriptCount;
 new vm.Script(match[2],{filename:'APP:'+id});scriptCount++;
}
if(scriptCount<3)throw Error('APP executable scripts missing');
const assets=Object.fromEntries(['index.html','app.html','pwa.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].map(name=>[name,sha(name==='app.html'?output:fs.readFileSync(path.join(app,name)))]));
const meta={
 schema:'8ZSUDOKU_APP_RELEASE_V2',channel:'APP',engine_revision:'0.3.0',lab_release_id:labRelease.release_id,
 lab_app_sha256:donorSha,index_sha256:sha(index),app_css_sha256:sha(css),app_ui_sha256:sha(ui),
 builder_sha256:sha(read(__filename)),app_html_sha256:sha(output),app_solve_playback_sha256:sha(playback),
 source_policy:'EXACT_LAB_DONOR_WITH_ISOLATED_APP_STORAGE',assets_sha256:assets,worker_runtime_sha256:sha(workerTemplate)
};
meta.release_id=sha(JSON.stringify(meta));
const worker=once(workerTemplate,'const RELEASE = null;','const RELEASE = '+JSON.stringify({id:meta.release_id,channel:'APP',engine:meta.engine_revision,assets},null,2)+';');
meta.worker_sha256=sha(worker);
for(const[name,bytes]of [['app.html',output],['sw.js',worker],['release.json',JSON.stringify(meta,null,2)+'\n']]){
 const filename=path.join(app,name);
 if(check){if(!fs.existsSync(filename)||read(filename)!==bytes)throw Error(`APP release stale: ${name}`);}
 else fs.writeFileSync(filename,bytes);
}
console.log(`APP ${meta.release_id} ${check?'CHECK PASS':'packaged'} from LAB ${donorSha}`);
