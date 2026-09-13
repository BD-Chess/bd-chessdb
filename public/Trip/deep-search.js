/* Classical multistart + best-improvement 2-opt, with one cooperative deadline.
 * Costs are evaluated on demand: no second n*n matrix for road or TSP jobs.
 * Hooks belong to the module's test harness, never to the worker wire protocol. */
(() => {
  'use strict';
  function budgetMs(n) { return n <= 50 ? 10000 : n <= 100 ? 30000 : n <= 500 ? 60000 : n <= 1000 ? 180000 : 300000; }
  async function verifyTarget(msg) {
    const p = msg.tspProof, r = p?.reference, e = p?.entry;
    if (msg.metric !== 'tsp-euc2d' || msg.distanceMatrix != null || !msg.roundTrip || !r || !e ||
        r.metric !== 'EUC_2D' || r.status !== 'proven' || r.id !== e.id || r.count !== e.count ||
        msg.points.length !== r.count || !Number.isSafeInteger(r.optimum) || r.optimum <= 0 ||
        r.originalSha256 !== e.originalSha256 || typeof p.originalText !== 'string') return null;
    const bytes = new TextEncoder().encode(p.originalText);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if (digest !== r.originalSha256) return null;
    try {
      const original = TripTspMetric.parse(p.originalText,e);
      const authenticated = TripTspMetric.authenticate(msg.points,original,e);
      if (authenticated.some((p,i)=>p.x!==msg.points[i].x || p.y!==msg.points[i].y || p.tspNodeId!==msg.points[i].tspNodeId || p.tspId!==msg.points[i].tspId)) return null;
    } catch { return null; }
    return r;
  }
  function create(msg, hooks = {}) {
    const now = hooks.now || (()=>performance.now()), started = hooks.started ?? now();
    const points=msg.points, n=points.length, planar=msg.metric==='tsp-euc2d';
    const metric=planar ? 'tsp-euc2d' : msg.distanceMatrix==null ? 'direct' : 'road';
    const increment=budgetMs(n);
    let budget=increment, segmentStarted=started, carried=0, stoppedAt=null;
    const elapsed=()=>Math.max(0,carried+(stoppedAt??now())-segmentStarted);
    const freeze=()=>{if(stoppedAt===null)stoppedAt=now();};
    const canResume=()=>reason==='budget'||reason==='cancelled';
    const start=Number.isInteger(msg.startIdx)&&msg.startIdx>=0&&msg.startIdx<n ? msg.startIdx : 0;
    if (n<2 || points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180 || (planar&&(!Number.isFinite(p.x)||!Number.isFinite(p.y))))) throw Error('All stops must have valid coordinates.');
    const D=msg.distanceMatrix;
    if (!planar && D!=null && (D.length!==n || D.some(row=>!row||row.length!==n))) throw Error('Incomplete road distance matrix.');
    const distance=(a,b)=>{
      const v=planar ? TripTspMetric.edge(points[a],points[b]) : D==null ? TripAirDistance.meters(points[a],points[b]) : D[a][b];
      if (!Number.isFinite(v)||v<0) throw Error('Incomplete road distance matrix.');
      return v;
    };
    function length(route) { let v=0; for(let i=1;i<n;i++)v+=distance(route[i-1],route[i]); if(msg.roundTrip)v+=distance(route[n-1],route[0]); return v; }
    // Establish a valid fallback before any quadratic preparation/search.
    const baseline=[start,...Array.from({length:n},(_,i)=>i).filter(i=>i!==start)];
    const base=length(baseline);
    let best=baseline.slice(), cost=base, candidates=0, completed=0, improvements=0, work=0, phase='preparing';
    let target=null, reason=null, cancelled=false, error=null, version=0;
    function verifyBest() {
      if (!target) return;
      if (cost < target.optimum) { error='TSP result is below the verified optimum. Check data and metric.'; reason='reference-mismatch'; return; }
      if (cost===target.optimum && TripTspMetric.assess(best.map(i=>points[i]),points,target,msg.roundTrip,cost)?.reached) reason='optimum';
    }
    function consider(route) {
      const v=length(route); // Independent full sum; do not accumulate 2-opt deltas.
      if (v < cost) { cost=v; best=route.slice(); version++; }
      verifyBest();
    }
    function* search() {
      // Validate a supplied directed table in small pieces; never construct an air table beside it.
      if (D!=null && !planar) for(let i=0;i<n;i++)for(let j=0;j<n;j++) { distance(i,j); if(++work%128===0)yield; }
      let hash=0xcbf29ce484222325n;
      const seed=points.map(p=>`${p.lat},${p.lon}`).concat([String(start),'deep',String(!!msg.roundTrip)]);
      for(const part of seed) for(const c of part+'|') { hash=((hash^BigInt(c.charCodeAt(0)))*0x100000001b3n)&0xffffffffffffffffn; if(++work%128===0)yield; }
      let rng=hash||1n;
      function random() { rng^=rng>>12n; rng^=(rng<<25n)&0xffffffffffffffffn; rng^=rng>>27n; return Number((((rng*2685821657736338717n)&0xffffffffffffffffn)>>11n))/9007199254740992; }
      phase='searching'; candidates=1;
      const greedy=[start], used=new Uint8Array(n); used[start]=1;
      while(greedy.length<n) {
        let next=-1, near=Infinity, a=greedy.at(-1);
        for(let i=0;i<n;i++) { if(!used[i]) {const d=distance(a,i);if(d<near){near=d;next=i;}} if(++work%128===0)yield; }
        greedy.push(next);used[next]=1;
      }
      let route=greedy.slice(); consider(route); yield;
      const reverse=new Float64Array(n);
      while(!reason) {
        // Improve this candidate to a local 2-opt optimum, subject only to shared deadline/cancel.
        while(!reason) {
          reverse[0]=0;
          for(let k=0;k<n-1;k++) { reverse[k+1]=reverse[k]+distance(route[k+1],route[k])-distance(route[k],route[k+1]); if(++work%128===0)yield; }
          let delta=-1e-9, bi=-1, bk=-1;
          for(let i=1;i<n-1;i++)for(let k=i+1;k<n;k++) {
            const a=route[i-1], b=route[i], c=route[k];
            let d=distance(a,c)-distance(a,b)+reverse[k]-reverse[i];
            if(k<n-1)d+=distance(b,route[k+1])-distance(c,route[k+1]);
            else if(msg.roundTrip)d+=distance(b,route[0])-distance(c,route[0]);
            if(d<delta){delta=d;bi=i;bk=k;}
            if(++work%128===0)yield;
          }
          if(bi<0)break;
          for(let a=bi,b=bk;a<b;a++,b--) [route[a],route[b]]=[route[b],route[a]];
          improvements++; consider(route); yield;
        }
        if(reason)break;
        completed++; yield;
        candidates++; route=greedy.slice();
        for(let i=n-1;i>1;i--) {const j=1+Math.floor(random()*i);[route[i],route[j]]=[route[j],route[i]];if(++work%128===0)yield;}
        consider(route); yield;
      }
    }
    const iterator=search();
    function snapshot() {
      if(reason)freeze();
      const used=elapsed();
      let air=0; for(let i=1;i<n;i++)air+=TripAirDistance.meters(points[best[i-1]],points[best[i]]);if(msg.roundTrip)air+=TripAirDistance.meters(points[best[n-1]],points[best[0]]);
      return {algorithm:'deep',metric,pointsSorted:best.map(i=>points[i]),totalCost:cost,baseCost:base,totalKm:planar?null:cost/1000,baseKm:planar?null:base/1000,directKm:air/1000,
        elapsedMs:used,budgetMs:budget,additionalBudgetMs:increment,remainingMs:Math.max(0,budget-used),candidates,completed,improvements,work,phase,bestVersion:version,
        reason,cancelled:reason==='cancelled',exact:reason==='optimum',error};
    }
    return {
      setTarget(r){target=r;verifyBest();},
      cancel(){cancelled=true;},
      resume() {
        if(!canResume())return false;
        carried=elapsed();segmentStarted=now();stoppedAt=null;
        budget+=increment;reason=null;cancelled=false;
        return true;
      },
      get canResume(){return canResume();},
      step(sliceMs=8) {
        const sliceEnd=now()+sliceMs;
        do {
          if(cancelled){reason='cancelled';break;}
          if(reason)break;
          if(elapsed()>=budget || (hooks.workLimit!=null&&work>=hooks.workLimit)){reason='budget';break;}
          const v=iterator.next();
          if(v.done)break;
        }while(now()<sliceEnd);
        if(reason)freeze();
        return !!reason;
      }, snapshot,
      get done(){return !!reason;}
    };
  }
  globalThis.TripDeepSearch={budgetMs,create,verifyTarget};
})();
