// Photo order is metadata only. Original/variant bytes and pair identities stay intact.
const ACTIONS=new Set(['up','down','top','bottom']);
export const validGalleryOrder=value=>value?.version===1&&Number.isSafeInteger(value.position)&&value.position>=0&&Number.isSafeInteger(value.clock)&&value.clock>0&&typeof value.event_id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(value.event_id)?value:null;
const sourceKey=pair=>String(pair.original?.sha256||pair.pair_id);
export function mergeGalleryOrder(a,b){
 const left=validGalleryOrder(a),right=validGalleryOrder(b);
 if(!left)return right;if(!right)return left;
 // Lamport time plus a unique event id makes immutable Sync snapshots commute.
 if(left.clock!==right.clock)return left.clock>right.clock?left:right;
 if(left.event_id!==right.event_id)return left.event_id>right.event_id?left:right;
 return left.position<=right.position?left:right;
}
export function orderedGallery(pairs,baselineIds=[]){
 const baseline=new Map(baselineIds.map((id,i)=>[id,i]));
 return pairs.map((pair,index)=>({pair,index})).sort((a,b)=>{
  const x=validGalleryOrder(a.pair.gallery_order),y=validGalleryOrder(b.pair.gallery_order);
  if(x&&y)return x.position-y.position||sourceKey(a.pair).localeCompare(sourceKey(b.pair));
  if(x||y)return x?-1:1;
  return (baseline.get(a.pair.pair_id)??baseline.size+a.index)-(baseline.get(b.pair.pair_id)??baseline.size+b.index);
 }).map(row=>row.pair);
}
export function moveGallery(pairs,id,action,{visibleIds,baselineIds=[]}={}){
 if(!ACTIONS.has(action))throw Error('GALLERY_MOVE_INVALID');
 const ordered=orderedGallery(pairs,baselineIds),visible=visibleIds?new Set(visibleIds):null;
 const items=visible?ordered.filter(pair=>visible.has(pair.pair_id)):ordered;
 const from=items.findIndex(pair=>pair.pair_id===id);
 if(from<0)return ordered;
 const to=action==='top'?0:action==='bottom'?items.length-1:from+(action==='up'?-1:1);
 if(to<0||to>=items.length||to===from)return ordered;
 const result=ordered.filter(pair=>pair.pair_id!==id),anchor=items[to].pair_id;
 const at=result.findIndex(pair=>pair.pair_id===anchor)+(to>from?1:0);
 result.splice(at,0,items[from]);return result;
}
