"use strict";

const MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 MiB per file (fits comfortably inside 2-4 GiB wasm32 Worker heap)
let cachedWasmBytes = null;
let cachedFastWasmBytes = null;

async function getWasmInstance(useFallbackFastModule = false) {
  if (useFallbackFastModule) {
    if (!cachedFastWasmBytes) {
      const resp = await fetch("./decoder_fast.wasm");
      if (resp.ok) {
        cachedFastWasmBytes = await resp.arrayBuffer();
      }
    }
    if (cachedFastWasmBytes) {
      const { instance } = await WebAssembly.instantiate(cachedFastWasmBytes, {});
      return instance.exports;
    }
  }
  if (!cachedWasmBytes) {
    const response = await fetch("./decoder.wasm");
    if (!response.ok) throw new Error("Brskalnik ni mogel prebrati datoteke decoder.wasm.");
    cachedWasmBytes = await response.arrayBuffer();
  }
  // Fresh instance per call (<1 ms from cached ArrayBuffer) guarantees zero WASM linear-memory accumulation
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

function bytesEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function verifyBytesMatch(inputBytes, restoredBytes, inputDigestOpt) {
  if (restoredBytes.byteLength !== inputBytes.byteLength) {
    return { verified: false, inputDigest: inputDigestOpt || "", restoredDigest: "" };
  }
  const inputDigest = inputDigestOpt !== undefined ? inputDigestOpt : await sha256Hex(inputBytes);
  const restoredDigest = await sha256Hex(restoredBytes);
  if (inputDigest && restoredDigest) {
    return { verified: inputDigest === restoredDigest, inputDigest, restoredDigest };
  }
  return { verified: bytesEqual(inputBytes, restoredBytes), inputDigest: "", restoredDigest: "" };
}

async function measureBrowserZipSize(inputBytes) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const writePromise = writer.write(inputBytes).then(() => writer.close());
    const [buf] = await Promise.all([new Response(cs.readable).arrayBuffer(), writePromise]);
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
      throw new Error((fnName.startsWith("encode") ? "Stiskanje ni uspelo." : "Obnova ni uspela.") + (detail ? " " + detail : ""));
    }
    return view.slice();
  } finally {
    api.free(ptr, inputBytes.length);
  }
}

async function encodeNativeWithLevel(inputBytes, level) {
  let api = await getWasmInstance(false);
  if (level === "fast") {
    if (typeof api.encode_native_fast === "function") {
      return callWasm(api, "encode_native_fast", inputBytes);
    }
    api = null;
    let fastApi = await getWasmInstance(true);
    return callWasm(fastApi, "encode_native", inputBytes);
  }
  if (level === "max" && typeof api.encode_native_max === "function") {
    return callWasm(api, "encode_native_max", inputBytes);
  }
  if (level === "ultra" && typeof api.encode_native_ultra === "function") {
    return callWasm(api, "encode_native_ultra", inputBytes);
  }
  return callWasm(api, "encode_native", inputBytes);
}

function isNative8zcMagic(bytes) {
  return (
    bytes &&
    bytes.length >= 5 &&
    bytes[0] === 0x38 &&
    bytes[1] === 0x5a &&
    bytes[2] === 0x43 &&
    bytes[3] === 0x4e &&
    (bytes[4] === 0x01 || bytes[4] === 0x02 || bytes[4] === 0x03)
  );
}

function resolveFileOp(file, defaultMode, encodeFormat, inputBytes) {
  const nameLow = (file.name || "").toLowerCase();
  if (isNative8zcMagic(inputBytes) || nameLow.endsWith(".8zc") || nameLow.endsWith(".8zc.zip")) {
    return "decode";
  }
  if (defaultMode === "decode") return "decode";
  return encodeFormat === "zip" ? "encode" : "encode_native";
}

self.onmessage = async ({ data }) => {
  try {
    const { mode, file, files } = data;
    const encodeFormat = data.encodeFormat === "zip" ? "zip" : "native";
    const encodeLevel = ["fast", "max", "ultra"].includes(data.encodeLevel) ? data.encodeLevel : "ultra";
    if (!["encode", "encode_native", "decode", "compare", "batch"].includes(mode)) throw new Error("Neznan postopek.");

    if (mode === "batch") {
      if (!Array.isArray(files) || !files.length) throw new Error("Ni izbranih datotek.");
      const defaultOp = data.defaultMode === "decode" ? "decode" : "encode";
      const items = [];
      const transfers = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        self.postMessage({ progress: true, index: i + 1, total: files.length, filename: f.name });
        const maxBytes = MAX_FILE_BYTES + 65536;
        try {
          if (!f.size || f.size > maxBytes) {
            throw new Error(`Datoteka "${f.name}" je prazna ali presega mejo 256 MiB.`);
          }
          const input = new Uint8Array(await f.arrayBuffer());
          const op = resolveFileOp(f, defaultOp, encodeFormat, input);

          const t0 = performance.now();
          let out;
          if (op === "encode_native") {
            out = await encodeNativeWithLevel(input, encodeLevel);
          } else {
            let api = await getWasmInstance(false);
            out = callWasm(api, op, input);
            api = null;
          }
          const elapsedMs = Math.max(1, Math.round(performance.now() - t0));

          let verified = false;
          let browserZipBytes = null;
          const outDigest = await sha256Hex(out);

          if (op === "encode" || op === "encode_native") {
            const inputDigest = await sha256Hex(input);
            let apiDec = await getWasmInstance(false);
            const restored = callWasm(apiDec, "decode", out);
            apiDec = null;
            const check = await verifyBytesMatch(input, restored, inputDigest);
            verified = check.verified;
            if (!verified) {
              throw new Error(`Preverba bitno točne obnove za "${f.name}" ni uspela.`);
            }
            browserZipBytes = await measureBrowserZipSize(input);
          } else {
            verified = out.byteLength <= MAX_FILE_BYTES;
            if (!verified) {
              throw new Error(`Obnovljena datoteka "${f.name}" presega mejo 256 MiB.`);
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
        } catch (fileErr) {
          items.push({
            origName: f.name,
            op: defaultOp,
            inputBytes: f.size || 0,
            outputBytes: 0,
            browserZipBytes: null,
            digest: "",
            verified: false,
            error: fileErr.message || "Napaka pri obdelavi datoteke.",
            elapsedMs: 0,
            bytes: null,
          });
        }
      }

      self.postMessage({ batchDone: true, items }, transfers);
      return;
    }

    const maxBytes = MAX_FILE_BYTES + (mode === "decode" ? 65536 : 0);
    if (!file || !file.size || file.size > maxBytes) {
      throw new Error("Datoteka je prazna ali presega dovoljeno velikost (256 MiB).");
    }

    const input = new Uint8Array(await file.arrayBuffer());

    if (mode === "compare") {
      const inputDigest = await sha256Hex(input);

      let api = await getWasmInstance(false);
      const t0 = performance.now();
      const encodedZip = callWasm(api, "encode", input);
      const encodeMs = Math.max(1, Math.round(performance.now() - t0));
      const hasNativeFn = typeof api.encode_native === "function";
      api = null;

      let apiDec = await getWasmInstance(false);
      const t1 = performance.now();
      const restoredZip = callWasm(apiDec, "decode", encodedZip);
      const decodeMs = Math.max(1, Math.round(performance.now() - t1));
      apiDec = null;

      const checkZip = await verifyBytesMatch(input, restoredZip, inputDigest);
      const restoredDigestZip = checkZip.restoredDigest;
      const verifiedZip = checkZip.verified;

      let encodedNative = null;
      let encodeNativeMs = null;
      let decodeNativeMs = null;
      let z8cNativeFastBytes = undefined;
      let encodeNativeFastMs = null;
      let z8cNativeMaxBytes = undefined;
      let encodeNativeMaxMs = null;
      let z8cNativeUltraBytes = undefined;
      let encodeNativeUltraMs = null;
      let restoredDigestNat = "";
      let verifiedNative = true;

      if (hasNativeFn) {
        const t2 = performance.now();
        encodedNative = await encodeNativeWithLevel(input, encodeLevel);
        encodeNativeMs = Math.max(1, Math.round(performance.now() - t2));

        let apiNatDec = await getWasmInstance(false);
        const t3 = performance.now();
        const restoredNative = callWasm(apiNatDec, "decode", encodedNative);
        decodeNativeMs = Math.max(1, Math.round(performance.now() - t3));
        apiNatDec = null;

        const checkNat = await verifyBytesMatch(input, restoredNative, inputDigest);
        restoredDigestNat = checkNat.restoredDigest;
        verifiedNative = checkNat.verified;

        if (encodeLevel === "ultra") {
          z8cNativeUltraBytes = encodedNative.byteLength;
          encodeNativeUltraMs = encodeNativeMs;
        } else if (encodeLevel === "max") {
          z8cNativeMaxBytes = encodedNative.byteLength;
          encodeNativeMaxMs = encodeNativeMs;
        } else {
          z8cNativeFastBytes = encodedNative.byteLength;
          encodeNativeFastMs = encodeNativeMs;
        }

        if (input.length <= 614400) {
          if (z8cNativeUltraBytes === undefined) {
            const tu0 = performance.now();
            const encUltra = await encodeNativeWithLevel(input, "ultra");
            encodeNativeUltraMs = Math.max(1, Math.round(performance.now() - tu0));
            z8cNativeUltraBytes = encUltra.byteLength;
          }
          if (z8cNativeMaxBytes === undefined) {
            const tm0 = performance.now();
            const encMax = await encodeNativeWithLevel(input, "max");
            encodeNativeMaxMs = Math.max(1, Math.round(performance.now() - tm0));
            z8cNativeMaxBytes = encMax.byteLength;
          }
          if (z8cNativeFastBytes === undefined) {
            const tf0 = performance.now();
            const encFast = await encodeNativeWithLevel(input, "fast");
            encodeNativeFastMs = Math.max(1, Math.round(performance.now() - tf0));
            z8cNativeFastBytes = encFast.byteLength;
          }
        }
      }

      const verified = verifiedZip && verifiedNative;
      const sha256Verified = Boolean(
        inputDigest &&
          restoredDigestZip &&
          inputDigest === restoredDigestZip &&
          (!encodedNative || (restoredDigestNat && inputDigest === restoredDigestNat))
      );
      if (!verified || (inputDigest && restoredDigestZip && !sha256Verified)) {
        throw new Error("Preverba bitno točne obnove v brskalniku ni uspela.");
      }

      const browserZipBytes = await measureBrowserZipSize(input);
      const useNativeOut = encodedNative && encodeFormat !== "zip";
      const primaryOut = useNativeOut ? encodedNative : encodedZip;
      const outputOp = useNativeOut ? "encode_native" : "encode";
      const archiveDigest = await sha256Hex(primaryOut);

      self.postMessage(
        {
          compare: true,
          bytes: primaryOut.buffer,
          outputOp,
          encodeLevel,
          digest: archiveDigest,
          inputBytes: input.length,
          inputDigest,
          restoredDigest: restoredDigestNat || restoredDigestZip,
          verified,
          sha256Verified,
          z8cZipBytes: encodedZip.byteLength,
          z8cNativeBytes: encodedNative ? encodedNative.byteLength : undefined,
          z8cNativeFastBytes,
          encodeNativeFastMs,
          z8cNativeMaxBytes,
          encodeNativeMaxMs,
          z8cNativeUltraBytes,
          encodeNativeUltraMs,
          browserZipBytes,
          encodeMs,
          decodeMs,
          encodeNativeMs,
          decodeNativeMs,
        },
        [primaryOut.buffer]
      );
      return;
    }

    let result;
    if (mode === "encode_native") {
      result = await encodeNativeWithLevel(input, encodeLevel);
    } else {
      let api = await getWasmInstance(false);
      result = callWasm(api, mode, input);
      api = null;
    }

    let verified = false;
    if (mode === "encode" || mode === "encode_native") {
      const inputDigest = await sha256Hex(input);
      let apiDec = await getWasmInstance(false);
      const restored = callWasm(apiDec, "decode", result);
      apiDec = null;
      const check = await verifyBytesMatch(input, restored, inputDigest);
      verified = check.verified;
      if (!verified) {
        throw new Error("Preverba bitno točne obnove v brskalniku ni uspela.");
      }
    } else {
      if (result.byteLength > MAX_FILE_BYTES) {
        throw new Error("Obnovljena datoteka presega dovoljeno velikost (256 MiB).");
      }
      verified = true;
    }

    const digest = await sha256Hex(result);
    self.postMessage({ bytes: result.buffer, outputOp: mode, encodeLevel, digest, verified }, [result.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "Brskalnik ni mogel dokončati opravila." });
  }
};
