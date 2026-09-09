const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREDENTIAL_RE = /^[A-Za-z0-9+/]{43}=$/;

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

  const credential = Netlify.env.get("SHIELD_EMAIL_CREDENTIAL");
  if (!credential || !CREDENTIAL_RE.test(credential)) {
    console.error("shield-email-access: missing or invalid SHIELD_EMAIL_CREDENTIAL");
    return json({ ok: false, error: "unavailable" }, 503);
  }

  const accessedAt = new Date().toISOString();
  const ip = String(context?.ip || "").slice(0, 80);

  // Server-side fallback audit. The browser also records the same event through
  // Netlify Forms so BD can receive form-submission email notifications.
  console.log(JSON.stringify({ event: "shield-email-access", email, accessedAt, ip, page }));

  return json({ ok: true, credential, accessedAt, ip });
};

export const config = {
  path: "/api/shield-email-access"
};
