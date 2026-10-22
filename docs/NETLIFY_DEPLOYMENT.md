# Netlify prebuilt continuous deployment

Version R1 — 2026-10-22. BD explicitly approved automatic publication of every tested main update, replacing the former weekly release window and build-minute hold. This governs MDLxDCC and ChessBest deployment; it does not authorize private-data disclosure, LAB promotion, paid services, or research actions.

## One publication path

`.github/workflows/deploy-netlify.yml` prepares and tests source in GitHub Actions, then runs `netlify deploy --prod --no-build`. Automatic publication follows a successful **Deploy to GitHub Pages** run on this repository's `main`. The exact source SHA that passed Pages is checked out; a superseded source never overwrites newer main. There is no Monday window, weekly attempt quota, materiality threshold or requirement for a fresh human approval for each tested main update.

Native Netlify builds remain **Stopped** on both existing projects. `ignore = "exit 0"` is retained as defense against accidental native build activation. Do not use Netlify build hooks, `deploy --trigger`, dashboard rebuilds, or a second production workflow. Stopped native builds still permit prebuilt CLI/API uploads.

| Project | Existing site ID | Publish artifact |
| --- | --- | --- |
| mdlxdcc | 17b4124d-c197-4c0a-a711-8b2c08d91088 | Full prepared public snapshot |
| bd-chess | deb1dab6-dfad-436e-ae92-4477d873c987 | Full prepared public snapshot with public/chess overlaid at its root |

Both retain shared routes, functions, redirects, headers and existing protection. ChessBest is not a chess-only truncated upload. The CLI reads the repository's existing Netlify config and uses the existing token from GitHub Secrets. No credential is copied into source, artifacts, messages or public HTML.

## Preparation and verification

Use locked root/function dependencies, reproduce OmniCPQ binary icons and shell integrity, run password-manager preparation, existing root/PWA/Guide/API diagnostics and OmniCPQ checks, and preflight every serverless bundle without invoking handlers or paid providers. Source main/CI and actual production status remain distinct. Relevant push CI for the exact source must succeed; an actual secret-boundary success is mandatory. Failed tests retain the previous live release.

`scripts/netlify-auto-release.mjs prepare` freezes both complete artifacts. A fingerprint covers static file bytes, functions, lockfiles, Netlify config and the release preparer. `publish` rechecks the unchanged artifacts, exact main and production lease. One shared `netlify-production` concurrency group serializes releases. An in-flight upload is never cancelled to start another; pending obsolete snapshots are skipped, and the newest verified main includes their changes.

A matching provider release title plus live `/.well-known/bd-deploy.json` suppresses an unchanged package even after a documentation-only commit. An unrelated outside overlay is not accepted as deduplication proof. Each provider write gets one INTENT; a failed/ambiguous CLI result is reconciled read-only, never blindly repeated. An existing same-target attempt or active provider upload requires reconciliation before another write.

After publication, verify the actual current READY deploy, `build_id: null`, complete function names, live marker, successful HTTPS landing and an exact static asset hash. Retain manifest and per-site PREPARED/INTENT/DISPATCHED/READY/LIVE_VERIFIED receipts as Actions artifacts; management continuity and policy live on Drive. A green job that skipped publishing is not a production release.

## Manual verification and recovery

The same workflow supports `workflow_dispatch`, site `all`, `mdlxdcc` or `bd-chess`, optional exact main SHA, and `verify_only=true` for preparation without publication. A non-main branch cannot publish. The maintenance staging branch runs preparation only. For a bad published change, fix or revert the source on main and publish forward through this same path. A failed deploy has not replaced the previous site.

The old weekly ChatGPT coordinator is retired after the verified cutover. Nara, image and editorial tasks retain their content schedules and scopes; their authorized main changes use this shared pipeline, without direct per-task Netlify dispatches. Retired one-off production jobs stay retired. Never reactivate an old release marker to publish again.

## Cost boundary

Keep the current Free Legacy plan. External preparation does not consume Netlify native build minutes; exhausted historical build minutes are not an artificial hold on this upload path. Actual provider restrictions, bandwidth/function limits, rate limits and GitHub storage limits still apply. No paid upgrade, top-up, paid runner or hidden paid retry is authorized. Standard GitHub-hosted runners for public repositories are free under current GitHub terms.

Official references: https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/ ; https://cli.netlify.com/commands/deploy/ ; https://docs.github.com/en/billing/concepts/product-billing/github-actions .
