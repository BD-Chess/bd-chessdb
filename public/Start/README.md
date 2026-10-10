# BD Start

Standalone personal homepage at `/Start/index.html`, created from the approved BD Start design on 2026-10-10.

EN/SL, light/dark, 90–140% text, three views, collapsible sections, shortcut editing, personal calendar, notes and saved sample stories. Settings and personal data use the isolated `bd-start-v1` localStorage key. Export/import JSON supports moving data between browsers. Import validates the full file before replacement; unsupported or corrupt stored data is preserved. Stale tabs cannot overwrite a newer revision.

News headlines, market prices, charts and weather are explicitly sample data. No live data API, account authentication, background synchronization or service worker is included in this initial release. Personal notes and calendar entries are never sent to the server by this app. localStorage is device/browser storage, not encrypted storage.

Runtime files are local to this directory. Icon artwork is from Lucide, upstream commit `70562c1ee1c4fdcf736fe97bc893fb8511927934`, under the included ISC/MIT license (`LICENSE-lucide`). No external fonts or runtime CDN dependencies.

Browser verification: `NODE_PATH=/path/to/playwright/node_modules node tests/start-app-browser.cjs` from repository root. Uses Chromium and WebKit at 1440px and 390px, checks persistence, UI actions, data import/export, unsafe imported URLs, literal text rendering, unavailable/corrupt storage, and concurrent-tab preservation. Set `START_QA_URL` to verify a public deployment with isolated browser profiles. The one-time Netlify release job is gated on the exact owner-authorized merge subject `release: bd-start 20261010`, the successful Pages commit and unchanged production baseline; ordinary commits do not release Netlify.
