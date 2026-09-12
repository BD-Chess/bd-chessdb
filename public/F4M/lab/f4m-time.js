/* Adapted controller contract from chess/new/js/8zc-time-core.js
   (blob 67a911f12a249030ed339b1ba76b8cfe82ff49e7).
   Monotonic clock for durations; wall UTC only for event stamps.
   Animation / review / pause are never charged to either player. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.F4MTime=api;})(globalThis,function(){
'use strict';
const copy=c=>({...c,used:{...c.used},remaining:{...c.remaining}});
function create({seconds=0,increment=0,turn=1,now=0}={}){const initial=Math.max(0,+seconds||0)*1000;return {version:1,mode:initial?'countdown':'elapsed',initial,increment:Math.max(0,+increment||0)*1000,turn,used:{1:0,2:0},remaining:{1:initial,2:initial},anchor:now,turnSpent:0,running:false,flagged:null};}
function tick(c,now){if(!c.running)return c;const dt=Math.max(0,now-c.anchor);c.anchor=now;const charged=c.mode==='countdown'?Math.min(dt,c.remaining[c.turn]):dt;c.used[c.turn]+=charged;c.turnSpent+=charged;if(c.mode==='countdown'){c.remaining[c.turn]=Math.max(0,c.remaining[c.turn]-dt);if(c.remaining[c.turn]<=0){c.flagged=c.turn;c.running=false;}}return c;}
function snapshot(c,now){return tick(copy(c),now);}
function pause(c,now){tick(c,now);c.running=false;return c;}
function resume(c,now){if(!c.flagged){c.anchor=now;c.running=true;}return c;}
function move(c,side,next,now,atUTC){if(!c.running||c.turn!==side)return null;tick(c,now);if(c.flagged)return null;const record={at_utc:atUTC,think_ms:c.turnSpent,red_elapsed_ms:c.used[1],yellow_elapsed_ms:c.used[2]};if(c.mode==='countdown'){c.remaining[side]+=c.increment;record.clock_ms=c.remaining[side];}c.turn=next;c.turnSpent=0;c.running=false;record.after=copy(c);return record;}
function restore(c,now){const n=copy(c);n.running=false;n.anchor=now;return n;}
function valid(c){return !!c&&['elapsed','countdown'].includes(c.mode)&&[1,2].includes(c.turn)&&[1,2].every(p=>Number.isFinite(c.used?.[p])&&c.used[p]>=0&&Number.isFinite(c.remaining?.[p])&&c.remaining[p]>=0)&&Number.isFinite(c.turnSpent)&&c.turnSpent>=0&&Number.isFinite(c.increment)&&c.increment>=0&&(c.flagged===null||[1,2].includes(c.flagged));}
function format(ms){let s=Math.max(0,Math.ceil(ms/1000));return (s>=3600?Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0'):Math.floor(s/60))+':'+String(s%60).padStart(2,'0');}
return {create,tick,snapshot,pause,resume,move,restore,valid,format,copy};
});
