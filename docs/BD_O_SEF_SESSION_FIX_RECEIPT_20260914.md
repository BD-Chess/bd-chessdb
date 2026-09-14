# BD/O Sef session fix — pre-merge receipt

- Root cause: first Sef release incorrectly introduced a second password layer.
- Required behavior: after `/BD/O/` is unlocked, `/BD/O/sef.html` reuses the existing tab-scoped `bd-o-v2-session`, like other private BD/O pages.
- Dedicated Sef password: retired; no longer required by current runtime.
- Local verification: `bdai4ever` unwraps current BD/O key PASS; 8-part ciphertext SHA checks PASS; AES-256-GCM decrypt PASS; gzip + JSON parse PASS; JS syntax PASS.
- Branch readback: Sef HTML, JS, config and all 8 ciphertext parts match local Git blob bytes exactly (11/11).
- Scope: only Sef implementation plus this receipt; current BD/O vault/index/tablet logic is not rewritten.
