"use strict";

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 MiB per file (fits comfortably inside 2-4 GiB wasm32 Worker heap)
let cachedWasmBytes = null;

async function getWasmInstance() {
  if (!cachedWasmBytes) {
    const response = await fetch("./decoder.wasm");
    if (!response.ok) throw new Error("Brskalnik ni mogel prebrati datoteke decoder.wasm.");
    cachedWasmBytes = await response.arrayBuffer();
  }
  // Fresh instance per file (<1 ms from cached ArrayBuffer) guarantees zero WASM linear-memory accumulation across large batches
  const { instance } = await WebAssembly.instantiate(cachedWasmBytes, {});
  return instance.exports;
}

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
    return buf.byteLength + 102;
  } catch {
    return null;
  }
}

function callWasm(api, fnName, inputBytes) {
  const ptr = api.alloc(inputBytes.length) >>> 0;
  if (!ptr) throw new Error("Za vhodno datoteko ni dovolj pomnilnika v WASM.");
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

function resolveFileOp(file, defaultMode, inputBytes) {
  const nameLow = (file.name || "").toLowerCase();
  if (nameLow.endsWith(".8zc.zip")) return "decode";
  if (defaultMode === "decode") return "decode";
  return "encode";
}

self.onmessage = async ({ data }) => {
  try {
    const { mode, file, files } = data;
    if (!["encode", "decode", "compare", "batch"].includes(mode)) throw new Error("Neznan postopek.");

    if (mode === "batch") {
      if (!Array.isArray(files) || !files.length) throw new Error("Ni izbranih datotek.");
      const defaultOp = data.defaultMode === "decode" ? "decode" : "encode";
      const items = [];
      const transfers = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        self.postMessage({ progress: true, index: i + 1, total: files.length, filename: f.name });
        const maxBytes = MAX_FILE_BYTES + 65536;
        if (!f.size || f.size > maxBytes) {
          throw new Error(`Datoteka "${f.name}" je prazna ali presega mejo 256 MiB.`);
        }
        const api = await getWasmInstance();
        const input = new Uint8Array(await f.arrayBuffer());
        const op = resolveFileOp(f, defaultOp, input);
        const t0 = performance.now();
        const out = callWasm(api, op, input);
        const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

        let verified = true;
        let browserZipBytes = null;
        let outDigest = await sha256Hex(out);

        if (op === "encode") {
          // Verify lossless roundtrip inside fresh WASM instance for files <= 64 MiB automatically
          if (input.length <= 64 * 1024 * 1024) {
            const apiDec = await getWasmInstance();
            const restored = callWasm(apiDec, "decode", out);
            verified = restored.length === input.length && restored.every((b, idx) => b === input[idx]);
            if (!verified) throw new Error(`Preverba bitno točne obnove za "${f.name}" ni uspela.`);
            browserZipBytes = await measureBrowserZipSize(input);
          }
        }

        items.push({
          origName: f.name,
          op,
          inputBytes: input.length,
          outputBytes: out.byteLength,
          browserZipBytes,
          digest: outDigest,
          verified,
          elapsedMs,
          bytes: out.buffer,
        });
        transfers.push(out.buffer);
      }

      self.postMessage({ batchDone: true, items }, transfers);
      return;
    }

    const maxBytes = MAX_FILE_BYTES + (mode === "decode" ? 65536 : 0);
    if (!file || !file.size || file.size > maxBytes) {
      throw new Error("Datoteka je prazna ali presega dovoljeno velikost (256 MiB).");
    }

    const api = await getWasmInstance();
    const input = new Uint8Array(await file.arrayBuffer());

    if (mode === "compare") {
      const inputDigest = await sha256Hex(input);
      const t0 = performance.now();
      const encoded = callWasm(api, "encode", input);
      const encodeMs = Math.max(1, Math.round(performance.now() - t0));

      const apiDec = await getWasmInstance();
      const t1 = performance.now();
      const restored = callWasm(apiDec, "decode", encoded);
      const decodeMs = Math.max(1, Math.round(performance.now() - t1));

      const restoredDigest = await sha256Hex(restored);
      const verified = restored.length === input.length && restored.every((byte, i) => byte === input[i]);
      const sha256Verified = Boolean(inputDigest && restoredDigest && inputDigest === restoredDigest);
      if (!verified || (inputDigest && restoredDigest && !sha256Verified)) {
        throw new Error("Preverba bitno točne obnove v brskalniku ni uspela.");
      }

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
          sha256Verified,
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
