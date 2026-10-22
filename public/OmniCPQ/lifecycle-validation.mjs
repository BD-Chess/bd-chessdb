// Skupna strukturna in semantična kontrola; brez odvisnosti od okolja odjemalca.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const placeholder = /^(?:unknown|manjka|todo|tbd|n\/?a|ni podano|brez dokaza|[-–—.]*)$/i;
const concrete = (value, seen = new Set()) => {
  if (typeof value === 'string') return nonblank(value) && !placeholder.test(value.trim());
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if ((!object(value) && !Array.isArray(value)) || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some(item => concrete(item, seen));
};

/** Vrne slovenski seznam problemov; [] pomeni skladnost zapisa, ne dokaza resničnosti. */
export function lifecycleIssues(data) {
  const issues = [];
  const problem = (path, message) => issues.push(`${path}: ${message}`);
  const record = (value, path, required, allowed = required) => {
    if (!object(value)) { problem(path, 'mora biti objekt.'); return false; }
    for (const key of required) if (!own(value, key)) problem(`${path}.${key}`, 'manjka obvezno polje.');
    for (const key of Object.keys(value)) if (!allowed.includes(key)) problem(`${path}.${key}`, 'neznano polje.');
    return true;
  };
  const string = (value, path, requiredContent = false, nullable = false) => {
    if (nullable && value === null) return;
    if (typeof value !== 'string') problem(path, nullable ? 'mora biti niz ali null.' : 'mora biti niz.');
    else if (requiredContent && !nonblank(value)) problem(path, 'mora vsebovati neprazno besedilo.');
  };
  const choice = (value, path, allowed) => {
    if (!allowed.includes(value)) problem(path, `dovoljene vrednosti so ${allowed.join(', ')}.`);
  };
  const array = (value, path, visit, minimum = 0) => {
    if (!Array.isArray(value)) { problem(path, 'mora biti seznam.'); return []; }
    if (value.length < minimum) problem(path, `zahteva vsaj ${minimum} zapis.`);
    for (let i = 0; i < value.length; i += 1) visit?.(value[i], `${path}[${i}]`, i);
    return value;
  };
  const strings = (value, path, minimum = 0, content = false, unique = false) => {
    const seen = new Set();
    return array(value, path, (item, itemPath) => {
      string(item, itemPath, content);
      if (unique && typeof item === 'string') {
        if (seen.has(item)) problem(itemPath, `podvojena referenca ${item}.`);
        seen.add(item);
      }
    }, minimum);
  };
  const idMap = (items, key, path) => {
    const map = new Map();
    items.forEach((item, index) => {
      if (!object(item) || !nonblank(item[key])) return;
      if (map.has(item[key])) problem(`${path}[${index}].${key}`, `podvojen ID ${item[key]}.`);
      else map.set(item[key], item);
    });
    return map;
  };
  const refs = (ids, map, path, name) => {
    if (!Array.isArray(ids)) return;
    ids.forEach((id, index) => {
      if (typeof id === 'string' && !map.has(id)) problem(`${path}[${index}]`, `${name} ${id} ne obstaja.`);
    });
  };

  if (!record(data, '$', ['schema', 'kind', 'service', 'context', 'sources', 'requirements', 'open_questions'],
    ['schema', 'kind', 'service', 'context', 'sources', 'requirements', 'tests', 'draft', 'lifecycle_states', 'open_questions', 'coverage'])) return issues;
  if (data.schema !== 'omnicpq.lifecycle-output.v1') problem('$.schema', 'zahtevana vrednost je omnicpq.lifecycle-output.v1.');
  choice(data.kind, '$.kind', ['TEST_PLAN', 'BUSINESS_REQUIREMENT']);
  string(data.service, '$.service', true);
  if (record(data.context, '$.context', ['model_version', 'environment'], ['model_version', 'environment', 'requirement_version'])) {
    string(data.context.model_version, '$.context.model_version', false, true);
    choice(data.context.environment, '$.context.environment', ['STAGE', 'PROD', 'UNKNOWN', 'SYNTHETIC']);
    if (own(data.context, 'requirement_version')) string(data.context.requirement_version, '$.context.requirement_version', false, true);
  }
  const environment = object(data.context) ? data.context.environment : undefined;
  const sources = array(data.sources, '$.sources', (source, path) => {
    if (!record(source, path, ['source_id', 'title', 'role', 'version', 'locator', 'sha256'])) return;
    string(source.source_id, `${path}.source_id`, true);
    string(source.title, `${path}.title`);
    choice(source.role, `${path}.role`, ['APPROVED_REQUIREMENT', 'MODEL', 'MANUAL', 'OBSERVATION', 'DATED_CASE', 'PROPOSAL', 'SYNTHETIC_APPROVED_FIXTURE', 'UNKNOWN']);
    string(source.version, `${path}.version`, false, true);
    string(source.locator, `${path}.locator`);
    string(source.sha256, `${path}.sha256`, false, true);
    if (typeof source.sha256 === 'string' && !/^[a-f0-9]{64}$/.test(source.sha256)) problem(`${path}.sha256`, 'mora biti 64 malih šestnajstiških znakov ali null.');
    if (source.role === 'SYNTHETIC_APPROVED_FIXTURE' && environment !== 'SYNTHETIC') problem(`${path}.role`, 'SYNTHETIC_APPROVED_FIXTURE je dovoljen samo v okolju SYNTHETIC.');
  });
  const sourceMap = idMap(sources, 'source_id', '$.sources');
  const approved = source => object(source) && concrete(source.title) && concrete(source.locator)
    && (source.role === 'APPROVED_REQUIREMENT' || (source.role === 'SYNTHETIC_APPROVED_FIXTURE' && environment === 'SYNTHETIC'));
  const hasApproved = ids => Array.isArray(ids) && ids.some(id => approved(sourceMap.get(id)));
  const requirements = array(data.requirements, '$.requirements', (requirement, path) => {
    if (!record(requirement, path, ['requirement_id', 'text', 'approval_status', 'source_ids'])) return;
    string(requirement.requirement_id, `${path}.requirement_id`, true);
    string(requirement.text, `${path}.text`, true);
    choice(requirement.approval_status, `${path}.approval_status`, ['CONFIRMED', 'PROPOSED', 'UNKNOWN', 'CONFLICT']);
    strings(requirement.source_ids, `${path}.source_ids`, 0, true, true);
    refs(requirement.source_ids, sourceMap, `${path}.source_ids`, 'vir');
    if (requirement.approval_status === 'CONFIRMED' && !hasApproved(requirement.source_ids)) problem(`${path}.source_ids`, 'potrjena zahteva potrebuje obstoječ odobren vir z naslovom in lokacijo.');
  });
  const requirementMap = idMap(requirements, 'requirement_id', '$.requirements');
  strings(data.open_questions, '$.open_questions');

  if (data.kind === 'TEST_PLAN') {
    for (const key of ['tests', 'coverage']) if (!own(data, key)) problem(`$.${key}`, 'manjka obvezno polje za TEST_PLAN.');
  }
  const tests = own(data, 'tests') ? array(data.tests, '$.tests', (test, path) => {
    if (!record(test, path, ['test_id', 'requirement_ids', 'priority', 'preconditions', 'input', 'steps', 'expected_result', 'execution_status', 'actual_result', 'evidence'])) return;
    string(test.test_id, `${path}.test_id`, true);
    strings(test.requirement_ids, `${path}.requirement_ids`, 1, true, true);
    refs(test.requirement_ids, requirementMap, `${path}.requirement_ids`, 'zahteva');
    choice(test.priority, `${path}.priority`, ['P0', 'P1', 'P2']);
    strings(test.preconditions, `${path}.preconditions`);
    if (!object(test.input)) problem(`${path}.input`, 'mora biti objekt.');
    strings(test.steps, `${path}.steps`, 1, true);
    const expected = test.expected_result;
    if (record(expected, `${path}.expected_result`, ['text', 'oracle_status', 'source_ids'], ['text', 'oracle_status', 'source_ids', 'expected_value'])) {
      string(expected.text, `${path}.expected_result.text`, true);
      choice(expected.oracle_status, `${path}.expected_result.oracle_status`, ['CONFIRMED', 'PROPOSED', 'ORACLE_PENDING', 'CONFLICT']);
      strings(expected.source_ids, `${path}.expected_result.source_ids`, 0, true, true);
      refs(expected.source_ids, sourceMap, `${path}.expected_result.source_ids`, 'vir');
      if (expected.oracle_status === 'CONFIRMED') {
        if (!hasApproved(expected.source_ids)) problem(`${path}.expected_result.source_ids`, 'potrjen oracle potrebuje obstoječ odobren vir z naslovom in lokacijo.');
        if (Array.isArray(test.requirement_ids)) for (const id of test.requirement_ids) {
          const requirement = requirementMap.get(id);
          if (requirement?.approval_status !== 'CONFIRMED' || !hasApproved(requirement.source_ids)) problem(`${path}.requirement_ids`, `potrjen oracle zahteva povezano potrjeno zahtevo ${id} z odobrenim virom.`);
        }
      }
    }
    choice(test.execution_status, `${path}.execution_status`, ['NOT_RUN', 'BLOCKED', 'PASS', 'FAIL', 'INCOMPLETE']);
    if (!(test.actual_result === null || typeof test.actual_result === 'string' || object(test.actual_result))) problem(`${path}.actual_result`, 'mora biti niz, objekt ali null.');
    const evidence = array(test.evidence, `${path}.evidence`, (item, itemPath) => {
      if (!record(item, itemPath, ['kind', 'description', 'locator'])) return;
      choice(item.kind, `${itemPath}.kind`, ['OBSERVED', 'USER_REPORTED']);
      string(item.description, `${itemPath}.description`, true);
      string(item.locator, `${itemPath}.locator`, true);
    });
    if (test.execution_status === 'NOT_RUN') {
      if (test.actual_result !== null) problem(`${path}.actual_result`, 'NOT_RUN zahteva null.');
      if (evidence.length) problem(`${path}.evidence`, 'NOT_RUN zahteva prazen seznam dokazov.');
    }
    if (['PASS', 'FAIL'].includes(test.execution_status)) {
      if (!concrete(test.actual_result)) problem(`${path}.actual_result`, 'PASS/FAIL zahteva konkreten neprazen dejanski rezultat.');
      if (!object(expected) || expected.oracle_status !== 'CONFIRMED') problem(`${path}.expected_result.oracle_status`, 'PASS/FAIL zahteva CONFIRMED oracle.');
      if (!evidence.length || evidence.some(item => !object(item) || !['OBSERVED', 'USER_REPORTED'].includes(item.kind) || !concrete(item.description) || !concrete(item.locator))) problem(`${path}.evidence`, 'PASS/FAIL zahteva konkretne neprazne dokaze z vrsto, opisom in lokacijo.');
    }
  }, 1) : [];
  const testMap = idMap(tests, 'test_id', '$.tests');

  if (own(data, 'coverage')) {
    const coverageIds = new Set();
    const edges = new Set();
    array(data.coverage, '$.coverage', (row, path) => {
      if (!record(row, path, ['requirement_id', 'test_ids', 'gap'])) return;
      string(row.requirement_id, `${path}.requirement_id`, true);
      if (typeof row.requirement_id === 'string') {
        if (coverageIds.has(row.requirement_id)) problem(`${path}.requirement_id`, `podvojena vrstica pokritosti ${row.requirement_id}.`);
        coverageIds.add(row.requirement_id);
        if (!requirementMap.has(row.requirement_id)) problem(`${path}.requirement_id`, `zahteva ${row.requirement_id} ne obstaja.`);
      }
      const ids = strings(row.test_ids, `${path}.test_ids`, 0, true, true);
      refs(row.test_ids, testMap, `${path}.test_ids`, 'test');
      string(row.gap, `${path}.gap`, false, true);
      if (Array.isArray(row.test_ids) && !ids.length && !nonblank(row.gap)) problem(`${path}.gap`, 'nepokrita zahteva potrebuje opis vrzeli.');
      ids.forEach(id => {
        edges.add(JSON.stringify([row.requirement_id, id]));
        const test = testMap.get(id);
        if (test && (!Array.isArray(test.requirement_ids) || !test.requirement_ids.includes(row.requirement_id))) problem(`${path}.test_ids`, `test ${id} nima povratne povezave na zahtevo ${row.requirement_id}.`);
      });
    });
    for (const id of requirementMap.keys()) if (!coverageIds.has(id)) problem('$.coverage', `manjka vrstica pokritosti zahteve ${id}.`);
    tests.forEach((test, index) => {
      if (!object(test) || !Array.isArray(test.requirement_ids)) return;
      for (const id of test.requirement_ids) if (!edges.has(JSON.stringify([id, test.test_id]))) problem(`$.tests[${index}].requirement_ids`, `v pokritosti manjka povezava ${id} → ${test.test_id}.`);
    });
  }

  if (data.kind === 'BUSINESS_REQUIREMENT') {
    for (const key of ['draft', 'lifecycle_states']) if (!own(data, key)) problem(`$.${key}`, 'manjka obvezno polje za BUSINESS_REQUIREMENT.');
  }
  if (own(data, 'draft')) {
    const textKeys = ['title', 'business_goal', 'as_is', 'to_be'];
    const listKeys = ['scope', 'rules', 'billing', 'lifecycle', 'integrations', 'acceptance_criteria', 'proposed_work_items'];
    if (record(data.draft, '$.draft', [...textKeys, ...listKeys])) {
      for (const key of textKeys) string(data.draft[key], `$.draft.${key}`);
      for (const key of listKeys) strings(data.draft[key], `$.draft.${key}`);
    }
  }
  if (own(data, 'lifecycle_states') && record(data.lifecycle_states, '$.lifecycle_states', ['proposal', 'approved', 'implemented', 'tested'])) {
    for (const key of ['proposal', 'approved', 'implemented', 'tested']) {
      const state = data.lifecycle_states[key];
      const path = `$.lifecycle_states.${key}`;
      if (!record(state, path, ['status', 'source_ids', 'note'])) continue;
      choice(state.status, `${path}.status`, ['UNKNOWN', 'NOT_PROVIDED', 'PROPOSED', 'CONFIRMED', 'PARTIAL', 'REJECTED']);
      strings(state.source_ids, `${path}.source_ids`, 0, true, true);
      refs(state.source_ids, sourceMap, `${path}.source_ids`, 'vir');
      string(state.note, `${path}.note`);
      if (state.status === 'CONFIRMED') {
        if (key === 'approved' && !hasApproved(state.source_ids)) problem(`${path}.source_ids`, 'potrjena odobritev potrebuje obstoječ odobren vir z naslovom in lokacijo.');
        else if (!Array.isArray(state.source_ids) || !state.source_ids.some(id => {
          const source = sourceMap.get(id);
          return source && concrete(source.title) && concrete(source.locator);
        })) problem(`${path}.source_ids`, 'potrjeno stanje potrebuje obstoječ vir z naslovom in lokacijo.');
      }
    }
  }
  return issues;
}

// Ob uvozu v brskalniku se Node API-ji ne nalagajo.
if (typeof process !== 'undefined' && process.versions?.node && process.argv[1]) {
  const { pathToFileURL } = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
      if (!process.argv[2]) throw new Error('Uporaba: node scripts/validate_lifecycle.mjs FILE');
      const { readFile } = await import('node:fs/promises');
      const issues = lifecycleIssues(JSON.parse(await readFile(process.argv[2], 'utf8')));
      if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
      else console.log('Zapis je skladen; odobritev in izvedba nista neodvisno preverjeni.');
    } catch (error) { console.error(`Napaka: ${error.message}`); process.exitCode = 1; }
  }
}
