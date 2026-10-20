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
  let last=0;
  const tick=()=>{
   try{
    const done=job.step(8),now=performance.now();
    if(done||now-last>200){postMessage({type:done?'result':'progress',result:job.snapshot()});last=now;}
    if(!done)timer=setTimeout(tick,0);else job=null;
   }catch(err){postMessage({type:'failed',error:err.message});job=null;}
  };tick();
 }catch(err){postMessage({type:'failed',error:err.message});}
};

