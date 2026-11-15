import {dimacsChunks} from './portgen.mjs';
self.onmessage=async({data})=>{
  try {
    const bytes=new Uint8Array(data.n*24+1024);let length=0;
    for(const chunk of dimacsChunks(data.n)){bytes.set(chunk,length);length+=chunk.length;}
    const hash=await crypto.subtle.digest('SHA-256',bytes.subarray(0,length));
    const sha256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
    self.postMessage({buffer:bytes.buffer,length,sha256},[bytes.buffer]);
  }catch{self.postMessage({error:'Unable to generate this example within available memory.'});}
};
