// SPDX-License-Identifier: GPL-3.0-or-later
import * as ort from './runtime/ort.wasm.min.mjs';
import { Chess } from './chess.mjs';
import { infer, MODEL_SHA256 } from './neural.mjs';
import { search } from './search.mjs';
let ready=null,session=null,generation=0;
const send=(id,type,value={})=>postMessage({id,type,...value});
const WASM_SHA256='fd078a39438a65660fc6c9df8d42fc886b5bf2931d6dbdd8dc51a17b1221499f';
const DOWNLOAD_BYTES=12297086+3483857;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function fetchAsset(path,phase,offset,onProgress) {
  const response=await fetch(new URL(path,import.meta.url));
  if(!response.ok)throw new Error('LCZero '+phase+' HTTP '+response.status);
  if(!response.body){const bytes=await response.arrayBuffer();onProgress({phase,loaded:offset+bytes.byteLength,total:DOWNLOAD_BYTES});return bytes;}
  const reader=response.body.getReader(),chunks=[];let size=0,last=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;
    if(performance.now()-last>=100){onProgress({phase,loaded:offset+size,total:DOWNLOAD_BYTES});last=performance.now();}}
  const bytes=new Uint8Array(size);let write=0;for(const chunk of chunks){bytes.set(chunk,write);write+=chunk.length;}
  onProgress({phase,loaded:offset+size,total:DOWNLOAD_BYTES});return bytes.buffer;
}
function historyFor(data) {
  if(Array.isArray(data.history))return data.history;
  if(!data.history?.moves)return [];
  const {startFen,moves}=data.history;
  if(!Array.isArray(moves))throw new Error('LCZero history moves must be an array');
  const board=new Chess(!startFen||startFen==='startpos'?undefined:startFen);
  const fens=[board.fen({forceEnpassantSquare:true})];
  for(const uci of moves){
    if(typeof uci!=='string'||!/^([a-h][1-8]){2}[qrbn]?$/.test(uci))throw new Error('Invalid LCZero history UCI');
    board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    fens.push(board.fen({forceEnpassantSquare:true}));
  }
  // Both clients normalize EP to legal rights for equivalence; keep the
  // original FEN (including a last double push) as actual encoded root.
  const supplied=new Chess(data.fen);
  if(board.fen()!==supplied.fen())throw new Error('LCZero history does not reach requested FEN');
  fens[fens.length-1]=data.fen;
  return fens;
}
async function prepare(onProgress=()=>{}) {
  if(!ready) ready=(async()=>{
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths=new URL('./runtime/',import.meta.url).href;
    onProgress({phase:'runtime',loaded:0,total:DOWNLOAD_BYTES});
    const runtimeBytes=await fetchAsset('./runtime/ort-wasm-simd-threaded.wasm','runtime',0,onProgress),runtimeDigest=await digest(runtimeBytes);
    if(runtimeDigest!==WASM_SHA256)throw new Error('LCZero WASM SHA-256 mismatch');
    ort.env.wasm.wasmBinary=new Uint8Array(runtimeBytes);
    const bytes=await fetchAsset('./maia-1900.onnx','model',runtimeBytes.byteLength,onProgress);
    const modelDigest=await digest(bytes);
    if(modelDigest!==MODEL_SHA256)throw new Error('LCZero model SHA-256 mismatch');
    session=await ort.InferenceSession.create(new Uint8Array(bytes),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    await infer(ort,session,new Chess(),[]); // warmup excluded from movetime
    return {model:'Maia 1900 / 64x6-SE',modelSha256:modelDigest,modelBytes:bytes.byteLength,provider:'wasm',threads:1,runtimeSha256:runtimeDigest,
      input:'INPUT_CLASSICAL_112_PLANE',policy:1858,value:'WDL',nativeUciSearch:false,search:'browser PUCT'};
  })().catch(error=>{ready=null;throw error;});
  return ready;
}
self.onmessage=async({data})=>{
  const {id,type}=data;
  if(type==='stop'){generation++;return;}
  const own=type==='analyze' ? ++generation : generation;
  try{
    const proof=await prepare(progress=>send(id,'progress',progress));
    if(type==='prepare'){send(id,'ready',{proof});return;}
    if(type==='evaluate'){
      const evaluation=await infer(ort,session,new Chess(data.fen),historyFor(data));
      send(id,'evaluation',{evaluation:{q:evaluation.q,wdl:evaluation.wdl,priors:evaluation.priors.map(p=>({uci:p.uci,index:p.index,prior:p.prior,logit:p.logit}))},proof});return;
    }
    if(type==='analyze'){
      if(own!==generation){send(id,'cancelled');return;}
      const descriptor={id:'lc0',name:'LCZero NN / Maia 1900 / browser PUCT',version:'Maia1900 / lc0-export-0.32.1 / browser-PUCT-R8',model:proof.model,modelSha256:proof.modelSha256,runtimeSha256:proof.runtimeSha256,backend:'wasm',source:'CSSLab/maia-chess@749204cf5979ce7f8b0412e804a4ee7c83c49ff8',nativeUciSearch:false};
      const history=historyFor(data);
      const decorate=snapshot=>({...snapshot,engine:descriptor,historyMode:history.length?'verified-explicit-history':'fen-only',proof});
      send(id,'started',{proof});
      const result=await search({...data,history,ort,session,isStopped:()=>own!==generation,onInfo:snapshot=>send(id,'info',{snapshot:decorate(snapshot)})});
      send(id,'result',{snapshot:decorate(result)});
    }
  }catch(error){send(id,'error',{error:error.message || String(error)});}
};
