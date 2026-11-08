# Repository instructions

## Netlify deployment

BD approved continuous prebuilt publication on 2026-10-22. Read `docs/NETLIFY_DEPLOYMENT.md` before changing release code or preparing a deployment/handoff. Tested main updates publish automatically through the existing GitHub Actions workflow and `netlify deploy --prod --no-build`. Native Netlify builds remain Stopped; no weekly/time/build-minute hold or separate production publisher. Preserve complete site/function/config artifacts, protection, source provenance, tests and concurrent work. Never infer a live deployment from a commit alone. A failed or unknown upload is reconciled before another attempt. No LAB-to-CURRENT promotion, private-data disclosure or paid upgrade follows merely from deployment permission.

## House rules
- Reuse existing code and dependencies before adding another pattern; document intentional exceptions.
- Access: reuse and adapt existing access primitives. Preserve each app's intended session scope and permissions; do not silently extend access across apps.
- Data: default to Supabase for relational, transactional and user-scoped data; use Netlify Blobs for files and simple app state with explicit access and retention. Keep schema changes in supabase/migrations/ and reconcile live history before applying anything.
- New app layout: public/<App>/, thin functions/<app>-*.mjs entries, functions/lib/<app>/, tests/<app>-*.test.mjs, docs/<app>.md. Preserve intentional existing paths.
- Reuse existing CI and the shared production publisher. Add a workflow only for checks the current CI cannot cover.
- Retire one-shot workflows after the outcome is verified and accepted, a receipt is retained in docs/ or ops/releases/, and references and recovery are checked. Reconcile uncertain effects before cleanup.
- Do not generate accidental source backup copies under public/. Document intentional reference/demo snapshots; inventory existing copies and follow BD's approved disposition. Git preserves source history; runtime data needs separate backups.
