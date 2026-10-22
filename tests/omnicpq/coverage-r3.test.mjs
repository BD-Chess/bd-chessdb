import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadKnowledge } from '../../functions/lib/omnicpq/knowledge.mjs';
import { CANONICAL_PROMPTS } from '../../public/OmniCPQ/prompts.mjs';

const packText = await readFile(process.env.OMNICPQ_TEST_KNOWLEDGE || '.private/omnicpq/knowledge.json', 'utf8');
const pack = JSON.parse(packText), k = await loadKnowledge({ reader: async () => packText });
const request = message => ({ message, mode: 'work', history: [], context: { text: '' } });
test('coverage questions receive the identical complete shared overview with its evidence role', async () => {
  for (const message of ['Katere storitve podpira pomočnik?', 'Kaj še manjka za cloud storitve?', 'Kateri so kandidati za skill?', 'Pokaži popis pokritosti']) {
    const result = await k.retrieve(request(message));
    const coverage = result.sources.find(row => row.path === 'references/SERVICE_COVERAGE.md');
    assert(coverage, message);
    assert.equal(coverage.kind, 'coverage_overview_not_product_rule');
    assert.equal(coverage.sha256, createHash('sha256').update(pack.files[coverage.path]).digest('hex'));
    assert(result.text.includes(pack.files[coverage.path]));
    assert(pack.files[coverage.path].includes('USER_REPORTED_IN_PROGRESS'));
  }
  const routine = await k.retrieve(request('Kako spremenim plačnika?'));
  assert(!routine.sources.some(row => row.path.endsWith('/SERVICE_COVERAGE.md')));
});
test('overview adds no product identity; public cards preserve all sixteen common messages', () => {
  const registry = JSON.parse(pack.files['references/SERVICE_REGISTRY.json']);
  const integration = JSON.parse(pack.files['references/INTEGRATION_V15.json']);
  assert.deepEqual(registry.product_modules, integration.baseline_product_modules);
  assert.equal(registry.product_modules.length, 16);
  assert.equal(registry.process_modules.length, 28);
  assert.equal(registry.context_modules.length, 14);
  assert.equal(registry.coverage_overview.entrypoint, 'references/SERVICE_COVERAGE.md');
  const common = JSON.parse(pack.files['copilot/PROMPTS.json']).prompts;
  assert.deepEqual(CANONICAL_PROMPTS, common);
  assert.equal(common.length, 16);
});
test('host export verdict retains both strict schema and v14 oracle/evidence semantics', () => {
  const data = JSON.parse(pack.files['references/PLM_TEST_EXAMPLE.json']);
  for (const source of data.sources) source.role = 'MODEL';
  const result = k.validateLifecycleAnswer('```json\n' + JSON.stringify(data) + '\n```');
  assert.equal(result.state, 'INVALID');
  assert(result.issues.some(issue => issue.category === 'semantic'));
});
