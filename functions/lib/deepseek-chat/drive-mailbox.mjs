import { createHash, randomUUID } from 'node:crypto';

const prefix = 'DEEPSEEK_CHAT_DRIVE_';
const endpoint = 'https://www.googleapis.com/drive/v3';
const uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const folderType = 'application/vnd.google-apps.folder';
const jsonType = 'application/json';
const driveId = /^[A-Za-z0-9_-]{10,256}$/;
const jobId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const terminal = new Set(['complete', 'failed', 'stopped', 'uncertain']);
const requestSchema = 'mydeepseekrhp.request.v1';
const stopSchema = 'mydeepseekrhp.stop.v1';
const ackSchema = 'mydeepseekrhp.ack.v1';
const resultSchema = 'mydeepseekrhp.result.v1';
const requestLimit = 64 * 1024;
const resultLimit = 400 * 1024;
const workerClockSkewMs = 5 * 60 * 1000;

function unavailable() {
  return Error('DRIVE_MAILBOX_UNAVAILABLE');
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function envelopeMatches(value, schema, owner, id) {
  return value?.schema === schema && value.owner === owner && value.id === id && stamp(value.createdAt);
}

function isCurrentReceipt(receipt, request) {
  return Date.parse(receipt.createdAt) >= Date.parse(request.createdAt) - workerClockSkewMs;
}

async function boundedJson(response, limit) {
  if (!response.body || Number(response.headers.get('content-length')) > limit) throw unavailable();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw unavailable();
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally {
    reader.releaseLock();
  }
}

function configuration(getEnv) {
  if (getEnv(prefix + 'ENABLED') !== 'true') return null;
  const read = key => getEnv(prefix + key);
  const owner = getEnv('DEEPSEEK_CHAT_OWNER_EMAIL')?.trim().toLowerCase();
  const inbox = read('INBOX_ID');
  const results = read('RESULTS_ID');
  const permission = read('PERMISSION_ID');
  const clientId = read('CLIENT_ID');
  const clientSecret = read('CLIENT_SECRET');
  const refreshToken = read('REFRESH_TOKEN');
  if (!owner || !driveId.test(inbox ?? '') || !driveId.test(results ?? '') || inbox === results ||
      !driveId.test(permission ?? '') || !clientId?.endsWith('.apps.googleusercontent.com') ||
      !clientSecret || !refreshToken) return null;
  return { owner, inbox, results, permission, clientId, clientSecret, refreshToken };
}

function googleClient({ clientId, clientSecret, refreshToken, permission }, fetcher, now) {
  let credential;
  let refreshing;
  const send = (url, options) =>
    fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(5000) });

  async function refresh() {
    const form = new URLSearchParams({
      grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken,
    });
    const response = await send(tokenEndpoint, { method: 'POST', body: form });
    if (!response.ok) throw unavailable();
    const token = await boundedJson(response, 8192);
    if (typeof token.access_token !== 'string' || !/^[A-Za-z0-9._~+/=-]{16,4096}$/.test(token.access_token) ||
        token.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(token.expires_in) || token.expires_in < 60) {
      throw unavailable();
    }
    const identity = await send(endpoint + '/about?fields=user(permissionId)', {
      headers: { Authorization: 'Bearer ' + token.access_token },
    });
    if (!identity.ok || (await boundedJson(identity, 8192)).user?.permissionId !== permission) throw unavailable();
    credential = { token: token.access_token, until: now() + (token.expires_in - 30) * 1000 };
  }

  async function call(path, query, options = {}) {
    if (!credential || now() >= credential.until) {
      refreshing ??= refresh().finally(() => { refreshing = undefined; });
      await refreshing;
    }
    const url = new URL(path, endpoint + '/');
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const auth = credential;
    const response = await send(url, {
      ...options, headers: { ...options.headers, Authorization: 'Bearer ' + auth.token },
    });
    if (response.status === 401 && credential === auth) credential = undefined;
    return response;
  }

  async function read(path, query, { maxBytes = 8192, allowMissing = false } = {}) {
    const response = await call(path, query);
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw unavailable();
    return boundedJson(response, maxBytes);
  }

  return { call, read };
}

export function createDriveMailbox({ getEnv, getStore, fetcher = fetch, now = Date.now }) {
  const settings = configuration(getEnv);
  if (!settings) return undefined;
  const { owner, inbox, results } = settings;
  const drive = googleClient(settings, fetcher, now);

  function keyFor(id, kind) {
    if (!jobId.test(id)) throw unavailable();
    return `v1/${digest([owner, inbox, results])}/${id}/${kind}`;
  }

  function matchesFile(file, folder, name) {
    return driveId.test(file?.id ?? '') && file.name === name &&
      file.mimeType === jsonType && file.trashed === false && file.parents?.includes(folder);
  }

  async function reserve(store, key, fingerprint) {
    const existing = await store.get(key, { type: 'json' });
    if (existing) return existing;
    const { ids } = await drive.read('files/generateIds', { count: 1, space: 'drive', type: 'files' });
    if (ids?.length !== 1 || !driveId.test(ids[0])) throw unavailable();
    const reservation = { fileId: ids[0], fingerprint, createdAt: new Date(now()).toISOString() };
    const write = await store.setJSON(key, reservation, { onlyIfNew: true });
    if (write?.modified === true) return reservation;
    if (write?.modified !== false) throw unavailable();
    const chosen = await store.get(key, { type: 'json' });
    if (!chosen) throw unavailable();
    return chosen;
  }

  async function download(fileId, folder, name, maxBytes) {
    if (!driveId.test(fileId)) throw unavailable();
    const info = await drive.read(`files/${fileId}`, {
      fields: 'id,name,mimeType,trashed,parents', supportsAllDrives: 'true',
    }, { allowMissing: true });
    if (!info) return null;
    if (!matchesFile(info, folder, name) || info.id !== fileId) throw unavailable();
    return drive.read(`files/${fileId}`, { alt: 'media', supportsAllDrives: 'true' }, { maxBytes });
  }

  async function upload(fileId, folder, name, value) {
    const boundary = randomUUID();
    const metadata = { id: fileId, name, mimeType: jsonType, parents: [folder] };
    const body = [
      `--${boundary}\r\nContent-Type: ${jsonType}; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${jsonType}; charset=UTF-8\r\n\r\n${JSON.stringify(value)}\r\n`,
      `--${boundary}--\r\n`,
    ].join('');
    try {
      const response = await drive.call(uploadEndpoint, { uploadType: 'multipart', supportsAllDrives: 'true' }, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
      });
      if (!response.ok && response.status !== 409) throw unavailable();
    } catch {
      // A lost response can follow a successful write. Reconcile the same ID before returning.
    }
    const saved = await download(fileId, folder, name, requestLimit);
    if (!saved || digest(saved) !== digest(value)) throw unavailable();
  }

  async function receiptFiles(id) {
    const ack = `${id}.ack.json`;
    const result = `${id}.result.json`;
    const data = await drive.read('files', {
      q: `'${results}' in parents and trashed = false and (name = '${ack}' or name = '${result}')`,
      fields: 'files(id,name,mimeType,parents,trashed),nextPageToken,incompleteSearch',
      pageSize: 10, spaces: 'drive', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    }, { maxBytes: 16384 });
    if (data.nextPageToken || data.incompleteSearch || !Array.isArray(data.files)) throw unavailable();
    const files = new Map();
    for (const file of data.files) {
      if ((file.name !== ack && file.name !== result) ||
          !matchesFile(file, results, file.name) || files.has(file.name)) throw unavailable();
      files.set(file.name, file.id);
    }
    return { ack: files.get(ack), result: files.get(result) };
  }

  async function readRequest(store, id) {
    const entry = await store.get(keyFor(id, 'request'), { type: 'json' });
    if (!entry) return null;
    if (!stamp(entry.createdAt) || !driveId.test(entry.fileId ?? '')) throw unavailable();
    const request = await download(entry.fileId, inbox, `${id}.json`, requestLimit);
    if (!request) return null;
    if (!envelopeMatches(request, requestSchema, owner, id) || request.createdAt !== entry.createdAt ||
        typeof request.prompt !== 'string' || !request.prompt.trim() || request.prompt.length > 8000 ||
        typeof request.reasoning !== 'boolean' || digest([request.prompt, request.reasoning]) !== entry.fingerprint) {
      throw unavailable();
    }
    return request;
  }

  async function view(store, request) {
    const { id, prompt } = request;
    const receipts = await receiptFiles(id);
    if (receipts.result) {
      const result = await download(receipts.result, results, `${id}.result.json`, resultLimit);
      if (!envelopeMatches(result, resultSchema, owner, id) ||
          !terminal.has(result.state) || !isCurrentReceipt(result, request)) throw unavailable();
      if (result.state === 'complete' &&
          (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 64000)) throw unavailable();
      return { id, prompt, state: result.state, ...(result.state === 'complete' && { reply: result.reply }) };
    }
    const stop = await store.get(keyFor(id, 'stop'), { type: 'json' });
    if (stop) {
      const saved = await download(stop.fileId, inbox, `${id}.stop.json`, requestLimit);
      if (saved) {
        if (!envelopeMatches(saved, stopSchema, owner, id) || saved.createdAt !== stop.createdAt) throw unavailable();
        return { id, prompt, state: 'stopping' };
      }
    }
    if (!receipts.ack) return { id, prompt, state: 'queued' };
    const ack = await download(receipts.ack, results, `${id}.ack.json`, requestLimit);
    if (!envelopeMatches(ack, ackSchema, owner, id) ||
        !isCurrentReceipt(ack, request)) throw unavailable();
    return { id, prompt, state: 'acknowledged' };
  }

  return {
    async available(account) {
      if (account !== owner) return false;
      const query = { fields: 'id,mimeType,trashed,capabilities(canAddChildren,canListChildren)', supportsAllDrives: 'true' };
      const [input, output] = await Promise.all([
        drive.read(`files/${inbox}`, query), drive.read(`files/${results}`, query),
      ]);
      return input.id === inbox && output.id === results &&
        [input, output].every(folder => folder.mimeType === folderType && folder.trashed === false) &&
        input.capabilities?.canAddChildren === true && output.capabilities?.canListChildren === true;
    },

    async enqueue({ owner: account, id, prompt, reasoning }) {
      if (account !== owner) return null;
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000 || typeof reasoning !== 'boolean') {
        throw unavailable();
      }
      const store = getStore();
      const fingerprint = digest([prompt, reasoning]);
      const entry = await reserve(store, keyFor(id, 'request'), fingerprint);
      if (entry.fingerprint !== fingerprint) return null;
      const existing = await readRequest(store, id);
      if (existing) return view(store, existing);
      const request = { schema: requestSchema, id, owner, prompt, reasoning, createdAt: entry.createdAt };
      await upload(entry.fileId, inbox, `${id}.json`, request);
      return { id, prompt, state: 'queued' };
    },

    async get({ owner: account, id }) {
      if (account !== owner) return null;
      const store = getStore();
      const request = await readRequest(store, id);
      return request && view(store, request);
    },

    async stop({ owner: account, id }) {
      if (account !== owner) return null;
      const store = getStore();
      const request = await readRequest(store, id);
      if (!request) return null;
      const before = await view(store, request);
      if (terminal.has(before.state) || before.state === 'stopping') return before;
      const entry = await reserve(store, keyFor(id, 'stop'), digest([owner, id]));
      if (!stamp(entry.createdAt) || !driveId.test(entry.fileId ?? '') || entry.fingerprint !== digest([owner, id])) {
        throw unavailable();
      }
      await upload(entry.fileId, inbox, `${id}.stop.json`, { schema: stopSchema, id, owner, createdAt: entry.createdAt });
      return view(store, request);
    },
  };
}
