#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function selector(html){ return html.match(/<nav\b[^>]*class="bd-version-selector[^"<>]*"[^>]*>[\s\S]*?<\/nav>/g)||[]; }
function walk(dir){
  const out=[]; if(!fs.existsSync(dir)) return out;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);e.isDirectory()?out.push(...walk(p)):out.push(p);}
  return out;
}
export function checkVersions(repo,base){
  const current=path.join(repo,'public/chess'), dev=path.join(repo,'public/chess-lab');
  const previous=path.join(dev,'old'), errors=[];
  const channels=[
    ['CURRENT',current,'/chess/',false],
    ['PREVIOUS',previous,'/chess-lab/old/',false],
    ['LAB',dev,'/chess-lab/',true],
  ];
  for(const [name,dir,,needsNav] of channels){
    const f=path.join(dir,'index.html'); if(!fs.existsSync(f)){errors.push(name+': missing entry page');continue;}
    const nav=selector(fs.readFileSync(f,'utf8'));
    if(!needsNav){if(nav.length)errors.push(name+': selector must be absent');continue;}
    if(nav.length!==1){errors.push('LAB: expected one selector');continue;}
    const links=[...nav[0].matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
    const expected={CURRENT:'../chess/',PREVIOUS:'./old/',LAB:'./'};
    for(const [label,href] of Object.entries(expected)){
      const x=links.find(v=>v[1]===href&&v[3]===label);
      if(!x) errors.push('LAB: missing '+label);
      else if(x[2].includes('aria-current="page"')!==(label==='LAB')) errors.push('LAB: wrong active '+label);
    }
  }
  for(const n of ['new','app','old','lab']) if(fs.existsSync(path.join(current,n))) errors.push('CURRENT still contains '+n);
  for(const n of ['app','lab']) if(fs.existsSync(path.join(dev,n))) errors.push('LAB still contains retired '+n);
  for(const n of ['app','lab']) if(!fs.existsSync(path.join(previous,n))) errors.push('missing retired archive '+n);
  const m=JSON.parse(fs.readFileSync(path.join(current,'versions.json'),'utf8'));
  if(m.current!=='/chess/'||m.lab!=='/chess-lab/'||m.previous!=='/chess-lab/old/'||Object.hasOwn(m,'app')) errors.push('channel metadata mismatch');
  const install={CURRENT:'/chess/',LAB:'/chess-lab/'};
  if(!m.installable_channels||Object.entries(install).some(([k,v])=>m.installable_channels[k]!==v)) errors.push('installable metadata mismatch');
  for(const [name,dir] of [['CURRENT',current],['LAB',dev]]){
    const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
    if(!/rel=["']manifest["'][^>]*href=["'](?:\.\/)?manifest\.webmanifest["']/i.test(html)) errors.push(name+': missing manifest');
    if(!fs.existsSync(path.join(dir,'sw.js'))) errors.push(name+': missing worker');
    const p=JSON.parse(fs.readFileSync(path.join(dir,'manifest.webmanifest'),'utf8'));
    if(p.id!=='./'||p.start_url!=='./'||p.scope!=='./') errors.push(name+': PWA scope crosses channel');
  }
  const ids=fs.readdirSync(previous,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^\d{3,}$/.test(e.name)).map(e=>e.name).sort((a,b)=>+a-+b);
  if(base){
    let prefix='public/chess-lab/old';
    try{execFileSync('git',['cat-file','-e',base+':'+prefix],{cwd:repo,stdio:'ignore'});}catch{prefix='public/chess/old';}
    const rows=execFileSync('git',['ls-tree','-rz',base,'--',prefix],{cwd:repo}).toString().split('\0').filter(Boolean), sealed=new Set();
    for(const row of rows){const x=row.match(/^[^ ]+ blob [0-9a-f]+\t(.+)$/);if(!x)continue;const rel=x[1].slice(prefix.length+1);if(!/^\d{3,}\//.test(rel))continue;sealed.add(rel);const now=path.join(previous,rel);if(!fs.existsSync(now)){errors.push('deleted archive '+rel);continue;}const before=execFileSync('git',['show',base+':'+x[1]],{cwd:repo});if(!before.equals(fs.readFileSync(now)))errors.push('changed archive '+rel);}
    for(const f of walk(previous)){const rel=path.relative(previous,f).split(path.sep).join('/');if(/^\d{3,}\//.test(rel)&&!sealed.has(rel))errors.push('added archive file '+rel);}
  }
  const next=String((ids.length?Math.max(...ids.map(Number)):0)+1).padStart(3,'0');
  return {ok:errors.length===0,errors,channels:channels.map(([name,,p])=>({name,path:p})),archives:ids,nextArchive:'/chess-lab/old/'+next+'/',promotionPerformed:false};
}
const here=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===here){const i=process.argv.indexOf('--base'),r=checkVersions(process.cwd(),i<0?null:process.argv[i+1]);console.log(JSON.stringify(r,null,2));if(!r.ok)process.exitCode=1;}
