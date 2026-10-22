import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepare, fingerprint, inventory, isAlreadyPublished, checkRuns, MARKER } from '../scripts/netlify-auto-release.mjs';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'bd-netlify-release-'));
  for (const dir of ['public/chess', 'public/Trip', 'public/S', 'public/BD/O', 'functions', 'scripts']) await mkdir(join(root, dir), { recursive: true });
  const files = { 'public/index.html': 'MDL', 'public/chess/index.html': 'CHESS', 'public/Trip/index.html': 'TRIP', 'public/S/index.html': 'S', 'public/BD/O/encrypted.json': 'ciphertext', 'functions/auth.mjs': 'export const handler=()=>{}', 'netlify.toml': 'headers', 'package.json': '{}', 'package-lock.json': '{}', 'scripts/netlify-auto-release.mjs': 'release-v1' };
  for (const [name, text] of Object.entries(files)) await writeFile(join(root, name), text);
  return root;
}
const sha = 'a'.repeat(40);
test('dual-site snapshots preserve shared routes and encrypted bytes with correct root overlay', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, 'out'), m = await prepare(root, output, sha);
  assert.equal(await readFile(join(output, 'mdlxdcc/index.html'), 'utf8'), 'MDL');
  assert.equal(await readFile(join(output, 'bd-chess/index.html'), 'utf8'), 'CHESS');
  for (const site of ['mdlxdcc', 'bd-chess']) {
    assert.equal(await readFile(join(output, site, 'Trip/index.html'), 'utf8'), 'TRIP');
    assert.equal(await readFile(join(output, site, 'BD/O/encrypted.json'), 'utf8'), 'ciphertext');
    const marker = JSON.parse(await readFile(join(output, site, MARKER), 'utf8'));
    assert.equal(marker.fingerprint, m.sites[site].fingerprint); assert.equal(marker.source_sha, sha);
  }
});
test('fingerprints ignore commit-only changes and react to functions, headers and static bytes', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const m = await prepare(root, join(root, 'out1'), sha), n = await prepare(root, join(root, 'out2'), 'b'.repeat(40));
  assert.equal(m.sites.mdlxdcc.fingerprint, n.sites.mdlxdcc.fingerprint);
  await writeFile(join(root, 'functions/auth.mjs'), 'changed function');
  const f = await prepare(root, join(root, 'out3'), sha);
  assert.notEqual(m.sites.mdlxdcc.fingerprint, f.sites.mdlxdcc.fingerprint);
  await writeFile(join(root, 'netlify.toml'), 'changed headers');
  const h = await prepare(root, join(root, 'out4'), sha);
  assert.notEqual(f.sites.mdlxdcc.fingerprint, h.sites.mdlxdcc.fingerprint);
  await writeFile(join(root, 'public/index.html'), 'changed page');
  const s = await prepare(root, join(root, 'out5'), sha);
  assert.notEqual(h.sites.mdlxdcc.fingerprint, s.sites.mdlxdcc.fingerprint);
});
test('invalid identity, unknown site, private plaintext and symlinks are rejected', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(prepare(root, join(root, 'out'), 'short'), /full source SHA/);
  assert.throws(() => fingerprint('unknown', [], [], []), /Unknown site/);
  await writeFile(join(root, 'public/.env'), 'not-a-real-secret');
  await assert.rejects(inventory(join(root, 'public')), /Private input/);
  await rm(join(root, 'public/.env'));
  await symlink(join(root, 'public/index.html'), join(root, 'public/link'));
  await assert.rejects(inventory(join(root, 'public')), /symlink/);
});
test('deduplication needs matching live marker and provider production provenance', () => {
  const fp = 'c'.repeat(64), marker = { schema: 'bd.deploy.v1', site: 'mdlxdcc', source_sha: sha, fingerprint: fp };
  const p = { state: 'ready', title: `prebuilt:v1 mdlxdcc ${sha} ${fp}` };
  assert.equal(isAlreadyPublished(p, marker, 'mdlxdcc', fp), true);
  assert.equal(isAlreadyPublished({ ...p, title: 'unrelated overlay' }, marker, 'mdlxdcc', fp), false);
  assert.equal(isAlreadyPublished(p, null, 'mdlxdcc', fp), false);
  assert.equal(isAlreadyPublished(p, marker, 'bd-chess', fp), false);
});
test('CI requires secret scan success and respects failed/pending checks, excluding retired jobs', () => {
  const secret = { id: 1, path: '.github/workflows/secret-boundary.yml', event: 'push', status: 'completed', conclusion: 'success' };
  assert.equal(checkRuns([], 99).ready, false); assert.equal(checkRuns([secret], 99).ready, true);
  assert.equal(checkRuns([secret, { id: 2, path: 'test', event: 'push', status: 'in_progress' }], 99).ready, false);
  assert.equal(checkRuns([secret, { id: 3, path: 'test', event: 'push', status: 'completed', conclusion: 'failure' }], 99).bad.length, 1);
  assert.equal(checkRuns([secret, { id: 4, path: 'retired', event: 'workflow_run', status: 'completed', conclusion: 'cancelled' }], 99).ready, true);
});
