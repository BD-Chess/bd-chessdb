# OmniCPQ 1.3.0-r4

The application uses the existing MDLxDCC owner login. Ordinary Guide visitors
cannot access this private endpoint. An owner may create an invitation in
Settings → Demo povabila and supply the separate demo password out of band.
The invitation URL carries a random token in its fragment; only its keyed hash
is stored. Activation binds the grant to the Netlify-provided IP for 24 hours.
Reusing a link, reconnecting, or clearing cookies does not renew the grant.
Owner revocation takes effect at the next API request.

Each demo has a separate transactional USD 1 ledger. Reservations, expiry,
per-minute throttling, in-flight exclusion and deduplication run under a row
lock in Postgres. Unknown provider outcomes retain their maximum charge.
Accounting uses conservative long-context/cache-write/regional upper rates,
so the displayed consumption is an upper estimate, not an invoice. Multimodal
requests reserve the entire permitted model context; a request is refused
when its upper bound exceeds the remaining budget. Reasoning output is
included in the output-token limit. No paid tools or automatic retries run.

Knowledge remains the exact common v15 distribution. Its compressed runtime
pack is in a private RLS-protected server store, not this repository or the
public build. New CLI Jira/Confluence data is not integrated in this release.

Runtime settings (Functions scope): OMNICPQ_ENABLED=1,
OMNICPQ_KNOWLEDGE_MODE=database, OMNICPQ_DEMO_EMAIL and
OMNICPQ_DEMO_PASSWORD_HASH. Existing MDLXDCC_GUIDE_* and OPENAI_API_KEY are
reused. Do not write their values into source, reports or logs.

Original PNG icon bytes are preserved losslessly in
scripts/omnicpq/icons.base64.json. Run materialize-icons.mjs then build-shell.mjs
before tests or deployment. The dated one-off GitHub workflow exists solely
for BD's approved 2026-10-22 exception; the weekly manual lane is unchanged.

Validation:

```
node scripts/omnicpq/materialize-icons.mjs
node scripts/omnicpq/build-shell.mjs
node --test tests/omnicpq/demo-r4.test.mjs tests/omnicpq/ui-r4.test.mjs
```

The full retrieval suite additionally requires the private v15 runtime pack:
set OMNICPQ_TEST_KNOWLEDGE and prepare .private/omnicpq/knowledge.json locally.
Never commit that fixture. Actual Edge installation and CPQ business-process
completion require device/CPQ evidence beyond these automated checks.
