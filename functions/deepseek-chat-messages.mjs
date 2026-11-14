import { getStore } from '@netlify/blobs';
import { emailAddress, env } from './lib/mdlxdcc-guide/access.mjs';
import { createDriveMailbox } from './lib/deepseek-chat/drive-mailbox.mjs';
import { json, originAllowed, readJson } from './lib/deepseek-chat/http.mjs';
import { origin, validSession } from './lib/deepseek-chat/session.mjs';

const messagePath = '/deepseek-chat/api/messages';
const jobIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const states = new Set(['queued', 'acknowledged', 'running', 'stopping', 'complete', 'stopped', 'failed', 'uncertain']);
const promptLimit = 8000;
const replyLimit = 64000;
const requestByteLimit = 64 * 1024;

function messageView(record, id) {
  if (record?.id !== id || !states.has(record.state) ||
      typeof record.prompt !== 'string' || !record.prompt.trim() || record.prompt.length > promptLimit) {
    throw new Error('INVALID_MAILBOX_RECORD');
  }
  const message = { id, state: record.state, prompt: record.prompt };
  if (record.state === 'complete') {
    if (typeof record.reply !== 'string' || !record.reply.trim() || record.reply.length > replyLimit) {
      throw new Error('INVALID_MAILBOX_REPLY');
    }
    message.reply = record.reply;
  }
  return message;
}

export function makeMessagesHandler({ mailbox, getEnv = env, now = Date.now, allowedOrigin = origin } = {}) {
  return async (req, context = {}) => {
    const { origin: requestOrigin, pathname } = new URL(req.url);
    if ((context.site?.name && context.site.name !== 'mdlxdcc') || requestOrigin !== allowedOrigin) {
      return json({ error: 'NOT_FOUND' }, 404);
    }
    if (!originAllowed(req, allowedOrigin)) return json({ error: 'ORIGIN_FORBIDDEN' }, 403);
    if (!['GET', 'POST'].includes(req.method)) {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, POST' });
    }
    const id = pathname.startsWith(`${messagePath}/`) ? pathname.slice(messagePath.length + 1) : null;
    if (pathname !== messagePath && !jobIdPattern.test(id ?? '')) return json({ error: 'NOT_FOUND' }, 404);

    try {
      const owner = emailAddress(getEnv('DEEPSEEK_CHAT_OWNER_EMAIL'));
      const secret = getEnv('DEEPSEEK_CHAT_SESSION_SECRET');
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(secret ?? '')) return json({ error: 'AUTH_UNAVAILABLE' }, 503);
      if (!validSession(req, owner, secret, now())) return json({ error: 'AUTH_REQUIRED' }, 401);

      if (req.method === 'GET' && !id) return json({ available: mailbox ? await mailbox.available(owner) === true : false });
      if (!mailbox) return json({ error: 'MAILBOX_UNAVAILABLE' }, 503);

      if (req.method === 'GET') {
        const message = await mailbox.get({ owner, id });
        return message ? json(messageView(message, id)) : json({ error: 'MESSAGE_NOT_FOUND' }, 404);
      }

      const body = await readJson(req, requestByteLimit);
      if (id) {
        if (body?.action !== 'stop' || Object.keys(body).length !== 1) return json({ error: 'INVALID_ACTION' }, 400);
        const message = await mailbox.stop({ owner, id });
        return message ? json(messageView(message, id), 202) : json({ error: 'MESSAGE_NOT_FOUND' }, 404);
      }

      if (!body || Object.keys(body).length !== 3 || typeof body.id !== 'string' || !jobIdPattern.test(body.id) ||
          typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > promptLimit ||
          typeof body.reasoning !== 'boolean') return json({ error: 'INVALID_MESSAGE' }, 400);
      const message = await mailbox.enqueue({ owner, id: body.id, prompt: body.prompt.trim(), reasoning: body.reasoning });
      return message ? json(messageView(message, body.id), 202) : json({ error: 'MESSAGE_CONFLICT' }, 409);
    } catch {
      return json({ error: 'MAILBOX_UNAVAILABLE' }, 503);
    }
  };
}

export default makeMessagesHandler({
  mailbox: createDriveMailbox({
    getEnv: env,
    getStore: () => getStore({ name: 'mydeepseekrhp-drive-ids-v1', consistency: 'strong' }),
  }),
});

export const config = {
  path: ['/deepseek-chat/api/messages', '/deepseek-chat/api/messages/:id'],
  rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 30 },
};
