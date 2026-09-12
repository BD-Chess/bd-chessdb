import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const ROOT = process.cwd();
const HTML_REL = 'public/index-todo.html';
const RECEIPT_REL = 'public/evidence/AI8_Sudoku_R6_HF4_STATUS_PUBLICATION_RECEIPT_20260912.json';
const WORKFLOW_REL = '.github/workflows/ai8-sudoku-html-once.yml';
const SELF_REL = 'ops/ai8-sudoku-html-once.mjs';
const EXPECTED_OLD_SHA256 = '97385d630e022ba7188e18bcaac2ab3c40cb20d22f2736a5f0c6715b2126358e';
const EXPECTED_NEW_SHA256 = 'f80cbf47854a6962bfec8ad0fc69ef0aaa224fdd2e1b19398657aa2279a014db';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const htmlPath = path.join(ROOT, HTML_REL);
let html = fs.readFileSync(htmlPath, 'utf8');
assert(sha256(Buffer.from(html, 'utf8')) === EXPECTED_OLD_SHA256, 'index-todo.html is not the reviewed source blob; refusing stale patch.');

const marker = '<!-- ENTRY-UPDATES:START -->\n';
const newUpdate = '<details class="entry-updates" data-entry-updated="2026-09-12" open><summary><span><span class="entry-update-label">12 / 09 / 2026</span><span class="entry-en" lang="en">Current Sudoku status</span><span class="entry-sl" lang="sl">Trenutno stanje Sudoku</span></span></summary><div class="entry-update-grid"><article class="entry-update-item"><a data-entry-link="" href="crp/AI8_Sudoku_R6.html">Sudoku R6 · STANDBY</a><p><span class="entry-en" lang="en">HF4 bounded acceptance is complete: master 5/5 PASS, selftest 444/444 with 3 allowed SKIP, smoke 4/4 PASS and P1/P2/P3 PASS. The long scientific campaign was not started; scientific_final=false.</span><span class="entry-sl" lang="sl">Omejena HF4 sprejemna faza je zaključena: master 5/5 PASS, selftest 444/444 s 3 dovoljenimi SKIP, smoke 4/4 PASS in P1/P2/P3 PASS. Dolga znanstvena kampanja ni bila zagnana; scientific_final=false.</span></p></article></div><p class="entry-update-note"><span class="entry-en" lang="en">Exact source: HF3_ALL_LIVE_1789236581472973300.zip. <a href="evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json">Open the verified evidence receipt.</a></span><span class="entry-sl" lang="sl">Točni vir: HF3_ALL_LIVE_1789236581472973300.zip. <a href="evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json">Odpri preverjeno dokazno potrdilo.</a></span></p></details>\n';
assert((html.match(/data-entry-updated="2026-09-12"/g) || []).length === 0, '12 September Sudoku update already exists.');
assert(html.includes(marker), 'ENTRY-UPDATES marker missing.');
html = html.replace(marker, marker + newUpdate);

const oldCard = '<article class="card priority-card accent-gold"><div class="priority-head"><div><div class="priority-kicker"><span class="entry-bilingual"><span class="entry-en" lang="en">Building</span><span class="entry-sl" lang="sl">V izdelavi</span></span></div><h3>Sudoku R6</h3></div><span class="priority-status active"><span class="entry-bilingual"><span class="entry-en" lang="en">large arena</span><span class="entry-sl" lang="sl">velika arena</span></span></span></div><p><span class="entry-bilingual"><span class="entry-en" lang="en">The new large Sudoku arena is currently being built.</span><span class="entry-sl" lang="sl">Nova velika Sudoku arena je trenutno v izdelavi.</span></span></p><div class="tasks"><div class="task"><input data-task="sep26-sudoku-build" id="now-sudoku-build" type="checkbox"/><label for="now-sudoku-build"><span class="entry-bilingual"><span class="entry-en" lang="en">Review the delivered build against the R6 contract.</span><span class="entry-sl" lang="sl">Primerjaj dostavljeno gradnjo s pogodbo R6.</span></span></label></div><div class="task"><input data-task="sep26-sudoku-first-run" id="now-sudoku-first-run" type="checkbox"/><label for="now-sudoku-first-run"><span class="entry-bilingual"><span class="entry-en" lang="en">After build validation, run the first clean confirmation test and retain the evidence.</span><span class="entry-sl" lang="sl">Po validaciji gradnje izvedi prvi čisti potrditveni test in shrani dokaze.</span></span></label></div></div><div class="priority-links"><a href="crp/AI8_Sudoku_R6.html">Sudoku R6</a></div></article>';
const newCard = '<article class="card priority-card accent-gold"><div class="priority-head"><div><div class="priority-kicker"><span class="entry-bilingual"><span class="entry-en" lang="en">Bounded phase PASS · 12 September 2026</span><span class="entry-sl" lang="sl">Omejena faza PASS · 12. september 2026</span></span></div><h3>Sudoku R6</h3></div><span class="priority-status"><span class="entry-bilingual"><span class="entry-en" lang="en">standby</span><span class="entry-sl" lang="sl">na čakanju</span></span></span></div><p><span class="entry-bilingual"><span class="entry-en" lang="en">HF4 completed its bounded engineering acceptance and P1/P2/P3 pilots. The arena is no longer running; the separate long scientific campaign remains NOT_STARTED and no superiority claim is made.</span><span class="entry-sl" lang="sl">HF4 je zaključila omejeno inženirsko sprejemno fazo in pilote P1/P2/P3. Arena ne teče več; ločena dolga znanstvena kampanja ostaja NOT_STARTED in trditve o superiornosti ni.</span></span></p><div class="tasks"><div class="task"><input data-task="sep26-sudoku-retain" id="now-sudoku-retain" type="checkbox"/><label for="now-sudoku-retain"><span class="entry-bilingual"><span class="entry-en" lang="en">Retain the verified bounded evidence and its limitations.</span><span class="entry-sl" lang="sl">Ohrani preverjene omejene dokaze in njihove meje.</span></span><span class="hint"><span class="entry-bilingual"><span class="entry-en" lang="en">Master 5/5, selftest 444/444, smoke 4/4 and P1/P2/P3 PASS; long campaign executions 0.</span><span class="entry-sl" lang="sl">Master 5/5, selftest 444/444, smoke 4/4 in P1/P2/P3 PASS; izvedb dolge kampanje 0.</span></span></span></label></div><div class="task"><input data-task="sep26-sudoku-next-campaign" id="now-sudoku-next-campaign" type="checkbox"/><label for="now-sudoku-next-campaign"><span class="entry-bilingual"><span class="entry-en" lang="en">Decide whether to design a separately identified long scientific campaign or a successor version.</span><span class="entry-sl" lang="sl">Odloči, ali naj zasnujemo ločeno označeno dolgo znanstveno kampanjo ali naslednjo različico.</span></span></label></div></div><div class="priority-links"><a href="crp/AI8_Sudoku_R6.html">Sudoku R6</a><a href="evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json"><span class="entry-bilingual"><span class="entry-en" lang="en">Final evidence</span><span class="entry-sl" lang="sl">Končni dokazi</span></span></a></div></article>';
assert(html.split(oldCard).length === 2, 'Expected exactly one stale visible Sudoku priority card.');
html = html.replace(oldCard, newCard);

const oldPlan = 'Active lanes (BD status, 2026-09-11):\\n1. TSP: five parallel research arenas running\\n2. Trading: two test arenas + BDTA just started\\n3. Sudoku R6: new large arena in build';
const newPlan = 'Active lanes (retained 2026-09-11 context; Sudoku updated 2026-09-12):\\n1. TSP: five parallel research arenas running\\n2. Trading: two test arenas + BDTA just started\\n3. Sudoku R6: bounded phase PASS; STANDBY; long scientific campaign NOT_STARTED';
assert(html.split(oldPlan).length === 2, 'Expected exactly one stale Sudoku line in copied plan.');
html = html.replace(oldPlan, newPlan);

const htmlBytes = Buffer.from(html, 'utf8');
assert(sha256(htmlBytes) === EXPECTED_NEW_SHA256, `Patched HTML hash mismatch: ${sha256(htmlBytes)}`);
assert(html.includes('Sudoku R6 · STANDBY'), 'New current Sudoku update missing.');
assert(html.includes('Bounded phase PASS · 12 September 2026'), 'New priority card missing.');
assert(html.includes('data-entry-updated="2026-09-11"'), 'Historical 11 September snapshot was lost.');
for (const ref of ['data/BD_MASTER_ARENA_REGISTER_LATEST.json','data/BD_PROJECT_STATE_LATEST.json','data/BD_MORNING_DELTA_LATEST.json']) {
  assert((html.split(ref).length - 1) === 1, `Authoritative JSON reference count changed for ${ref}.`);
}
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
assert(scripts.length === 6, `Expected 6 inline scripts, found ${scripts.length}.`);
for (const [index, code] of scripts.entries()) new vm.Script(code, { filename: `index-todo-inline-${index + 1}.js` });
fs.writeFileSync(htmlPath, htmlBytes);

const receipt = {
  schema: 'AI8_SUDOKU_R6_STATUS_PUBLICATION_RECEIPT_V2',
  generated_at: '2026-09-12T22:52:08+02:00',
  source_bundle: {
    filename: 'HF3_ALL_LIVE_1789236581472973300.zip',
    sha256: 'e1c5b282beaa0ef14a7ff15cc166852ca5e05c9ef459f9521243ca99f42a2b5f'
  },
  validated_state_commit: 'e9a9edd10b1e1dec4be11dae3cbc7360cffe0786',
  state_publication_commit: '55bf8d72fed5dd2770da0e80e785e1c8c07f6994',
  validation_workflow: {
    run_id: 34718026580,
    name: 'AI8 Sudoku status one-shot',
    conclusion: 'success',
    state_validator: 'scripts/validate-8z-control-state.js',
    state_validator_result: 'PASS'
  },
  published_state: {
    arena_id: 'sudoku-r6-proofatlas',
    old_status: 'RUNNING',
    new_status: 'STANDBY',
    bounded_phase: 'PASS',
    long_scientific_campaign: 'NOT_STARTED',
    scientific_final: false
  },
  files: {
    'public/data/BD_MASTER_ARENA_REGISTER_LATEST.json': {
      git_blob_sha: '27207d53759aa1e0d81201f043b633a5cb972d17',
      sha256: '0d44f5fcbfaff7fde662c58564f9c6869311bafbcf528567807b85c501a0f36d'
    },
    'public/data/BD_PROJECT_STATE_LATEST.json': {
      git_blob_sha: '43d1b69f56fa47fca3249db42ccd777aaaa38d44',
      sha256: '1ed926289ee2500bc4b4f4face4885782d5152011d09af5d746ef1de21c04d18'
    },
    'public/data/BD_MORNING_DELTA_LATEST.json': {
      git_blob_sha: '468b70c917c46667dc3a010caf14caab2aaad443',
      sha256: '64eb8c14d7b3638604f02973874713883803308d09ee450841b7c48dbb55b51d'
    },
    'public/evidence/AI8_Sudoku_R6_HF4_BOUNDED_FINAL_20260912.json': {
      git_blob_sha: 'ddf93068ae3ca55029ac033290f7acb79cf1f48c',
      sha256: '160d5a8f4820700f1bf9e32ca04cb39580147f0752030ebb116a3374ad923e04'
    },
    'public/index-todo.html': {
      sha256: EXPECTED_NEW_SHA256,
      bytes: htmlBytes.length
    }
  },
  html_projection: {
    path: HTML_REL,
    source_change_required: true,
    reason: 'The data-driven 8Z Control projection was already accurate, but the visible static Sudoku status card, priority workbench and copied plan still described the arena as being built. Those Sudoku-only surfaces were corrected while the explicitly dated 11 September snapshot was retained as history.',
    validation: {
      html_parse: 'PASS',
      inline_javascript_syntax: 'PASS_6_OF_6',
      authoritative_json_references: 'PASS',
      unrelated_page_sections_preserved: true
    }
  },
  production_action: 'The exact state and minimal Sudoku-only HTML correction are committed to GitHub main and published by the existing GitHub-to-Netlify and GitHub Pages workflows.'
};
const receiptPath = path.join(ROOT, RECEIPT_REL);
fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  html_sha256: EXPECTED_NEW_SHA256,
  html_bytes: htmlBytes.length,
  inline_scripts_checked: scripts.length,
  receipt_sha256: sha256(fs.readFileSync(receiptPath)),
  historical_snapshot_preserved: true
}, null, 2));

for (const rel of [WORKFLOW_REL, SELF_REL]) {
  const target = path.join(ROOT, rel);
  if (fs.existsSync(target)) fs.rmSync(target);
}
