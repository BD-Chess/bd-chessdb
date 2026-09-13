# Trip Optimizer — BD version standard

Adopted 2026-09-13. Scope: Trip only; no optimizer, road-distance, chatbot,
API-key, local-storage or shared-function behavior changes.

| Channel | Public URL | Repository directory |
| --- | --- | --- |
| CURRENT | /trip/ | public/Trip/ |
| PREVIOUS | /trip/old/ | public/Trip/old/ |
| LAB | /trip/new/ | public/Trip/new/ |
| Archive 001 | /trip/old/001/ | public/Trip/old/001/ |

The three channels have a static, accessible CURRENT · PREVIOUS · LAB selector.
Only the selected channel has aria-current="page". Each selector is embedded in
its own HTML; no shared mutable selector asset is required.

## Initial adoption

CURRENT and LAB keep their verified brute-force-15 release runtime unchanged.
PREVIOUS is copied from /trip/old2/. That legacy address remains unchanged.
Archive 001 is an exact copy of old2 before adding a selector, including images,
MyTrips and Protected files. It must never be edited or overwritten.
versions.json records its original Git blob hashes. Numbering is chronological
by archival event; the next archive is 002.

## Future promotion transaction

1. Read the newest main, applicable AGENTS.md and versions.json. Verify existing
   archive hashes. Inspect changes and active Netlify production workflow runs.
2. Choose the next unused numeric archive ID (zero-padded to at least 3 digits);
   never reuse an ID or fill a historical gap. Copy PREVIOUS into old/NNN.
   **Exclude numbered archive subdirectories when copying old/**.
3. Copy CURRENT's release-owned files into old/, keeping all numbered archives.
   Exclude old/, old2/, new/ and channel metadata from the CURRENT copy.
4. Copy the verified LAB release-owned files into CURRENT, preserving old/,
   old2/, new/ and metadata. Remove obsolete channel-owned assets only when
   explicitly reviewed; never recursively replace the entire Trip directory.
5. Update active selector markings in the three channel HTML files only.
   Keep LAB available as a baseline for the next development cycle.
6. Add the new archive's file hashes, source commit and timestamp to versions.json.
   Add an explicit /trip/old/NNN index rewrite before /trip/old/*.
   Never edit existing archives, even to refresh their selector or links.
7. Run Trip tests. Check the three channels and the new archive, relative asset
   URLs, worker imports, desktop/mobile selector, route distance and cancel UI.
8. Re-read main immediately before committing. If unrelated changes arrived,
   base the minimal Trip-only commit on that head; merge only the Trip block
   of public/_redirects. If Trip itself changed, reconcile before publishing.
   Push without force. If main moves again, retry from the new head.
9. Do not start a manual Netlify deploy alongside other sessions. Wait for an
   active production deploy to finish before pushing. Use the existing
   GitHub → Netlify workflow; verify its deployed commit includes this commit.
   Cross-session writes cannot be atomically locked by this document: if a
   newer push supersedes the deployment, verify that newer deployed tree too.
10. Verify live URLs and archive hashes, then store the release package,
    provenance and validation results in the canonical Trip project folder.

## Archive boundaries

Each archive owns its local HTML, JavaScript, worker, CSS, images and examples.
Do not switch archived relative assets to mutable CURRENT paths. External
Google Maps/fonts and existing server-side endpoints remain live dependencies:
this is a frontend snapshot, not a frozen copy of external services or secrets.
Any future shared backend change must retain old-client compatibility or add a
versioned endpoint before an incompatible promotion.

## Verification

Run: node --test tests/trip-*.test.mjs

Archive integrity is checked against committed Git blob hashes. The original
old2 preservation test stays in force. CURRENT/LAB runtime equality is an
initial-adoption regression check; when LAB intentionally diverges, replace
that equality test with release-specific assertions as part of that work.
