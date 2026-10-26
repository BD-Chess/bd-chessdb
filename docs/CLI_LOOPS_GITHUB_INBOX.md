# CLI Loops private GitHub submission

The composer previews a native v5 request, freezes its host/limits/topic and asks
the owner to confirm. `cli-loops-inbox` then creates one immutable signed record
in private `BD-Chess/8zListener-Inbox@main`. The function reuses the existing
mdlxdcc owner session; no token reaches the browser. A successful receipt means
the queue record was read back, not that a Listener started or finished.

Configure production/functions secrets on the mdlxdcc Netlify site:

- `CLI_LOOPS_GITHUB_TOKEN`: fine-grained access only to 8zListener-Inbox, Contents
  read/write and Metadata read. Do not grant AIm3-system access.
- `CLI_LOOPS_INBOX_SIGNING_KEY`: Ed25519 PKCS8 DER base64. Pin its corresponding
  raw 32-byte public key in the Listener's optional `github_inbox` profile.

Listener 0.4.2 validates the private repository, exact branch/host/path, Git blob,
publisher signature and unchanged native bytes before existing journal intake.
Drive and local inputs remain available. Results continue to the existing Drive
output. WORK and HOME each require their own runtime configuration/acceptance.

The create-only request ID is also used for lost-response reconciliation.
Session storage retains only ID, host and native hash; it does not retain topic,
password, token or the full plan. The browser never retries with a fresh ID
automatically. Confirm the original request before deciding to submit another.

Run focused tests using the repository's existing jsdom dev dependency:

```
node --test tests/cli-loops-inbox.test.mjs tests/cli-loops-submit.test.mjs
```

These tests use injected authentication/GitHub fixtures. Real credentials,
private queue readback, browser interaction, resident execution and terminal
Drive writeback require separate live acceptance. Deploy through the existing
GitHub prebuilt main workflow; preserve stopped native Netlify builds.
