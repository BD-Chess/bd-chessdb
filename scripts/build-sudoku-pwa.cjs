'use strict';
// Package each channel's own source. Never copy LAB into CURRENT or legacy PWA.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), base = path.join(root, 'public/S');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const template = fs.readFileSync(path.join(__dirname, 'sudoku-channel-worker.js'), 'utf8');
const check = process.argv.includes('--check');
// Keep LAB's downloadable HTML self-contained, using the same presentation sources.
const labPath = path.join(base, 'new/app.html');
const originalLab = fs.readFileSync(labPath, 'utf8');
const presentationDir=path.join(base,'new','presentation');
const sources={
  bootstrap:fs.readFileSync(path.join(presentationDir,'bootstrap.js'),'utf8'),
  css:fs.readFileSync(path.join(presentationDir,'app.css'),'utf8'),
  ui:fs.readFileSync(path.join(presentationDir,'app-ui.js'),'utf8'),
  playback:fs.readFileSync(path.join(presentationDir,'app-solve-playback.js'),'utf8'),
  pwa:fs.readFileSync(path.join(presentationDir,'pwa.js'),'utf8'),
  labUi:fs.readFileSync(path.join(base,'_pwa','lab-ui.js'),'utf8'),
  i18n:fs.readFileSync(path.join(base,'_pwa','i18n.js'),'utf8')
};
for(const [name,source] of Object.entries(sources))if(source.includes('</script>'))throw Error('Presentation source contains closing script tag: '+name);
const headBlock='<!-- BEGIN SUDOKU UNIFIED HEAD -->\n<style id="sudoku-app-style">\n'+sources.css+'\n</style>\n<script id="sudoku-unified-bootstrap">\n'+sources.bootstrap+'\n</script>\n<!-- END SUDOKU UNIFIED HEAD -->';
const bodyBlock='<!-- BEGIN SUDOKU PRESENTATION -->\n'
 +'<script id="sudoku-lab-ui">\n'+sources.labUi+'\n</script>\n'
 +'<script id="sudoku-i18n">\n'+sources.i18n+'\n</script>\n'
 +'<script id="sudoku-app-ui">\n'+sources.ui+'\n</script>\n'
 +'<script id="sudoku-app-solve-playback">\n'+sources.playback+'\n</script>\n'
 +'<script id="sudoku-app-pwa">\n'+sources.pwa+'\n</script>\n'
 +'<!-- END SUDOKU PRESENTATION -->';
let lab=originalLab;
lab=lab.includes('<!-- BEGIN SUDOKU UNIFIED HEAD -->')
  ? lab.replace(/<!-- BEGIN SUDOKU UNIFIED HEAD -->[\s\S]*?<!-- END SUDOKU UNIFIED HEAD -->/,()=>headBlock)
  : lab.replace('</head>',headBlock+'\n</head>');
lab=lab.includes('<!-- BEGIN SUDOKU PRESENTATION -->')
  ? lab.replace(/<!-- BEGIN SUDOKU PRESENTATION -->[\s\S]*?<!-- END SUDOKU PRESENTATION -->/,()=>bodyBlock)
  : lab.replace('</body>',bodyBlock+'\n</body>');
if (lab !== originalLab) {
  if (check) throw Error('LAB embedded presentation is stale');
  fs.writeFileSync(labPath, lab);
}
for (const [channel, directory] of [['CURRENT',''],['LAB','new'],['LEGACY_RECOVERY','PWA']]) {
  const dir = path.join(base, directory), prefix = directory ? '../' : '';
  const shared = ['client.js','i18n.js','shell.css','icon-180.png','icon-192.png','icon-512.png'].map(x => prefix + '_pwa/' + x);
  const assets = ['index.html','manifest.webmanifest',...shared];
  if (channel === 'CURRENT') assets.push('current/index.html','current/promotion.json');
  else assets.push('app.html');
  if (channel === 'LEGACY_RECOVERY') assets.push('icon-180.png','icon-192.png','icon-512.png');
  const digests = Object.fromEntries(assets.map(name => [name, hash(fs.readFileSync(path.join(dir,name)))]));
  const runtimeHash = hash(template);
  const id = hash(JSON.stringify({channel,assets:digests,worker_runtime_sha256:runtimeHash}));
  const engine = '0.3.0';
  const generated = template.replace('const RELEASE = null;', 'const RELEASE = ' + JSON.stringify({id,channel,engine,assets:digests},null,2) + ';');
  const release = {schema:'8ZSUDOKU_CHANNEL_RELEASE_V2',channel,release_id:id,engine_revision:engine,source_policy:'SAME_CHANNEL_NO_GAME_COPY',assets_sha256:digests,worker_runtime_sha256:runtimeHash,worker_sha256:hash(generated)};
  for (const [name, text] of [['sw.js',generated],['release.json',JSON.stringify(release,null,2)+'\n']]) {
    const target = path.join(dir,name);
    if (check) { if (!fs.existsSync(target) || fs.readFileSync(target,'utf8') !== text) throw Error(channel + ' release stale: ' + name); }
    else fs.writeFileSync(target,text);
  }
  console.log(channel + ' ' + id + (check ? ' CHECK PASS' : ' packaged'));
}
