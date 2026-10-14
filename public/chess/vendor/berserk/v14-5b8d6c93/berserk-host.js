/* GPL-3.0 Berserk 14 scalar UCI host. Verified NNUE is supplied by the session loader.
 * The compiled command() is synchronous. Stop terminates the host Worker; later searches recreate it.
 * The user buffer is verified by the session manager before this worker is created. */
const originalFetch=self.fetch.bind(self);
self.fetch=async function(input,options){
  const response=await originalFetch(input,options);
  const url=String(typeof input==='string'?input:input.url||input);
  if(!url.endsWith('.wasm')||!response.body)return response;
  const reader=response.body.getReader();let loaded=0;
  return new Response(new ReadableStream({async pull(controller){
    try{const chunk=await reader.read();
      if(chunk.done){
        const timing=self.performance?.getEntriesByName?.(url)?.slice(-1)[0];
        self.postMessage({type:'chessbest-engine-progress',phase:timing?.transferSize>0&&timing.transferSize>=(timing.encodedBodySize||0)?'downloading':timing?.decodedBodySize>0?'preparing':'loading',loaded});
        reader.releaseLock();controller.close();
      }else{loaded+=chunk.value.byteLength;controller.enqueue(chunk.value);}
    }catch(error){controller.error(error);}
  },cancel(reason){return reader.cancel(reason);}}),{status:response.status,headers:response.headers});
};
importScripts('berserk-emscripten.js');
const base = new URL('./',self.location.href);
let startModule;
const moduleReady = new Promise(resolve=>{startModule=resolve;});
self.onmessage = event => {
  if (event.data?.type === 'init-network') {
    const data = event.data.buffer;
    if (!(data instanceof ArrayBuffer) || data.byteLength !== 25201924) throw new Error('Invalid local Berserk NNUE');
    // Preserve the donor's asynchronous preload ordering using a device-local Blob.
    // A synchronous getPreloadedPackage() can re-enter Emscripten run() before FS/main are ready.
    const localNetwork = URL.createObjectURL(new Blob([data],{type:'application/octet-stream'}));
    const instance = Berserk({
      locateFile(file){if(file.endsWith('.data'))return localNetwork;return new URL(file.endsWith('.wasm')?'berserk-emscripten.wasm':file,base).href;},
      print(line){self.postMessage(String(line));},
      printErr(line){self.postMessage('info string Berserk stderr: '+String(line));}
    });
    startModule(instance.finally(()=>URL.revokeObjectURL(localNetwork)));return;
  }
  const command = String(event.data ?? '');
  moduleReady.then(module=>{
    module.ccall('command',null,['string'],[command]);
    if(command.trim()==='quit')self.close();
  }).catch(error=>{self.postMessage('info string Berserk load failed');setTimeout(()=>{throw error;},0);});
};
