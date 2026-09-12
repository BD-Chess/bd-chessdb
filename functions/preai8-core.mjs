import { createHash, timingSafeEqual } from "node:crypto";

export const PROTOCOL = "PREAI8-WAKE-LAB-v1";
export const STORE_NAME = "preai8-wake-v1";
export const HISTORY_LIMIT = 288;

export const EMAIL_RUNS = Object.freeze([
  { run_id: "PREAI8-20260912-A", label: "MDLxDCC.org + nove arene" },
  { run_id: "PREAI8-20260912-B", label: "Odprta raziskava" }
]);

export const RHP_ROSTER = Object.freeze([
  { id: 1, key: "crystallizer", name: "The Crystallizer", function: "formal compression" },
  { id: 2, key: "physicist", name: "The Physicist", function: "dynamics and scaling" },
  { id: 3, key: "naturalist", name: "The Naturalist", function: "ecology and evolution" },
  { id: 4, key: "engineer", name: "The Engineer", function: "buildability and cost" },
  { id: 5, key: "falsifier", name: "The Falsifier", function: "adversarial challenge" },
  { id: 6, key: "seed_dreamer", name: "The Seed Dreamer", function: "cross-domain seeds" },
  { id: 7, key: "cartographer", name: "The Cartographer", function: "idea-space mapping" },
  { id: 8, key: "claustrum", name: "The Claustrum", function: "DCC governance" },
  { id: 9, key: "historian", name: "The Historian", function: "prior art and memory" },
  { id: 11, key: "child", name: "The Child", function: "physical intuition" },
  { id: 0, key: "empiricist", name: "The Empiricist", function: "test-all gate" }
]);

export const ACTIONS = new Set(["pause", "resume", "pulse"]);
export const PULSE_SOURCES = new Set(["browser", "manual", "heartbeat", "external", "scheduler"]);

export function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

export function authorized(authHeader, expectedToken) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  const expected = String(expectedToken || "").trim();
  if (!token || !expected) return false;
  const a = sha256(token);
  const b = sha256(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeAction(value) {
  const action = String(value || "").trim().toLowerCase();
  return ACTIONS.has(action) ? action : null;
}

export function normalizeSource(value, fallback = "manual") {
  const source = String(value || fallback).trim().toLowerCase();
  return PULSE_SOURCES.has(source) ? source : null;
}

export function slot5m(date = new Date()) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 5) * 5);
  return d.toISOString();
}

export function publicStatus({ control = {}, latest = null, historyCount = 0, wakeConfigured = false, staticSnapshot = null } = {}) {
  return {
    ok: true,
    protocol: PROTOCOL,
    server_time: new Date().toISOString(),
    mode: "RHP_11_WAKE_LAB",
    email_plane: { mode: "DYAD_ONLY", members: 2, runs: EMAIL_RUNS },
    rhp_plane: {
      mode: "RHP_11",
      members: RHP_ROSTER.length,
      roster: RHP_ROSTER,
      execution: wakeConfigured ? "BRIDGE_CONFIGURED_NOT_VERIFIED" : "NOT_CONNECTED"
    },
    heartbeat: {
      provider: "Netlify Scheduled Function",
      cadence: "*/5 * * * *",
      cadence_minutes: 5,
      production_only: true,
      paused: Boolean(control?.paused),
      latest,
      history_count: Number(historyCount || 0)
    },
    wake_bridge: { configured: Boolean(wakeConfigured), mode: wakeConfigured ? "http-post" : "none", guarantee: false },
    email_snapshot: staticSnapshot || null,
    safety: "Heartbeat/pulse are signals only. They are not counted as model execution unless an external wake bridge is configured and its result is verified."
  };
}
