# HMAL HOME source

This directory versions the HOME application update. Production routing is
`public/hmal/index.html` → the existing authenticated HOME `/hmal/` server.
Netlify serves the entry point. The Python/PowerShell model controller runs on
HOME; publishing this repository does not install it on that computer.

The update includes native Chat roles, model-specific history, effective slot
context checks, explicit optional answer reservation, honest completion checks,
quality UI and a collapsed historical test-results section. Defaults remain
available-context output and no generation deadline. Local-first storage and
300-second/manual Drive archival are retained.

The private test report is **not** in the public repository or Netlify artifact.
HOME reads `evidence/smoke-results.v1.json` beneath its configured private HMAL
data root, through the existing session-protected `/api/hmal/` route. The UI
loads it once after authentication. A missing report leaves Chat usable and
shows an unavailable report. Saved observations never claim current health.

Installation requires the current Drive HOME handoff, fresh source comparison,
backups, existing controller/process ownership checks, Windows PowerShell and
native acceptance. The already pinned local `protocols/RHP.md` remains required;
this source directory does not replace the protocol or the portal's auth server.

`tests/hmal/` verifies generic fixtures without model, credential or Drive calls.
HOME acceptance is separate from the cloud source/entry-point publication.
