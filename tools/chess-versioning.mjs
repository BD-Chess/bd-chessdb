/** Read-only BD Chess channel / immutable archive gate. Never writes or promotes. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function nextArchive(names) {
  const ids = names.filter(name => /^\d{3,}$/.test(name)).map(Number);
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error('Invalid archive number');
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate numerical archive IDs');
  return String(Math.max(0, ...ids) + 1).padStart(3, '0');
}
export function checkVersions(repo, base) {
  const app = path.join(repo, 'public/chess');
  const errors = [], channels = [['CURRENT',''],['PREVIOUS','old'],['LAB','new'],['PWA','PWA']];
  for (const [name, dir] of channels) {
    const file = path.join(app, dir, 'index.html');
    if (!fs.existsSync(file)) { errors.push(`${name}: missing entry page`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const nav = html.match(/<nav\b[^>]*class="bd-version-selector[^"<>]*"[^>]*>[\s\S]*?<\/nav>/g) || [];
    if (nav.length !== 1) { errors.push(`${name}: expected one version selector`); continue; }
    const links = [...nav[0].matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
    if (links.length !== channels.length) errors.push(`${name}: expected ${channels.length} version links`);
    if (links.filter(link => link[2].includes('aria-current="page"')).length !== 1) errors.push(`${name}: expected one active channel`);
    for (const [label, suffix] of channels) {
      // Relative URLs also work when Pages hosts the repository below /bd-chessdb/.
      const href = dir === suffix ? './' : `${dir ? '../' : './'}${suffix ? suffix + '/' : ''}`;
      const link = links.find(candidate => candidate[1] === href && candidate[3] === label);
      if (!link) errors.push(`${name}: missing direct ${label} link`);
      else if (link[2].includes('aria-current="page"') !== (label === name)) errors.push(`${name}: wrong active channel`);
    }
    if (!html.includes('id="bd-version-style"')) errors.push(`${name}: selector CSS is not self-contained`);
  }
  const old = path.join(app,'old');
  const archiveNames = fs.existsSync(old) ? fs.readdirSync(old,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).filter(n=>/^\d{3,}$/.test(n)) : [];
  const next = nextArchive(archiveNames);
  const metadata = JSON.parse(fs.readFileSync(path.join(app,'versions.json'),'utf8'));
  if (metadata.pwa !== '/chess/PWA/') errors.push('PWA metadata mismatch');
  const listed = (metadata.archives || []).map(a=>a.id).sort();
  if (JSON.stringify(archiveNames.sort()) !== JSON.stringify(listed)) errors.push('Archive directory/metadata mismatch');
  const redirects = fs.readFileSync(path.join(repo,'public/_redirects'),'utf8');
  if (/^\s*\/chess\/new\S*\s+\/chess\/(?:\s|:)/m.test(redirects)) errors.push('LAB is redirected to CURRENT');
  if (base) {
    if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Use the full inspected main commit SHA');
    const entries = execFileSync('git',['ls-tree','-r',base,'--','public/chess/old'],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(Boolean);
    for (const entry of entries) {
      const match = entry.match(/^\d+ blob ([a-f0-9]+)\t(public\/chess\/old\/\d{3,}\/.*)$/);
      if (!match) continue;
      const full = path.join(repo,match[2]);
      if (!fs.existsSync(full)) { errors.push(`Deleted archive file: ${match[2]}`); continue; }
      const hash = execFileSync('git',['hash-object','--',full],{cwd:repo,encoding:'utf8'}).trim();
      if (hash !== match[1]) errors.push(`Changed archive file: ${match[2]}`);
    }
    // Also reject adding files to an archive that already existed at the base.
    const oldPaths = new Set(entries.map(e=>e.split('\t')[1]));
    const oldIds = new Set([...oldPaths].map(p=>p?.match(/^public\/chess\/old\/(\d{3,})\//)?.[1]).filter(Boolean));
    function walk(dir) { for(const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory())walk(p);else if(!oldPaths.has(path.relative(repo,p).split(path.sep).join('/')))errors.push(`Added file to sealed archive: ${p}`); } }
    for(const id of oldIds)if(fs.existsSync(path.join(old,id)))walk(path.join(old,id));
  }
  return {ok:errors.length===0,errors,channels:channels.map(([name,dir])=>({name,path:`/chess/${dir?dir+'/':''}`})),archives:archiveNames,nextArchive:`/chess/old/${next}/`,promotionPerformed:false,immutableComparison:base||'not requested'};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const index = process.argv.indexOf('--base');
  const result = checkVersions(repo,index < 0 ? null : process.argv[index+1]);
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}
