import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('local preview serves every frozen shell resource and relative module dependency without exposing private files', { timeout: 15_000 }, async () => {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, ['scripts/omnicpq/preview.mjs', '--demo'], {
    env: { ...process.env, PORT: String(port), OMNICPQ_PREVIEW_HOST: '127.0.0.1', OMNICPQ_PREVIEW_PREFIX: '/OmniCPQ/' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error('Preview exited before serving');
      try { ready = (await fetch(`http://127.0.0.1:${port}/OmniCPQ/`)).status === 200; if (ready) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(ready, 'Preview must become ready');
    const base = `http://127.0.0.1:${port}/OmniCPQ/`;
    const integrity = await (await fetch(base + 'shell-integrity.json')).json();
    const seen = new Set(), modules = [];
    for (const [path, expected] of Object.entries(integrity.files)) {
      const response = await fetch(base + path); assert.equal(response.status, 200, path);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
      if (path.endsWith('.mjs')) modules.push(path);
    }
    while (modules.length) {
      const path = modules.pop(); if (seen.has(path)) continue; seen.add(path);
      const response = await fetch(base + path); assert.equal(response.status, 200, path);
      assert(response.headers.get('content-type').includes('javascript'), path);
      const source = await response.text();
      for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
        const url = new URL(match[1], base + path); assert(url.href.startsWith(base)); modules.push(url.href.slice(base.length));
      }
    }
    assert(seen.has('lifecycle-validation.mjs'));
    for (const path of ['.private/omnicpq/knowledge.json', 'references/SERVICE_REGISTRY.json', '../private-inputs/knowledge.json']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    const doc = await readFile('docs/omnicpq-pwa/README.md', 'utf8');
    const identity = await import('../../functions/lib/omnicpq/identity.mjs');
    assert(doc.includes(identity.SKILL.zipSha256)); assert(doc.includes(identity.SKILL.manifestSha256));
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000); timer.unref();
      await exited; clearTimeout(timer);
    }
  }
});

