import { randomUUID } from 'node:crypto';

export const owner = 'owner@example.invalid';
export const inbox = 'folder-inbox-dev';
export const results = 'folder-results-dev';
export const principal = 'permission-id-dev';
const token = 'a'.repeat(30);
const folderType = 'application/vnd.google-apps.folder';

export function driveFixture(overrides = {}) {
  const env = {
    DEEPSEEK_CHAT_OWNER_EMAIL: owner,
    DEEPSEEK_CHAT_DRIVE_ENABLED: 'true',
    DEEPSEEK_CHAT_DRIVE_INBOX_ID: inbox,
    DEEPSEEK_CHAT_DRIVE_RESULTS_ID: results,
    DEEPSEEK_CHAT_DRIVE_PERMISSION_ID: principal,
    DEEPSEEK_CHAT_DRIVE_CLIENT_ID: 'test.apps.googleusercontent.com',
    DEEPSEEK_CHAT_DRIVE_CLIENT_SECRET: randomUUID(),
    DEEPSEEK_CHAT_DRIVE_REFRESH_TOKEN: randomUUID(),
    ...overrides,
  };
  const blobs = new Map();
  const files = new Map();
  const calls = [];
  const store = {
    async get(key) { return blobs.get(key); },
    async setJSON(key, value, options) {
      if (!options.onlyIfNew) throw Error('Fixture expects immutable reservation');
      if (blobs.has(key)) return { modified: false };
      blobs.set(key, value);
      return { modified: true };
    },
  };
  let generated = 0;
  const behavior = { loseAfterUpload: 0, rejectBeforeUpload: 0, principal };

  function add(folder, name, content, id = 'file-generated-' + ++generated) {
    files.set(id, { info: { id, name, mimeType: 'application/json', trashed: false, parents: [folder] }, content });
    return id;
  }

  async function fetcher(input, options) {
    const url = new URL(input);
    calls.push({ url, method: options.method ?? 'GET' });
    const json = (value, status = 200) => Response.json(value, { status });
    if (url.origin === 'https://oauth2.googleapis.com' && url.pathname === '/token') {
      return json({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
    }
    if (url.origin !== 'https://www.googleapis.com' || options.headers.Authorization !== 'Bearer ' + token) {
      throw Error('Unexpected Drive endpoint or authorization');
    }
    if (url.pathname === '/drive/v3/about') return json({ user: { permissionId: behavior.principal } });
    if (url.pathname === '/drive/v3/files/generateIds') return json({ ids: ['file-generated-' + ++generated] });
    if (url.pathname === '/upload/drive/v3/files' && options.method === 'POST') {
      const [meta, content] = options.body.split('\r\n').filter(line => line.startsWith('{')).map(JSON.parse);
      if (behavior.rejectBeforeUpload > 0) {
        behavior.rejectBeforeUpload -= 1;
        throw Error('Transport dropped before write');
      }
      if (files.has(meta.id)) return json({}, 409);
      add(meta.parents[0], meta.name, content, meta.id);
      if (behavior.loseAfterUpload > 0) {
        behavior.loseAfterUpload -= 1;
        throw Error('Transport dropped after write');
      }
      return json({ id: meta.id }, 201);
    }
    if (url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q');
      const [folder, ...names] = Array.from(q.matchAll(/'([^']+)'/g), match => match[1]);
      return json({ files: [...files.values()].map(({ info }) => info)
        .filter(info => info.parents.includes(folder) && names.includes(info.name) && !info.trashed) });
    }
    if (url.pathname.startsWith('/drive/v3/files/')) {
      const id = url.pathname.split('/').at(-1);
      if (id === inbox || id === results) {
        return json({ id, mimeType: folderType, trashed: false,
          capabilities: { canAddChildren: id === inbox, canListChildren: true } });
      }
      const file = files.get(id);
      if (!file) return json({}, 404);
      return json(url.searchParams.get('alt') === 'media' ? file.content : file.info);
    }
    throw Error('Fixture does not recognize request');
  }

  return { getEnv: key => env[key], getStore: () => store, fetcher, behavior, files, calls, blobs, add };
}
