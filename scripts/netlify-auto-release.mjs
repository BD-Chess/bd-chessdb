// BD approved 2026-10-22: prepare/test on GitHub, upload prebuilt artifacts only.
import { cp, mkdir, readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verifyShell, verifyLiveShell } from './omnicpq/verify-shell.mjs';

export const SITES = Object.freeze({
  mdlxdcc: { id: '17b4124d-c197-4c0a-a711-8b2c08d91088', url: 'https://www.mdlxdcc.org' },
  'bd-chess': { id: 'deb1dab6-dfad-436e-ae92-4477d873c987', url: 'https://chessbest.org' },
});
const TEAM = '6802342a64df540aa5dc3fd4';
export const MARKER = '.well-known/bd-deploy.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const json = value => JSON.stringify(value, null, 2) + '\n';
function requireValue(value, message) { if (!value) throw Error(message); return value; }

export async function inventory(root, prefix = '') {
  const rows = [];
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
    if (['node_modules', '.git', '.netlify'].includes(entry.name)) continue;
    const path = join(root, entry.name), name = prefix + entry.name;
    if ((await lstat(path)).isSymbolicLink()) throw Error('Publish symlink is not allowed: ' + name);
    if (entry.isDirectory()) {
      if (entry.name === '.private') throw Error('Private input in publish tree: ' + name);
      rows.push(...await inventory(path, name + '/'));
    }
    else if (entry.isFile()) {
      if (name === MARKER) continue;
      if (entry.name === '.private' || entry.name === 'rclone.conf' || /^\.env(?:\.|$)/i.test(entry.name) || name.split('/').includes('.private')) throw Error('Private input in publish tree: ' + name);
      const bytes = await readFile(path);
      rows.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  return rows;
}

export function fingerprint(site, files, functions, config) {
  requireValue(SITES[site], 'Unknown site');
  return sha256(JSON.stringify({ schema: 1, site, files, functions, config }));
}

export async function prepare(root, output, sha, sites = Object.keys(SITES)) {
  requireValue(/^[0-9a-f]{40}$/.test(sha), 'A full source SHA is required');
  const functions = await inventory(join(root, 'functions'));
  const config = [];
  for (const path of ['netlify.toml', 'package.json', 'package-lock.json', 'scripts/netlify-auto-release.mjs']) config.push({ path, sha256: sha256(await readFile(join(root, path))) });
  const result = { schema: 'bd.netlify.prebuilt.v1', source_sha: sha, sites: {} };
  for (const site of sites) {
    requireValue(SITES[site], 'Unknown site');
    const dir = join(output, site);
    await mkdir(dir, { recursive: true });
    // Each output is a full snapshot; ChessBest keeps every shared route.
    await cp(join(root, 'public'), dir, { recursive: true });
    if (site === 'bd-chess') await cp(join(root, 'public/chess'), dir, { recursive: true, force: true });
    for (const path of ['index.html', 'Trip/index.html', 'S/index.html']) await readFile(join(dir, path));
    if (site === 'bd-chess') requireValue((await readFile(join(dir, 'index.html'))).equals(await readFile(join(root, 'public/chess/index.html'))), 'Wrong ChessBest root');
    // Inspect the exact copied final artifact, after every HTML transformation.
    await verifyShell(join(dir,'OmniCPQ'));
    const files = await inventory(dir);
    const fp = fingerprint(site, files, functions, config);
    await mkdir(join(dir, '.well-known'), { recursive: true });
    await writeFile(join(dir, MARKER), json({ schema: 'bd.deploy.v1', site, source_sha: sha, fingerprint: fp }));
    result.sites[site] = { id: SITES[site].id, dir, fingerprint: fp, files, functions, config };
  }
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'manifest.json'), json(result));
  return result;
}

async function api(url, token) {
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('Read-only API failed: ' + response.status + ' ' + new URL(url).pathname);
  return response.json();
}
async function github(path) { return api('https://api.github.com/repos/BD-Chess/bd-chessdb' + path, requireValue(process.env.GITHUB_TOKEN, 'Missing GitHub read token')); }
async function netlify(path) { return api('https://api.netlify.com/api/v1/' + path, requireValue(process.env.NETLIFY_AUTH_TOKEN, 'Missing Netlify token')); }
async function currentMain(sha) { return (await github('/branches/main')).commit.sha === sha; }

export function checkRuns(runs, ownRun) {
  // Only push verification belongs here. Old workflow_run one-shot jobs may be
  // cancelled/skipped intentionally; their retired state must not deadlock CI.
  const latest = new Map();
  for (const run of [...runs].sort((a,b) => b.id-a.id)) {
    if (String(run.id) === String(ownRun) || run.event !== 'push') continue;
    if (!latest.has(run.path)) latest.set(run.path, run);
  }
  const checks = [...latest.values()];
  const bad = checks.filter(r => r.status === 'completed' && !['success', 'skipped', 'neutral'].includes(r.conclusion));
  const pending = checks.filter(r => r.status !== 'completed');
  const secret = checks.some(r => r.path === '.github/workflows/secret-boundary.yml' && r.conclusion === 'success');
  return { ready: secret && !bad.length && !pending.length, bad, pending, secret };
}

async function ciGate(sha) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (!await currentMain(sha)) return false;
    const runs = [];
    for (let page = 1; ; page++) {
      const data = await github('/actions/runs?head_sha=' + sha + '&per_page=100&page=' + page);
      runs.push(...data.workflow_runs);
      if (data.workflow_runs.length < 100) break;
      requireValue(page < 10, 'CI pagination coverage exceeded');
    }
    const state = checkRuns(runs, process.env.GITHUB_RUN_ID);
    requireValue(!state.bad.length, 'Same-commit verification failed: ' + state.bad.map(r => r.name).join(', '));
    if (state.ready) return true;
    console.log('Waiting for same-commit verification: ' + state.pending.map(r => r.name).join(', '));
    await sleep(10000);
  }
  throw Error('Same-commit verification did not complete; no publication');
}

export function isAlreadyPublished(published, marker, site, fp) {
  return published?.state === 'ready' && published?.title === `prebuilt:v1 ${site} ${marker?.source_sha} ${fp}` && marker?.schema === 'bd.deploy.v1' && marker?.site === site && marker?.fingerprint === fp;
}

export function deployArgs(prepared, message) {
  // CLI 26.2 rejects --context with --no-build; --prod already selects production.
  return ['--yes', 'netlify-cli@26.2.0', 'deploy', '--prod', '--no-build', '--dir', prepared.dir, '--functions', 'functions', '--skip-functions-cache', '--site', prepared.id, '--message', message, '--json'];
}

export function verifyFunctionInventory(deployed, files) {
  // Netlify's deploy API returns compact available_functions rows with `n`;
  // also accept expanded function rows used by other API representations.
  const actual = new Set([...(deployed.available_functions || []), ...(deployed.functions || [])]
    .map(f => typeof f === 'string' ? f : f.name || f.n).filter(Boolean));
  const expected = files.filter(f => !f.path.includes('/') && /\.(mjs|mts|js|ts)$/.test(f.path))
    .map(f => f.path.replace(/\.(mjs|mts|js|ts)$/, ''));
  const missing = expected.filter(name => !actual.has(name));
  requireValue(!missing.length, 'Deployed function inventory is incomplete: ' + missing.join(', '));
  return expected;
}

async function readMarker(url) {
  const r = await fetch(url + '/' + MARKER + '?receipt=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  return r.ok ? r.json() : null;
}

async function verifyUnchanged(root, site, prepared) {
  requireValue(JSON.stringify(await inventory(prepared.dir)) === JSON.stringify(prepared.files), 'Prepared static artifact changed after verification');
  requireValue(JSON.stringify(await inventory(join(root, 'functions'))) === JSON.stringify(prepared.functions), 'Functions changed after verification');
  for (const file of prepared.config) requireValue(sha256(await readFile(join(root, file.path))) === file.sha256, 'Config changed after verification');
  requireValue(fingerprint(site, prepared.files, prepared.functions, prepared.config) === prepared.fingerprint, 'Manifest fingerprint mismatch');
}

export async function publish(root, output) {
  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  const sha = manifest.source_sha;
  if (!await ciGate(sha)) { console.log('SKIP_SUPERSEDED: newer main owns the next release'); return; }
  for (const [site, prepared] of Object.entries(manifest.sites)) {
    const receiptPath = join(output, site + '-receipt.json');
    const receipt = { schema: 'bd.netlify.release.v1', site, source_sha: sha, fingerprint: prepared.fingerprint, run_id: process.env.GITHUB_RUN_ID, status: 'PREPARED' };
    const save = async () => writeFile(receiptPath, json(receipt));
    await save();
    if (!await currentMain(sha)) { receipt.status = 'SKIP_SUPERSEDED'; await save(); return; }
    const before = await netlify('sites/' + SITES[site].id);
    requireValue(before.id === prepared.id && before.account_id === TEAM, 'Unexpected Netlify site/team');
    const marker = await readMarker(SITES[site].url);
    receipt.previous_deploy_id = before.published_deploy?.id || null;
    if (isAlreadyPublished(before.published_deploy, marker, site, prepared.fingerprint)) { receipt.status = 'SKIP_ALREADY_LIVE'; await save(); continue; }
    const message = `prebuilt:v1 ${site} ${sha} ${prepared.fingerprint}`;
    const recent = await netlify('sites/' + prepared.id + '/deploys?per_page=20');
    requireValue(!recent.some(d => !['ready', 'error', 'rejected', 'canceled', 'cancelled'].includes(d.state)), 'Another Netlify deploy is still active');
    requireValue(!recent.some(d => d.title === message), 'A previous attempt exists; reconcile it before retrying');
    await verifyUnchanged(root, site, prepared);
    // Same production lease immediately before the single CLI invocation.
    const fresh = await netlify('sites/' + prepared.id);
    requireValue(fresh.published_deploy?.id === receipt.previous_deploy_id, 'Production changed during preparation');
    if (!await currentMain(sha)) { receipt.status = 'SKIP_SUPERSEDED'; await save(); return; }
    receipt.status = 'INTENT'; receipt.attempted_at = new Date().toISOString(); await save();
    const cli = spawnSync('npx', deployArgs(prepared, message), { cwd: root, encoding: 'utf8', maxBuffer: 20*1024*1024, timeout: 600000, env: process.env });
    // CLI stdout can contain details: keep it in the CI artifact, never print tokens.
    await writeFile(join(output, site + '-cli.json'), cli.stdout || '');
    if (cli.status !== 0) {
      receipt.status = 'UNKNOWN_EFFECT'; receipt.cli_exit = cli.status; await save();
      // Read-only reconciliation only; never retry a possibly effective upload.
      const candidates = await netlify('sites/' + prepared.id + '/deploys?per_page=20');
      const found = candidates.find(d => d.title === message);
      if (found) { receipt.deploy_id = found.id; receipt.provider_state = found.state; await save(); }
      console.error((cli.stderr || '').slice(-4000));
      throw Error('CLI did not confirm success; inspect receipt before any new attempt');
    }
    const data = JSON.parse(cli.stdout);
    const id = requireValue(data.deploy_id || data.deployId || data.id, 'CLI returned no deploy ID');
    receipt.deploy_id = id; receipt.status = 'DISPATCHED'; await save();
    const deployed = await netlify('sites/' + prepared.id + '/deploys/' + id);
    requireValue(deployed.site_id === prepared.id && deployed.state === 'ready' && deployed.build_id == null, 'Expected READY prebuilt deploy without Netlify build');
    const now = await netlify('sites/' + prepared.id);
    requireValue(now.published_deploy?.id === id, 'Uploaded deploy is not current production');
    receipt.status = 'READY'; receipt.build_id = deployed.build_id ?? null; receipt.provider_state = deployed.state; await save();
    const expectedFunctions = verifyFunctionInventory(deployed, prepared.functions);
    let live = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const m = await readMarker(SITES[site].url);
      if (m?.source_sha === sha && m?.fingerprint === prepared.fingerprint && m?.site === site) { live = true; break; }
      await sleep(5000);
    }
    requireValue(live, 'Live release marker differs from prepared artifact');
    const landing = await fetch(SITES[site].url + '/?release=' + id, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    requireValue(landing.ok, 'Production landing does not respond successfully');
    const liveAsset = prepared.files.find(f => f.path === 'site-search-index.json') || prepared.files.find(f => f.path.endsWith('.css'));
    requireValue(liveAsset, 'No static verification asset');
    const response = await fetch(SITES[site].url + '/' + liveAsset.path + '?release=' + id, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    requireValue(response.ok && sha256(Buffer.from(await response.arrayBuffer())) === liveAsset.sha256, 'Live static asset does not match');
    receipt.omnicpq_live = await verifyLiveShell(SITES[site].url,join(prepared.dir,'OmniCPQ'));
    receipt.status = 'LIVE_VERIFIED'; receipt.completed_at = new Date().toISOString(); receipt.function_count = expectedFunctions.length; receipt.static_files = prepared.files.length; receipt.live_asset = liveAsset.path; await save();
    console.log(JSON.stringify({ site, status: receipt.status, deploy_id: id, source_sha: sha, build_id: null }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, output, sha, selected = 'all'] = process.argv.slice(2);
  const root = process.cwd();
  try {
    if (command === 'prepare') { const m = await prepare(root, resolve(output), sha, selected === 'all' ? Object.keys(SITES) : [selected]); console.log(JSON.stringify({ source_sha: sha, prepared: Object.keys(m.sites) })); }
    else if (command === 'publish') await publish(root, resolve(output));
    else throw Error('Usage: netlify-auto-release.mjs prepare OUTPUT SHA [all|mdlxdcc|bd-chess] | publish OUTPUT');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

