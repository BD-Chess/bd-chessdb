#!/usr/bin/env python3
"""Materialize independently verified 2026-11-23 LLM R4 JSON on a clean branch from main.

Expected release archive is a write-isolated Git blob, with manifest SHA-256 for each output.
It is created out of the local reproducible research workspace; this script never edits raw research data.
"""
from __future__ import annotations
import base64, hashlib, io, json, os, pathlib, urllib.request, zipfile
ROOT=pathlib.Path.cwd()
RELEASE_ZIP_SHA256='83529b7ffce7dfef1dcb7a2fd29dc860573afdf52bd8cf5ccc41ab18bdd0b4ab'
BLOB_SHA='a00d6a28c7d34ec4be3a2f9c81d89532cb5e096f'
TARGET='public/llms'
DATE='2026-11-23'
TOKEN=os.environ['GITHUB_TOKEN']
URL='https://api.github.com/repos/BD-Chess/bd-chessdb/git/blobs/'+BLOB_SHA
req=urllib.request.Request(URL,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ai8-llm-r4-materialize'})
with urllib.request.urlopen(req,timeout=40) as r:
    data=json.load(r)
assert data['encoding']=='base64' and data['sha']==BLOB_SHA
zbytes=base64.b64decode(data['content'].replace('\n',''))
assert hashlib.sha256(zbytes).hexdigest()==RELEASE_ZIP_SHA256, 'ZIP identity mismatch'
with zipfile.ZipFile(io.BytesIO(zbytes),'r') as z:
    manifest=json.loads(z.read('release_manifest.json'))
    assert manifest['schema']=='ai8-llm-r4-release-v1' and manifest['capture']==DATE
    for name,spec in manifest['files'].items():
        assert name in ['meta_index.json','sources.json','commentary_sl.json','captures.json']
        content=z.read(name)
        assert len(content)==spec['size'] and hashlib.sha256(content).hexdigest()==spec['sha256']
        obj=json.loads(content)
        if name=='meta_index.json':
            assert obj['data_fetched']==DATE and obj['capture_scope']['refreshed_sources']==['arc_prize','artificial_analysis','vals_ai']
            assert obj['counts']['sources_accepted']==35 and obj['counts']['boards_used']==157
            assert obj['counts']['models_ranked']==174
        if name=='captures.json':
            assert obj['latest']==DATE and len(obj['captures'])==3
        if name=='sources.json':
            assert obj['fetched']==DATE and len(obj['accepted'])==35
        p=ROOT/TARGET/name
        p.write_bytes(content)
        if name!='captures.json':
            archive=ROOT/TARGET/'data'/DATE/name
            archive.parent.mkdir(parents=True,exist_ok=True)
            archive.write_bytes(content)
    updates_path=ROOT/TARGET/'updates.json'
    updates=json.loads(updates_path.read_text(encoding='utf-8'))
    assert updates['updated']==DATE and len(updates['items'])>=3
    updates['baseline_capture']=DATE
    updates['title']={'sl':'Novosti in spremljani kandidati · R4','en':'Updates and tracked candidates · R4'}
    updates['scope']={
      'sl':'Nov zajem R4 z dne 23. 11. 2026: preverjenih 35 virov, izračunane nove meritve iz ARC Prize, Artificial Analysis in Vals AI. Preostalih 32 virov je ohranjenih z izvirnimi datumi rezultatov; Arena API je za razširjeni zajem vračal 502. Tu spremljamo tudi specializirane modele in agentne sisteme, ki ne sodijo v skupno lestvico.',
      'en':'New R4 capture 23 Nov 2026: 35 sources checked, new measured data from ARC Prize, Artificial Analysis and Vals AI. The remaining 32 sources retain their original score dates; the Arena API returned 502 for the expanded capture. We also track specialized models and agent systems outside the general ranking.'
    }
    updates_path.write_text(json.dumps(updates,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    tests=ROOT/'tests/llms-page.test.cjs'
    s=tests.read_text(encoding='utf-8')
    assert "assert.equal(UPDATES.baseline_capture, '2026-11-20');" in s
    s=s.replace("assert.equal(UPDATES.baseline_capture, '2026-11-20');","assert.equal(UPDATES.baseline_capture, '2026-11-23');")
    assert "if (CAPS.latest === '2026-11-20')" in s
    s=s.replace("if (CAPS.latest === '2026-11-20')","if (CAPS.latest === '2026-11-23')")
    s=s.replace("  assert.equal(META.data_fetched, CAPS.latest);","  assert.equal(META.data_fetched, CAPS.latest);\n  assert.ok(CAPS.captures.some(c => c.date === '2026-11-20'), 'the R3 capture is archived');\n  if (CAPS.latest === '2026-11-23') {\n    const astra = META.models.find(m => m.model_id === 'gpt-6.2-astra');\n    assert.ok(astra && astra.n_sources >= 5 && astra.overall_rank, 'R4 ARC Prize independently covers Astra');\n    assert.deepEqual(META.capture_scope, SRC.capture_scope, 'R4 provenance shared by model and sources');\n  }")
    tests.write_text(s,encoding='utf-8')
    readme=ROOT/'docs/LLMS_R4_20261123.md'
    readme.write_text("""# LLM meta-index R4 · 2026-11-23

Actual 23 November targeted scientific refresh, not a date relabel.

## Method

- Original R2 raw source archive and the v2 builder were recovered from the canonical project Drive.
- The unavailable original R3 raw source files were **not fabricated**. Four affected sources were reconstructed from public R3 model-level board scores, retaining original R2 observations where R3 did not publish them; the rebuilt baseline recovered all 174 ranked models and the first 25 published scores exactly.
- 35 source families rechecked through 91 HTTP probes; 75 HTTP 200 and 16 upstream failures. **Availability is not data recapture.**
- Updated scores for only three first-party, machine-readable sources: ARC Prize (full ARC-AGI-1/2/3 JSON), Artificial Analysis (public Next.js RSC model metrics) and Vals AI (13 current benchmark JSONs). No inferred benchmark numbers.
- Other 32 sources carried with their own original board dates. Expanded LMArena HF fetch returned HTTP 502: R3 Arena data retained, not claimed newly measured.
- Category weights, normalization method and R1 comparison panel remain unchanged. Historical R3 and R1 public JSONs retained byte-identically.

## Evidence

Project Drive: `GPT Projects/AI8_LLM_META_INDEX/R4/` · full primary source captures, old raw, reconstructed baseline, scripts, SHA-256 evidence manifest, calculated outputs.

R4 Drive evidence ZIP ID: `1d8UzQ-NrjpoG8NJ2Q0pfdC3ev28XRaS5`.
R4 release ZIP ID: `1ZMQ5nvzcKtsyx08pI7Nr7-bBZLgZju8G`.

## Changes at a glance

- GPT-6.2 Astra: #12 76.9 (4 sources) -> #9 78.8 (5 sources).
- GPT-6.2 Sol: #16 69.7 (4 sources) -> #15 70.5 (5 sources).
- Gemini 4 Neon: #3 88.3 (3 sources) unchanged.
- Gemini 4 Hydrogen: #14 75.5 (7 sources) -> #13 76.8 (8 sources).

These ranks are relative to one fixed model panel, not calibrated probabilities or proof of universal superiority.

## Reproduction caveat

R3 source recovery is an audited inference from published board-level scores, not the original upstream R3 raw archive. The R4 evidence ZIP labels this explicitly; no claim of a full 35-source re-run is made.
""",encoding='utf-8')
    print('R4 MATERIALIZED',DATE,'ZIP_SHA256',RELEASE_ZIP_SHA256,'archived_sources',len(manifest['files'])-1)
