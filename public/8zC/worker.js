"use strict";

async function sha256Hex(bytes) {
  if (!self.crypto?.subtle) return "";
  try {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

async function measureBrowserZipSize(inputBytes) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    writer.write(inputBytes);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    // Standard single-member ZIP container overhead (30B local hdr + 2B name "in" + 46B central dir + 2B name + 22B EOCD = 102 B)
    return buf.byteLength + 102;
  } catch {
    return null;
  }
}

function callWasm(api, fnName, inputBytes) {
  const ptr = api.alloc(inputBytes.length) >>> 0;
  if (!ptr) throw new Error("Za vhodno datoteko ni dovolj pomnilnika.");
  try {
    new Uint8Array(api.memory.buffer, ptr, inputBytes.length).set(inputBytes);
    const code = api[fnName](ptr, inputBytes.length);
    const offset = api.result_ptr() >>> 0;
    const size = api.result_len() >>> 0;
    const view = new Uint8Array(api.memory.buffer, offset, size);
    if (code !== 0) {
      const detail = new TextDecoder().decode(view);
      throw new Error((fnName === "encode" ? "Stiskanje ni uspelo." : "Obnova ni uspela.") + (detail ? " " + detail : ""));
    }
    return view.slice();
  } finally {
    api.free(ptr, inputBytes.length);
  }
}

self.onmessage = async ({ data: { mode, file } }) => {
  try {
    if (!["encode", "decode", "compare"].includes(mode)) throw new Error("Neznan postopek.");
    const maxBytes = 16 * 1024 * 1024 + (mode === "decode" ? 1024 : 0);
    if (!file.size || file.size > maxBytes) throw new Error("Neveljavna velikost vhodne datoteke.");
    const response = await fetch("./decoder.wasm");
    if (!response.ok) throw new Error("Brskalnik ni mogel prebrati datoteke decoder.wasm.");
    const wasmBytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    const api = instance.exports;
    const input = new Uint8Array(await file.arrayBuffer());

    if (mode === "compare") {
      const inputDigest = await sha256Hex(input);
      const t0 = performance.now();
      const encoded = callWasm(api, "encode", input);
      const encodeMs = Math.max(1, Math.round(performance.now() - t0));

      const t1 = performance.now();
      const restored = callWasm(api, "decode", encoded);
      const decodeMs = Math.max(1, Math.round(performance.now() - t1));

      const restoredDigest = await sha256Hex(restored);
      const verified = restored.length === input.length && (!inputDigest || inputDigest === restoredDigest);
      if (!verified) throw new Error("Preverba SHA-256 obnove v brskalniku ni uspela.");

      const browserZipBytes = await measureBrowserZipSize(input);
      const archiveDigest = await sha256Hex(encoded);

      self.postMessage(
        {
          compare: true,
          bytes: encoded.buffer,
          digest: archiveDigest,
          inputBytes: input.length,
          inputDigest,
          restoredDigest,
          verified,
          z8cZipBytes: encoded.byteLength,
          browserZipBytes,
          encodeMs,
          decodeMs,
        },
        [encoded.buffer]
      );
      return;
    }

    const result = callWasm(api, mode, input);
    const digest = await sha256Hex(result);
    self.postMessage({ bytes: result.buffer, digest }, [result.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "Brskalnik ni mogel dokončati opravila." });
  }
};
