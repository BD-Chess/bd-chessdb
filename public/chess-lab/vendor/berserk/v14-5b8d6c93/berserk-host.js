/* GPL-3.0 Berserk 14 scalar UCI host. The NNUE is supplied locally, never downloaded from this site.
 * The compiled command() is synchronous. Stop terminates the host Worker; later searches recreate it.
 * The user buffer is verified by the session manager before this worker is created. */
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
