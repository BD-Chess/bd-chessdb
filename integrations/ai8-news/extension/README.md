# AI8 view Chromium extension

Unpacked Manifest V3 extension. Native host name: `org.ai8.news`.

The fixed public manifest key gives extension ID
`nlhhhmkffnmnobnjodhgmcmgjdfjlldh`. The native host must allow exactly
`chrome-extension://nlhhhmkffnmnobnjodhgmcmgjdfjlldh/`. The key is public
extension identity material. No private signing key or authentication credential
is included.

On a Ground News article the **AI8 view** button opens a sidebar with separate
GPT/Codex and Claude views. Extraction stops before publisher coverage; if a
summary cannot be identified, select the desired text and use the browser's
**AI8 view** context menu. Other publisher pages receive access only through the
user's `activeTab` gesture. Selected text is labelled `selection`; a Ground News
summary is labelled `ground-summary`, never a full publisher article.

The extension does not fetch sources, bypass publisher access controls or run
commands. It sends literal bounded content over one persistent native port.
Closing a tab or losing the native connection does not automatically repeat a
model request. Reload/reopen the page after configuring the native host, or use
the sidebar's **Preveri povezavo** button. Browser-protected pages cannot be
injected.

## Native contract

Requests use protocol `v: 1`, an opaque `requestId`, and only `ping` or `analyze`.
An analyze request has `article: {url,title,text,inputKind,capturedAt}`. Text is
trimmed and is at most 59,999 JavaScript UTF-16 code units and 256,000 UTF-8 bytes.
No arbitrary command, model name, filesystem path or CLI argument is accepted.

Native responses are `ready`, `accepted`, `progress`, `result` or `error`. Startup
`ready` may omit `requestId`; all job messages must echo it. Model result statuses
are `ok`, `error` and `timeout`. Each successful analysis contains `summary`,
`opinion`, `reasons`, `uncertainties` and `questions`. `article.sha256` is the
SHA-256 of the exact normalized text's UTF-8 bytes. URL, input kind and text hash
must match the submitted snapshot. Unknown response fields are not forwarded to
the page. Output is created with `textContent` in a closed shadow root.

On the owned HTTPS `/news` page, a trusted click on `#ai8-analyze` reads
`#ai8-url`, `#ai8-title`, `#ai8-text` and `#ai8-kind`. Output is
`window.postMessage({source:'ai8-news-extension',type,payload}, location.origin)`.
Types are `ready`, `progress`, `result` and `error`; `payload.results` is direct.
Ready reports `installed:true` and the actual `nativeHostAvailable` boolean.
The extension never listens for page-originated `postMessage` commands.

## Verification

From the repository root:

```sh
node --test integrations/ai8-news/extension/tests/*.test.mjs
```

These tests exercise source/hash binding, malformed and stale native messages,
trusted-click gating, disconnect uncertainty, one active job, sender/frame
boundaries, exact manifest identity and literal rendering of hostile markup.
They simulate Chrome APIs and do not install the extension or call either model.
Actual Chromium/native-host integration remains an owner acceptance step.
