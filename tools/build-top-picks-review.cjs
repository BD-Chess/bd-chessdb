'use strict';
// Deterministic, offline projection of frozen evidence. No engines or providers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'public/chess-lab');
const {Chess}=require(base+'/js/chess.min.js'),Core=require(base+'/js/8zc-review-core.js');
const sha=v=>createHash('sha256').update(v).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const check=process.argv.includes('--check');
const inputs=new Map(),outputs=new Map();
function input(p,expected){const b=read(p),hash=sha(b);if(expected)assert.equal(hash,expected,p);inputs.set(p,{bytes:b.length,sha256:hash});return JSON.parse(b);}
function output(p,value){const b=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';outputs.set(p,{bytes:Buffer.byteLength(b),sha256:sha(b)});if(check)assert.equal(read(p).toString(),b,'Stale '+p);else fs.writeFileSync(path.join(root,p),b);}
const frozenPath='docs/chessbest-evidence/top-picks-frozen-20261020.json';
const frozen=input(frozenPath),catalogPath='public/chess-lab/Games/ChessBest_Top_Picks.catalog.json',catalog=input(catalogPath);
const pgFiles=catalog.collection_files.flatMap(file=>{
 const p='public/chess-lab/'+file,b=read(p);inputs.set(p,{bytes:b.length,sha256:sha(b)});
 return b.toString().trim().split(/\n\s*\n(?=\[Event)/).map(pgn=>({pgn,file,review:Core.build({Chess,pgn})}));
});
const canonical=x=>JSON.stringify(x,Object.keys(x).sort()); // CSV fields are flat.
function score(raw,pov='mover'){return {...Core.decodeCdb(raw),pov};}
const cp=(raw,pov='mover')=>({type:'cp',cp:raw,pov});
function sanPV(fen,tokens){
 const g=new Chess(fen);return tokens.map(token=>{
  const san=token.replace(/^\d+\.(?:\.\.)?\s*/,''),m=g.move(san,{sloppy:true});
  assert(m,'Illegal saved SAN '+token);return m.from+m.to+(m.promotion||'');
 });
}
const empty=()=>({status:'unknown',at:null,candidates:[]});
function recordHash(x){return sha(canonical(x));}
function cdbRequests(evidence,doc,p){
 for(const req of doc.requests||[]){
  const row=evidence.positions.find(row=>row.fen===req.fen);if(!row||req.http_status!==200)continue;
  const observation={provider:'cdb',label:'CDB '+req.action,at:req.received_at_utc,
   status:'ok',method:req.action,provenance:{path:p,sha256:sha(read(p)),body_sha256:sha(req.raw),kind:'saved-http-body'},candidates:[]};
  if(req.action==='queryall'){
   observation.candidates=req.raw.split('|').filter(x=>x.startsWith('move:')).map(item=>{
    const move=item.match(/^move:([^,]+)/)?.[1],n=item.match(/,score:([+-]?\d+)(?:,|$)/);
    return {uci:move,score:n?score(Number(n[1])):{type:'unknown'}};
   });
  }else if(req.action==='querypv'){
   const n=req.raw.match(/^score:([+-]?\d+)/),pv=req.raw.match(/,pv:(.+)$/)?.[1].split('|');
   if(n&&pv?.length){observation.candidates=[{uci:pv[0],score:score(Number(n[1])),pv}];observation.depth=Number(req.raw.match(/,depth:(\d+)/)?.[1])||null;}
  }else{
   const n=req.raw.match(/^eval:([+-]?\d+)$/);if(n)observation.positionScore=score(Number(n[1]));
  }
  row.observations.push(observation);
 }
}
function uciRun(doc,p,at){
 const result=doc.result,fen=doc.request.fen;
 assert(result.completeMultiPV,'Incomplete source must not become a matched comparison');
 assert(result.lines.every(l=>l.depth===result.linesDepth),'Mixed-depth source');
 return {provider:'sf',label:'SF Lite',status:'ok',at:at||doc.provenance.startedAt,
  engine:doc.engine.name,depth:result.linesDepth,settings:{threads:doc.engine.threads,hash_mb:doc.engine.hashMB,
   multipv:doc.engine.multiPV,root_moves:doc.request.rootMoves||null},
  engine_sha256:doc.engine.jsSHA256,method:'same-depth-multipv',
  provenance:{path:p,sha256:sha(read(p)),kind:'saved-engine-receipt'},
  candidates:result.lines.map(l=>({uci:l.move,score:l.score.type==='mate'?
   {type:'mate',sign:Math.sign(l.score.mover)||1,moves:Math.abs(l.score.mover),pov:'mover',bound:l.score.bound}:
   {type:'cp',cp:l.score.mover,pov:'mover',bound:l.score.bound},pv:l.pv})),fen};
}
function addSF(evidence,doc,p,anchor){
 const row=evidence.positions[anchor];
 if(doc.schema==='chessbest-sf-lite-readonly-evidence/1'){
  assert.equal(doc.fen,row.fen);for(const run of doc.depths){
   row.observations.push({provider:'sf',label:'SF Lite',status:'ok',at:run.utc,engine:doc.engine_id.name,
    engine_sha256:doc.engine_js_sha256,depth:run.target_depth,settings:doc.options,
    method:doc.options.root_moves?'restricted-root-multipv':'same-depth-multipv',
    provenance:{path:p,sha256:sha(read(p)),kind:'saved-engine-receipt'},
    candidates:run.lines.map(l=>{assert.equal(l.reported_depth,run.target_depth);const pv=sanPV(row.fen,l.pv_san);return {uci:pv[0],score:cp(l.score_white_cp,'white'),pv};})});
  }
 }else if(doc.schema==='chessbest-sf-lite-cold-evidence/1'){
  assert.equal(doc.fen,row.fen);for(const run of doc.observations)row.observations.push(uciRun(run.result,p,run.observed_at_utc));
 }else if(doc.schema==='chessbest-sf-lite-uci-v1'){
  assert.equal(doc.request.fen,row.fen);row.observations.push(uciRun(doc,p));
 }else if(doc.schema==='chessbest-tcec-candidate-receipt/1'){
  const c=doc.cases.find(c=>c.id===evidence.id);assert(c);assert.equal(c.anchor.fen_before,row.fen);
  for(const run of c.sf_lite){
   const pv=sanPV(row.fen,run.sample_best_pv.replace(/\d+\.(?:\.\.)?\s*/g,'').trim().split(/\s+/));
   row.observations.push({provider:'sf',label:'SF Lite',status:'partial',at:doc.captured_utc,
    engine:'Stockfish 18 Lite WASM',engine_sha256:doc.engine.js_sha256,depth:run.depth,
    settings:{threads:doc.engine.threads,hash_mb:doc.engine.hash_mb,multipv:doc.engine.multipv},method:'candidate-summary',
    caveat:doc.engine.caveat,provenance:{path:p,sha256:sha(read(p)),kind:'parsed-engine-summary'},
    candidates:[{uci:run.best_uci,score:cp(run.best_cp_mover),pv},
     {uci:run.played_uci,score:cp(run.played_cp_mover)}]});
  }
 }
}
const entries=[];
for(const c of catalog.cases){
 const matches=pgFiles.filter(g=>sha(g.review.moves.join(' '))===c.source.mainline_uci_sha256);assert.equal(matches.length,1,c.id);
 const {review:r}=matches[0],anchor=c.anchor.ply_after;
 assert.equal(r.positions[anchor].fen,c.anchor.fen_before_move);assert.equal(r.moves[anchor],c.anchor.played_uci);
 const sourcePath='public/chess-lab/'+c.source.path,sourceBytes=read(sourcePath);assert.equal(sha(sourceBytes),c.source.sha256,sourcePath);
 inputs.set(sourcePath,{bytes:sourceBytes.length,sha256:sha(sourceBytes)});
 const original=sourceBytes.toString().trim().split(/\n\s*\n(?=\[Event)/)[c.source.game_index_1based-1];
 const originalReview=Core.build({Chess,pgn:original});assert.deepEqual(originalReview.moves,r.moves);assert.equal(originalReview.rootFen,r.rootFen);
 const id=c.evidence.review_v4?'dreev-kasparov-1996':c.id;
 const file=c.evidence.review_v4?'config/dreev-kasparov-review.json':'config/review-'+c.id+'.json';
 if(c.evidence.review_v4){
  input('public/chess-lab/'+file,c.evidence.review_v4.evidence_sha256);
 }else{
  const frozenGame=frozen.games.find(g=>g.id===c.id);assert(frozenGame);assert.equal(frozenGame.rows.length,r.totalPly);
  const positions=r.positions.map((p,ply)=>({ply,fen:p.fen,played:r.moves[ply]||null,cdb:empty(),sf:empty(),observations:[]}));
  const e={schema:'chessbest-review-evidence/1',id,rootFen:r.rootFen,moves:r.moves,mainline_sha256:c.source.mainline_uci_sha256,
   sources:{cdb:{label:'CDB archive',date:frozen.archive.snapshot.slice(0,10),snapshot:frozen.archive.snapshot,
    zip_sha256:frozen.archive.sha256,method:'Parsed position estimates from moves.csv. No candidate score is inferred.',archive_note:frozen.interpretation},
    sf:{label:'SF Lite',date:'2026-09-26',engine:'Stockfish 18 Lite WASM',method:'Local anchor receipts only. No whole-game SF scan.'}},
   provenance:{frozen_input_sha256:sha(read(frozenPath)),archive:frozen.archive,source:c.source,license:c.source.license||null,
    license_notice:c.license_notice||null},positions,decisions:[],notes:[{ply:anchor,text:c.reason}],coverage:{}};
  for(let i=0;i<frozenGame.rows.length;i++){
   const {record:a,record_sha256:h}=frozenGame.rows[i];assert.equal(recordHash(a),h);assert.equal(a.fen,positions[i].fen);assert.equal(a.move,r.moves[i]);
   const n=a.before_white_cp===''?null:Number(a.before_white_cp);assert(n===null||Number.isFinite(n));
   positions[i].cdb={...empty(),label:'CDB archive',status:n===null?'unknown':'partial',at:frozen.archive.snapshot,
    timeRole:'archive-snapshot',positionScore:n===null?null:score(n,'white'),method:'parsed-position-estimate',
    provenance:{path:frozenPath,sha256:sha(read(frozenPath)),member:'moves.csv',record_sha256:h,kind:'parsed-projection'}};
  }
  const last=frozenGame.rows.at(-1);if(last.record.after_white_cp!=='')positions.at(-1).cdb={...positions.at(-2).cdb,
   positionScore:score(Number(last.record.after_white_cp),'white'),provenance:{...positions.at(-2).cdb.provenance,record_sha256:last.record_sha256}};
  for(const {record,record_sha256:h} of frozenGame.dcc){
   const row=positions.find(p=>p.fen===record.fen);assert(row);const a=record.analysis;
   row.observations.push({provider:'dcc',label:'DCC archive',status:a.receipt.status,at:frozen.archive.snapshot,
    timeRole:'archive-snapshot',method:'dcc-heuristic',settings:a.receipt.config,legal_count:a.receipt.coverage.totalLegalMoves,
    provenance:{path:frozenPath,sha256:sha(read(frozenPath)),member:'DCC_EVIDENCE.json',record_sha256:h,kind:'parsed-projection'},
    candidates:a.allMoves.map(m=>({uci:m.move,score:score(m.score),heuristic:a.candidates.find(c=>c.move===m.move)?.data?.dccScore??null})),
    dcc_pick:a.dcc1Move,raw_first:a.receipt.rawBest});
  }
  const ev=c.evidence;
  const docs=new Map();
  function collect(v){if(!v||typeof v!=='object')return;for(const [p,h]of[['source_snapshot_path','source_snapshot_sha256'],['candidate_receipt_path','candidate_receipt_sha256'],['receipt_path','receipt_sha256']])if(v[p])docs.set(v[p],v[h]);Object.values(v).forEach(collect);}
  collect(ev);
  // Full per-depth UCI rounds complement the candidate summary receipts.
  for(const p of fs.readdirSync(path.join(root,'docs/chessbest-evidence')).filter(p=>p.startsWith(c.id+'-sf-lite-d')&&p.endsWith('.json')))
   docs.set('docs/chessbest-evidence/'+p,null);
  for(const [p,h]of docs){const doc=input(p,h);if(doc.requests)cdbRequests(e,doc,p);else addSF(e,doc,p,anchor);}
  const sf=positions[anchor].observations.filter(o=>o.provider==='sf').sort((a,b)=>(b.depth||0)-(a.depth||0));
  if(sf.length)positions[anchor].sf=sf[0];
  const counts={cp:0,mate:0,special:0,unknown:r.totalPly};
  for(const row of positions.slice(0,-1)){
   const direct=row.observations.filter(o=>o.provider==='cdb'&&o.method==='queryall').at(-1);
   // Archive estimates stay primary for a coherent dated trajectory. Direct root
   // candidate receipts remain distinct observations, including unknown scores.
   if(direct){row.cdb={...direct,positionScore:row.cdb.positionScore,positionEstimate:row.cdb};
    const type=direct.candidates.find(c=>c.uci===row.played)?.score.type||'unknown';
    if(type!=='unknown'){counts[type]++;counts.unknown--;}}
  }
  e.coverage={cdb_played_types:counts};
  // Validate everything using the same runtime attach boundary before publishing.
  const validated=Core.attachEvidence({...r,headers:{...r.headers,ChessBestReviewEvidence:id}},e,Chess);
  e.coverage=validated.evidence.coverage;
  output('public/chess-lab/'+file,e);
 }
 const b=read('public/chess-lab/'+file);
 entries.push({id:c.id,alias:id,source:r.headers.ChessBestSource,rootFen:r.rootFen,mainline_sha256:c.source.mainline_uci_sha256,
  totalPly:r.totalPly,anchor:{ply:anchor,fen:c.anchor.fen_before_move,played:c.anchor.played_uci},file,bytes:b.length,sha256:sha(b)});
}
for(const notice of catalog.license_notices){const p='public/chess-lab/'+notice.path;assert.equal(sha(read(p)),notice.sha256);inputs.set(p,{sha256:notice.sha256,bytes:read(p).length});}
output('public/chess-lab/js/8zc-review-registry.js',
 '/* Generated by tools/build-top-picks-review.cjs from verified frozen inputs. */\n'+
 '(function(root){const registry='+JSON.stringify({schema:'chessbest-review-registry/1',entries},null,2)+';\n'+
 "if(typeof module==='object'&&module.exports)module.exports=registry;else root.ChessReviewRegistry=registry;\n})(typeof window==='object'?window:globalThis);\n");
output('docs/chessbest-evidence/top-picks-review-build-20261020.json',{schema:'chessbest-top-picks-build/1',inputs:Object.fromEntries([...inputs].sort()),outputs:Object.fromEntries([...outputs].sort()),games:entries.map(x=>({id:x.id,totalPly:x.totalPly,mainline_sha256:x.mainline_sha256}))});
console.log('Top Picks: 10 source/root/mainline/anchor mappings; 9 frozen projections + unchanged Dreev V4; '+(check?'reproduction PASS':'generated'));
