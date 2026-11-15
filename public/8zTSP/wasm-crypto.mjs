// Envelope v2: authenticated 21-byte header || AES-256-GCM ciphertext || 128-bit tag.
// Authentication belongs to BD HTML Protector; this layer uses a random content key.
export const MAGIC = new Uint8Array([56,90,84,83,80,69,78,67]); // 8ZTSPENC
export const VERSION = 2, HEADER_BYTES = 21;
export function readEnvelope(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_BYTES + 16 + 8 || !MAGIC.every((b,i) => bytes[i] === b) || bytes[8] !== VERSION) {
    throw Error('Invalid encrypted module');
  }
  return {header:bytes.slice(0,HEADER_BYTES),iv:bytes.slice(9,21),ciphertext:bytes.slice(HEADER_BYTES)};
}
export async function importWasmKey(hex,usages = ['decrypt']) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hex)) throw Error('Invalid Wasm content key');
  const raw = Uint8Array.from(hex.match(/../g),byte=>parseInt(byte,16));
  try {return await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,usages);}
  finally {raw.fill(0);}
}
export async function decryptWasm(buffer,key) {
  const envelope = readEnvelope(buffer);
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:envelope.iv,
    additionalData:envelope.header,tagLength:128},key,envelope.ciphertext));
}
