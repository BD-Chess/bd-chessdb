/* Thin worker adapter. The maintained Trip LAB solver remains unchanged. */
importScripts('../../../Trip/new/air-distance.js','../../../Trip/new/deep-search.js');
let job=null,timer=null;
onmessage=e=>{
 if(e.data?.type==='cancel'){job?.cancel();return;}
 if(e.data?.type!=='start'||job)return;
 try{
  const {points,distanceMatrix}=e.data;
  if(!Array.isArray(points)||points.length<2||points.length>50)throw Error('INVALID_POINTS');
  if(distanceMatrix&&(distanceMatrix.length!==points.length||distanceMatrix.some(r=>r.length!==points.length||r.some(v=>!Number.isFinite(v)||v<0))))throw Error('INVALID_MATRIX');
  job=TripDeepSearch.create({points,distanceMatrix,startIdx:0,roundTrip:true});
  // This itinerary has a five-second cooperative deadline. Keep the maintained
  // Trip LAB engine and its default budgets unchanged for all other consumers.
  const started=performance.now();let last=0,budgetExpired=false;
  const tick=()=>{
   try{
    if(performance.now()-started>=5000){budgetExpired=true;job.cancel();}
    const done=job.step(8),now=performance.now();
    if(done||now-last>200){const result=job.snapshot();postMessage({type:done?'result':'progress',result:{...result,budgetMs:5000,additionalBudgetMs:5000,remainingMs:Math.max(0,5000-result.elapsedMs),...(budgetExpired?{reason:'budget',cancelled:false}:{})}});last=now;}
    if(!done)timer=setTimeout(tick,0);else job=null;
   }catch(err){postMessage({type:'failed',error:err.message});job=null;}
  };tick();
 }catch(err){postMessage({type:'failed',error:err.message});}
};

