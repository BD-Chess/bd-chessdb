import { PROTOCOL, authorized, normalizeAction, normalizeSource, publicStatus, slot5m } from "./preai8-core.mjs";
import { readState, recordPulse, setPaused } from "./preai8-store.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  }});
}

async function loadStaticSnapshot(req) {
  try {
    const url = new URL("/data/PREAI8_STATUS.json", req.url);
    const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch (_) { return null; }
}

export default async (req) => {
  const wakeConfigured = Boolean(Netlify.env.get("PREAI8_WAKE_URL"));
  if (req.method === "GET") {
    const [state, snapshot] = await Promise.all([readState(), loadStaticSnapshot(req)]);
    return json(publicStatus({ control: state.control, latest: state.latest, historyCount: state.history.length, wakeConfigured, staticSnapshot: snapshot }));
  }
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const expected = Netlify.env.get("PREAI8_OWNER_TOKEN");
  if (!authorized(req.headers.get("authorization"), expected)) return json({ ok: false, error: "unauthorized" }, 401);
  let body; try { body = await req.json(); } catch (_) { return json({ ok: false, error: "json" }, 400); }
  const action = normalizeAction(body?.action);
  if (!action) return json({ ok: false, error: "action" }, 400);
  if (action === "pause" || action === "resume") {
    const control = await setPaused(action === "pause", "owner");
    return json({ ok: true, protocol: PROTOCOL, action, control });
  }
  const source = normalizeSource(body?.source, "manual");
  if (!source) return json({ ok: false, error: "source" }, 400);
  const state = await readState();
  if (state.control?.paused) return json({ ok: false, error: "paused", control: state.control }, 409);
  const now = new Date();
  const event = { protocol: PROTOCOL, event: "pulse", source, target: "RHP_11", slot_utc: slot5m(now), emitted_at: now.toISOString(), wake_bridge_configured: wakeConfigured, wake_claimed: false };
  const receipt = await recordPulse(event);
  return json({ ok: true, event, receipt, note: "Pulse recorded. No model wake is claimed." });
};

export const config = { path: "/api/preai8" };
