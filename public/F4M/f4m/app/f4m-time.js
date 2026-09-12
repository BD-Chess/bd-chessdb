/* Adapted from ChessTime 1.0.0, blob 67a911f12a249030ed339b1ba76b8cfe82ff49e7.
 * Separate clock from the physics. Stop at move acceptance; animations are not charged.
 * A saved monotonic anchor is never reused across reloads. Restore is always paused.
 */
(function(root){'use strict';
function create({seconds=0,increment=0,turn=1,now=0}={}){
 const initial=Math.max(0,Number(seconds)||0)*1000;
 return {version:'1.0.0',mode:initial?'countdown':'elapsed',initial,increment:Math.max(0,Number(increment)||0)*1000,
  turn,used:{1:0,2:0},remaining:{1:initial,2:initial},anchor:now,turnSpent:0,running:false,flagged:null};
}
const copy=s=>({...s,used:{...s.used},remaining:{...s.remaining}});
function tick(s,now){
 if(!s.running)return s;
 const delta=Math.max(0,now-s.anchor);s.anchor=Math.max(now,s.anchor);
 const charged=s.mode==='countdown'?Math.min(delta,s.remaining[s.turn]):delta;
 s.used[s.turn]+=charged;s.turnSpent+=charged;
 if(s.mode==='countdown'){s.remaining[s.turn]=Math.max(0,s.remaining[s.turn]-delta);if(!s.remaining[s.turn]){s.flagged=s.turn;s.running=false;}}
 return s;
}
function snapshot(s,now=s.anchor){return tick(copy(s),now);}
function pause(s,now){tick(s,now);s.running=false;}
function resume(s,now){if(!s.flagged){s.anchor=now;s.running=true;}}
function move(s,side,next,now,atUTC){
 if(!s.running||s.turn!==side)return null;tick(s,now);if(s.flagged)return null;
 const r={atUTC,think_ms:s.turnSpent,used:{...s.used}};
 if(s.mode==='countdown'){s.remaining[side]+=s.increment;r.remaining={...s.remaining};}
 s.turn=next;s.turnSpent=0;s.running=false;r.after=copy(s);return r;
}
function restore(raw,now=0){
 if(!raw||![1,2].includes(raw.turn)||!['elapsed','countdown'].includes(raw.mode))throw Error('Invalid clock');
 for(const k of ['initial','increment','turnSpent'])if(!Number.isFinite(raw[k])||raw[k]<0)throw Error('Invalid clock value');
 for(const p of [1,2])for(const k of ['used','remaining'])if(!Number.isFinite(raw[k]?.[p])||raw[k][p]<0)throw Error('Invalid clock totals');
 if(raw.flagged!==null&&![1,2].includes(raw.flagged))throw Error('Invalid flag');
 const s=copy(raw);s.running=false;s.anchor=now;return s;
}
function format(ms){const n=Math.max(0,Math.ceil(ms/1000));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
const api={VERSION:'1.0.0',create,copy,tick,snapshot,pause,resume,move,restore,format};root.F4MTime=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
