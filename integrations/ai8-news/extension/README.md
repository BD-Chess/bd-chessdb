# AI8 view Chromium extension0.2

Unpacked Manifest V3 addon. Native host: `org.ai8.news`.

The fixed public manifest key gives ID `nlhhhmkffnmnobnjodhgmcmgjdfjlldh`.
The native host must allow exactly
`chrome-extension://nlhhhmkffnmnobnjodhgmcmgjdfjlldh/`. This public key is
extension identity material; it contains no login credential or private key.

## Reading on our News page

On `https://www.mdlxdcc.org/news/`, Ground News fills the iframe below a fixed
bar. **Trenutna novica** captures the visible Ground summary without calling a
model. **GPT analiza**, **Claude analiza** and **Obe analizi** request only the
selected reader or readers. The native helper reuses an already completed
reader's exact-source result when adding the second opinion.

Pasting an article URL into the page uses the site's separate public article
fetcher. The extension does not fetch that URL itself. URL/manual modes read
its populated source fields; frame mode captures the current Ground document.
Only an actual user click in the owned toolbar starts an analysis.

The iframe content script publishes URL/title metadata and responds to a
background request targeting its exact Chrome document ID. It creates no panel,
connects to no native host and cannot start an analysis. Nested Ground frames
are inert. A missing or ambiguous summary asks for explicit source selection.
A changed frame URL/document invalidates the previous output; native work is
not automatically repeated or canceled.

Chrome's scripting result verifies the current document ID, URL and direct-child
relationship before registering a sender. Reader loading clears old frame
bindings while retaining the owned toolbar subscription. A child can register
metadata before the parent content script starts; the parent's subsequent
source probe reconciles it without running a model. Queued messages from an old
top or child document cannot replace the current binding.

Ground News' subscriber login inside an iframe depends on the browser's cookie
and storage behavior. The addon does not read cookies or change those settings.
**Odpri Ground News** offers a normal first-party page when needed. That page
retains its **AI8 view** button with the two-reader sidebar. On another
accessible publisher page, select text and choose **AI8 view** in the browser's
context menu. Such access requires the explicit `activeTab` gesture; iframe
context-menu selections never start native work.

A Ground summary is labeled `ground-summary`, not a full publisher article.
Selected publisher text is labeled `selection`. Only a structurally recognized,
visible GroundAI-attributed list of direct bullet items is captured. Publisher
coverage cards, whole-page interface text and hidden variants are excluded.

## Native protocol and update compatibility

Messages use `v:1`, opaque `requestId` and `ping` or `analyze`. The analysis
packet is `{article:{url,title,text,inputKind,capturedAt},models:[...]}`. The
allowed selections are `['gpt']`, `['claude']` and `['gpt','claude']`; omission
keeps the older both-reader behavior. Text is trimmed and bounded to59,999
JavaScript UTF-16 code units and256,000 UTF-8 bytes. No command, filesystem path,
provider model name or CLI argument comes from a webpage.

Responses are `ready`, `accepted`, `progress`, `result` or `error`. All job
messages echo the request ID; startup `ready` may omit it. Results include
`requestedModels`, optional `cachedModels`, both result keys and the source
snapshot. Unselected readers have `{status:'not-requested',analysis:null}`;
selected statuses are `ok`, `error` or `timeout`. Each successful analysis has
plain-text summary, opinion, reasons, uncertainties and questions.

`article.sha256` binds the exact normalized text's UTF-8 bytes. URL, input kind,
text hash and requested readers must match the original request. Results from
stale frame documents or source revisions are never delivered to the new view.
Unknown response fields are not forwarded; model/publisher text uses
`textContent`, not HTML.

Host0.2 startup and ping responses advertise
`capabilities:{modelSelection:true}`. A single-agent request is refused before
calling an older host, which might otherwise ignore `models` and run both.
The public ready message includes `extensionVersion:'0.2.0'`,
`capabilities:{frameCapture:true,modelSelection:<host support>}` and the actual
`nativeHostAvailable` boolean. The page can require these features rather than
mistaking an older installed addon for the new toolbar integration. Update the
host and reload the unpacked addon before refreshing the News page.

## Owned-page bridge

Trusted buttons: `#ai8-gpt`, `#ai8-claude`, `#ai8-analyze` and capture-only
`#ai8-current`. Hidden `#ai8-source-mode` selects `frame`, `url` or `manual`.
URL/manual inputs are `#ai8-url`, `#ai8-title`, `#ai8-text` and `#ai8-kind`.

The extension sends only output:

```js
window.postMessage({source:'ai8-news-extension',type,payload}, location.origin)
```

Types are `ready`, `source`, `progress`, `result`, `error`. Captured source has
`{requestId,article}`; frame navigation metadata has `{url,title}` without an ID.
Capture-only errors carry `{requestId,error}`. A frame analysis first emits
progress with its request ID, then the matching captured source, then native
progress/results. Trusted source edits invalidate the old local output and
release its UI state; the global native job remains singular until it ends.
The extension never listens for webpage-originated `postMessage` commands.

Closing a tab or losing the native connection does not trigger a retry. Use
**Preveri povezavo** on the standalone sidebar or refresh the page after setup.
No models run during idle metadata publication or frame capture.

## Verification

From the repository root:

```sh
node --test integrations/ai8-news/extension/tests/*.test.mjs
```

The offline suite covers fixed identity/permissions, literal rendering,
source/hash/model binding, single active work, disconnect uncertainty,
trusted-click gating, explicit publisher grants, frame-only capture,
foreign/nested-frame rejection, exact document routing and navigation races.
Startup ordering and iframe-only reloads have dedicated regressions.
It installs nothing and calls neither model. Real Chromium/native-host and
subscriber-login behavior remain separate acceptance checks.
