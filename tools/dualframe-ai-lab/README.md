# DualFrame AI — LAB v1.0 · verified continuation R2

Concept and product originator: **Bojan Dobrečevič (BD)**. Implementation: GPT Work, 2026-10-13. Nara/Illuminara is a read-only design reference. The existing gallery and Daily release system are outside this change.

The LAB continues the existing product with three task modes, a five-entry model register, output proof, authenticated provider receipts, and provider-specific live gates. Local gallery/comparison remains usable without provider credentials. All real-provider generation remains **HELD** because account-specific free entitlement and private asset handling have not been verified. No paid call or real-provider image is claimed.

## Runnable product and model adapter status

| Key | Provider / exact API contract | Modes | Verified now |
| --- | --- | --- | --- |
| `demo` | deterministic browser/Pillow simulation | Faithful, Smart, Infographic | Local functionality; no AI-quality claim |
| `bria-direct` | `https://engine.prod.bria-api.com/v2/image/edit/expand` | Faithful, Smart | Offline transport and response tests |
| `fal-bria` | `fal-ai/bria/expand` | Faithful, Smart | Offline payload/queue/private-download tests |
| `fal-sunburst` | `openai/gpt-image-2.5/sunburst/edit` | All three | Offline payload/queue/private-download tests |
| `fal-nano` | `google/nano-banana-2.1/edit` | All three | Offline payload/queue/private-download tests |

Frontend: `public/Nara/dualframe-lab/`. Static modules preserve local import, EXIF-aware display, original hash, IndexedDB persistence, gallery, fullscreen, L/P selection, EN/SL, downloads, comparison, backup/restore and deletion. Demo is explicitly disclosed as a synthetic canvas simulation. The UI can select a model/mode, and authenticated `/api/capabilities` states each gateway model's actual gate. GitHub Pages itself cannot execute the private Python gateway.

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
| `POST /api/expand` | Frozen job, provider/model/mode/quality/whitelisted parameters, explicit external consent, persisted idempotency key |
| `GET /api/jobs/:id` | Owner-only, no signed status URL |
| `POST /api/jobs/:id/cancel` | Terminal local cancellation; upstream credit may already be consumed |
| `POST /api/jobs/:id/resume` | Reconcile an existing request ID only; never resubmit generation |
| `POST /api/jobs/:id/accept` | Accept into the private server pair manifest |
| `GET /api/pairs`, `GET /api/pairs/:id` | Owner-only manifests |
| `GET /api/assets/:id` | Bearer-authenticated bytes; never a token in a URL |
| `POST /api/compare` | Hash-bound record, immutable score, server does not trust client aggregate eligibility |
| `DELETE /api/pairs/:id` | Remove local server assets/jobs/linked comparisons; provider/browser/backups separate |

Default data root is outside the public checkout, mode 0700; originals and database mode 0600. Original bytes are retained; EXIF orientation/ICC are normalized into a separate sRGB RGBA PNG without GPS/EXIF/text metadata. Auth ownership uses invite hash, constant-time token check, strict origin allowlist, no cookies, 12 MB/24 MP input caps, 20 pairs per invite, 6 new jobs/hour, 40 retained jobs, bounded requests and output storage, no URL upload, fixed provider endpoint, exact asset-host allowlist, redirect refusal, and no request/prompt/credential logging.

Storage expiration: 24 hours by default, capped at 24 hours; purge runs at startup and while servicing requests (30-second housekeeping interval). An inactive stopped process does not purge until restart. Disk unlink is not forensic secure erase, and filesystem/host backups follow their own policy. Browser IndexedDB has no automatic purge; the uploader controls it and can export/delete local data. Deleting a server pair does not promise deletion of provider copies. Backend outage does not affect the static production gallery or already accepted browser pairs.

## Task semantics, proof and quality

**Faithful Expand** restores the original rectangle from a normalized, EXIF-corrected, sRGB RGBA image at scale 1, without alpha blending. The final delivery PNG is reopened, its protected rectangle decoded, and every channel compared with the normalized original. `pixel_proof` reports zero difference, normalized/source/output hashes, and the exact checked scope. This verifies normalized decoded pixels; it does not assert equivalence between original compressed JPEG bytes and PNG bytes. Visible seam quality still needs real outputs and human review.

**Smart Reframe** and **Infographic/Text** permit creative reconstruction, explicitly mark that the entire image may change, and never claim pixel protection. The frontend can add deterministic editable text after an infographic background; those modified bytes carry their own output hash and local-overlay provenance. Legacy `cinematic` requests map to `smart`. Bria is not offered for Infographic/Text because its expansion contract does not establish text layout capability.

Requested quality is `hd` or `4k`. Faithful canvas sizing never shrinks the protected original. Creative modes use exactly 1920×1080 / 1080×1920 for HD and 3840×2160 / 2160×3840 for 4K, with disclosed source resampling permitted. The server decodes provider output dimensions rather than trusting model metadata. Unexpected canvas size is explicitly reported as a LANCZOS transformation of the generated background, followed by protected-source restoration in Faithful. Such an output cannot be called native 4K. A 4K variant is accepted only when provider dimensions already match the requested canvas, no interpolation happened, and long/short edges are at least 3840/2160. Demo canvases never have verified native resolution; demo 4K cannot populate the 4K slot. Pixel equality and aesthetic quality are distinct tests.

Jobs/outputs retain model key, exact endpoint/API contract, effective provider parameters, original hash, output hash, geometry, request ID, completion time, latency and actual cost only when independently returned. `provider_cost=null` means unknown, not free. Model webpage price is not actual charged cost. `task_parameters_hash` includes source/target/mode/position/prompt/quality/seed/whitelisted options and excludes model/provider so the same task can be compared across models without merging different task scores. Gateway provenance establishes this gateway's authenticated record; it is not independent model-vendor attestation or proof of historical imported sidecars.

## Live gate and private provider assets

Budget remains **€0 new paid spend**. Every live gate defaults to off. One global durable ledger reserves at most one real submission across both providers and all models; failed/ambiguous submissions retain that reservation. The older Bria ledger is migrated into the global ledger. One process owns the data directory through a filesystem lock, SQLite uses full synchronous commits, files are written with fsync/atomic replacement and hash readback. Restart resumes only deterministic local jobs automatically. External jobs with a known receipt can use authenticated `/resume`; unknown ambiguous submissions are held for reconciliation and are never submitted again.

Env booleans alone cannot open the gate. A private hash-bound review JSON must independently establish this particular account's remaining free entitlement, retention handling, private input transport and private asset access. `DUALFRAME_PROVIDER_EVIDENCE_FILE` must lie outside the entire repository `public/` publish tree; `DUALFRAME_PROVIDER_EVIDENCE_SHA256` must match its complete bytes. Example record shape (placeholders are not verification):

```json
{
  "fal": {
    "reviewer": "INDEPENDENT_REVIEWER",
    "submitter": "ACCOUNT_OPERATOR",
    "account_free_requests": 1,
    "allowed_endpoint_ids": ["fal-ai/bria/expand"],
    "qualities": ["hd"],
    "entitlement_evidence_sha256": "SHA256_OF_REVIEWED_ACCOUNT_EVIDENCE",
    "retention_reviewed": true,
    "input_private_transport_verified": true,
    "asset_private_access_verified": true,
    "privacy_evidence_sha256": "SHA256_OF_REVIEWED_PRIVACY_EVIDENCE",
    "review_expires_at": 0
  }
}
```

Use `bria` for the direct account record. Expired/unreviewed/malformed records, missing secrets, missing invite or disabled flags keep the gate closed. An advertised trial and a free website tool do not establish free API entitlement. Each live request must match an explicitly reviewed endpoint ID and quality; provider-wide free flags do not authorize other models or 4K. Records are operator-supplied evidence references, not a mechanism that independently contacts/attests the billing account. Review and activation remain operational requirements, and resetting the ledger to evade budget is outside scope.

Bria inputs are inline normalized base64. Explicit canvas geometry replaces crop-prone `aspect_ratio`. Moderation stays enabled. Output host allowlisting, HTTPS and no redirects apply. A short-lived signed asset with an explicit signature and expiry is required; unsigned/long-lived public assets remain HELD. Separate account privacy evidence is still required.

Fal inputs are inline PNG data URIs; SDK public upload is not used. Submit sets `X-Fal-Store-IO:0`, `X-Fal-No-Retry:1`, `x-app-fal-disable-fallback:true`, and a one-hour deny-public lifecycle ACL. Returned queue URLs are persisted and constrained to HTTPS `queue.fal.run` and the known request path, never accepted from user input. Reconciliation only polls those URLs and retrieves the existing response. Public/old CDN output remains HELD. For supported `v3b.fal.media` output, the gateway verifies a deny-default/no-rule ACL through `rest.fal.ai/storage/files/acl`, obtains a short-lived server-only storage bearer token through `/storage/auth/token`, then privately downloads via bearer authentication. FAL_KEY is never sent to CDN, the browser, sidecars or logs. If ACL/authentication cannot be proved, the output is held. Queue IO deletion is distinct from generated-file lifecycle and vendor retention.

Whitelisted model options: Bria `negative_prompt`; Sunburst `quality`/`background`; Nano `thinking_level`. Output count is fixed at one, PNG, safety on; Nano web search is off and generation limit on. All arbitrary endpoint/URL/key/cost/admin/retry/fallback request fields are rejected. Billing response is not exposed by the model contract. Optional `DUALFRAME_FAL_BILLING_READ_ENABLED=1` can read actual billing events with a reviewed BILLING/FULL-scope key, sum only exact request-ID/endpoint matches, and preserve null for missing events, permission failures or paginated/incomplete receipts. No estimate is presented as an actual cost.

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


## R4 product continuation

The public LAB adds the existing 30-artwork read-only responsive reference gallery, immersive double tap, a guarded five-entry model selector, and local import of an already prepared opposite composition. Imported pairs preserve their original and mark source linkage as uploader-declared, without native 4K or provider verification claims. Imported dimensions are shown explicitly. Previous compositions remain retained among candidates. No credentials, paid provider call or gateway hosting is implied.
