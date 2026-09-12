import { PROTOCOL, RHP_ROSTER, slot5m } from "./preai8-core.mjs";
import { readState, recordPulse } from "./preai8-store.mjs";

export default async (req) => {
  const now = new Date();
  let nextRun = null;
  try { const body = await req.json(); nextRun = body?.next_run || null; } catch (_) {}

  const state = await readState();
  if (state.control?.paused) {
    console.log(JSON.stringify({ type: "preai8-heartbeat", status: "paused", at: now.toISOString() }));
    return;
  }

  const event = {
    protocol: PROTOCOL,
    event: "heartbeat",
    source: "heartbeat",
    target: "RHP_11",
    rhp_members: RHP_ROSTER.length,
    slot_utc: slot5m(now),
    emitted_at: now.toISOString(),
    next_run: nextRun,
    wake_bridge_configured: Boolean(Netlify.env.get("PREAI8_WAKE_URL")),
    wake_claimed: false
  };
  const receipt = await recordPulse(event);
  console.log(JSON.stringify({ type: "preai8-heartbeat", ...event, receipt }));

  const wakeUrl = Netlify.env.get("PREAI8_WAKE_URL");
  if (!wakeUrl) {
    console.log(JSON.stringify({ type: "preai8-wake-bridge", status: "not-configured", emitted_at: event.emitted_at }));
    return;
  }

  const token = Netlify.env.get("PREAI8_WAKE_TOKEN") || "";
  try {
    const response = await fetch(wakeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(8000)
    });
    console.log(JSON.stringify({ type: "preai8-wake-bridge", status: response.ok ? "accepted" : "rejected", http_status: response.status, emitted_at: event.emitted_at, wake_claimed: false }));
  } catch (error) {
    console.error(JSON.stringify({ type: "preai8-wake-bridge", status: "failed", error: String(error?.message || error).slice(0, 300), emitted_at: event.emitted_at, wake_claimed: false }));
  }
};

export const config = { schedule: "*/5 * * * *" };
