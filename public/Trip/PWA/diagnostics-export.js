/* Local diagnostics packaging only. No solver, imports, network, or credentials. */
(() => {
  'use strict';
  const SCHEMA='TripDiagnosticsV1', MAX_BYTES=80*1024*1024, MAX_NODES=3496;
  const encoder=new TextEncoder();
  const fail=code=>{const error=new Error(code);error.code=code;throw error;};
  const check=(value,code)=>{if(!value)fail(code);};
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const hashPattern=/^[a-f0-9]{64}$/i;
  const token=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)?value:null;
  function canonical(value,depth=0) {
    check(depth<32,'DEPTH_LIMIT');
    if(value===null||typeof value!=='object') {
      check(value!==undefined&&['string','number','boolean','object'].includes(typeof value),'INVALID_JSON');
      check(typeof value!=='number'||Number.isFinite(value),'NONFINITE_INPUT');
      return JSON.stringify(value);
    }
    return Array.isArray(value)?'['+value.map(v=>canonical(v,depth+1)).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
  }
  async function sha(bytes) {
    const result=await crypto.subtle.digest('SHA-256',typeof bytes==='string'?encoder.encode(bytes):bytes);
    return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');
  }
  // A conservative UTF-8 upper bound is checked before constructing strings/buffers.
  function estimate(value,limit=MAX_BYTES,depth=0) {
    check(depth<32,'DEPTH_LIMIT');
    if(value===null||value===undefined)return 4;
    if(typeof value==='number'||typeof value==='boolean')return 32;
    if(typeof value==='string'){check(value.length*6<=limit,'EXPORT_TOO_LARGE');return value.length*6+2;}
    check(typeof value==='object','INVALID_JSON');
    let size=2;
    for(const key of Object.keys(value)) {
      size+=(Array.isArray(value)?0:key.length*6+3)+estimate(value[key],limit-size,depth+1)+1;
      check(size<=limit,'EXPORT_TOO_LARGE');
    }
    return size;
  }
  const forbiddenKey=/^(?:__proto__|prototype|constructor|password|passphrase|token|access_token|refresh_token|authorization|api_key|apiKey|secret|secrets|key|keys|credential|credentials|unlock|derived_key|cipher_key|core|core_state|solver|solver_state|state_dump|checkpoint_data|verificationInput|verification_input|input|points|coordinates|catalogCoordinates|catalog_coordinates|values|matrix|nodeIds|node_ids|addresses|address|passengers|names|raw|payload|source_data|originalSource|original_source|message|stack)$/i;
  const credentialKey=/(?:password|passphrase|token|secret|credential|authorization|api.?key|cipher.?key|derived.?key|unlock)/i;
  const allowedSummary=new Set(['schema','schema_version','diag_schema_version','identity','problem','reference','configuration','environment','timing','result','coverage','reproducibility','storage','export','errors','quality','definitions']);
  const errorCodes=new Set(['QUOTA_EXCEEDED','STORAGE_ERROR','DIAGNOSTICS_ERROR','WORKER_ERROR','VALIDATION_ERROR','RESTORE_GAP','UNKNOWN_ERROR','EXPORT_ERROR','NO_VERIFIED_TOUR','MISSING_WORKER','PARTIAL','STALE']);
  function clean(value,depth=0,key='') {
    check(depth<32,'DEPTH_LIMIT');
    if(value===undefined||value===null)return null;
    if(typeof value==='number')return Number.isFinite(value)?(Object.is(value,-0)?0:value):null;
    if(typeof value==='boolean')return value;
    if(typeof value==='string') {
      if(/^(?:error|error_code|errorCode)$/.test(key))return errorCodes.has(value)?value:'UNKNOWN_ERROR';
      // Only generated, bounded diagnostic labels reach here. Raw error messages,
      // URLs with credentials/query strings, HTML and multiline payloads are removed.
      if(value.length>512||/[\x00-\x1f<>@]|(?:Bearer\s|password\s*[:=]|token\s*[:=]|api.?key\s*[:=])/i.test(value))return null;
      if(/^https?:\/\//i.test(value)&&/[?#]/.test(value))return null;
      return value;
    }
    if(Array.isArray(value))return value.map(v=>clean(v,depth+1,key));
    check(record(value),'INVALID_JSON');
    const out={};
    for(const [k,v] of Object.entries(value))if(!forbiddenKey.test(k)&&!credentialKey.test(k)&&/^[A-Za-z0-9_.:-]{1,128}$/.test(k))out[k]=clean(v,depth+1,k);
    return out;
  }
  function safeSummary(source) {
    check(record(source),'INVALID_SUMMARY');
    const result={schema:SCHEMA};
    for(const [key,value] of Object.entries(source))if(allowedSummary.has(key))result[key]=clean(value,0,key);
    result.schema=SCHEMA;
    if(record(result.identity))Object.assign(result.identity,{engine_version:result.identity.engine_version??result.identity.engine??null,core_version:result.identity.core_version??result.identity.core_engine??null,numerics_version:result.identity.numerics_version??result.problem?.numeric??null,timing_semantics:result.identity.timing_semantics??result.timing?.timing_semantics??null});
    if(record(result.problem))Object.assign(result.problem,{node_count:result.problem.node_count??result.problem.n??null,start_index:result.problem.start_index??result.problem.start??null,normalized_input_hash:result.problem.normalized_input_hash??result.problem.problem_hash??null,metric:result.problem.metric??result.problem.cost_kind??null});
    if(record(result.result))Object.assign(result.result,{best_cost:result.result.best_cost??result.result.cost??null,baseline_cost:result.result.baseline_cost??result.result.base_cost??null});
    if(record(result.timing)){result.timing.export_ms=null;result.timing.export_ms_reason='package duration is known only after immutable snapshot serialization';}
    // Only coded errors belong in a diagnostic record; never retain exception text.
    if(Array.isArray(result.errors))result.errors=result.errors.map(error=>{const code=typeof error==='string'?error:error?.code??error?.error_code??error?.error;return {error_code:errorCodes.has(code)?code:'UNKNOWN_ERROR',worker_id:finite(error?.worker_id)?error.worker_id:null};});
    return result;
  }
  function normalizeInput(value) {
    if(!value)return null;
    const p=value.problem||value, c=p.cost, n=p.nodeIds?.length;
    check(p.schema==='ProblemV2'&&c?.schema==='CostSpecV2','INVALID_PROBLEM');
    check(Number.isSafeInteger(n)&&n>=2&&n<=MAX_NODES,'INVALID_NODE_COUNT');
    check(p.nodeIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=64)&&new Set(p.nodeIds).size===n,'INVALID_NODE_IDS');
    check(Number.isSafeInteger(p.start)&&p.start>=0&&p.start<n&&typeof p.closed==='boolean'&&typeof p.directed==='boolean','INVALID_ROUTE_SEMANTICS');
    check(p.end===undefined||p.end===null,'UNSUPPORTED_TERMINAL');
    const problem={schema:'ProblemV2',nodeIds:p.nodeIds.slice(),start:p.start,closed:p.closed,directed:p.directed,cost:{schema:'CostSpecV2',kind:c.kind,units:c.units}};
    let edge, catalogCoordinates=null;
    if(c.kind==='matrix') {
      check(n<=512&&['m','s','EUC_2D','unit'].includes(c.units)&&Array.isArray(c.values)&&c.values.length===n,'INVALID_MATRIX');
      check(c.values.every(row=>Array.isArray(row)&&row.length===n&&row.every(v=>finite(v)&&v>=0&&v<=1e12)),'INVALID_MATRIX');
      if(!p.directed)for(let i=0;i<n;i++)for(let j=0;j<i;j++)check(c.values[i][j]===c.values[j][i],'MATRIX_SYMMETRY_MISMATCH');
      problem.cost.values=c.values.map(row=>row.map(v=>Object.is(v,-0)?0:v));
      edge=(i,j)=>problem.cost.values[i][j];
    } else if(c.kind==='haversine') {
      check(c.units==='m'&&!p.directed&&Array.isArray(c.points)&&c.points.length===n&&c.points.every(q=>Array.isArray(q)&&q.length===2&&q.every(finite)&&Math.abs(q[0])<=90&&Math.abs(q[1])<=180),'INVALID_COORDINATES');
      problem.cost.points=c.points.map(q=>q.slice());
      edge=(i,j)=>{const a=problem.cost.points[i],b=problem.cost.points[j],r=Math.PI/180,lat1=a[0]*r,lat2=b[0]*r;const h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((b[1]-a[1])*r/2)**2;return 2*6371008.8*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));};
    } else if(c.kind==='catalog-euc2d') {
      check(c.units==='EUC_2D'&&!p.directed&&token(c.instanceId)&&hashPattern.test(c.originalSha256||'')&&(c.numeric===undefined||c.numeric==='binary64-browser-halfup-v1'),'INVALID_CATALOG_IDENTITY');
      catalogCoordinates=value.catalogCoordinates||value.catalog_coordinates||c.catalogCoordinates;
      check(Array.isArray(catalogCoordinates)&&catalogCoordinates.length===n&&catalogCoordinates.every(q=>Array.isArray(q)&&q.length===2&&q.every(finite)),'MISSING_CATALOG_COORDINATES');
      catalogCoordinates=catalogCoordinates.map(q=>q.slice());
      Object.assign(problem.cost,{instanceId:c.instanceId,originalSha256:c.originalSha256,numeric:'binary64-browser-halfup-v1'});
      edge=(i,j)=>Math.floor(Math.hypot(catalogCoordinates[i][0]-catalogCoordinates[j][0],catalogCoordinates[i][1]-catalogCoordinates[j][1])+0.5);
    } else fail('UNSUPPORTED_METRIC');
    return {problem,catalogCoordinates,edge,n,suppliedHash:p.problemHash||null,originalSource:value.originalSource||null};
  }
  async function verify(best,input,summary,cut) {
    const source=record(best)?best:{}, route=source.route??source.tour??null;
    if(route===null) {
      check(source.cost===undefined||source.cost===null,'MISSING_BEST_TOUR');
      check(summary.result?.best_cost===undefined||summary.result.best_cost===null,'MISSING_BEST_TOUR');
      summary.result=summary.result||{};Object.assign(summary.result,{best_cost:null,route_hash:null,verified:false});
      return {schema:'TripBestTourV1',run_id:summary.identity.run_id,export_id:summary.identity.export_id,export_cut:cut,route:null,cost:null,route_hash:null,verified:false,verification_reason:'NO_VERIFIED_TOUR'};
    }
    check(input,'MISSING_VERIFICATION_INPUT');
    const {problem:p,edge,n}=input;
    check(Array.isArray(route)&&route.length===n&&route[0]===p.start,'INVALID_ROUTE');
    const seen=new Uint8Array(n);let cost=0;
    for(let i=0;i<n;i++) {const node=route[i];check(Number.isSafeInteger(node)&&node>=0&&node<n&&!seen[node],'INVALID_PERMUTATION');seen[node]=1;if(i)cost+=edge(route[i-1],node);}
    if(p.closed)cost+=edge(route[n-1],route[0]);
    check(finite(cost)&&cost>=0,'INVALID_COST');
    for(const reported of [source.cost,source.best_cost,summary.result?.best_cost,summary.result?.cost])if(reported!==undefined&&reported!==null)check(finite(reported)&&Math.abs(cost-reported)<=1e-9*Math.max(1,Math.abs(cost)),'COST_MISMATCH');
    const routeHash=await sha(canonical(route));
    for(const supplied of [source.route_hash,source.routeHash,summary.result?.route_hash])if(supplied!==undefined&&supplied!==null)check(supplied===routeHash,'ROUTE_HASH_MISMATCH');
    const problemHash=await sha(canonical(p));
    for(const supplied of [input.suppliedHash,source.problem_hash,summary.problem?.normalized_input_hash,summary.problem?.problem_hash])if(supplied!==undefined&&supplied!==null)check(supplied===problemHash,'PROBLEM_HASH_MISMATCH');
    if(input.originalSource)check(p.cost.kind==='catalog-euc2d'&&await sha(input.originalSource)===p.cost.originalSha256,'SOURCE_HASH_MISMATCH');
    if(summary.problem?.n!==undefined)check(summary.problem.n===n,'NODE_COUNT_MISMATCH');
    if(summary.problem?.node_count!==undefined&&summary.problem.node_count!==null)check(summary.problem.node_count===n,'NODE_COUNT_MISMATCH');
    if(summary.problem?.start!==undefined)check(summary.problem.start===p.start,'START_MISMATCH');
    if(summary.problem?.start_index!==undefined&&summary.problem.start_index!==null)check(summary.problem.start_index===p.start,'START_MISMATCH');
    if(summary.problem?.closed!==undefined)check(summary.problem.closed===p.closed,'CLOSED_MISMATCH');
    if(summary.problem?.directed!==undefined)check(summary.problem.directed===p.directed,'DIRECTION_MISMATCH');
    summary.result=summary.result||{};Object.assign(summary.result,{best_cost:cost,route_hash:routeHash,verified:true});
    return {schema:'TripBestTourV1',run_id:summary.identity.run_id,export_id:summary.identity.export_id,export_cut:cut,route:route.slice(),node_order:'zero-based indices in normalized input.nodeIds order',node_count:n,start:p.start,end:null,closed:p.closed,directed:p.directed,cost,units:p.cost.units,metric:p.cost.kind,rounding:p.cost.kind==='catalog-euc2d'?'binary64 Math.hypot then floor(distance + 0.5)':'none',route_hash:routeHash,route_hash_semantics:'SHA-256 UTF-8 canonical JSON numeric route array',problem_hash:problemHash,instance_id:p.cost.instanceId||null,original_source_sha256:p.cost.originalSha256||null,original_source_hash_checked_here:p.cost.kind==='catalog-euc2d'?!!input.originalSource:null,verified:true,verification:'independent permutation and same-metric cost recalculation using supplied verification input'};
  }
  const methodColumns=['run_id','worker_id','recipe_id','phase','operator_id','scale','mode','eligible','eligibility_reason','measurement_coverage','dispatches','candidates_started','candidates_ready','candidates_completed','candidates_inflight','work_units','delta_evaluations','accepted_moves','measured_compute_ms','preparation_ms','validation_ms','compute_definition','local_cost_gain','worker_best_count','worker_best_gain','pool_best_count','pool_best_gain','pool_attribution_quality','parent_contribution_count','imported_seed_count','descendant_pool_best_count','descendant_pool_best_reason','time_since_last_pool_improvement_ms','sample_count'];
  function csvCell(value) {
    if(value===null||value===undefined)return '';
    let text=typeof value==='object'?JSON.stringify(value):String(value);
    // Keep native negative numeric cells numeric; defend all text, including whitespace prefixes.
    if(typeof value==='string'&&/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
    return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  }
  function csv(rows,runId) {
    check(Array.isArray(rows),'INVALID_METHODS');
    return methodColumns.join(',')+'\r\n'+rows.map(row=>{check(record(row),'INVALID_METHODS');check(row.run_id===undefined||row.run_id===runId,'METHOD_RUN_MISMATCH');const safe=clean(row);safe.run_id=runId;return methodColumns.map(k=>csvCell(safe[k])).join(',');}).join('\r\n')+(rows.length?'\r\n':'');
  }
  function eventsText(events,runId,cut) {
    check(Array.isArray(events),'INVALID_EVENTS');
    const last=new Map();
    return events.map(event=>{
      check(record(event)&&event.run_id===runId,'EVENT_RUN_MISMATCH');
      const item=clean(event),worker=String(item.worker_id??'coordinator'),session=String(item.session_id??'unknown');
      if(item.schema_version===1)item.schema_version=SCHEMA;
      item.coordinator_receive_sequence=item.coordinator_receive_sequence??item.coordinator_sequence??null;
      const seq=item.sequence??item.local_sequence??item.worker_sequence;
      if(seq!==undefined&&seq!==null) {
        check(Number.isSafeInteger(seq)&&seq>=0,'INVALID_SEQUENCE');
        const key=session+':'+worker,previous=last.get(key);check(previous===undefined||seq>previous,'EVENT_SEQUENCE_ORDER');last.set(key,seq);
        const max=worker==='coordinator'?cut?.coordinator_sequence:cut?.worker_sequences?.[worker];
        if(max!==undefined&&max!==null)check(seq<=max,'EVENT_AFTER_CUT');
      }
      const receive=item.coordinator_receive_sequence;
      if(receive!==undefined&&receive!==null&&cut?.coordinator_sequence!==undefined)check(receive<=cut.coordinator_sequence,'EVENT_AFTER_CUT');
      return JSON.stringify(item);
    }).join('\n')+(events.length?'\n':'');
  }
  const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc32(bytes) {let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  function zip(files) {
    const entries=files.map(file=>({...file,nameBytes:encoder.encode(file.name),crc:crc32(file.bytes)}));
    const localSize=entries.reduce((s,f)=>s+30+f.nameBytes.length+f.bytes.length,0),directorySize=entries.reduce((s,f)=>s+46+f.nameBytes.length,0),total=localSize+directorySize+22;
    check(total<=MAX_BYTES,'EXPORT_TOO_LARGE');
    const bytes=new Uint8Array(total),view=new DataView(bytes.buffer);let offset=0;
    const u16=(at,v)=>view.setUint16(at,v,true),u32=(at,v)=>view.setUint32(at,v,true);
    for(const file of entries) {
      file.offset=offset;u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x800);u16(offset+8,0);u16(offset+12,33);u32(offset+14,file.crc);u32(offset+18,file.bytes.length);u32(offset+22,file.bytes.length);u16(offset+26,file.nameBytes.length);
      bytes.set(file.nameBytes,offset+30);bytes.set(file.bytes,offset+30+file.nameBytes.length);offset+=30+file.nameBytes.length+file.bytes.length;
    }
    for(const file of entries) {
      u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0x800);u16(offset+10,0);u16(offset+14,33);u32(offset+16,file.crc);u32(offset+20,file.bytes.length);u32(offset+24,file.bytes.length);u16(offset+28,file.nameBytes.length);u32(offset+42,file.offset);bytes.set(file.nameBytes,offset+46);offset+=46+file.nameBytes.length;
    }
    u32(offset,0x06054b50);u16(offset+8,entries.length);u16(offset+10,entries.length);u32(offset+12,directorySize);u32(offset+16,localSize);
    return bytes.buffer;
  }
  const readme=`# Trip diagnostics export\n\nThis is a local, inert diagnostic snapshot, not a solver checkpoint or executable.\n\n- JSON/JSONL are UTF-8. JSON numbers use full JavaScript binary64 round-trip precision. CSV uses decimal points and quoted cells; formula-like text is prefixed with an apostrophe. Empty CSV cells correspond to null/unsupported values, never invented zeros.\n- All files share export_id and the summary coverage.export_cut where available. Event sequences are per worker/session; coordinator receive order is an observed ordering, not a total causal order. Read coverage for dropped, compacted, missing or stale data.\n- Durations ending in _ms are milliseconds. The budget is the shared pool running elapsed time minus explicit pauses. Worker compute is the sum of measured instrumented worker sections, not OS CPU time; it may exceed elapsed wall time. Concurrent component times must not be added as a partition of wall time. Legacy and uncertain restored intervals remain separately labeled in summary.json.\n- best-tour.json uses zero-based indices in the normalized problem node order, with fixed START and explicit closed/directed semantics. A verified tour has a valid permutation and independently recalculated cost; this verifies the supplied result, not proof of global optimality. Numeric references may be informational only.\n- For matrix metrics sum the ordered matrix entries along the route, adding the final-to-first edge only when closed. For haversine use radius 6371008.8 m and the binary64 formula 2R asin(sqrt(clamp(sin((lat2-lat1)/2)^2 + cos(lat1)cos(lat2)sin(deltaLongitude/2)^2,0,1))). For catalog EUC_2D each edge is floor(Math.hypot(dx,dy)+0.5) using original binary64 coordinates; do not substitute mathematical-decimal rounding.\n- route_hash is SHA-256 of UTF-8 canonical JSON numeric route array. Object keys in canonical problem JSON are sorted; array order is preserved. Hashes are identities, not an anonymity guarantee.\n- Input is absent by default. A catalog source SHA identifies the original file but an omitted private matrix/coordinates prevents standalone recalculation. input.json exists only after explicit user opt-in and contains the exact normalized numerical input; numeric values are not reduced to float32. Node identifiers may then contain private information.\n- manifest.json lists SHA-256 and byte length for all other members; it intentionally does not hash itself. ZIP uses the uncompressed STORE method, CRC32 and UTF-8 names. Packaging runs in a separate worker, can be cancelled by terminating it and is capped at 80 MiB including ZIP overhead.\n- No secrets, solver code, solver RNG/state or unlock credentials belong in this export. Result verification and exact multiworker schedule reproduction are separate capabilities.\n`;
  async function exportDiagnostics(payload,includeInput,requestId) {
    check(record(payload),'INVALID_PAYLOAD');
    const summary=safeSummary(payload.summary),exportId=token(payload.exportId||summary.identity?.export_id);
    check(exportId&&record(summary.identity)&&token(summary.identity.run_id),'INVALID_IDENTITY');
    summary.identity.export_id=exportId;summary.identity.diag_schema_version=SCHEMA;
    const runId=summary.identity.run_id,cut=summary.coverage?.export_cut||null;
    const input=normalizeInput(payload.verificationInput);
    const best=await verify(payload.bestTour,input,summary,cut);
    const inputIncluded=!!(includeInput&&input);
    summary.reproducibility={...(summary.reproducibility||{}),input_included:inputIncluded,export_result_verified:best.verified,can_verify_cost_from_package:!!(inputIncluded&&best.verified)};
    summary.export={...(summary.export||{}),export_id:exportId,input_included:inputIncluded,input_inclusion_reason:inputIncluded?'explicit-opt-in':includeInput?'verification-input-unavailable':'not-requested',packaging:'dedicated worker; ZIP STORE',maximum_zip_bytes:MAX_BYTES,export_ms:null,export_ms_reason:'package duration is known only after immutable snapshot serialization'};
    const optedInput=includeInput&&input?{schema:'TripDiagnosticsInputV1',problem:input.problem,...(input.catalogCoordinates?{catalogCoordinates:input.catalogCoordinates}:{}),numeric_precision:'JSON binary64 round-trip',matrix_layout:input.problem.cost.kind==='matrix'?'rows = source index; columns = target index; unavailable links unsupported':null}:null;
    const estimateBytes=estimate({summary,events:payload.events||[],methods:payload.methods||[],best,input:optedInput})+16384;
    check(estimateBytes<=MAX_BYTES,'EXPORT_TOO_LARGE');
    self.postMessage({type:'diagnostics-export-progress',requestId,phase:'verified',estimatedBytes:estimateBytes,inputIncluded:!!optedInput});
    const files=[{name:'summary.json',text:JSON.stringify(summary,null,2)+'\n'},{name:'events.jsonl',text:eventsText(payload.events||[],runId,cut)},{name:'methods.csv',text:csv(payload.methods||[],runId)},{name:'best-tour.json',text:JSON.stringify(best,null,2)+'\n'},{name:'README.md',text:readme}];
    if(optedInput)files.push({name:'input.json',text:JSON.stringify(optedInput)+'\n'});
    let actual=0;
    for(const file of files) {file.bytes=encoder.encode(file.text);delete file.text;actual+=file.bytes.length;check(actual+16384<=MAX_BYTES,'EXPORT_TOO_LARGE');file.sha256=await sha(file.bytes);}
    const manifest={schema:'TripDiagnosticsManifestV1',diag_schema_version:SCHEMA,export_id:exportId,run_id:runId,export_cut:cut,coverage:summary.coverage||null,input_included:!!optedInput,files:files.map(file=>({name:file.name,bytes:file.bytes.length,sha256:file.sha256})),self_hash:'intentionally absent'};
    files.push({name:'manifest.json',bytes:encoder.encode(JSON.stringify(manifest,null,2)+'\n')});
    const bytes=zip(files),instance=input?.problem.cost.instanceId;
    const label=typeof instance==='string'&&/^[a-z]{2}\d{1,4}$/.test(instance)?instance:'custom';
    const filename='trip-diagnostics_'+label+'_'+runId.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64)+'_'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'.zip';
    self.postMessage({type:'diagnostics-exported',requestId,bytes,filename,exportId},[bytes]);
  }
  let busy=false;
  self.onmessage=async event=>{
    const data=event.data||{},requestId=typeof data.requestId==='string'||Number.isSafeInteger(data.requestId)?data.requestId:null;
    if(busy){self.postMessage({type:'diagnostics-export-error',requestId,errorCode:'EXPORT_BUSY'});return;}
    busy=true;
    try {
      if(data.type==='problem-hash') {
        estimate(data.problem);const problemHash=await sha(canonical(data.problem));self.postMessage({type:'problem-hash',requestId,problemHash});
      } else {check(data.type==='diagnostics-export','UNKNOWN_REQUEST');await exportDiagnostics(data.payload,data.includeInput===true,requestId);}
    } catch(error) {self.postMessage({type:'diagnostics-export-error',requestId,errorCode:typeof error?.code==='string'&&/^[A-Z_]{1,64}$/.test(error.code)?error.code:'EXPORT_ERROR'});}
    finally {busy=false;}
  };
})();
