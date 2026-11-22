import {decryptWasm,importWasmKey} from './wasm-crypto.mjs';
const modules = new Map();
let contentKey;

const protectedRivals = {
  lkh: './rivals/lkh-wasm/lkh_3_0_14.wasm.enc',
  concorde: './rivals/concorde/concorde.wasm.enc',
};
export async function loadRivalWasm(engine) {
  const path = protectedRivals[engine];
  if (!path) return null;
  if (!contentKey) throw Error('Unlock the app before loading this solver');
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw Error('Encrypted solver module unavailable');
  return decryptWasm(await response.arrayBuffer(), contentKey);
}
export const loaderState = {status:'loading',metrics:null};
export function supportsSharedThreads() {
  if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') return false;
  try {return new WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof SharedArrayBuffer;}
  catch {return false;}
}
export function solverModule(shared = false) {
  if (loaderState.status !== 'ready' || !modules.has(shared)) throw Error('Solver unavailable');
  return modules.get(shared);
}
export async function initializeWasm() {
  const prepared = new Map(),metrics = {};
  // Page inserts this block BEFORE BD HTML Protector encrypts the HTML.
  // Remove it immediately; no key or plaintext is persisted in browser storage.
  const block = document.getElementById('tsp8z-wasm-key');
  const encoded = block?.textContent;
  block?.remove();
  try {
    if (!crypto.subtle || !encoded || block.type !== 'application/json') throw Error('Content key unavailable');
    const key = await importWasmKey(JSON.parse(encoded).keyHex);
    for (const shared of supportsSharedThreads() ? [false,true] : [false]) {
      const path = shared ? './pkg-shared/tsp8z_web_bg.wasm.enc' : './pkg/tsp8z_web_bg.wasm.enc';
      const response = await fetch(new URL(path,import.meta.url));
      if (!response.ok) throw Error('Encrypted module unavailable');
      const began = performance.now();
      const plaintext = await decryptWasm(await response.arrayBuffer(),key);
      try {
        const hash = await crypto.subtle.digest('SHA-256',plaintext);
        const module = await WebAssembly.compile(plaintext);
        prepared.set(shared,module);
        metrics[shared ? 'shared' : 'serial'] = {decryptCompileMilliseconds:performance.now()-began,
          sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};
      } finally {plaintext.fill(0);}
    }
    contentKey = key;
    for (const [variant,module] of prepared) modules.set(variant,module);
    loaderState.metrics = metrics; loaderState.status = 'ready';
  } catch (error) {loaderState.status = 'failed';throw error;}
}
