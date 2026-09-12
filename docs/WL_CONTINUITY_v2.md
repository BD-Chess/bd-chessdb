# Wake Lab /WL/ — continuity v2

2026-09-12. Private RHP-11 journal, separate from the Gmail/Outlook dyad.

The native hourly assistant task generates one member contribution per invocation.
A five-minute Netlify clock records liveness only; it does not invoke a model.
Do not report an event-triggered fast model loop as connected.

The reader decrypts an AES-256-GCM journal locally. PBKDF2-SHA256 with 600,000
iterations wraps a random master key. No plaintext access password or conversation
is committed. Browser sessionStorage holds only the unlocked master key for the
current tab, not the password. Lock clears rendered conversation and key material.
A separate random control token is inside the encrypted vault; only its SHA-256
verifier exists in the server function.

The canonical journal is public/WL/state.enc.json plus immutable ciphertext entries
under public/WL/data/entries/. One non-force Git commit must publish both the event
and its index. The reader obtains current ciphertext from the repository's raw
main feed, so each conversation step does not need another website deployment.
The state binds canonical plaintext SHA-256 and event parent hashes. Only integer
numeric event fields are supported by the cross-language canonical profile.

/api/wl/runtime GET exposes only a paused flag, current server time and pulse time.
It contains no RHP bodies, password or control credential. POST requires the random
control token. Storage errors return 503, never a false healthy/allowed state.
The native assistant must read a fresh runtime flag before sending an RHP step;
failure or paused=true means no write. Email tasks are not controlled by this flag.

A−/A+ changes text by 10 percentage points with no application-level upper cap,
minimum 70%, and a one-click 100% reset. The theme toggle is a single icon.
No navigation link is added to public index pages or the sitemap. /WL/ is noindex;
privacy depends on encryption/authentication, not on the unlinked URL.

The 11 RHP roles follow BD's v2.8 reference: 1 Crystallizer, 2 Physicist,
3 Naturalist, 4 Engineer, 5 Falsifier, 6 Seed Dreamer, 7 Cartographer,
8 Claustrum, 9 Historian, 11 Child, 0 Empiricist. Same-model role separation is
not claimed as independent models, blind assessment, or validated DCC sensing.

One-shot deployment recovery uses the authorized Netlify connector's temporary
proxy in an ephemeral encrypted GitHub Actions handoff. The runner publishes a
fresh RSA-3072 public key; only an RSA-OAEP/AES-GCM envelope is stored publicly.
The private key remains in the running job's memory. The payload is restricted to
the existing site, exact current main SHA, and the connector's proxy host.
No persistent Netlify token is extracted or committed. This does not repair the
separate NETLIFY_AUTH_TOKEN-based workflow automatically; its skipped deployment
must not be reported as a successful publication.

Tests: tests/test_wl_codec.py (local cryptography), tests/wl_live_test.py (real
production browser acceptance, password provided privately at runtime).
Only actual executed test receipts establish PASS; shipped tests alone do not.
