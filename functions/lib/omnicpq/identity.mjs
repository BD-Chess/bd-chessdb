// Exact shared v15 distribution; consumer rules come from this ZIP.
export const SKILL = Object.freeze({
  "name": "ai-pomocnik-omnicpq",
  "version": "v0.1.5",
  "release": "v15",
  "files": 194,
  "payloads": 192,
  "zipSha256": "583b0c5581f081818c494354796b56aa6e0761d8e30e44e351ae0b19fd064682",
  "manifestSha256": "0cb4ae1034afd32d3b7424c29cf177b899e650a9f3664e519007e676b369670e"
});
export const APP_VERSION = '1.3.0-r4';
export const ADAPTER_DELTA = 'OMNICPQ_PWA_HOST_CAPABILITIES_20261022_R4';
export const error = (code, status = 503) => Object.assign(Error(code), { code, status });
export const hash = async value => (await import('node:crypto')).createHash('sha256').update(value).digest('hex');
