# Trip Optimizer Gemini restoration — 2026-09-12

The deployed Trip app matched Git blob `2a049377d6a2742263adde2d9114ba0c7c329495`.
Its external `remarkable-sopapillas-d3e79a.netlify.app` endpoint returned HTTP 404
for POST and OPTIONS. There was no Gemini function in the current site deployment.

The repair adds `functions/gemini.mjs` using the existing functions directory and
changes Trip to `/.netlify/functions/gemini`. No site is renamed. Model selection
and credentials are server-side. The default model remains `gemini-2.5-flash`.

## Configuration

- `GEMINI_API_KEY`: Google Gemini credential, or a runtime credential injected by
  an already available Netlify AI Gateway. Never use the public Google Maps key.
- `GOOGLE_GEMINI_BASE_URL`: optional provider base URL. Netlify injects this with
  its Gemini gateway credential. Without it, the Google API is used directly.
- `TRIP_GEMINI_MODEL`: optional server-side model override.

No billing plan, AI feature switch, or credential is changed by this patch. If
Netlify supplies AI Gateway credentials, inference uses existing Netlify credits;
a manually configured Google credential uses its Google project's quota instead.
Re-deploy after changing environment variables.

GET `/.netlify/functions/gemini` reports configuration presence only; it does not
prove that inference works. Verify with a short POST and a real browser chat.

## Verification

`node --test tests/trip-gemini.test.mjs`

The focused tests cover provider requests, gateway routing, missing configuration,
HTTP/auth/model/quota errors, timeouts, blocked and truncated responses, multiple
text parts, source filtering and non-disclosure of provider errors/credentials.
The public endpoint has a platform rate limit and bounded prompt/output sizes.
Client history is bounded and only stores successful model exchanges. The client
serializes requests, escapes response HTML and renders Google Search suggestions
inside a sandboxed frame.
