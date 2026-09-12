import { passwordOK } from './wl-auth.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  }});
}

export default async req => {
  if (req.method !== 'POST') return json({ ok:false, error:'method' }, 405);
  let body;
  try { body = await req.json(); } catch (_) { return json({ ok:false, error:'json' }, 400); }
  if (!passwordOK(String(body?.password || ''))) return json({ ok:false, error:'password' }, 401);
  return json({ ok:true, mode:'tab-session', note:'The password is retained only by this browser tab and is required again after Lock/tab close.' });
};

export const config = { path: '/api/wl/session' };
