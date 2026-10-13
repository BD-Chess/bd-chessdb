# DualFrame AI — LAB v1.0 · verified continuation R2

Concept and product originator: **Bojan Dobrečevič (BD)**. Implementation: GPT Work, 2026-10-13. Nara/Illuminara is a read-only design reference. The existing gallery and Daily release system are outside this change.

R2 continues the existing PR #185 instead of rebuilding. Controlled comparisons now reject demo candidates on either side, synthetic originals, malformed output hashes and invalid/non-finite dimensions. Existing saved scores are reclassified on load without changing their ratings. A new comparison starts with fresh ratings/notes; reopened locked comparisons retain their recorded values. The deterministic mock copies normalized RGBA pixels without blending transparent originals into its background. Malformed pending provider responses fail with a bounded provider error. The optional empty Bria prompt was reproduced successfully and is covered explicitly; it was not a defect.

## Runnable product

Frontend: `public/Nara/dualframe-lab/`. Static HTML + ES modules, no bundler, external fonts, tracking, keys or private images. Upload, EXIF-aware display, immutable original SHA-256, local IndexedDB persistence, deterministic opposite-orientation demo, accept/reject/cancel/regenerate, gallery, fullscreen, rotation, EN/SL, downloads, source-area overlay, backup/restore, imported outputs, blind scoring and CSV/JSON export are browser-local. The page makes no provider requests until the user selects Bria, connects an invite-only gateway and explicitly consents.

**LIVE_PROVIDER_HELD.** Bria v2 adapter contract is implemented and tested with transport doubles. There is no claim of a real AI image generation. No ChatGPT image-generation session is used. Demo output is a synthetic canvas simulation, clearly disclosed. Provider-native 4K and verified upscale are absent: requesting 4K visibly falls back to HD, without stretching or generating.

## Start locally

From the repository/package root, with Python 3.12:

```bash
python -m pip install -r tools/dualframe-ai-lab/requirements.txt
python tools/dualframe-ai-lab/server.py
```

Open `http://127.0.0.1:8765/`. Static UI and browser-local demo work without an invite token; private API endpoints remain closed. The server does not auto-load `.env`. Configure secrets in environment/managed settings before launching an authenticated gateway. Use a high-entropy invite of at least 32 characters. Never put a provider API key into the page's invite field: it accepts a **DualFrame invite**, not a Bria key.

Focused verification, with no external provider calls:

```bash
node --test tools/dualframe-ai-lab/test_core.mjs
python -m unittest discover -s tools/dualframe-ai-lab -p 'test_server.py' -v
```

## Hosting boundary

GitHub Pages can publish the isolated static leaf. It cannot run the Python API or keep a provider secret. The supplied API is a single-process persistent server, ready for a private host behind HTTPS with a durable private volume. Dockerfile is a deployment recipe, not a claim that a container or paid host was created. Do not copy SQLite/file storage into an ephemeral Netlify Function. A later serverless port needs object storage, a durable job ledger and verified quotas, and must stay isolated from the production Nara release configuration.

An HTTPS public page cannot reliably use an HTTP local gateway. Use the local runner for same-origin local work, or a separately hosted HTTPS gateway with this page's origin explicitly allowed. Desktop narrow/portrait viewport selects landscape; phones use current viewport orientation; iPad/Android tablets use current viewport orientation. Preview simulation and manual viewer override support unusual devices. iOS Safari physical-device acceptance remains separate from desktop/browser checks.

## APIs and private storage

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Public minimal service status; no secrets |
| `GET /api/capabilities` | Authenticated gate status |
| `POST /api/uploads` | Raw JPEG/PNG/WebP bytes, strict Content-Type + magic + Pillow validation |
| `POST /api/expand` | Frozen job, explicit consent for Bria, persisted idempotency key |
| `GET /api/jobs/:id` | Owner-only, no signed status URL |
| `POST /api/jobs/:id/cancel` | Terminal local cancellation; upstream credit may already be consumed |
| `POST /api/jobs/:id/accept` | Accept into the private server pair manifest |
| `GET /api/pairs`, `GET /api/pairs/:id` | Owner-only manifests |
| `GET /api/assets/:id` | Bearer-authenticated bytes; never a token in a URL |
| `POST /api/compare` | Hash-bound record, immutable score, server does not trust client aggregate eligibility |
| `DELETE /api/pairs/:id` | Remove local server assets/jobs/linked comparisons; provider/browser/backups separate |

Default data root is outside the public checkout, mode 0700; originals and database mode 0600. Original bytes are retained; EXIF orientation/ICC are normalized into a separate sRGB RGBA PNG without GPS/EXIF/text metadata. Auth ownership uses invite hash, constant-time token check, strict origin allowlist, no cookies, 12 MB/24 MP input caps, 20 pairs per invite, 6 new jobs/hour, 40 retained jobs, bounded requests and output storage, no URL upload, fixed provider endpoint, exact asset-host allowlist, redirect refusal, and no request/prompt/credential logging.

Storage expiration: 24 hours by default, capped at 24 hours; purge runs at startup and while servicing requests (30-second housekeeping interval). An inactive stopped process does not purge until restart. Disk unlink is not forensic secure erase, and filesystem/host backups follow their own policy. Browser IndexedDB has no automatic purge; the uploader controls it and can export/delete local data. Deleting a server pair does not promise deletion of provider copies. Backend outage does not affect the static production gallery or already accepted browser pairs.

## Faithful versus cinematic

Faithful chooses an explicit no-crop canvas and original rectangle. Bria's `aspect_ratio` parameter is omitted because the current API documents possible crop/resize; `canvas_size`, `original_image_size`, `original_image_location` are used instead. The server rejects unexpected output dimensions. It overwrites the source rectangle with normalized original RGBA pixels and losslessly encodes PNG, verifying byte equality of that **decoded normalized region**. This does not mean the original JPEG compressed bytes or arbitrary ICC pipeline are equivalent to a PNG. Surrounding seam quality is unmeasured without real outputs/human review.

Cinematic uses the explicit requested placement and scene direction with provider reconstruction allowed; no pixel preservation is claimed for it. Demo cinematic is still only a deterministic simulation. Source-size improvement and aesthetic quality require real-provider review.

## Safe real-provider activation

Budget in this mandate: **€0 new paid spend**. All live gates default to off. Before the one narrow real smoke, verify the actual Bria account's available free expansion entitlement, applicable data/retention terms and exact output hostname. Merely seeing an advertised free trial is insufficient. The operator must provide an invite, managed Bria secret, exact output hosts, and explicitly set `DUALFRAME_LIVE_ENABLED=1`, `DUALFRAME_FREE_ENTITLEMENT_VERIFIED=1`, `DUALFRAME_RETENTION_REVIEWED=1`, `DUALFRAME_VERIFIED_FREE_REQUESTS=1`. The persistent global ledger reserves at most **one** request, including uncertain/failed submissions, with no automatic generation retry. Client `cost`, `admin` and unknown fields are rejected. Resetting the ledger to evade the budget is outside scope.

Input is private inline base64 to Bria, not a publicly hosted photograph. Moderation is enabled. Output is downloaded by the gateway without sending the Bria token to the asset host, checked and stored privately. On submission, request ID/status URL are persisted; browser gets request ID, not URL. Polling is bounded. Restart holds uncertain in-flight jobs rather than re-submitting. A pending timeout or crash requires operator reconciliation against the stored request ID before any new generation. No final charge/model-weight identifier is invented if the response doesn't expose it.

## Ready for BD originals

In **Creation gallery**, add originals directly from the device. They stay private in that browser. In **Blind comparison lab**, select an original, import the web output and pre-existing GPT Work reference, then import one sidecar for each. The accepted live-generated opposite variant can be the web output automatically. Unknown source lineage is retained for inspection and excluded from the controlled aggregate.

Sidecar shape (one per imported output):

```json
{
  "kind": "reference",
  "source_sha256": "EXACT_64_HEX_ORIGINAL_HASH",
  "output_sha256": "EXACT_64_HEX_OUTPUT_FILE_HASH",
  "direction": "portrait",
  "target_ratio": "9:16",
  "provider": "GPT Work",
  "model_or_version": "KNOWN_VERSION_OR_UNKNOWN",
  "review_scale_policy": "equal-canvas-v1",
  "provider_cost": null,
  "cost_currency": null,
  "latency_ms": null
}
```

This is a hash-bound **uploader declaration** of source history, not independent verification of a past model session. No artwork title/number can establish same-source input. Demo cannot qualify as a controlled provider output. The UI persists the randomization seed, same A/B positions, original and equal review frames, shared zoom, simple contain/crop baseline, five criteria per candidate, preference and failure notes. Submit locks scores and reveals providers. Export is private/download-only; no original or result is published automatically. No numerical winner is claimed. Start one blind review with **Begin blind review** once both candidates are present. Research with at least 5 original landscape and 5 portrait samples remains a later step.

Versioned schema is at `public/Nara/dualframe-lab/pair.schema.json`; frontend `checkPair` enforces key semantic invariants in addition to schema. Jobs have immutable input fields with separately updated lifecycle/status/receipts. Browser backups preserve raw bytes and verify restored hashes; provider keys/invite tokens are never serialized. Keep original/variant/manifest downloads for recovery.

## Rollback

Revert only the DualFrame feature commit/PR, or remove only `public/Nara/dualframe-lab/` and `tools/dualframe-ai-lab/` after preserving private data. Never revert an older whole-repository baseline over concurrent Visual Series/ChessBest changes. No production gallery/navigation/global deployment file belongs to this patch.
