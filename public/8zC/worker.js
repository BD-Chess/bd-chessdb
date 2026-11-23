"use strict";

self.onmessage = async ({ data: { mode, file } }) => {
  try {
    if (!["encode", "decode"].includes(mode)) throw new Error("Neznan postopek.");
    const maxBytes = 16 * 1024 * 1024 + (mode === "decode" ? 1024 : 0);
    if (!file.size || file.size > maxBytes) throw new Error("Neveljavna velikost vhodne datoteke.");
    const response = await fetch("./decoder.wasm");
    if (!response.ok) throw new Error("Brskalnik ni mogel prebrati datoteke decoder.wasm.");
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    const api = instance.exports;
    const input = new Uint8Array(await file.arrayBuffer());
    const ptr = api.alloc(input.length) >>> 0;
    if (!ptr) throw new Error("Za vhodno datoteko ni dovolj pomnilnika.");
    let result;
    try {
      new Uint8Array(api.memory.buffer, ptr, input.length).set(input);
      const code = api[mode](ptr, input.length);
      const offset = api.result_ptr() >>> 0;
      const size = api.result_len() >>> 0;
      const view = new Uint8Array(api.memory.buffer, offset, size);
      if (code !== 0) {
        const detail = new TextDecoder().decode(view);
        throw new Error((mode === "encode" ? "Stiskanje ni uspelo." : "Obnova ni uspela.") + (detail ? " " + detail : ""));
      }
      result = view.slice();
    } finally {
      api.free(ptr, input.length);
    }
    let digest;
    if (self.crypto?.subtle) {
      try {
        const hash = await crypto.subtle.digest("SHA-256", result);
        digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
      } catch { /* The download remains available when the browser cannot compute SHA-256. */ }
    }
    self.postMessage({ bytes: result.buffer, digest }, [result.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "Brskalnik ni mogel dokončati opravila." });
  }
};
