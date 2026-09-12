import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'public', 'data');
const EVIDENCE = path.join(ROOT, 'public', 'evidence');
const NOW = '2026-09-12T22:39:43+02:00';
const AS_OF = '2026-09-12T20:09:51+02:00';
const SOURCE = 'HF3_ALL_LIVE_1789236581472973300.zip';
const SOURCE_SHA256 = 'e1c5b282beaa0ef14a7ff15cc166852ca5e05c9ef459f9521243ca99f42a2b5f';
const RUNTIME_ID = 'fea185d275321c519209af404acb8ebab887bcefb0ae86c26e3f4591ae9d0f02';
const PUBLIC_RECORD = '/evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json';
const WORKFLOW = '.github/workflows/ai8-sudoku-status-once.yml';
const SELF = 'ops/ai8-sudoku-status-once.mjs';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function writeJson(rel, value) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}

const register = readJson('public/data/BD_MASTER_ARENA_REGISTER_LATEST.json');
const projects = readJson('public/data/BD_PROJECT_STATE_LATEST.json');
const previousRefresh = register.last_successful_refresh || register.generated_at;
const arena = register.arenas.find(a => a.arena_id === 'sudoku-r6-proofatlas');
assert(arena, 'Missing sudoku-r6-proofatlas.');
assert(arena.status === 'RUNNING', `Expected Sudoku RUNNING, got ${arena.status}.`);
assert(arena.running === true, 'Expected Sudoku running=true before transition.');
assert(String(arena.checkpoint).includes('258/443'), 'Unexpected prior Sudoku checkpoint; refuse stale patch.');
assert(register.status_counts.RUNNING === 11 && register.status_counts.STANDBY === 11, 'Unexpected prior status counters; refuse stale patch.');

register.generated_at = NOW;
register.last_successful_refresh = NOW;
register.source_boundary = 'GPT PROJECT EXACT UPLOAD + VERIFIED GOOGLE DRIVE LIVE EXTRACTS';
register.status_counts.RUNNING -= 1;
register.status_counts.STANDBY += 1;
register.state_corrections.push({
  arena_id: 'sudoku-r6-proofatlas',
  correction: 'The interim RUNNING acceptance state is superseded by the exact final HF3 ALL LIVE extract: bounded master acceptance and P1/P2/P3 pilots PASS; the long scientific campaign was not executed.',
  source_chat: 'Sudoku R6',
  confidence: 'HIGH'
});
register.state_history.push({
  timestamp: NOW,
  arena_id: 'sudoku-r6-proofatlas',
  old_status: 'RUNNING',
  new_status: 'STANDBY',
  old_value: 'HF4 acceptance/selftest 258/443 with 0 failures/errors',
  new_value: 'Bounded master 5/5 PASS; selftest 444/444 with 3 allowed SKIP; smoke 4/4 PASS; P1/P2/P3 PASS; long campaign executions 0; scientific_final=false',
  evidence: SOURCE,
  source_project_chat: 'Sudoku R6',
  confidence: 'HIGH'
});
Object.assign(arena, {
  version: 'v0.2.0 HF4_R1',
  branch: 'HF3/HF4 bounded acceptance / ProofAtlas',
  status: 'STANDBY',
  running: false,
  resume_ready: true,
  last_verified_at: AS_OF,
  last_verified_source: SOURCE,
  evidence_type: 'exact GPT Project upload; CRC-valid all-live extract with hash-bound master, native Windows, selftest, smoke and pilot receipts',
  checkpoint: 'Master 5/5 PASS · selftest 444/444 (441 PASS, 3 allowed SKIP) · smoke 4/4 PASS · P1/P2/P3 PASS',
  best_result: 'Package verify PASS (246); native Windows and field regression 23/23 PASS; P1 391 tasks, P2 72 tasks and P3 mechanism screen PASS',
  progress: 'STANDBY: bounded engineering acceptance and pilots complete; protected/long campaign executions 0; scientific_final=false',
  workers: 'W4 bounded smoke/pilot completed; no active workers',
  next_action: 'Retain the completed bounded evidence; use it to decide or design a separately identified long scientific campaign or successor version before any scientific promotion.',
  attention: 'WATCH',
  confidence: 'HIGH',
  notes: 'Scientific superiority is NOT_ESTABLISHED. P3 verified specialist mechanisms on deliberately selected tiny fixtures, but all 10 positive specialist comparisons cost more than the cheapest firing ordinary control; each niche is retained with a reopening condition.',
  public_link: '/crp/AI8_Sudoku_R6.html'
});
register.current_sudoku_evidence = {
  as_of: AS_OF,
  reviewed_at: NOW,
  source: SOURCE,
  sha256: SOURCE_SHA256,
  bytes: 13722495,
  zip_entries: 3021,
  uncompressed_bytes: 56523275,
  crc_status: 'PASS',
  runtime_identity: RUNTIME_ID,
  master_receipt_hash: 'b844fb456033eb0e9eb1f8a725f737dce47eb2b5ff8dcc473a849c2df535de2f',
  public_record: PUBLIC_RECORD,
  scope: 'HF4 bounded engineering acceptance and P1/P2/P3 pilots are complete PASS; long scientific campaign executions remain zero and scientific_final=false.'
};
register.partial_update_at = NOW;
register.partial_update_scope = `Sudoku-only exact-project refresh from ${SOURCE}; all unrelated arena states preserved.`;

projects.generated_at = NOW;
projects.last_successful_refresh = NOW;
projects.source_boundary = register.source_boundary;
const work = projects.machines.find(m => m.machine === 'Work PC');
assert(work, 'Missing Work PC record.');
assert(work.active_arena_ids.includes('sudoku-r6-proofatlas'), 'Sudoku is not in prior Work PC active list.');
work.active_arena_ids = work.active_arena_ids.filter(id => id !== 'sudoku-r6-proofatlas');
work.known_active_allocation = 'Four Work-PC arena lines remain marked active from the prior verified refresh: 8zTSP-R v0.1.1 relational-native, BD Trading Atlas v0.1.4-HF3, 8zMaterials legacy A3, and 8zMaterials v0.2.0F B6/H1. Sudoku HF4 bounded acceptance is complete and is no longer counted active.';
const project = projects.projects.find(p => p.project === 'Sudoku R6');
assert(project && project.status === 'RUNNING', 'Unexpected prior Sudoku project state.');
Object.assign(project, {
  status: 'STANDBY',
  last_change: 'Exact final HF3 ALL LIVE extract: master 5/5 PASS, selftest 444/444 with 3 allowed SKIP, smoke 4/4 PASS and P1/P2/P3 PASS. Long scientific campaign executions remain 0; scientific_final=false.',
  next_action: 'Retain the bounded result and decide/design a separately identified long scientific campaign or successor; do not promote pilot evidence into a scientific superiority claim.'
});
projects.partial_update_at = NOW;
projects.partial_update_scope = `Sudoku-only exact-project refresh from ${SOURCE}; unrelated project and machine state preserved.`;
projects.provenance_rule = register.provenance_rule;

const delta = {
  schema_version: '8z-control.v0.1',
  title: 'BD Arena Morning Delta',
  generated_at: NOW,
  previous_successful_refresh: previousRefresh,
  source_boundary: register.source_boundary,
  mode: 'BD_AI8_EXACT_PROJECT_SUDOKU_REFRESH',
  message: 'Exact final Sudoku HF4 extract: bounded master acceptance and P1/P2/P3 pilots PASS; arena moved RUNNING → STANDBY. The long scientific campaign remains NOT_STARTED.',
  changes: [{
    timestamp: NOW,
    arena_id: 'sudoku-r6-proofatlas',
    old_status: 'RUNNING',
    new_status: 'STANDBY',
    old_value: 'HF4 acceptance/selftest 258/443 with 0 failures/errors',
    new_value: 'Master 5/5 PASS; selftest 444/444 (441 PASS, 3 allowed SKIP); smoke 4/4 PASS; P1/P2/P3 PASS; long campaign executions 0; scientific_final=false',
    evidence: SOURCE,
    source_project_chat: 'Sudoku R6',
    confidence: 'HIGH'
  }]
};

const evidence = {
  schema: 'AI8_SUDOKU_R6_PUBLIC_EVIDENCE_V2',
  generated_at: NOW,
  as_of: AS_OF,
  source_bundle: {
    filename: SOURCE,
    sha256: SOURCE_SHA256,
    bytes: 13722495,
    zip_entries: 3021,
    uncompressed_bytes: 56523275,
    crc_status: 'PASS'
  },
  arena: 'v0.2.0 HF4_R1',
  runtime_identity: RUNTIME_ID,
  operational_verdict: {
    arena_status: 'STANDBY',
    bounded_phase: 'PASS',
    long_scientific_campaign: 'NOT_STARTED',
    scientific_final: false
  },
  master: {
    status: 'PASS',
    stages_completed: 5,
    stages_planned: 5,
    receipt_hash: 'b844fb456033eb0e9eb1f8a725f737dce47eb2b5ff8dcc473a849c2df535de2f',
    receipt_sha256: 'b84aec78e94608e601b0cf010590a934e008e6664ded73e27dc9600cd1867c68',
    acceptance_platform: 'win32',
    python_version: '3.12.10'
  },
  package_verify: { status: 'PASS', members: 246 },
  native_windows: {
    status: 'PASS',
    harness_revision: 'HF3_HF4_STALL_REGRESSION',
    field_regression: { status: 'PASS', completed: 23, planned: 23, errors: 0 },
    sha3_256: 'ea1d258c26f502f33fd99b1af89b614e09760958599bddf5d63294b04d4bc689'
  },
  selftest: {
    status: 'PASS', tests_run: 444, tests_planned: 444, passed: 441, skipped: 3, failures: 0, errors: 0,
    skip_reasons: [
      'Node unavailable: JS parity NOT_RUN',
      'explicit bounded Linux adapter; native Windows is separate',
      'platform does not permit this input-symlink fixture'
    ],
    sha3_256: '29871e501b31dabb67f4817ce25468be344a322e956f01460ed3820ef4f87ce6'
  },
  smoke: {
    status: 'PASS', completed: 4, planned: 4, errors: 0,
    receipt_hash: '5903128f49a6e912bead602913d4bbb5181803a4b4cfbb0b691887d08a262ae3',
    sha3_256: '767563d43b47c813de79817b5b383feb2b3842f98137db0beeced21bf2a7ddc9'
  },
  bounded_pilots: {
    status: 'PASS',
    P1: { accepted_puzzles: 23, budget_exhausted: false, expected_tasks: 391, hash: 'd50466913198a95f74a17a5748e0c450c27c9aeb22b17fc660d6509938a684cd', not_run_tasks: 0, reason: null, status: 'PASS', stop_reason: null },
    P2: { accepted_puzzles: 8, budget_exhausted: false, expected_tasks: 72, hash: '31f886f28009be6e9ac63424cc6b17f45658bc63dc3f9fd1c623a11f070e7a14', not_run_tasks: 0, reason: null, status: 'PASS', stop_reason: null },
    P3: { accepted_puzzles: null, budget_exhausted: null, expected_tasks: null, hash: '9ceb8de2e9bf2786d30967a17fbe0393dc93aab64e1e6d4bd8adec783f811786', not_run_tasks: null, reason: null, status: 'PASS', stop_reason: null },
    sha3_256: '9b4d5771428bd9d8c03cf6928947fed080c961ea977ecb0dee108b74dd3960cf'
  },
  p3_interpretation: {
    status: 'PASS', claim_status: 'VERIFIED', scientific_confirmation: false, superiority_claim: false,
    primary_comparisons: 10, specialist_costlier_than_cheapest_firing_control: 10,
    disposition: 'RANK_DONT_ELIMINATE: all specialist niches retained with explicit reopening conditions',
    scope: 'SOFTWARE_PATH_ACTIVATION_AND_BOUNDED_COST_ONLY',
    limitations: [
      'Deliberately selected tiny mechanism fixtures; activation frequencies are not natural-workload estimates.',
      'The two Atlas plans reuse one train/application pair; they are two algorithm paths, not two transfer observations.',
      'Constructed allowed-domain states do not claim derivation from empty-puzzle givens.',
      'Atlas application is a distinct canonical puzzle in the same constructed family; generalization and persistent-learning value remain open.',
      'All PATH FIRE checks use cold independently enumerated POM tables; charged setup dominates these simple effects.',
      'Native AIS PENDING at its finite prefix cap remains censored LIMIT; no exhaustive negative claim over the complete AIS grammar.',
      'No runtime campaign checkpoint policy is evaluated here. Capability, setup, oracle and evidence publication costs are separated.'
    ]
  },
  long_campaign_executions: 0,
  protected_executions: 0,
  scientific_final: false,
  claim_boundary: 'This is a verified bounded engineering acceptance and pilot result. It does not establish scientific superiority, and it does not claim that the long scientific campaign was executed.'
};

const registerLatest = 'public/data/BD_MASTER_ARENA_REGISTER_LATEST.json';
const projectLatest = 'public/data/BD_PROJECT_STATE_LATEST.json';
const deltaLatest = 'public/data/BD_MORNING_DELTA_LATEST.json';
writeJson(registerLatest, register);
writeJson(projectLatest, projects);
writeJson(deltaLatest, delta);
writeJson('public/data/BD_MASTER_ARENA_REGISTER_20260912_SUDOKU_FINAL_R1.json', register);
writeJson('public/data/BD_PROJECT_STATE_20260912_SUDOKU_FINAL_R1.json', projects);
writeJson('public/data/BD_MORNING_DELTA_20260912_SUDOKU_FINAL_R1.json', delta);
writeJson('public/evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json', evidence);

const statuses = new Set(['RUNNING','STANDBY','NEXT','BUILD','TEST','BLOCKED','DONE','UNCERTAIN']);
const required = ['arena_id','family','project','name','version','branch','status','running','resume_ready','last_verified_at','last_verified_source','source_chat','checkpoint','best_result','progress','workers','machine','next_action','attention','confidence','notes'];
const ids = new Set();
const counts = {};
for (const item of register.arenas) {
  for (const key of required) assert(Object.hasOwn(item, key), `${item.arena_id || '(unknown)'} missing ${key}.`);
  assert(item.arena_id && !ids.has(item.arena_id), `Duplicate/empty arena ${item.arena_id}.`);
  assert(statuses.has(item.status), `Bad status ${item.status}.`);
  assert(item.running === (item.status === 'RUNNING'), `running/status mismatch ${item.arena_id}.`);
  ids.add(item.arena_id);
  counts[item.status] = (counts[item.status] || 0) + 1;
}
for (const status of statuses) assert(Number(register.status_counts[status] || 0) === Number(counts[status] || 0), `Counter mismatch ${status}.`);
const referenced = new Set();
for (const p of projects.projects) for (const id of p.arena_ids) {
  assert(ids.has(id), `Unknown project arena ${id}.`);
  assert(!referenced.has(id), `Duplicate project arena ${id}.`);
  referenced.add(id);
}
for (const id of ids) assert(referenced.has(id), `Unreferenced arena ${id}.`);
for (const change of delta.changes) assert(ids.has(change.arena_id), `Unknown delta arena ${change.arena_id}.`);
assert(!work.active_arena_ids.includes('sudoku-r6-proofatlas'), 'Sudoku still listed active on Work PC.');
assert(arena.status === 'STANDBY' && arena.running === false, 'Sudoku transition failed.');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index-todo.html'), 'utf8');
for (const ref of ['data/BD_MASTER_ARENA_REGISTER_LATEST.json','data/BD_PROJECT_STATE_LATEST.json','data/BD_MORNING_DELTA_LATEST.json']) assert(html.includes(ref), `HTML missing ${ref}.`);

const receipt = {
  source_sha256: SOURCE_SHA256,
  arena_status: arena.status,
  status_counts: register.status_counts,
  register_sha256: sha256File(registerLatest),
  project_state_sha256: sha256File(projectLatest),
  morning_delta_sha256: sha256File(deltaLatest),
  evidence_sha256: sha256File('public/evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json')
};
console.log(JSON.stringify(receipt, null, 2));

// One-shot transport only: final production tree contains no helper workflow or patch script.
for (const rel of [WORKFLOW, SELF]) {
  const target = path.join(ROOT, rel);
  if (fs.existsSync(target)) fs.rmSync(target);
}
