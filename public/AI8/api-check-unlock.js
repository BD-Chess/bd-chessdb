/* API Check encrypted key vault. Compatible with MALm 8Z Shield v3.
 * Ciphertext is public; the passphrase is NEVER stored in this source.
 * Secrets are ephemeral in browser memory after a manual unlock.
 */
(function (root) {
  'use strict';
  const te = new TextEncoder();
  const td = new TextDecoder();
  const M64 = (1n << 64n) - 1n;
  const DOMAIN_SUFFIX_B64 = 'fHxNREx4RENDLm9yZw==';
  const EXPECTED = ['chatgpt','claude','qwen','gemini','grok','glm','minimax','mistral','kimi','deepseek'];
  function concat(...parts) {
    const result = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
    let off = 0;
    for (const x of parts) { result.set(x, off); off += x.length; }
    return result;
  }
  function bigEndian(bytes) {
    let v = 0n;
    for (const b of bytes) v = (v << 8n) | BigInt(b);
    return v;
  }
  function eightBytes(v) {
    const b = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) { b[i] = Number(v & 255n); v >>= 8n; }
    return b;
  }
  async function sha(bytes) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  }
  async function deriveShieldKey(passphrase, salt, iterations, rounds) {
    const ph = await sha(te.encode(passphrase));
    const sm = await sha(concat(ph, salt, te.encode('8Z_AUTH_V1')));
    let x = bigEndian(sm.slice(0, 8)) || 0x9E3779B97F4A7C15n;
    for (let i = 0; i < rounds; i++) {
      x = (x ^ (x >> 12n)) & M64;
      x = (x ^ ((x << 25n) & M64)) & M64;
      x = (x ^ (x >> 27n)) & M64;
    }
    const sh = await sha(eightBytes(x));
    const km = await crypto.subtle.importKey('raw', concat(ph, sh), 'PBKDF2', false, ['deriveBits']);
    const result = await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'}, km, 256);
    ph.fill(0); sm.fill(0); sh.fill(0);
    return new Uint8Array(result);
  }
  async function unzipGzip(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('Gzip is not available');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unlock(password) {
    const host = location.hostname.toLowerCase();
    // Matches MALm's production-host binding, and permits local development.
    if (!['www.mdlxdcc.org','mdlxdcc.org','localhost','127.0.0.1'].includes(host)) {
      throw new Error('Unsupported host');
    }
    if (!password) throw new Error('Empty passphrase');
    const response = await fetch('/AI8/api-check.vault.json', {
      method:'GET',cache:'no-store',credentials:'omit',redirect:'error'
    });
    if (!response.ok) throw new Error('Vault unavailable');
    const data = await response.text();
    if (data.length > 8192) throw new Error('Unexpected vault size');
    const vault = JSON.parse(data);
    if (vault.schema !== 'bd-api-check-vault-v1' ||
        vault.crypto !== '8z-shield-v3-pbkdf2-aes256gcm' ||
        vault.iterations !== 10000000 || vault.rounds !== 1024 ||
        typeof vault.payload !== 'string') throw new Error('Unexpected vault');
    const raw = atob(vault.payload);
    const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    if (bytes.length < 61 || bytes.length > 8192) throw new Error('Invalid payload');
    const salt = bytes.slice(0,32), iv = bytes.slice(32,44), cipher = bytes.slice(44);
    const derived = await deriveShieldKey(password + atob(DOMAIN_SUFFIX_B64), salt, vault.iterations, vault.rounds);
    try {
      const key = await crypto.subtle.importKey('raw', derived, 'AES-GCM', false, ['decrypt']);
      const clear = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,tagLength:128},key,cipher));
      const json = JSON.parse(td.decode(await unzipGzip(clear)));
      clear.fill(0);
      if (json.schema !== 'bd-api-check-keys-v1' ||
          !json.keys || typeof json.keys !== 'object' ||
          Object.keys(json.keys).length !== EXPECTED.length ||
          !EXPECTED.every(id => typeof json.keys[id] === 'string' &&
            json.keys[id].length > 12 && json.keys[id].length < 8192 &&
            !/[\r\n]/.test(json.keys[id]))) throw new Error('Invalid key set');
      return json.keys;
    } finally { derived.fill(0); }
  }
  root.BDAPIVault = Object.freeze({unlock});
})(window);
