/* AI8 Sudoku v1.2.0 shared JavaScript truth kernel.
 * Python remains authoritative. This module exists for golden-fixture parity
 * and browser-side canonical state hashing. It implements K0 only.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.AI8SudokuTruth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SIZE=9, FULL_MASK=0x1ff;
  const ENGINE_ID='AI8_SUDOKU_LOGIC_V1_2_0';
  const PROOF_SCHEMA_VERSION='AI8_SUDOKU_PROOF_TRANSACTION_V1';
  const TECHNIQUE_VERSIONS={
    'K0.CANDIDATE_INIT':'1.0.0',
    'K0.NAKED_SINGLE':'1.0.0',
    'K0.HIDDEN_SINGLE':'1.0.0',
    'K0.CONTRADICTION':'1.0.0'
  };
  const TRANSACTION_KEYS=['schema_version','engine_id','sequence','technique','premises','affected_units','affected_cells','affected_candidates','placements','eliminations','candidate_initializations','contradictions','pre_board_hash','pre_candidate_hash','pre_state_hash','post_board_hash','post_candidate_hash','post_state_hash','verifier_result','transaction_hash'];
  const TECHNIQUE_KEYS=['id','version','tier','requires_uniqueness'];
  const VERIFIER_RESULT_KEYS=['status','code','details'];
  const STATE_INPUT_KEYS=['board','candidates','candidate_initialized'];

  function utf8Bytes(text){
    const s=unescape(encodeURIComponent(text));
    const out=new Array(s.length);
    for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i);
    return out;
  }
  function rrot(n,x){return (x>>>n)|(x<<(32-n));}
  function sha256(text){
    const K=[
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const bytes=utf8Bytes(String(text));
    const bitLen=bytes.length*8;
    bytes.push(0x80);
    while((bytes.length%64)!==56) bytes.push(0);
    const hi=Math.floor(bitLen/0x100000000), lo=bitLen>>>0;
    for(let i=3;i>=0;i--) bytes.push((hi>>>(i*8))&255);
    for(let i=3;i>=0;i--) bytes.push((lo>>>(i*8))&255);
    let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w=new Array(64);
    for(let off=0;off<bytes.length;off+=64){
      for(let i=0;i<16;i++) w[i]=((bytes[off+4*i]<<24)|(bytes[off+4*i+1]<<16)|(bytes[off+4*i+2]<<8)|bytes[off+4*i+3])>>>0;
      for(let i=16;i<64;i++){
        const s0=(rrot(7,w[i-15])^rrot(18,w[i-15])^(w[i-15]>>>3))>>>0;
        const s1=(rrot(17,w[i-2])^rrot(19,w[i-2])^(w[i-2]>>>10))>>>0;
        w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
      }
      let [a,b,c,d,e,f,g,h]=H;
      for(let i=0;i<64;i++){
        const S1=(rrot(6,e)^rrot(11,e)^rrot(25,e))>>>0;
        const ch=((e&f)^((~e)&g))>>>0;
        const t1=(h+S1+ch+K[i]+w[i])>>>0;
        const S0=(rrot(2,a)^rrot(13,a)^rrot(22,a))>>>0;
        const maj=((a&b)^(a&c)^(b&c))>>>0;
        const t2=(S0+maj)>>>0;
        h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      H=[(H[0]+a)>>>0,(H[1]+b)>>>0,(H[2]+c)>>>0,(H[3]+d)>>>0,(H[4]+e)>>>0,(H[5]+f)>>>0,(H[6]+g)>>>0,(H[7]+h)>>>0];
    }
    return H.map(x=>x.toString(16).padStart(8,'0')).join('');
  }

  function canonicalStringify(v){
    if(v===null) return 'null';
    if(typeof v==='string') return JSON.stringify(v);
    if(typeof v==='number'){
      if(!Number.isFinite(v)) throw new Error('non-finite number');
      return JSON.stringify(v);
    }
    if(typeof v==='boolean') return v?'true':'false';
    if(Array.isArray(v)) return '['+v.map(canonicalStringify).join(',')+']';
    if(typeof v==='object'){
      return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalStringify(v[k])).join(',')+'}';
    }
    throw new Error('unsupported canonical value');
  }
  function canonicalHash(v){return sha256(canonicalStringify(v));}
  function deepClone(v){return JSON.parse(JSON.stringify(v));}

  function parseBoard(input){
    if(typeof input==='string'){
      const s=input.replace(/\s/g,'').replace(/\./g,'0');
      if(s.length!==81||!/^[0-9]{81}$/.test(s)) throw new Error('invalid board string');
      return Array.from(s,ch=>Number(ch));
    }
    if(Array.isArray(input)&&input.length===9&&input.every(r=>Array.isArray(r)&&r.length===9)) return input.flat().map(Number);
    if(!Array.isArray(input)||input.length!==81) throw new Error('board must have 81 cells');
    const b=input.slice();
    if(b.some(v=>!Number.isInteger(v)||v<0||v>9)) throw new Error('invalid board value');
    return b;
  }
  function rowOf(c){return Math.floor(c/9);} function colOf(c){return c%9;}
  function boxOf(c){return Math.floor(rowOf(c)/3)*3+Math.floor(colOf(c)/3);}
  const ROWS=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>r*9+c));
  const COLS=Array.from({length:9},(_,c)=>Array.from({length:9},(_,r)=>r*9+c));
  const BOXES=Array.from({length:9},(_,b)=>{const br=Math.floor(b/3)*3,bc=(b%3)*3;const a=[];for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++)a.push((br+dr)*9+bc+dc);return a;});
  const UNIT_ORDER=[...Array.from({length:9},(_,i)=>'R'+(i+1)),...Array.from({length:9},(_,i)=>'C'+(i+1)),...Array.from({length:9},(_,i)=>'B'+(i+1))];
  const UNIT_CELLS={}; ROWS.forEach((u,i)=>UNIT_CELLS['R'+(i+1)]=u); COLS.forEach((u,i)=>UNIT_CELLS['C'+(i+1)]=u); BOXES.forEach((u,i)=>UNIT_CELLS['B'+(i+1)]=u);
  const CELL_UNITS=Array.from({length:81},(_,c)=>['R'+(rowOf(c)+1),'C'+(colOf(c)+1),'B'+(boxOf(c)+1)]);
  const PEERS=Array.from({length:81},(_,c)=>Array.from(new Set([...ROWS[rowOf(c)],...COLS[colOf(c)],...BOXES[boxOf(c)]])).filter(x=>x!==c).sort((a,b)=>a-b));
  function normalizeUnits(units){const rank={R:0,C:1,B:2};return Array.from(new Set(units)).sort((a,b)=>(rank[a[0]]-rank[b[0]])||(Number(a.slice(1))-Number(b.slice(1))));}
  function valuesFromMask(mask){const a=[];for(let v=1;v<=9;v++)if(mask&(1<<(v-1)))a.push(v);return a;}
  function validateBoard(board){
    try{board=parseBoard(board);}catch(e){return {ok:false,message:String(e.message||e)};}
    for(const uid of UNIT_ORDER){const vals=UNIT_CELLS[uid].map(c=>board[c]).filter(Boolean);if(new Set(vals).size!==vals.length)return{ok:false,message:'duplicate value in unit '+uid};}
    return{ok:true,message:''};
  }
  function legalMask(board,cell){if(board[cell]!==0)return 0;let used=0;for(const p of PEERS[cell])if(board[p])used|=1<<(board[p]-1);return FULL_MASK&~used;}
  function exactCandidates(board){return board.map((v,c)=>v===0?legalMask(board,c):0);}
  function boardString(board){return parseBoard(board).join('');}
  function boardHash(board){return sha256(boardString(board));}
  function exactKeys(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),keys.slice().sort());}
  function validCell(v){return Number.isInteger(v)&&v>=0&&v<81;}
  function validDigit(v){return Number.isInteger(v)&&v>=1&&v<=9;}
  function validHash(v){return typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);}
  function cellValueShape(v){return exactKeys(v,['cell','value'])&&validCell(v.cell)&&validDigit(v.value);}
  function effectShape(v){return exactKeys(v,['cell','value','effect'])&&validCell(v.cell)&&validDigit(v.value)&&['initialize','consume_by_placement','eliminate'].includes(v.effect);}
  function canonicalCellValues(items){return items.every(cellValueShape)&&same(items,items.slice().sort((a,b)=>a.cell-b.cell||a.value-b.value))&&new Set(items.map(x=>x.cell+':'+x.value)).size===items.length;}
  function canonicalEffects(items){return items.every(effectShape)&&same(items,items.slice().sort((a,b)=>a.cell-b.cell||a.value-b.value||a.effect.localeCompare(b.effect)))&&new Set(items.map(x=>x.cell+':'+x.value+':'+x.effect)).size===items.length;}
  function candidateString(cands,init){
    if(!Array.isArray(cands)||cands.length!==81||cands.some(m=>!Number.isInteger(m)||m<0||m>FULL_MASK))throw new Error('invalid candidates');
    return(init?'1':'0')+':'+cands.map(m=>m.toString(16).padStart(3,'0')).join(',');
  }
  function candidateHash(cands,init){return sha256(candidateString(cands,init));}
  function stateHash(board,cands,init){return canonicalHash({board_hash:boardHash(board),candidate_hash:candidateHash(cands,init),candidate_initialized:!!init});}
  function makeState(value){
    if(!exactKeys(value,STATE_INPUT_KEYS))throw new Error('invalid state keys');
    const board=parseBoard(value.board), candidates=value.candidates.slice();
    if(typeof value.candidate_initialized!=='boolean')throw new Error('invalid initialized flag');
    const init=value.candidate_initialized;
    candidateString(candidates,init);
    return{board,candidates,candidate_initialized:init,board_hash:boardHash(board),candidate_hash:candidateHash(candidates,init),state_hash:stateHash(board,candidates,init)};
  }
  function k0Truth(state){
    const vb=validateBoard(state.board);if(!vb.ok)return vb;
    if(!state.candidate_initialized)return{ok:state.candidates.every(x=>x===0),message:'uninitialized candidate state'};
    const expected=exactCandidates(state.board);
    for(let i=0;i<81;i++)if(state.candidates[i]!==expected[i])return{ok:false,message:'stale candidates at '+i};
    return{ok:true,message:''};
  }
  function txHash(tx){const x=deepClone(tx);x.transaction_hash='';return canonicalHash(x);}
  function same(a,b){return canonicalStringify(a)===canonicalStringify(b);}
  function postHashesMatch(tx,post){return tx.post_board_hash===boardHash(post.board)&&tx.post_candidate_hash===candidateHash(post.candidates,post.candidate_initialized)&&tx.post_state_hash===stateHash(post.board,post.candidates,post.candidate_initialized);}
  function placementTransition(state,tx,cell,value){
    if(tx.placements.length!==1||!cellValueShape(tx.placements[0])||!same(tx.placements[0],{cell,value}))return{accepted:false,code:'PLACEMENT_PREMISE_MISMATCH'};
    if(!canonicalCellValues(tx.eliminations))return{accepted:false,code:'MALFORMED_OR_NONCANONICAL_ELIMINATIONS'};
    if(tx.candidate_initializations.length||tx.contradictions.length)return{accepted:false,code:'FORBIDDEN_PLACEMENT_PAYLOAD'};
    if(!canonicalEffects(tx.affected_candidates))return{accepted:false,code:'MALFORMED_OR_NONCANONICAL_AFFECTED_CANDIDATES'};
    if(state.board[cell]!==0||!(state.candidates[cell]&(1<<(value-1)))||!(legalMask(state.board,cell)&(1<<(value-1))))return{accepted:false,code:'ILLEGAL_PLACEMENT'};
    const post={board:state.board.slice(),candidates:state.candidates.slice(),candidate_initialized:true};
    const targetValues=valuesFromMask(post.candidates[cell]);post.board[cell]=value;post.candidates[cell]=0;
    const bit=1<<(value-1),elims=[],changed=new Set([cell]);
    for(const p of PEERS[cell])if(post.board[p]===0&&(post.candidates[p]&bit)){post.candidates[p]&=~bit;elims.push({cell:p,value});changed.add(p);}
    elims.sort((a,b)=>a.cell-b.cell||a.value-b.value);
    if(!same(tx.eliminations,elims))return{accepted:false,code:'ELIMINATIONS_MISMATCH'};
    const effects=targetValues.map(v=>({cell,value:v,effect:'consume_by_placement'})).concat(elims.map(e=>({cell:e.cell,value:e.value,effect:'eliminate'}))).sort((a,b)=>a.cell-b.cell||a.value-b.value||a.effect.localeCompare(b.effect));
    if(!same(tx.affected_candidates,effects))return{accepted:false,code:'AFFECTED_CANDIDATES_MISMATCH'};
    if(!same(tx.affected_cells,Array.from(changed).sort((a,b)=>a-b)))return{accepted:false,code:'AFFECTED_CELLS_MISMATCH'};
    if(!same(tx.affected_units,normalizeUnits(CELL_UNITS[cell])))return{accepted:false,code:'AFFECTED_UNITS_MISMATCH'};
    if(!postHashesMatch(tx,post))return{accepted:false,code:'POST_HASH_MISMATCH'};
    const truth=k0Truth(post);if(!truth.ok)return{accepted:false,code:'POST_STATE_CANDIDATE_TRUTH_FAILURE'};
    return{accepted:true,code:'OK',post_state:makeState(post)};
  }
  function verifyCommitted(stateValue,tx){
    let state;
    try{state=makeState(stateValue);}catch(e){return{accepted:false,code:'MALFORMED_STATE'};}
    if(!exactKeys(tx,TRANSACTION_KEYS))return{accepted:false,code:'MALFORMED_TRANSACTION_KEYS'};
    if(tx.schema_version!==PROOF_SCHEMA_VERSION)return{accepted:false,code:'UNSUPPORTED_SCHEMA'};
    if(tx.engine_id!==ENGINE_ID)return{accepted:false,code:'WRONG_ENGINE'};
    if(!Number.isInteger(tx.sequence)||tx.sequence<0)return{accepted:false,code:'MALFORMED_SEQUENCE'};
    if(!exactKeys(tx.technique,TECHNIQUE_KEYS))return{accepted:false,code:'MALFORMED_TECHNIQUE'};
    const id=tx.technique.id;
    if(!Object.prototype.hasOwnProperty.call(TECHNIQUE_VERSIONS,id))return{accepted:false,code:'UNSUPPORTED_TECHNIQUE'};
    if(tx.technique.version!==TECHNIQUE_VERSIONS[id])return{accepted:false,code:'UNSUPPORTED_TECHNIQUE_VERSION'};
    if(tx.technique.tier!=='K0')return{accepted:false,code:'UNSUPPORTED_TECHNIQUE_TIER'};
    if(typeof tx.technique.requires_uniqueness!=='boolean')return{accepted:false,code:'MALFORMED_UNIQUENESS_FLAG'};
    if(tx.technique.requires_uniqueness)return{accepted:false,code:'UNIQUENESS_DEPENDENT_UNSUPPORTED'};
    for(const k of ['premises','affected_units','affected_cells','affected_candidates','placements','eliminations','candidate_initializations','contradictions'])if(!Array.isArray(tx[k]))return{accepted:false,code:'MALFORMED_ARRAY'};
    if(tx.affected_units.some(u=>typeof u!=='string'||!UNIT_CELLS[u])||!same(tx.affected_units,normalizeUnits(tx.affected_units)))return{accepted:false,code:'MALFORMED_OR_NONCANONICAL_AFFECTED_UNITS'};
    if(tx.affected_cells.some(c=>!validCell(c))||!same(tx.affected_cells,Array.from(new Set(tx.affected_cells)).sort((a,b)=>a-b)))return{accepted:false,code:'MALFORMED_OR_NONCANONICAL_AFFECTED_CELLS'};
    for(const k of ['pre_board_hash','pre_candidate_hash','pre_state_hash','post_board_hash','post_candidate_hash','post_state_hash'])if(!validHash(tx[k]))return{accepted:false,code:'MALFORMED_HASH'};
    if(tx.pre_board_hash!==state.board_hash)return{accepted:false,code:'STALE_PRE_BOARD_HASH'};
    if(tx.pre_candidate_hash!==state.candidate_hash)return{accepted:false,code:'STALE_PRE_CANDIDATE_HASH'};
    if(tx.pre_state_hash!==state.state_hash)return{accepted:false,code:'STALE_PRE_STATE_HASH'};
    if(!exactKeys(tx.verifier_result,VERIFIER_RESULT_KEYS)||!Array.isArray(tx.verifier_result.details)||tx.verifier_result.details.some(x=>typeof x!=='string'))return{accepted:false,code:'MALFORMED_VERIFIER_RESULT'};
    if(tx.verifier_result.status!=='ACCEPTED'||tx.verifier_result.code!=='OK'||!same(tx.verifier_result.details,[]))return{accepted:false,code:'NOT_COMMITTED'};
    if(!validHash(tx.transaction_hash)||txHash(tx)!==tx.transaction_hash)return{accepted:false,code:'TRANSACTION_HASH_MISMATCH'};
    const truth=k0Truth(state);if(!truth.ok)return{accepted:false,code:'PRE_STATE_CANDIDATE_TRUTH_FAILURE'};
    if(id==='K0.CANDIDATE_INIT'){
      if(state.candidate_initialized)return{accepted:false,code:'CANDIDATES_ALREADY_INITIALIZED'};
      if(!same(tx.premises,[{board_valid:true,candidate_rule:'row_col_box_exclusion'}])||tx.placements.length||tx.eliminations.length||tx.contradictions.length)return{accepted:false,code:'INVALID_CANDIDATE_INIT_PREMISE'};
      const masks=exactCandidates(state.board),init=[];for(let c=0;c<81;c++)if(state.board[c]===0)init.push({cell:c,values:valuesFromMask(masks[c])});
      if(!same(tx.candidate_initializations,init))return{accepted:false,code:'INVALID_CANDIDATE_INITIALIZATION'};
      const effects=[];for(const item of init)for(const value of item.values)effects.push({cell:item.cell,value,effect:'initialize'});effects.sort((a,b)=>a.cell-b.cell||a.value-b.value||a.effect.localeCompare(b.effect));
      if(!same(tx.affected_candidates,effects))return{accepted:false,code:'AFFECTED_CANDIDATES_MISMATCH'};
      if(!same(tx.affected_cells,init.map(x=>x.cell)))return{accepted:false,code:'AFFECTED_CELLS_MISMATCH'};
      if(!same(tx.affected_units,UNIT_ORDER))return{accepted:false,code:'AFFECTED_UNITS_MISMATCH'};
      const post={board:state.board.slice(),candidates:masks,candidate_initialized:true};
      if(!postHashesMatch(tx,post))return{accepted:false,code:'POST_HASH_MISMATCH'};
      return{accepted:true,code:'OK',post_state:makeState(post)};
    }
    if(id==='K0.NAKED_SINGLE'){
      const p=tx.premises&&tx.premises[0];if(tx.premises.length!==1||!exactKeys(p,['cell','candidate_mask','only_value'])||!validCell(p.cell)||!Number.isInteger(p.candidate_mask)||!validDigit(p.only_value))return{accepted:false,code:'MALFORMED_NAKED_SINGLE_PREMISE'};
      if(state.board[p.cell]!==0||state.candidates[p.cell]!==p.candidate_mask||valuesFromMask(p.candidate_mask).length!==1||valuesFromMask(p.candidate_mask)[0]!==p.only_value)return{accepted:false,code:'INVALID_NAKED_SINGLE'};
      return placementTransition(state,tx,p.cell,p.only_value);
    }
    if(id==='K0.HIDDEN_SINGLE'){
      const p=tx.premises&&tx.premises[0];if(tx.premises.length!==1||!exactKeys(p,['unit','value','candidate_cells','target_cell'])||!UNIT_CELLS[p.unit]||!validDigit(p.value)||!Array.isArray(p.candidate_cells)||p.candidate_cells.some(c=>!validCell(c))||!validCell(p.target_cell))return{accepted:false,code:'MALFORMED_HIDDEN_SINGLE_PREMISE'};
      if(UNIT_CELLS[p.unit].some(c=>state.board[c]===p.value))return{accepted:false,code:'INVALID_HIDDEN_SINGLE'};
      const bit=1<<(p.value-1),computed=UNIT_CELLS[p.unit].filter(c=>state.board[c]===0&&(state.candidates[c]&bit));
      if(!same(p.candidate_cells,computed)||computed.length!==1||p.target_cell!==computed[0])return{accepted:false,code:'INVALID_HIDDEN_SINGLE'};
      return placementTransition(state,tx,p.target_cell,p.value);
    }
    if(id==='K0.CONTRADICTION'){
      if(tx.placements.length||tx.eliminations.length||tx.candidate_initializations.length||tx.affected_candidates.length)return{accepted:false,code:'CONTRADICTION_MUTATES_STATE'};
      const c=tx.contradictions&&tx.contradictions[0];if(tx.contradictions.length!==1||tx.premises.length!==1||!same(tx.premises,tx.contradictions)||!c||typeof c!=='object')return{accepted:false,code:'MALFORMED_CONTRADICTION'};
      let real=false,units=[],cells=[];
      if(c.kind==='EMPTY_CELL_NO_CANDIDATES'&&exactKeys(c,['kind','cell'])&&validCell(c.cell)){real=state.candidate_initialized&&state.board[c.cell]===0&&state.candidates[c.cell]===0;cells=[c.cell];}
      else if(c.kind==='UNIT_VALUE_NO_LOCATION'&&exactKeys(c,['kind','unit','value'])&&UNIT_CELLS[c.unit]&&validDigit(c.value)){const bit=1<<(c.value-1);real=state.candidate_initialized&&!UNIT_CELLS[c.unit].some(x=>state.board[x]===c.value)&&!UNIT_CELLS[c.unit].some(x=>state.board[x]===0&&(state.candidates[x]&bit));units=[c.unit];}
      else if(c.kind==='EXACT_ORACLE_NO_SOLUTION')return{accepted:false,code:'ORACLE_REQUIRED_PYTHON_AUTHORITY'};
      else return{accepted:false,code:'MALFORMED_OR_UNSUPPORTED_CONTRADICTION'};
      if(!real)return{accepted:false,code:'FALSE_CONTRADICTION'};
      if(!same(tx.affected_units,units)||!same(tx.affected_cells,cells))return{accepted:false,code:'AFFECTED_SCOPE_MISMATCH'};
      if(!postHashesMatch(tx,state))return{accepted:false,code:'POST_HASH_MISMATCH'};
      return{accepted:true,code:'OK',post_state:state};
    }
    return{accepted:false,code:'UNSUPPORTED_TECHNIQUE'};
  }

  return {SIZE,ENGINE_ID,PROOF_SCHEMA_VERSION,sha256,canonicalStringify,canonicalHash,parseBoard,valuesFromMask,validateBoard,legalMask,exactCandidates,boardHash,candidateHash,stateHash,makeState,transactionHash:txHash,verifyCommitted};
});
