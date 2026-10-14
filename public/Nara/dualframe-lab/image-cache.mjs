export function adjacentImageIndices(length,index){
 if(!Number.isInteger(length)||length<2||!Number.isInteger(index)||index<0||index>=length)return [];
 const previous=(index-1+length)%length,next=(index+1)%length;
 return previous===next?[previous]:[previous,next];
}
export function syncImageCache(cache,urls,ImageClass=Image){
 const wanted=[...new Set(urls.filter(url=>typeof url==='string'&&url))],keep=new Set(wanted);
 for(const [url,image] of cache)if(!keep.has(url)){image.removeAttribute('src');cache.delete(url);}
 for(const url of wanted){
  if(cache.has(url))continue;
  const image=new ImageClass();image.decoding='async';if('fetchPriority'in image)image.fetchPriority='low';
  image.onerror=()=>{if(cache.get(url)===image)cache.delete(url);};
  image.src=url;cache.set(url,image);
  if(typeof image.decode==='function')image.decode().catch(()=>{if(cache.get(url)===image)cache.delete(url);});
 }
}
