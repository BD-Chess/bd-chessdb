// Application limits; numerical search inputs are not split into restarted runs.
export const RUN_LIMITS=Object.freeze({minSeconds:0.1,maxSeconds:86400,history:4096,renderChanges:256});
export const validSeconds=value=>typeof value==='number'&&Number.isFinite(value)&&value>=RUN_LIMITS.minSeconds&&value<=RUN_LIMITS.maxSeconds;
export function retainRecent(items,item,limit) {
  items.push(item);
  if(items.length<=limit)return 0;
  // Preserve the first event and recent events; discard a batch to bound copying.
  const drop=Math.max(1,Math.floor(limit/2));items.splice(1,drop);return drop;
}
