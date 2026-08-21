/* AI8_SUDOKU_HUMAN_EVENT_V1 local-first event recorder. */
(function(root,factory){
  const api=factory(root.AI8SudokuTruth||(typeof require==='function'?require('./ai8_sudoku_truth_v1.js'):null));
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AI8SudokuHumanTrace=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Truth){
  'use strict';
  if(!Truth)throw new Error('AI8SudokuTruth is required');
  const SCHEMA='AI8_SUDOKU_HUMAN_EVENT_V1';
  const ENGINE='8Z_SUDOKU_HTML_HUMAN_TRACE_V1_2_0';
  const STORAGE_KEY='ai8SudokuHumanTraceV1';
  const CONSENT_KEY='ai8SudokuHumanTraceConsentV1';
  const ALLOWED_SOURCE=new Set(['touch','pointer','key']);
  const ALLOWED_ACTION=new Set(['select_cell','place_value','erase_value','add_note','remove_note','undo','request_hint','accept_hint','ignore_hint','start','pause','resume','finish']);
  const MUTATING_ACTION=new Set(['place_value','erase_value','add_note','remove_note']);
  const PAYLOAD_KEYS={
    start:['reason','difficulty'],
    select_cell:['cell','selected'],
    place_value:['cell','value','previous_value','previous_notes'],
    erase_value:['cell','previous_value','previous_notes'],
    add_note:['cell','value'],
    remove_note:['cell','value'],
    undo:['cell','restored_value','restored_notes','replaced_value','replaced_notes','reverted_action'],
    request_hint:['hint_id','cell','value','technique'],
    accept_hint:['hint_id'],
    ignore_hint:['hint_id','reason'],
    pause:[],resume:[],finish:['outcome']
  };
  const PRIVACY={
    local_first:true,
    device_identifiers:false,
    hidden_fingerprinting:false,
    input_source_domain:['touch','pointer','key'],
    export_time_quantum_ms:50,
    redundant_visible_ui_snapshot:false
  };
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function isInt(v,a,b){return Number.isInteger(v)&&v>=a&&v<=b;}
  function boundedText(v,max){return typeof v==='string'&&v.length>0&&v.length<=max&&![...v].some(ch=>ch.codePointAt(0)<32);}
  function noteList(v){return Array.isArray(v)&&v.every(x=>isInt(x,1,9))&&JSON.stringify(v)===JSON.stringify(Array.from(new Set(v)).sort((a,b)=>a-b));}
  function exactKeys(obj,expected){return obj&&typeof obj==='object'&&!Array.isArray(obj)&&JSON.stringify(Object.keys(obj).sort())===JSON.stringify(expected.slice().sort());}
  function sanitizePayload(action,payload){
    if(!ALLOWED_ACTION.has(action))throw new Error('unsupported human action '+action);
    const expected=PAYLOAD_KEYS[action];
    if(!exactKeys(payload,expected))throw new Error('human trace payload keys mismatch for '+action);
    const p=clone(payload);
    if(action==='start'&&(!boundedText(p.reason,64)||!boundedText(p.difficulty,32)))throw new Error('invalid start payload');
    if(action==='select_cell'&&(!isInt(p.cell,0,80)||typeof p.selected!=='boolean'))throw new Error('invalid selected cell payload');
    if(action==='place_value'&&(!isInt(p.cell,0,80)||!isInt(p.value,1,9)||!isInt(p.previous_value,0,9)||!noteList(p.previous_notes)))throw new Error('invalid placement payload');
    if(action==='erase_value'&&(!isInt(p.cell,0,80)||!isInt(p.previous_value,0,9)||!noteList(p.previous_notes)))throw new Error('invalid erase payload');
    if((action==='add_note'||action==='remove_note')&&(!isInt(p.cell,0,80)||!isInt(p.value,1,9)))throw new Error('invalid note payload');
    if(action==='undo'&&(!isInt(p.cell,0,80)||!isInt(p.restored_value,0,9)||!isInt(p.replaced_value,0,9)||!noteList(p.restored_notes)||!noteList(p.replaced_notes)||!MUTATING_ACTION.has(p.reverted_action)))throw new Error('invalid undo payload');
    if(action==='request_hint'&&(!boundedText(p.hint_id,96)||!isInt(p.cell,0,80)||!isInt(p.value,1,9)||!boundedText(p.technique,96)))throw new Error('invalid hint request payload');
    if(action==='accept_hint'&&!boundedText(p.hint_id,96))throw new Error('invalid hint acceptance payload');
    if(action==='ignore_hint'&&(!boundedText(p.hint_id,96)||!boundedText(p.reason,96)))throw new Error('invalid hint ignore payload');
    if(action==='finish'&&!boundedText(p.outcome,64))throw new Error('invalid finish payload');
    return p;
  }
  function normalizeSource(source){if(!ALLOWED_SOURCE.has(source))throw new Error('invalid input source');return source;}
  function noteMasksFromSets(notes){
    const out=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++){let m=0;for(const v of notes[r][c])m|=1<<(v-1);out.push(m);}return out;
  }
  function stateObject(board,candidates){
    const b=Truth.parseBoard(board),c=candidates.slice();
    if(c.length!==81||c.some(m=>!isInt(m,0,0x1ff)))throw new Error('invalid human candidate state');
    if(b.some((v,i)=>v!==0&&c[i]!==0))throw new Error('notes on filled cell');
    return{board:b,candidates:c,board_hash:Truth.boardHash(b),candidate_hash:Truth.candidateHash(c,true)};
  }
  function eventHash(event){const p=clone(event);p.event_hash='';return Truth.canonicalHash(p);}
  function traceHash(trace){const p=clone(trace);p.trace_hash='';return Truth.canonicalHash(p);}
  class Recorder{
    constructor(getState){
      if(typeof getState!=='function')throw new Error('getState function required');
      this.getState=getState;this.trace=null;this.lastClock=null;this.finished=false;this.memoryConsent=false;this.memoryStored=null;
    }
    hasConsent(){try{return localStorage.getItem(CONSENT_KEY)==='yes'||this.memoryConsent;}catch(_){return this.memoryConsent;}}
    setConsent(granted){
      this.memoryConsent=!!granted;
      try{if(granted)localStorage.setItem(CONSENT_KEY,'yes');else localStorage.removeItem(CONSENT_KEY);}catch(_){}
      if(!granted){this.trace=null;this.finished=false;this.lastClock=null;this.memoryStored=null;try{localStorage.removeItem(STORAGE_KEY);}catch(_){}}
      return !!granted;
    }
    isActive(){return !!this.trace&&this.hasConsent()&&!this.finished;}
    _now(){return(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}
    _delta(){const now=this._now();const d=this.lastClock===null?0:Math.max(0,now-this.lastClock);this.lastClock=now;return Math.round(d/50)*50;}
    _current(){const s=this.getState();return stateObject(s.board,s.candidates);}
    start(source='pointer',payload={reason:'session_start',difficulty:'unknown'}){
      if(!this.hasConsent())return false;
      source=normalizeSource(source);payload=sanitizePayload('start',payload);
      const raw=this.getState(),initial=stateObject(raw.board,raw.candidates);
      const givens=Array.isArray(raw.givens)?Array.from(new Set(raw.givens)).sort((a,b)=>a-b):initial.board.map((v,i)=>v?i:null).filter(v=>v!==null);
      if(givens.some(i=>!isInt(i,0,80)||initial.board[i]===0))throw new Error('given cells do not match initial board');
      this.trace={schema_version:SCHEMA,engine_id:ENGINE,consent:{granted:true,scope:'local_human_action_trace'},privacy_contract:clone(PRIVACY),initial_state:initial,given_cells:givens,events:[],final_state:initial,trace_hash:''};
      this.lastClock=this._now();this.finished=false;
      this.capture('start',source,payload,()=>{});
      return true;
    }
    capture(action,source,payload,mutate){
      if(typeof mutate!=='function')mutate=()=>{};
      if(!this.isActive()){
        // No consent/no trace: preserve normal game behaviour.  A completed trace,
        // however, must not acquire unrecorded post-finish state mutations.
        if(!(this.trace&&this.finished))mutate();
        return null;
      }
      source=normalizeSource(source);payload=sanitizePayload(action,payload||{});
      const before=this._current();
      mutate();
      const after=this._current();
      const event={
        sequence:this.trace.events.length,
        action,
        input_source:source,
        delta_ms_50:this._delta(),
        payload,
        before_board_hash:before.board_hash,
        before_candidate_hash:before.candidate_hash,
        after_board_hash:after.board_hash,
        after_candidate_hash:after.candidate_hash,
        event_hash:''
      };
      event.event_hash=eventHash(event);
      this.trace.events.push(event);this.trace.final_state=after;this.trace.trace_hash=traceHash(this.trace);this._persist();
      if(action==='finish')this.finished=true;
      return event;
    }
    noMutation(action,source,payload){return this.capture(action,source,payload,()=>{});}
    exportObject(){
      if(!this.trace)return null;
      this.trace.final_state=this._current();this.trace.trace_hash=traceHash(this.trace);this._persist();return clone(this.trace);
    }
    _persist(){this.memoryStored=clone(this.trace);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.trace));}catch(_){} }
    storedObject(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):clone(this.memoryStored);}catch(_){return clone(this.memoryStored);}}
    deleteAll(){this.setConsent(false);}
  }
  return{SCHEMA,ENGINE,STORAGE_KEY,CONSENT_KEY,PRIVACY,PAYLOAD_KEYS,Recorder,noteMasksFromSets,stateObject,eventHash,traceHash,sanitizePayload};
});
