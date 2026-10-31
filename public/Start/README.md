# BD Start

Standalone personal homepage at `/Start/index.html`, created from the approved BD Start design on 2026-10-10.

EN/SL, light/dark and 90–140% text remain available in Settings. The homepage has up to eight user-selectable, reorderable favorites, six searchable collapsible directories, personal links, a seven-day calendar summary, notes and saved sample stories. Settings and personal data use the isolated `bd-start-v1` localStorage key. New favorite and directory preferences are optional additions to the existing version-1 contract: existing exports remain importable. Export/import validates the full file before replacement; unsupported or corrupt stored data is preserved. Stale tabs cannot overwrite a newer revision.

The AI8 News panel reads the latest edition from the same-origin `/news/catalog.json`, validates its SHA-256 before displaying up to three stories, and shows the edition date, source and RSS-metadata label. It retains a link to News on failure. Historical sample stories and bookmarks remain accessible separately. Market prices, charts and weather remain explicitly sample data; ARSO and Promet.si links are available. The calendar is local rather than connected to an external account. No background synchronization or service worker is included. Personal notes and calendar entries are never sent to the server by this app. localStorage is device/browser storage, not encrypted storage.

Runtime files are local to this directory. Icon artwork is from Lucide, upstream commit `70562c1ee1c4fdcf736fe97bc893fb8511927934`, under the included ISC/MIT license (`LICENSE-lucide`). No external fonts or runtime CDN dependencies.

Verification: `node --test tests/start-state-r2.test.cjs` and `NODE_PATH=/path/to/playwright/node_modules node tests/start-app-browser.cjs` from repository root. The browser suite covers Chromium and WebKit at desktop and mobile sizes, news integrity, favorites and search, data migration, CRUD, import/export, unsafe URLs, storage failures and concurrent tabs. For the current production publication process, see `docs/NETLIFY_DEPLOYMENT.md`; the historical one-shot Start release remains retired.
