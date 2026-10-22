# Repository instructions

## Netlify deployment

BD approved continuous prebuilt publication on 2026-10-22. Read `docs/NETLIFY_DEPLOYMENT.md` before changing release code or preparing a deployment/handoff. Tested main updates publish automatically through the existing GitHub Actions workflow and `netlify deploy --prod --no-build`. Native Netlify builds remain Stopped; no weekly/time/build-minute hold or separate production publisher. Preserve complete site/function/config artifacts, protection, source provenance, tests and concurrent work. Never infer a live deployment from a commit alone. A failed or unknown upload is reconciled before another attempt. No LAB-to-CURRENT promotion, private-data disclosure or paid upgrade follows merely from deployment permission.
