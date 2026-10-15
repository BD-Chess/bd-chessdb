// Images outside the visible window release their Blob URLs. No private bytes enter SW cache.
export function createImageLoader({readBlob,URLClass=URL,Observer=globalThis.IntersectionObserver}={}){
 const records=new Map();let serial=0;
 const key=(asset,normalized)=>{const value=normalized?asset.normalized||asset.blob:asset.blob||asset.normalized;return value?.id||value||asset.remote_url||'';};
 function release(img,row){row.token=++serial;if(row.url){URLClass.revokeObjectURL(row.url);row.url=null;}img.removeAttribute('src');}
 async function load(img,row){
  if(row.loaded)return;const token=row.token=++serial;
  const value=row.normalized?row.asset.normalized||row.asset.blob:row.asset.blob||row.asset.normalized;
  const blob=await readBlob(value);if(row.token!==token||records.get(img)!==row)return;
  row.url=blob?URLClass.createObjectURL(blob):null;row.loaded=true;
  const url=row.url||row.asset.remote_url;if(url)img.src=url;
 }
 const observer=Observer?new Observer(entries=>{for(const entry of entries){const row=records.get(entry.target);if(!row)continue;if(entry.isIntersecting){load(entry.target,row).catch(()=>{});}else{release(entry.target,row);row.loaded=false;}}},{rootMargin:'80px'}):null;
 return {
  async bind(img,asset,normalized=false,immediate=false){
   if(!asset)return;const prior=records.get(img),identity=key(asset,normalized);
   if(prior?.key===identity){if(immediate)await load(img,prior);return;}
   if(prior)release(img,prior);
   const row={asset,normalized,key:identity,token:++serial,loaded:false,url:null};records.set(img,row);
   if(immediate||!observer)await load(img,row);else observer.observe(img);
  },
  sweep(){for(const [img,row] of records)if(!img.isConnected){observer?.unobserve(img);release(img,row);records.delete(img);}},
  unbind(img){const row=records.get(img);if(row){observer?.unobserve(img);release(img,row);records.delete(img);}},
  clear(){for(const [img,row] of records){observer?.unobserve(img);release(img,row);}records.clear();},
  get size(){return records.size;}
 };
}
