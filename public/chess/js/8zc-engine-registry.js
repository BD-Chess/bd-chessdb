/* One source of engine-family capabilities. Importing it never starts a worker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessEngineRegistry=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const entries={
    'sf-lite':{family:'stockfish',role:'SF',label:'Stockfish Lite',available:true,depth:true,multiPV:true,restrictedRoots:true},
    'sf-full':{family:'stockfish',role:'SF',label:'Stockfish Full',available:true,depth:true,multiPV:true,restrictedRoots:true},
    reckless:{family:'reckless',role:'RLE',label:'Reckless',available:true,depth:true,multiPV:true,restrictedRoots:false},
    lc0:{family:'lc0',role:'LC0',label:'LCZero NN / Maia1900 / browser PUCT',available:true,depth:false,visits:true,multiPV:false,restrictedRoots:false},
    berserk:{family:'berserk',role:'BER',label:'Berserk',available:true,depth:true,multiPV:true,restrictedRoots:true}
  };
  const listeners=new Set();
  const get=mode=>entries[mode]?Object.freeze({...entries[mode],id:mode}):null;
  const supported=mode=>!!entries[mode]?.available;
  const participants=variant=>[variant==='sf-full'?'sf-full':'sf-lite','reckless','lc0','berserk'].filter(supported);
  function rootSupport(ids){
    const unsupported=ids.filter(id=>!entries[id]?.restrictedRoots);
    return {supported:ids.length>0&&!unsupported.length,unsupported,
      reason:unsupported.length?'Restricted first moves unavailable: '+unsupported.map(id=>entries[id]?.label||id).join(', ')+' does not support this search.':ids.length?'':'No available engine participants.'};
  }
  return {get,supported,participants,rootSupport,modes:()=>Object.keys(entries).filter(supported),roleFor:mode=>entries[mode]?.role,
    label:mode=>entries[mode]?.label||mode,count:variant=>participants(variant).length,
    setAvailable(mode,available){if(entries[mode]){entries[mode].available=!!available;for(const fn of listeners)fn();}},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
});
