// Exact shared v16 distribution; consumer rules come from this ZIP.
export const SKILL = Object.freeze({
  "name": "ai-pomocnik-omnicpq",
  "version": "v0.1.6",
  "release": "v16",
  "files": 233,
  "payloads": 231,
  "zipSha256": "2468eaec7724c2f0db684b8948843b5cabcaa6fa9319fc0f8f586f40fdab0318",
  "manifestSha256": "bc9ca72ecbf7094f72c683148c841806ae80931f5ad9a26e8a1fa435c7c2c92a"
});
export const APP_VERSION = '1.4.0-r5';
export const ADAPTER_DELTA = 'OMNICPQ_PWA_HOST_CAPABILITIES_20261022_R5';
export const error = (code, status = 503) => Object.assign(Error(code), { code, status });
export const hash = async value => (await import('node:crypto')).createHash('sha256').update(value).digest('hex');

