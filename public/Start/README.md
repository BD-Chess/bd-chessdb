# BD Start

Standalone personal homepage at `/Start/index.html`, created from the approved BD Start design on 2026-10-10.

EN/SL, light/dark and 90–140% text remain available in Settings. The homepage has up to eight user-selectable, reorderable favorites, six searchable collapsible directories, personal links, a seven-day calendar summary, notes and saved sample stories. Settings and personal data use the isolated `bd-start-v1` localStorage key. New favorite and directory preferences are optional additions to the existing version-1 contract: existing exports remain importable. Export/import validates the full file before replacement; unsupported or corrupt stored data is preserved. Stale tabs cannot overwrite a newer revision.

The AI8 News panel reads the latest edition from the same-origin `/news/catalog.json`, validates its SHA-256 before displaying up to three stories, and shows the edition date, source and RSS-metadata label. It retains a link to News on failure. Historical sample stories and bookmarks remain accessible separately. Market prices, charts and weather remain explicitly sample data; ARSO and Promet.si links are available. The calendar is local rather than connected to an external account. No background synchronization or service worker is included. Personal notes and calendar entries leave the browser only when the visitor turns on sync (R7, below), and then only encrypted. localStorage is device/browser storage, not encrypted storage.

Runtime files are local to this directory. Icon artwork is from Lucide, upstream commit `70562c1ee1c4fdcf736fe97bc893fb8511927934`, under the included ISC/MIT license (`LICENSE-lucide`). No external fonts or runtime CDN dependencies.

BD's November 4 request adds a permanent `Trading · 1s Arena` link beside the
favorites heading and a searchable research-directory entry. These are static
navigation additions outside the eight personal pins; no saved favorites,
exports, notes or localStorage records are migrated or overwritten.

BD's November 11 request adds a searchable research-directory entry for the
new 8zTSP page (`../BD/BD_8ZTSP.html`), first in "Raziskave & primerjave".
Like the entry above it is a static navigation addition: no saved favorites,
personal links, exports or localStorage records change.

The November 12 directory update adds links to AI8 DNA, Nara and Illuminara,
and the public OmniCPQ origin story. Searching Start also searches the public
site catalogue, without including protected shortcuts. Results are created as
text, stay on the same site, and existing shortcuts still work if the catalogue
is unavailable. No personal Start data or saved favorites are changed.
The shared release check requires new indexable public HTML pages to be present
in the catalogue; protected and explicit `noindex` pages remain excluded.

BD's November 7 request (R5) makes wide and 4K windows use their width
instead of a 1260px column. From 1600px the directory takes the left two
thirds with its groups side by side, and personal links, AI8 News, more and
Moj dan stack on the right; from 2400px Moj dan gets a third column. The
number of directory columns follows the text size. Below 1600px the layout
is unchanged. This is CSS only: no stored data, links or behavior change.

R6 (also November 7) adjusts the wide layout only: AI8 News is not shown,
because BD reads news on a separate NEWS desktop; "Vreme & promet" moves under
"Moje povezave"; it, "Moj koledar" and (R8, November 8) "Prostor za misel"
open on every visit. Closing one of them lasts until the next visit. The
stored open state of these panels is never
changed by the wide layout, so narrower windows and phones keep what the
visitor chose. A narrower window restores the R2 places.

R7 (BD, November 7) adds optional sync between browsers (`sync.js`, Netlify
function `/api/bd-start-sync`). In "Podatki & nastavitve" the visitor enters a
sync password once per browser; the browser remembers the derived keys under
`bd-start-sync-v1`, separate from the exported `bd-start-v1` data. PBKDF2-SHA256
(600,000 iterations) and HKDF derive a 256-bit vault id, which is sent, and an
AES-GCM content key, which is never sent. The server, backed by Netlify Blobs
store `bd-start-sync-v1`, keeps one ciphertext record per vault with a revision
and compare-and-set writes. It accepts at most five vaults and 1.5 MB per
record, and it cannot read anything.

Synced content: calendar, notes, favorites, personal links, bookmarks,
language and weather city. Appearance, text size, open panels and the shown
month stay per device. Server content passes the import validation before it
replaces local content, and the replaced local content is kept once under
`bd-start-sync-backup-v1`. An unknown password asks before creating a vault, so
a typo creates nothing. A newer server copy meeting unsent local changes is
never merged silently: the page offers "Naloži novejše" or "Obdrži to napravo".
Offline changes stay local and are sent later. A forgotten password cannot be
recovered; local data stays in each browser.

Verification: `node --test tests/start-state-r2.test.cjs tests/bd-start-sync.test.mjs` and `NODE_PATH=/path/to/playwright/node_modules node tests/start-app-browser.cjs` from repository root. The browser suite covers Chromium and WebKit at desktop and mobile sizes, news integrity, favorites and search, data migration, CRUD, import/export, unsafe URLs, storage failures and concurrent tabs. For the current production publication process, see `docs/NETLIFY_DEPLOYMENT.md`; the historical one-shot Start release remains retired.
