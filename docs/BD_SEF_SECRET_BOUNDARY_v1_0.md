# BD Sef — hard security boundary v1.0

Date: 2026-09-17

## Absolute rule

Unlocked/raw Sef content and raw credentials are never portable project artifacts.

Allowed locations:

1. BD's private Google Drive Sef — authoritative unlocked/raw source for BD + authorized assistant work.
2. The intentionally protected/encrypted `/BD/O/sef.html` website runtime artifacts — GitHub/Netlify may carry only the protected/encrypted runtime form, never unlocked/raw Sef content or raw credentials.

Forbidden in all ZIPs, release bundles, Live Extracts, Collector output, evidence packs, chat/file attachments, Home↔Work deployment bundles, screenshots, logs, receipts, unencrypted GitHub/Netlify source, or workflow artifacts.

8zCockpit must never read, package, copy, generate, or depend on Sef/raw credentials. rclone credentials are machine-local configuration.

Any credential that crosses this boundary is treated as exposed and must be rotated/revoked before reuse.

All build/publish paths touching Sef are fail-closed: if unlocked/private Sef filenames or obvious raw-secret markers are detected, the build must fail.