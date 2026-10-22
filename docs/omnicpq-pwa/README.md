# OmniCPQ standalone v16

The private shared skill is v16 / v0.1.6. Exact distribution identity:

- ZIP SHA-256 2468eaec7724c2f0db684b8948843b5cabcaa6fa9319fc0f8f586f40fdab0318
- Manifest SHA-256 bc9ca72ecbf7094f72c683148c841806ae80931f5ad9a26e8a1fa435c7c2c92a

The application retains the existing owner login, private server knowledge and transactional demo invitations. Product sources and the source Excel files remain outside this public repository. Public code contains 19 generic starter prompts, retrieval logic, pinned hashes and no catalog payload.

V16 adds exact-code/name lookup over verified private B2B catalog rows, explicit SO relation retrieval, source provenance and selected paraphrased diagnostic evidence. A catalog entry is not full configuration support. All original price rows for a selected code are retained with workbook, sheet and row references. No B2B relation is inferred from categories. SO prices are not in the new export.

The existing database RPC uses a fixed legacy slot called v15. Its label is not the payload version: verifyPack requires the exact current ZIP hash, manifest hash and every source hash. No authentication or accounting function is changed for this release. Blobs, when explicitly configured instead, use a version-specific private key. Neither private storage mode allows public/client data access.

Local preview is explicitly simulated and makes no provider requests:

```
node scripts/omnicpq/prepare-knowledge.mjs EXTRACTED_SKILL ORIGINAL_ZIP .private/omnicpq/knowledge.json
node scripts/omnicpq/materialize-icons.mjs
node scripts/omnicpq/build-prompts.mjs .private/omnicpq/knowledge.json
node scripts/omnicpq/build-shell.mjs
node scripts/omnicpq/preview.mjs --demo
```

Deployment follows docs/NETLIFY_DEPLOYMENT.md and the existing automatic GitHub Actions prebuilt release. Live activation, login, model response, demo budget and Copilot import are separately evidenced. A simulated preview or green code test never proves a live AI answer or CPQ E2E.
