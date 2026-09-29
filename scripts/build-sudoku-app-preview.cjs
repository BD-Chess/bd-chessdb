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
const once=(source,oldText,newText)=>{
 const parts=source.split(oldText);
 if(parts.length!==2)throw Error(`Expected exactly one donor anchor: ${oldText.slice(0,100)}`);
 return parts.join(newText);
};
let output=donor;
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
output=once(output,"if(k?.startsWith(NS+'.')&&k!==EPOCH)localStorage.removeItem(k);}library={schema:SCHEMA","if(k?.startsWith(NS+'.')&&k!==EPOCH)localStorage.removeItem(k);}localStorage.removeItem('8zSudoku.app.ui.language');library={schema:SCHEMA");
output=once(output,'This is a product preview at <code>/S/new/</code>. The current <code>/S/</code> game remains untouched until manual review.','This is the APP web preview at <code>/S/app/</code>. The APP game and its saved data are separate from LAB and CURRENT.');
output=once(output,'<div style="text-align:center;padding:2rem 5vw 0.5rem;font-family:\'Cormorant Garamond\',serif;font-size:1.2rem;font-style:italic;color:rgba(226,232,244,0.35);letter-spacing:.03em">Less describes more.</div>\n\n','');
// APP touch loupe follows the finger with a safe offset; LAB donor stays unchanged.
output=once(output," function paintLoupe(g,x,y){\n  const p=$('uxLoupe');if(!p)return;const i=g.cells.findIndex(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom);\n  p.dataset.outside=String(i<0);if(i<0){p.querySelector('.ux-loupe-title').textContent='Slide over the grid';return;}\n  if(p.dataset.cell===String(i)){p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;return;}\n  p.dataset.cell=String(i);p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;\n  const view=p.querySelector('.ux-loupe-grid');view.replaceChildren();\n  // Read only the player's visible values/Notes. Never consult solution,\n  // candidates, proof/search, selection, history, review or assistance adapters.\n  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){\n   const r=Math.floor(i/9)+dy,c=i%9+dx,n=document.createElement('div');n.className='ux-loupe-cell'+(!dx&&!dy?' ux-loupe-focus':'');\n   if(r<0||r>8||c<0||c>8)n.classList.add('ux-loupe-edge');\n   else if(playerGrid[r][c])n.textContent=String(playerGrid[r][c]);\n   else if(notes[r][c].size){const marks=document.createElement('div');marks.className='ux-loupe-notes';for(let d=1;d<=9;d++){const s=document.createElement('span');s.textContent=notes[r][c].has(d)?String(d):'';marks.appendChild(s);}n.appendChild(marks);}\n   view.appendChild(n);\n  }\n }\n"," function positionLoupe(g,p,x,y){\n  if(g.kind!=='touch')return;const v=visibleBounds();if(!v)return;\n  const width=g.loupeWidth||p.getBoundingClientRect().width,height=g.loupeHeight||p.getBoundingClientRect().height,pad=6,gap=54;\n  let left=x-width/2,top=y-height-gap;\n  if(top<v.top+pad&&y+gap+height<=v.bottom-pad)top=y+gap;\n  left=Math.max(v.left+pad,Math.min(v.right-width-pad,left));top=Math.max(v.top+pad,Math.min(v.bottom-height-pad,top));\n  p.style.left=Math.round(left)+'px';p.style.top=Math.round(top)+'px';\n }\n function paintLoupe(g,x,y){\n  const p=$('uxLoupe');if(!p)return;if(g.kind==='touch')positionLoupe(g,p,x,y);const i=g.cells.findIndex(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom);\n  p.dataset.outside=String(i<0);if(i<0){p.querySelector('.ux-loupe-title').textContent='Slide over the grid';return;}\n  if(p.dataset.cell===String(i)){p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;return;}\n  p.dataset.cell=String(i);p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;\n  const view=p.querySelector('.ux-loupe-grid');view.replaceChildren();\n  // Read only the player's visible values/Notes. Never consult solution,\n  // candidates, proof/search, selection, history, review or assistance adapters.\n  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){\n   const r=Math.floor(i/9)+dy,c=i%9+dx,n=document.createElement('div');n.className='ux-loupe-cell'+(!dx&&!dy?' ux-loupe-focus':'');\n   if(r<0||r>8||c<0||c>8)n.classList.add('ux-loupe-edge');\n   else if(playerGrid[r][c])n.textContent=String(playerGrid[r][c]);\n   else if(notes[r][c].size){const marks=document.createElement('div');marks.className='ux-loupe-notes';for(let d=1;d<=9;d++){const s=document.createElement('span');s.textContent=notes[r][c].has(d)?String(d):'';marks.appendChild(s);}n.appendChild(marks);}\n   view.appendChild(n);\n  }\n }\n");
output=once(output," function openLoupe(g){const v=visibleBounds();if(!v)return false;const width=Math.min(280,v.width-16,v.height-46),height=width+30;if(width<100)return false;\n  const p=document.createElement('div');p.id='uxLoupe';p.className='ux-loupe';p.setAttribute('aria-hidden','true');p.style.cssText=`left:${v.left+(v.width-width)/2}px;top:${v.top+(v.height-height)/2}px;width:${width}px;height:${height}px;--ux-loupe-cell:${(width-28)/3}px`;\n  p.innerHTML='<div class=\"ux-loupe-title\"></div><div class=\"ux-loupe-grid\"></div>';g.cells=[...$('grid').children].map(c=>c.getBoundingClientRect());document.body.appendChild(p);paintLoupe(g,g.x,g.y);return true;\n }\n"," function openLoupe(g){const v=visibleBounds();if(!v)return false;const width=Math.min(280,v.width-16,v.height-46),height=width+30;if(width<100)return false;g.loupeWidth=width;g.loupeHeight=height;\n  const p=document.createElement('div');p.id='uxLoupe';p.className='ux-loupe';p.setAttribute('aria-hidden','true');p.style.cssText=`left:${v.left+(v.width-width)/2}px;top:${v.top+(v.height-height)/2}px;width:${width}px;height:${height}px;--ux-loupe-cell:${(width-28)/3}px`;\n  p.innerHTML='<div class=\"ux-loupe-title\"></div><div class=\"ux-loupe-grid\"></div>';g.cells=[...$('grid').children].map(c=>c.getBoundingClientRect());document.body.appendChild(p);paintLoupe(g,g.x,g.y);return true;\n }\n");
output=once(output,'</head>',`<meta name="theme-color" content="#08101d">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="8zSudoku">\n<link rel="manifest" href="./manifest.webmanifest">\n<link rel="apple-touch-icon" href="./icon-180.png">\n<style id="sudoku-app-style">\n${css}\n</style>\n</head>`);
output=once(output,'</body>',`<script id="sudoku-app-ui">\n${ui}\n</script>\n<script id="sudoku-app-pwa">\n${pwa}\n</script>\n</body>`);
if(output.includes('<script src=')||output.includes('<link rel="stylesheet"'))throw Error('APP game must be standalone');
const assets=Object.fromEntries(['index.html','app.html','pwa.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].map(name=>[name,sha(name==='app.html'?output:fs.readFileSync(path.join(app,name)))]));
const meta={
 schema:'8ZSUDOKU_APP_RELEASE_V2',channel:'APP',engine_revision:'0.3.0',lab_release_id:labRelease.release_id,
 lab_app_sha256:donorSha,index_sha256:sha(index),app_css_sha256:sha(css),app_ui_sha256:sha(ui),
 builder_sha256:sha(read(__filename)),app_html_sha256:sha(output),
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
