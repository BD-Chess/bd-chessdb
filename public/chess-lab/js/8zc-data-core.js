/* Portable DATA v2; strict v1 validation precedes a separate logical migration. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessDataCore = api;
})(globalThis, function() {
  'use strict';
  const MiB = 1024 * 1024;
  const LIMITS = Object.freeze({ file:64*MiB, game:2000000, preferences:512*1024,
    evaluations:4*MiB, studies:13500000, evidence:16*MiB, simulation:32*MiB,
    timing:4*MiB, recovery:16*MiB });
  const V1_SECTIONS = Object.freeze(Object.fromEntries(Object.keys(LIMITS).filter(x=>x!=='file').map(x=>[x,1])));
  const SECTIONS = Object.freeze({...V1_SECTIONS,evidence:2});
  const PREFERENCE_KEYS={settings:new Set("allCDBSeconds allDCCSeconds allSFSeconds analysisLink analysisSource analysisTimeMs badgeInitialDelay bg cdbEnabled coachMode coachOpen dccClickAction dccDefenseCandidates dccDefenseCheck dccDefensePlies dccDepth dccEnabled dccEvalFloor dccOnly dccPolicy dccSensors dccStructureMode dccTakeover dccTieThreshold dccTopCandidates doubleBoard drawDelay evalMode flipBoard font historySize ioFormat nextDot notation opponentModel pieceSize retryInterval sfAnalysisDepth sfCardMode sfRootNodes showSimEval cdbStartOn cdbStartMoves cdbStartMode showTimers showTimestamps simGames simSpeed theme timerDisplayDefaults topN tryLaterDuration".split(' ')),analysis:new Set('analysisMode boardSource sfCardMode sfFullThreadsRequested hashMB engineMemoryPolicy analysisTimeMs deepTimeMs'.split(' ')),layout:new Set('focusMode workspaceWidth compact pauseOnDisagreement pauseOnSwing pauseSwingCp pauseOnMissing'.split(' '))};
  const NUMBER_SETTINGS=["cdbStartMoves", "allCDBSeconds", "allDCCSeconds", "allSFSeconds", "badgeInitialDelay", "dccDefenseCandidates", "dccDefensePlies", "dccDepth", "dccEvalFloor", "dccTieThreshold", "dccTopCandidates", "drawDelay", "retryInterval", "sfAnalysisDepth", "sfRootNodes", "simGames", "simSpeed", "timerDisplayDefaults", "topN", "tryLaterDuration", "analysisTimeMs"],BOOLEAN_SETTINGS=["cdbStartOn", "analysisLink", "cdbEnabled", "coachOpen", "dccDefenseCheck", "dccEnabled", "dccOnly", "flipBoard", "nextDot", "showSimEval", "showTimers", "showTimestamps", "doubleBoard"],STRING_SETTINGS=["cdbStartMode", "analysisSource", "bg", "coachMode", "dccClickAction", "dccPolicy", "dccStructureMode", "evalMode", "font", "historySize", "ioFormat", "notation", "opponentModel", "pieceSize", "sfCardMode", "theme"];
  const bytes = value => new TextEncoder().encode(typeof value==='string'?value:canonical(value)).length;
  const fail = text => { throw Error(text); };
  const object = v => !!v && typeof v==='object' && !Array.isArray(v);
  function exact(v, keys, label) {
    if (!object(v) || Object.keys(v).sort().join('|') !== [...keys].sort().join('|')) fail('Invalid '+label+' fields.');
  }
  function canonical(value, depth=0) {
    if (depth>160) fail('DATA nesting exceeds the supported limit.');
    if (value===null || typeof value==='boolean' || typeof value==='string') return JSON.stringify(value);
    if (typeof value==='number' && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';
    if (!object(value)) fail('DATA must contain only JSON values.');
    return '{'+Object.keys(value).sort().map(key=>{
      if (['__proto__','prototype','constructor'].includes(key)) fail('Unsafe DATA object property.');
      // Credentials have no logical adapter, including fields smuggled into nested records.
      if (/^(?:api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|password|credential|secret|lichess[-_]?token|anthropic[-_]?token|owner|lease)$/i.test(key)) fail('Credential or ownership field is not supported in DATA.');
      return JSON.stringify(key)+':'+canonical(value[key],depth+1);
    }).join(',')+'}';
  }
  async function digest(value) {
    const data=new TextEncoder().encode(canonical(value));
    const crypto = globalThis.crypto || (typeof require==='function' ? require('node:crypto').webcrypto : null);
    if (!crypto?.subtle) fail('SHA-256 is unavailable. Use a secure browser context.');
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function empty() { return {game:null,preferences:{settings:null,analysis:null,layout:null,language:null,appWidth:null,showTopLine:null},
    evaluations:{cache:{},positions:[]},studies:{collection:null,undoA:null,undoB:null},
    evidence:{snapshots:[],metadata:{version:1,pins:[]}},simulation:{schema:'chess-sim-archive',version:1,runs:[],events:[]},timing:null,
    recovery:{studyPending:null,evidencePending:[],simulationCheckpoint:null,legacyStudy:null,legacyEvidence:null,legacySimulation:null,legacyCheckpoint:null,recoveredDrafts:null,legacyAnalysis:null}}; }
  function counts(p,version=2) { return {gamePlies:p.game?.resume?.totalPlies??0,studies:p.studies.collection?.studies?.length||0,
    evidence:p.evidence.snapshots.length,positions:p.evaluations.positions.length,runs:p.simulation.runs.length,
    events:p.simulation.events.length,drafts:Object.values(p.recovery).filter(v=>Array.isArray(v)?v.length:v!==null).length,...(version===2?{pins:p.evidence.metadata.pins.length}:{})}; }
  function manifest(p,version=2) { return {bytes:bytes(p),sections:Object.fromEntries(Object.keys(SECTIONS).map(k=>[k,bytes(p[k])])),counts:counts(p,version)}; }
  function typedScores(v) {
    if (!v || typeof v!=='object') return;
    if (object(v.score)) {
      const s=v.score;
      if (!['cp','mate','decisive','unknown','terminal'].includes(s.type)) fail('Unsupported typed evaluation score.');
      for (const k of ['root','white','plies','moves']) if (s[k]!==undefined && s[k]!==null && !Number.isFinite(s[k])) fail('Invalid evaluation score.');
      if (s.type==='terminal' && !['checkmate','stalemate'].includes(s.state))fail('Invalid terminal score.');
      if (s.type==='mate' && !['root','white','plies','moves'].some(k=>Number.isFinite(s[k])))fail('Mate evaluation is missing its value.');
      if (s.type==='cp' && !Number.isFinite(s.root) && !Number.isFinite(s.white)) fail('Centipawn evaluation is missing its value.');
    }
    for (const item of Object.values(v)) typedScores(item);
  }
  function checkCollection(value, deps) {
    if (value===null) return;
    if (bytes(value)>4500000) fail('Studies exceed the 4.5 MB collection limit.');
    deps.StudyStore.validate(deps.Study,deps.Chess,value);
    for (const s of value.studies) {
      if (bytes(s)>deps.Study.LIMITS.bytes || Object.keys(s.nodes).length>deps.Study.LIMITS.nodes) fail('Study size/node limit exceeded.');
      deps.Study.validate(deps.Chess,s);
      if (!s.nodes[s.selectedId]) fail('Invalid Study cursor.');
    }
    if (value.activeId!==null && !value.studies.some(s=>s.id===value.activeId)) fail('Invalid active Study.');
    if (!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.appliedOperations)||value.appliedOperations.length>64||value.appliedOperations.some(x=>typeof x!=='string'||x.length>200)) fail('Unsupported Study operation ledger.');
    if (value.comparison?.question?.length>2000) fail('A/B question is too long.');
    for (const slot of ['A','B']) if (value.comparison?.[slot]) typedScores(value.comparison[slot]);
  }
  function checkGame(value,deps) {
    if (value===null) return;
    exact(value,['schema','pgn','topPick','resume'],'game');
    if (value.schema!=='chessbest-game/1' || typeof value.pgn!=='string' || bytes(value.pgn)>LIMITS.game) fail('Invalid game PGN.');
    const s=deps.Study.parsePGN(deps.Chess,value.pgn), line=[];
    let node=s.nodes.root; while(node.children.length) {node=s.nodes[node.children[0]];line.push(node);}
    const r=value.resume;
    if (!object(r) || !Number.isSafeInteger(r.cursor) || r.cursor<0 || r.cursor>line.length || r.totalPlies!==line.length || r.pgnLength!==value.pgn.length || r.fen!==(r.cursor?line[r.cursor-1].fen:s.rootFen)) fail('Game cursor/FEN does not match the complete PGN.');
    if (value.topPick!==null && (!object(value.topPick) || value.topPick.cursor!==r.cursor || value.topPick.totalPlies!==line.length || value.topPick.pgnLength!==value.pgn.length)) fail('Invalid Top Pick reference.');
  }
  // Exact saved ChessTime contract, without restore()'s anchor/flag normalization.
  // The boot recovery gate also uses this before application modules start.
  function checkClock(clock,paused=false) {
    exact(clock,['version','mode','initial','increment','turn','used','remaining','anchor','turnSpent','running','flagged'],'saved clock');
    if(clock.version!=='1.0.0'||!['elapsed','countdown'].includes(clock.mode)||!['w','b'].includes(clock.turn)||typeof clock.running!=='boolean'||paused&&clock.running)fail('Invalid paused workspace clock.');
    if(clock.flagged!==null&&!['w','b'].includes(clock.flagged))fail('Invalid saved clock flag.');
    const time=value=>{if(!Number.isFinite(value)||value<0)fail('Invalid saved clock time.');};
    for(const field of ['initial','increment','anchor','turnSpent'])time(clock[field]);
    for(const field of ['used','remaining']){exact(clock[field],['w','b'],'clock '+field);time(clock[field].w);time(clock[field].b);}
  }
  function checkTiming(timing,deps) {
    if(timing===null)return;
    exact(timing,['pgn','records','kind','humanStartPly','clock'],'workspace timing');
    if(typeof timing.pgn!=='string'||!Array.isArray(timing.records)||!['analysis','human','sim','lichess','dccbot'].includes(timing.kind)||!Number.isSafeInteger(timing.humanStartPly)||timing.humanStartPly<0)fail('Invalid workspace timing.');
    if(timing.pgn)deps.Study.parsePGN(deps.Chess,timing.pgn);
    checkClock(timing.clock,true);
    // Records may extend past the displayed PGN cursor and have null gaps.
    for(const row of timing.records) {
      if(row===null)continue;
      if(!object(row)||typeof row.at_utc!=='string'||!Number.isFinite(Date.parse(row.at_utc))||typeof row.san!=='string'||!row.san||typeof row.move!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(row.move))fail('Invalid workspace timing record.');
      for(const field of ['think_ms','white_elapsed_ms','black_elapsed_ms','clock_ms','analysis_ms'])if(['think_ms','white_elapsed_ms','black_elapsed_ms'].includes(field)||row[field]!==undefined)if(!Number.isFinite(row[field])||row[field]<0)fail('Invalid workspace record time.');
      for(const field of ['fen','afterFen'])if(typeof row[field]!=='string'||!new deps.Chess().validate_fen(row[field]).valid)fail('Invalid workspace record FEN.');
      checkClock(row.after);
    }
  }
  function validatePayload(p,deps,version=2) {
    exact(p,Object.keys(SECTIONS),'payload'); canonical(p);
    for (const [k,limit] of Object.entries(LIMITS)) if (k!=='file' && (k==='evidence'&&version===2?deps.Evidence.storageBytes(p[k]):bytes(p[k]))>limit) fail('DATA '+k+' section exceeds its limit.');
    checkGame(p.game,deps);
    exact(p.preferences,Object.keys(empty().preferences),'preferences');
    for (const k of ['settings','analysis','layout']) {
      const value=p.preferences[k];if(value===null)continue;
      if(!object(value))fail('Invalid '+k+' preferences.');
      for(const [field,item] of Object.entries(value)) {
        if(!PREFERENCE_KEYS[k].has(field))fail('Unsupported '+k+' preference field.');
        if(k==='settings'&&field==='dccSensors') {
          if(!object(item)||Object.entries(item).some(([name,v])=>!['stability','floor','volatility','trend','structure'].includes(name)||typeof v!=='boolean'))fail('Invalid DCC sensor preferences.');
        } else if(!['string','boolean','number'].includes(typeof item))fail('Invalid preference value.');
      }
    }
    const settings=p.preferences.settings;
    for(const name of NUMBER_SETTINGS)if(settings?.[name]!==undefined&&typeof settings[name]!=='number')fail('Invalid numeric preference.');
    for(const name of BOOLEAN_SETTINGS)if(settings?.[name]!==undefined&&typeof settings[name]!=='boolean')fail('Invalid boolean preference.');
    for(const name of STRING_SETTINGS)if(settings?.[name]!==undefined&&typeof settings[name]!=='string')fail('Invalid text preference.');
    if(settings?.dccTakeover!==undefined&&!['string','number'].includes(typeof settings.dccTakeover))fail('Invalid takeover preference.');

    if(settings?.cdbStartMoves!==undefined&&(!Number.isInteger(settings.cdbStartMoves)||settings.cdbStartMoves<1||settings.cdbStartMoves>30))fail('Invalid CDB opening length.');
    if(settings?.cdbStartMode!==undefined&&!['e4','d4','random_main','random_side'].includes(settings.cdbStartMode))fail('Invalid CDB opening mode.');
    if(settings?.theme!==undefined&&!['dark','light'].includes(settings.theme))fail('Invalid theme.');
    if(settings?.bg!==undefined&&!/^#[0-9a-f]{3,8}$/i.test(settings.bg))fail('Invalid background color.');
    if(settings?.font!==undefined&&!/^\d{1,2}px$/.test(settings.font))fail('Invalid font size.');
    const analysis=p.preferences.analysis,layout=p.preferences.layout;
    for(const name of ['sfFullThreadsRequested','hashMB','analysisTimeMs','deepTimeMs'])if(analysis?.[name]!==undefined&&typeof analysis[name]!=='number')fail('Invalid numeric engine preference.');
    for(const name of ['analysisMode','boardSource','sfCardMode','engineMemoryPolicy'])if(analysis?.[name]!==undefined&&typeof analysis[name]!=='string')fail('Invalid engine preference.');
    for(const name of ['workspaceWidth','pauseSwingCp'])if(layout?.[name]!==undefined&&typeof layout[name]!=='number')fail('Invalid numeric layout preference.');
    for(const name of ['compact','pauseOnDisagreement','pauseOnSwing','pauseOnMissing'])if(layout?.[name]!==undefined&&typeof layout[name]!=='boolean')fail('Invalid layout preference.');
    if(layout?.focusMode!==undefined&&!['auto','expanded'].includes(layout.focusMode))fail('Invalid focus preference.');
    if (p.preferences.language!==null&&!['sl','en'].includes(p.preferences.language)) fail('Invalid language.');
    if (p.preferences.appWidth!==null&&!['375','390','402','430'].includes(p.preferences.appWidth)) fail('Invalid APP width.');
    if (p.preferences.showTopLine!==null&&!['0','1'].includes(p.preferences.showTopLine)) fail('Invalid top-line preference.');
    exact(p.evaluations,['cache','positions'],'evaluations');
    if (!object(p.evaluations.cache)||Object.keys(p.evaluations.cache).length>1500 || !Array.isArray(p.evaluations.positions)) fail('Invalid evaluation cache.');
    for (const v of Object.values(p.evaluations.cache)) if(!object(v)||!Number.isFinite(v.time)||typeof v.text!=='string')fail('Invalid cached evaluation.');
    exact(p.studies,['collection','undoA','undoB'],'Studies');
    for (const v of Object.values(p.studies)) checkCollection(v,deps);
    exact(p.evidence,version===1?['snapshots']:['snapshots','metadata'],'Evidence');
    if (!Array.isArray(p.evidence.snapshots)||p.evidence.snapshots.length>30) fail('Evidence exceeds 30 snapshots.');
    for (const items of [p.evidence.snapshots,p.evaluations.positions]) {
      if(new Set(items.map(v=>v.id)).size!==items.length)fail('Duplicate evidence IDs.');
      items.forEach(v=>{deps.Evidence.validate(v);typedScores(v);});
    }
    if(version===2)deps.Evidence.metadata(p.evidence.snapshots,p.evidence.metadata);
    exact(p.simulation,['schema','version','runs','events'],'simulation');
    deps.Sim.validate(p.simulation,true);
    for(const record of [...p.simulation.runs,...p.simulation.events])if(typeof record.id!=='string')fail('DATA record IDs must be strings.');
    for(const run of p.simulation.runs)if(run.eventId!=null&&typeof run.eventId!=='string')fail('DATA event references must be strings.');
    for(const event of p.simulation.events)for(const game of event.games||[])if(game.runId!=null&&typeof game.runId!=='string')fail('DATA game references must be strings.');
    for(const run of p.simulation.runs) {
      if (run.pgn) deps.Study.parsePGN(deps.Chess,run.pgn);
      for(const key of ['fen','startFen','finalFen']) if(run[key]&&!new deps.Chess().validate_fen(run[key]).valid)fail('Invalid Sim FEN.');
      typedScores(run);
    }
    checkTiming(p.timing,deps);
    exact(p.recovery,Object.keys(empty().recovery),'recovery');
    if (!Array.isArray(p.recovery.evidencePending))fail('Invalid pending Evidence.');
    for(const op of p.recovery.evidencePending) if(op.snapshot)deps.Evidence.validate(op.snapshot);
    const checkpoint=p.recovery.simulationCheckpoint;
    if(checkpoint!==null) {
      if(bytes(checkpoint)>8*MiB||checkpoint.schema!=='chess-sim-checkpoint'||checkpoint.version!==1||!Array.isArray(checkpoint.records))fail('Invalid Sim checkpoint.');
      for(const x of checkpoint.records) {if(!['runs','events'].includes(x.kind))fail('Invalid checkpoint section.');deps.Sim.validateRecord(x.value,x.kind==='runs'?'game':'event');}
    }
    if(p.recovery.legacyStudy!==null)checkCollection(p.recovery.legacyStudy,deps);
    if(p.recovery.legacyEvidence!==null) {if(!Array.isArray(p.recovery.legacyEvidence))fail('Invalid retained Evidence.');p.recovery.legacyEvidence.forEach(deps.Evidence.validate);}
    if(p.recovery.legacySimulation!==null)deps.Sim.validate(p.recovery.legacySimulation,false);
    return p;
  }
  async function pack(payload, source, deps, version=2) {
    if(![1,2].includes(version))fail('Unsupported DATA schema/version.');
    validatePayload(payload,deps,version);
    const envelope={schema:'chessbest-workspace-data',version,exportedAt:new Date().toISOString(),source,
      sections:{...(version===1?V1_SECTIONS:SECTIONS)},manifest:manifest(payload,version),sha256:await digest(payload),payload};
    if(bytes(envelope)>LIMITS.file)fail('DATA file exceeds 64 MiB. Use the separate Study/Sim exports.');
    return envelope;
  }
  async function parse(text,deps) {
    if(typeof text!=='string'||bytes(text)>LIMITS.file)fail('DATA file exceeds 64 MiB.');
    let v;try{v=JSON.parse(text);}catch(_){fail('DATA file is truncated or invalid JSON.');}
    exact(v,['schema','version','exportedAt','source','sections','manifest','sha256','payload'],'envelope');
    if(v.schema!=='chessbest-workspace-data'||![1,2].includes(v.version))fail('Unsupported DATA schema/version.');
    if(!Number.isFinite(Date.parse(v.exportedAt)))fail('Invalid export date.');
    exact(v.source,['channel','release'],'source');
    if(!['LAB','CURRENT'].includes(v.source.channel)||typeof v.source.release!=='string'||v.source.release.length>160)fail('Invalid source provenance.');
    if(canonical(v.sections)!==canonical(v.version===1?V1_SECTIONS:SECTIONS))fail('Unsupported DATA section versions.');
    validatePayload(v.payload,deps,v.version);
    if(canonical(v.manifest)!==canonical(manifest(v.payload,v.version)))fail('DATA counts/bytes do not match.');
    if(!/^[0-9a-f]{64}$/.test(v.sha256)||await digest(v.payload)!==v.sha256)fail('DATA SHA-256 does not match.');
    return v;
  }
  async function migrate(value,deps) {
    const original=await parse(canonical(value),deps);
    if(original.version===2)return original;
    const payload=JSON.parse(canonical(original.payload));payload.evidence.metadata={version:1,pins:[]};
    const migrated=await pack(payload,original.source,deps);migrated.exportedAt=original.exportedAt;return migrated;
  }
  function diff(old,next) {
    const rows=[];
    const compare=(section,a,b)=>{
      const A=new Map(a.map(v=>[String(v.id),canonical(v)])),B=new Map(b.map(v=>[String(v.id),canonical(v)]));
      rows.push({section,added:[...B.keys()].filter(k=>!A.has(k)).length,removed:[...A.keys()].filter(k=>!B.has(k)).length,
        changed:[...B.keys()].filter(k=>A.has(k)&&A.get(k)!==B.get(k)).length,unchanged:[...B.keys()].filter(k=>A.get(k)===B.get(k)).length});
    };
    compare('Studies',old.studies.collection?.studies||[],next.studies.collection?.studies||[]);
    const single=(section,a,b)=>compare(section,a===null?[]:[{id:section,value:a}],b===null?[]:[{id:section,value:b}]);
    const semanticCollection=value=>value===null?null:Object.fromEntries(Object.entries(value).filter(([k])=>!['revision','appliedOperations'].includes(k)));
    single('Active Study',old.studies.collection?.activeId??null,next.studies.collection?.activeId??null);
    single('A / B comparison',old.studies.collection?.comparison??null,next.studies.collection?.comparison??null);
    const metadata=value=>value===null?null:Object.fromEntries(Object.entries(value).filter(([k])=>!['studies','activeId','comparison','revision','appliedOperations'].includes(k)));
    single('Studies metadata',metadata(old.studies.collection),metadata(next.studies.collection));
    single('Studies undo A',semanticCollection(old.studies.undoA),semanticCollection(next.studies.undoA));
    single('Studies undo B',semanticCollection(old.studies.undoB),semanticCollection(next.studies.undoB));
    compare('Evidence',old.evidence.snapshots,next.evidence.snapshots);
    compare('Evidence pins',(old.evidence.metadata?.pins||[]).map(id=>({id})),(next.evidence.metadata?.pins||[]).map(id=>({id})));
    compare('Sim games',old.simulation.runs,next.simulation.runs);compare('Tournaments',old.simulation.events,next.simulation.events);
    for(const section of ['game','preferences','evaluations','timing','recovery'])compare(section,old[section]===null?[]:[{id:section,value:old[section]}],next[section]===null?[]:[{id:section,value:next[section]}]);
    return rows;
  }
  return {LIMITS,SECTIONS,V1_SECTIONS,bytes,canonical,digest,empty,counts,manifest,validatePayload,pack,parse,migrate,diff};
});
