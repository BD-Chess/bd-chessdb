import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadKnowledge, selectService,createRetriever,verifyPack } from '../../functions/lib/omnicpq/knowledge.mjs';
import { instructions } from '../../functions/lib/omnicpq/instructions.mjs';

// The same verified package supplies runtime and fixture content; no synthetic
// replacement product rules, network access or provider calls are involved.
const packText = await readFile(process.env.OMNICPQ_TEST_KNOWLEDGE || new URL('../../../private-inputs/knowledge.json', import.meta.url), 'utf8');
const files = JSON.parse(packText).files;
const registry = JSON.parse(files['references/SERVICE_REGISTRY.json']);
const knowledge = await loadKnowledge({ reader: async () => packText });
const input = (message, changes = {}) => ({ message, mode: 'work', context: { text: '' }, history: [], ...changes });
const paths = result => result.sources.map(source => source.path);
const user = content => ({ role: 'user', content });
test('private behavior context is selectively retrieved and available v17 documentation is distinguished from its v16 base',async()=>{
  const reads=[],documentReader=async name=>{reads.push(name);const bytes=Buffer.from('SYNTHETIC_PRIVATE_CONTEXT '+name);return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};};
  const k=createRetriever(await verifyPack(packText),{documentReader});
  let r=await k.retrieve(input('Kje je TS Suvereni oblak v A4?'));assert(r.sources.some(s=>s.path==='playbooks/A4_SO_WORKED_EXAMPLE_R3.md'));assert(r.text.includes('SYNTHETIC_PRIVATE_CONTEXT'));
  reads.length=0;await k.retrieve(input('Kako deluje VPI?'));assert.equal(reads.length,0);
  r=await k.retrieve(input('Pokaži pokritost',{promptId:'COVERAGE'}));assert.equal(r.documentationStatus,'V17_AVAILABLE');assert.equal(r.skill.release,'v16');
  const absent=createRetriever(await verifyPack(packText),{documentReader:async()=>{throw Error('Missing');}});r=await absent.retrieve(input('Pokaži pokritost',{promptId:'COVERAGE'}));assert.equal(r.documentationStatus,'V17_PRIVATE_STORAGE_PENDING');
});

test('process/context fixtures retrieve their actual complete module and evidence, with unrelated modules absent', async () => {
  const fixtures = [
    ['Sprememba plačnika', 'OMNICPQ_SPREMEMBA_PLACNIKA', 'OMNICPQ_DODAJANJE_DODATNE_STORITVE'],
    ['Kako spremenim plačnika?', 'OMNICPQ_SPREMEMBA_PLACNIKA', 'OMNICPQ_SELITEV_STORITVE'],
    ['Kako dodam dodatno storitev na obstoječo ponudbo?', 'OMNICPQ_DODAJANJE_DODATNE_STORITVE', 'OMNICPQ_DODAJANJE_PODREJENEGA_PRODUKTA'],
    ['Charge price item not configured', 'JIRA_B2B_UPORABNISKA_DIAGNOSTIKA', 'B2B_TERMINALNA_OPREMA_DIAGNOSTIKA_DELNI'],
    ['VPI oprema CPE_ID napaka', 'B2B_TERMINALNA_OPREMA_DIAGNOSTIKA_DELNI', 'OMNICPQ_SPREMEMBA_PLACNIKA'],
    ['VPI RIPE PI IPv6', 'VPI_RIPE_PI_IPV6_DELNI', 'NAMESTITVENE_RESITVE_TV'],
  ];
  for (const [message, expected, excluded] of fixtures) {
    const result = await knowledge.retrieve(input(message));
    assert(paths(result).includes(`references/${expected}.md`), message);
    assert(!paths(result).includes(`references/${excluded}.md`), message);
    const entry = [...registry.process_modules, ...registry.context_modules].find(row => row.entrypoint === `references/${expected}.md`);
    for (const evidence of entry.evidence_paths || []) assert(paths(result).includes(evidence), `${message}: ${evidence}`);
    for (const source of result.sources) {
      assert(result.text.includes(files[source.path]), `${message}: whole ${source.path}`);
      assert.equal(source.sha256, createHash('sha256').update(files[source.path]).digest('hex'));
      assert(source.sections.every(section => section.startLine > 0 && section.endLine >= section.startLine));
    }
  }
});

test('current named service overrides stale context/history; explicit selection and specific aliases remain valid', async () => {
  const result = await knowledge.retrieve(input('VPI cena', {
    context: { text: 'TS Suvereni oblak VM disk backup licenca' }, history: [user('TS Suvereni oblak')],
  }));
  assert.equal(result.service.id, 'VPI');
  assert(!paths(result).some(path => path.includes('ts-suvereni-oblak/')));
  assert.equal((await knowledge.retrieve(input('Kaj pa cena?', { history: [user('VPI')] }))).service.id, 'VPI');
  assert.equal((await knowledge.retrieve(input('Kaj pa cena?', { service: 'TS_SO' }))).service.id, 'TS_SO');
  assert.equal(selectService(registry, 'SD-WAN Lite konfiguracija').service_id, 'SD_WAN_LITE');
  assert.equal(selectService(registry, 'VPI 5G FWA').service_id, 'VPI_5G_FWA');
  assert.equal(selectService(registry, 'VPI DDoS').service_id, 'VPI_DDOS_VPS');
  assert.equal(selectService(registry, 'xVPI nato VPI cena').service_id, 'VPI');
  assert.equal(selectService(registry, 'xVPI cena'), null);
});

test('ambiguous SO/VPN/VPS and independent service names never fall back to old SO rules', async () => {
  for (const message of ['SO', 'VPN', 'VPS', 'VPI namesto TS Suvereni oblak', 'Primerjaj VPI in VPN L3']) {
    const request = input(message, { context: { text: 'TS Suvereni oblak' }, history: [user('TS Suvereni oblak')] });
    const result = await knowledge.retrieve(request);
    assert.equal(result.service, null, message);
    assert.equal(result.serviceResolution.ambiguous, true, message);
    assert(!paths(result).some(path => path.includes('ts-suvereni-oblak/')), message);
    assert(instructions(result, request).includes('najmanjši razlikovalni podatek'), message);
  }
  assert.equal(selectService(registry, 'VPS ob VPI').service_id, 'VPI_DDOS_VPS');
  assert.equal((await knowledge.retrieve(input('TS Suvereni oblak'))).service.id, 'TS_SO');
});

test('typed QA/PLM intent and elliptical followups use the same task in retrieval and instructions', async () => {
  for (const request of [
    input('QA VPI: pokritost modela'),
    input('Pripravi testne scenarije za VPI'),
    input('Dodaj še negativne in mejne primere.', { history: [user('Pripravi testne scenarije za VPI')] }),
    input('Dopolni še z odvisnostmi.', { history: [user('Pripravi testne scenarije za VPI')] }),
  ]) {
    const result = await knowledge.retrieve(request);
    assert.equal(result.intent.mode, 'plm', request.message);
    assert(paths(result).includes('references/PLM_TESTING.md'));
    assert(paths(result).includes('references/LIFECYCLE_OUTPUT.schema.json'));
    assert(!paths(result).includes('references/CPQ_FLOW.md'));
    assert(!paths(result).includes('references/OMNICPQ_UPRAVLJANJE_Z_DOKUMENTI.md'));
    assert(instructions(result, request).includes('Izbrana začetna naloga je PLM_TESTS.'));
  }
});

test('clear CPQ action and business design are distinct; a new service does not inherit old PLM intent', async () => {
  const history = [user('Pripravi testne scenarije za TS Suvereni oblak')];
  const work = input('Kako dodam dodatno storitev na obstoječo ponudbo?', { mode: 'plm', history });
  const w = await knowledge.retrieve(work);
  assert.equal(w.intent.mode, 'work'); assert(paths(w).includes('references/CPQ_FLOW.md'));
  assert(!paths(w).includes('references/PLM_TESTING.md'));
  const jira = input('Pripravi poslovno zahtevo IT/PLM za novo cloud storitev.');
  const j = await knowledge.retrieve(jira);
  assert.equal(j.intent.mode, 'jira'); assert(paths(j).includes('references/JIRA_REQUIREMENTS.md'));
  assert(paths(j).includes('references/POSLOVNA_ZAHTEVA_IT_PLM.md'));
  assert(instructions(j, jira).includes('Izbrana začetna naloga je JIRA_REQUIREMENT.'));
  assert(!paths(j).some(path => path.includes('ts-suvereni-oblak/')));
  const changed = await knowledge.retrieve(input('Kaj pa cena za VPI?', { history }));
  assert.equal(changed.service.id, 'VPI'); assert.equal(changed.intent.mode, 'work');
  assert(!paths(changed).includes('references/PLM_TESTING.md'));
});

test('price roots require word boundaries; scenario/assessment phrasing does not inflate the payload', async () => {
  for (const message of ['Pripravi testne scenarije za VPI', 'Pripravi testni scenarij za VPI', 'Ocena testnega načrta za VPI']) {
    const result = await knowledge.retrieve(input(message));
    assert(!paths(result).includes('references/PRICE_GUIDE.md'), message);
    assert(!paths(result).includes('references/OMNICPQ_POGODBENE_CENE_CPL.md'), message);
    assert(!paths(result).includes('references/VPI_VPNL3_VPLS_SLA_DOPOLNITEV.md'), message);
    assert(paths(result).includes('references/services/VPI.md'), message);
    assert(result.text.length < (await knowledge.retrieve(input('Pripravi testne scenarije za VPI, vključi cene.'))).text.length, message);
  }
  for (const word of ['cena', 'cene', 'cenik', 'cenovna', 'CPL', 'obračun', 'popust']) {
    const result = await knowledge.retrieve(input(`VPI ${word}`));
    assert(paths(result).includes('references/PRICE_GUIDE.md'), word);
  }
});

test('followup process survives same-topic context while unrelated current context is not carried forward', async () => {
  const prior = 'Kako dodam dodatno storitev na obstoječo ponudbo za VPI?';
  const next = await knowledge.retrieve(input('Nadaljuj.', { history: [user(prior)] }));
  assert.equal(next.service.id, 'VPI');
  assert(paths(next).includes('references/OMNICPQ_DODAJANJE_DODATNE_STORITVE.md'));
  const changed = await knowledge.retrieve(input('VPI SLA', { history: [user('Sprememba plačnika za TS Suvereni oblak')] }));
  assert(!paths(changed).includes('references/OMNICPQ_SPREMEMBA_PLACNIKA.md'));
  assert(!paths(changed).some(path => path.includes('ts-suvereni-oblak/')));
});

test('a stale selected service conflicts explicitly with a different clear current service', async () => {
  const request = input('Kakšna je cena VPI?', {
    service: 'TS_SO', context: { text: 'TS Suvereni oblak VM' }, history: [user('TS Suvereni oblak')],
  });
  const result = await knowledge.retrieve(request);
  assert.equal(result.service, null);
  assert.equal(result.serviceResolution.conflict, true);
  assert.deepEqual(new Set(result.serviceResolution.candidates), new Set(['VPI', 'TS_SO']));
  assert(!paths(result).some(path => path.includes('ts-suvereni-oblak/') || path === 'references/services/VPI.md'));
  assert(instructions(result, request).includes('v konfliktu: VPI, TS_SO'));
});

test('a new unregistered IT/cloud service does not inherit SO from context, history or a stale selection', async () => {
  for (const service of [null, 'TS_SO']) {
    const request = input('Pripravi poslovno zahtevo za novo neznano IT/cloud storitev.', {
      service, context: { text: 'TS Suvereni oblak VM disk Backup' }, history: [user('TS Suvereni oblak')],
    });
    const result = await knowledge.retrieve(request);
    assert.equal(result.service, null);
    assert.equal(result.serviceResolution.unknownNewService, true);
    assert(!paths(result).some(path => path.includes('ts-suvereni-oblak/')));
    assert(paths(result).includes('references/JIRA_REQUIREMENTS.md'));
    assert(instructions(result, request).includes('Ne podeduj storitve, kod ali cen'));
  }
});

test('pure price/explanation does not fetch the GUI flow; actual continuation and primary CPQ prompt retain it', async () => {
  for (const message of ['VPI cena', 'Kako se izračuna cena VPI?', 'Razloži SLA za VPI.']) {
    const result = await knowledge.retrieve(input(message));
    assert.equal(result.intent.mode, 'work');
    assert(!paths(result).includes('references/CPQ_FLOW.md'), message);
  }
  const continuation = await knowledge.retrieve(input('Kako nadaljujem po podpisu?'));
  assert(paths(continuation).includes('references/CPQ_FLOW.md'));
  const primary = knowledge.canonicalPrompts.find(prompt => prompt.id === 'CPQ_HELP');
  const result = await knowledge.retrieve(input(primary.message, { promptId: primary.id }));
  assert(paths(result).includes('references/CPQ_FLOW.md'));
});
