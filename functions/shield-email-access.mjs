import { createHash } from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = "mdlxdcc.org";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default async (req, context) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ ok: false, error: "json" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const rawPage = String(body?.page || "").trim();
  const page = rawPage.startsWith("/") && rawPage.length <= 200 ? rawPage : "";

  // Deliberately low-friction gate requested by BD: syntax only, no mailbox verification.
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "email" }, 400);
  }

  // The owner password stays server-side in Netlify. Never publish it or the
  // derived password-equivalent credential in GitHub source. Environment-variable
  // changes require a fresh Netlify deploy before a preview/production function sees them.
  const password = Netlify.env.get("SHIELD_EMAIL_PASSWORD");
  if (!password) {
    console.error("shield-email-access: missing SHIELD_EMAIL_PASSWORD");
    return json({ ok: false, error: "unavailable" }, 503);
  }
  const credential = createHash("sha256")
    .update(`${password}||${DOMAIN}`, "utf8")
    .digest("base64");

  const accessedAt = new Date().toISOString();
  const ip = String(context?.ip || "").slice(0, 80);

  // Authoritative server-side audit line. Netlify's Context.ip is the client IP.
  // The browser also submits the same event to the Netlify Form so BD can attach
  // a form-submission email notification to bd@siol.net.
  console.log(JSON.stringify({ event: "shield-email-access", email, accessedAt, ip, page }));

  return json({ ok: true, credential, accessedAt, ip });
};

export const config = {
  path: "/api/shield-email-access",
  method: "POST",
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
