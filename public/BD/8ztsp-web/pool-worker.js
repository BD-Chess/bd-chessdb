// Page-owned compute worker; initialization comes only from our pinned adapter.
let initialized = false;
self.onmessage = ({data}) => {
  if (initialized || data.type !== 'wasm_bindgen_worker_init') return;
  initialized = true;
  (async () => {
    if (!(data.module instanceof WebAssembly.Module) || !(data.memory instanceof WebAssembly.Memory)) {
      throw Error('Invalid shared Wasm initialization');
    }
    if (!Number.isInteger(data.receiver) || data.receiver <= 0 || data.receiver >= data.memory.buffer.byteLength) throw Error('Invalid pool receiver');
    const api = await import('./pkg-shared/tsp8z_web.js');
    api.initSync({module:data.module,memory:data.memory});
    self.postMessage({type:'wasm_bindgen_worker_ready'});
    api.wbg_rayon_start_worker(data.receiver);
  })().catch(error => self.postMessage({type:'pool-error',message:String(error)}));
};
