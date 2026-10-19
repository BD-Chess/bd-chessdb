# Opt-in original Grok image output

An authenticated `bd-research-owner` legacy-password session can request
`preserve_provider_native: true` on `POST /api/df/expand`, exclusively with
`model: "grok-imagine"`, `mode: "smart"`, `quality: "hd"` and a portrait or
landscape target. The existing xAI adapter requests `resolution: "2k"` and
`quality: "medium"`; the API's `hd` value is a compatibility value in this path.

The immutable job and effective-request fingerprint include the opt-in only
when true. Omitted/false requests retain the previous fingerprint and HD export
behavior. Changing the flag with an existing key is an idempotency conflict.
Unsupported combinations and non-boolean flags fail before worker dispatch.
Other accounts and models receive no new entitlement or provider access.

The native path fully decodes and validates one bounded PNG/JPEG/WebP, target
orientation/aspect (2% rounding tolerance), non-rotated EXIF, at most 24 million
pixels and the existing provider-download bound of 75 MiB. It then stores the
**original provider bytes** without rotation, resize, crop, padding or re-encode.
Invalid provider output fails that job; it does not trigger a generation retry.

`output.sha256 == output.provider_response_sha256`, output/provider dimensions
match, and `resolution_origin` is `provider-native-unmodified`. The actual MIME
and byte size are retained. Existing owner-bound asset downloads/ranges apply.
Do not infer a fixed 2048px edge: actual Grok 2K geometry can be 1584x2816.

`GET /api/df/capabilities` advertises `native_output_preserved: true` on the Grok
model plus the opt-in field/allowed modes/qualities. This advertises API support,
not account validation, a successful generation or visual acceptance.

Offline coverage: `node --test tests/dualframe-native-output.test.mjs`.
