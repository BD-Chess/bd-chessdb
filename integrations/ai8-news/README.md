# AI8 view — Ground News, GPT and Claude

Ground News is the reading source. **AI8 view** adds two independent analyses of
the same selected text using the computer's installed **Codex CLI** and **Claude
Code CLI**, with their existing subscription logins. It does not modify Ground
News servers, bypass publisher paywalls or run a local GGUF model.

`https://www.mdlxdcc.org/news/` is a reader with Ground News below a fixed
toolbar: **GPT analiza**, **Claude analiza**, or **Obe analizi**. Pasting an
article URL retrieves its title and publicly accessible text automatically.
Previous AI8 daily editions remain in `archive.html`; new own daily editions are
paused until BD requests otherwise. The public website has no server endpoint
that runs a visitor's CLI. Its `/api/news-source` function only retrieves public
source text, without forwarding browser logins or cookies. Reading and URL
retrieval work without the addon; analysis needs the local addon and host.

## Omarchy installation

Requirements: Chromium, Python3, `mise`, a working `codex` login and a working
`claude` login. Current tested CLI flags include Codex `--ignore-user-config` and
Claude `--safe-mode`; older versions may need updating before using this helper.

From a reviewed checkout of this repository:

```bash
python3 integrations/ai8-news/native/test_host.py
node --test integrations/ai8-news/extension/tests/*.test.mjs
python3 integrations/ai8-news/install.py
```

The installer copies addon/host code to `~/.local/share/ai8-news`, backs up an
existing installation, resolves the current CLI executables and registers
`org.ai8.news` under `~/.config/chromium/NativeMessagingHosts/`. It does not
restart Chromium or change browser preferences.

On Omarchy, an alternative to loading it manually is:

```bash
python3 integrations/ai8-news/install.py --enable-browser-startup
```

This backs up and merges the addon into `~/.config/chromium-flags.conf`, preserving
the existing extension list and other flags. It takes effect on the **next full
Chromium start**; it does not close current tabs or restart the browser. Merely
opening another window in an already-running Chromium is not a full start.
Use the manual method below if you want to enable it in the running browser.

In the **same Chromium profile used for NEWS**, open `chrome://extensions`, enable
Developer mode, choose **Load unpacked**, and select:

```text
/home/bd/.local/share/ai8-news/extension
```

The fixed addon ID is `nlhhhmkffnmnobnjodhgmcmgjdfjlldh`. Its manifest key is a
public extension identity, not a login credential. Refresh the Ground News story
or public `/news/` page after loading it. On another Linux account use the path
printed by the installer rather than the example `/home/bd` path above.

When upgrading from 0.1, rerun `install.py` from the updated checkout, click
**Reload** for the existing addon on `chrome://extensions`, then refresh NEWS.
Both addon and native host need the 0.2 capabilities for individual GPT/Claude
buttons. The page displays **Posodobi AI8 view** if an older component is still
connected. Frame capture itself works with the 0.2 addon even while the native
host is disconnected; URL retrieval remains independent of both.

## Reading a story

- On our `/news/` page, browse Ground News in the large frame. **Trenutna
  novica** captures the current story through the addon. Then choose **GPT
  analiza**, **Claude analiza**, or **Obe analizi**. Navigation alone never
  starts an analysis.
- Paste a source URL in the top toolbar, or press Enter / **Odpri / pridobi**.
  The title and public text appear in the source inspector. Other publishers
  open in the text reader; Ground News stays available through **Branje**.
  If a site requires a subscription, login, or browser verification, open it
  with your normal access and explicitly select the text you want to analyze.
  URL retrieval does not bypass those controls.
- A normal webpage cannot read a different site's frame. The addon captures
  only the Ground frame in this NEWS tab, and associates the result with that
  exact source. Ground subscriber login inside the frame depends on the
  browser's third-party cookie rules; **Ground posebej** opens it normally if
  needed. Existing protections are not changed.
- On a Ground News story, click **AI8 view**. A readable Ground summary is used
  only when the addon can identify it; otherwise select the text yourself.
- On any accessible publisher page, select the desired text, right-click and
  choose **AI8 view**. Only the selected text is sent.

Connection status distinguishes an installed addon from a functioning native
host. The source inspector remains editable for an explicit excerpt or question.

The two readers receive the same literal packet and do not see each other's
answer. Results show the summary, opinion, reasons, uncertainties and questions
for each reader. A summary or excerpt does not become a verified full article.
Analysis uses cloud services behind the CLI logins; the selected text is sent
to OpenAI and Anthropic. Nothing is published automatically.

## Local storage, limits and recovery

Source text and results are saved privately in `~/.local/share/ai8-news/private/`
(files0600, private directory). This directory and local config are excluded
from Git. No provider credential is copied to the addon, source tree or page.

The public URL endpoint accepts only public HTTP(S) destinations, revalidates
redirects and pins approved DNS answers. It bounds response size, redirects and
time, executes no page scripts, and does not forward login cookies. Its small
per-IP request budget is scoped to each warm function instance, not a global
provider rule. Existing site protections and the Free Legacy plan are unchanged.

There is no HTTP listener. Chromium connects the allowlisted addon to a stdio
native host. Web content cannot choose a program, shell command or CLI flag.
The host limits input, validates structured results, serializes analyses and
uses a finite timeout. Claude's tools and customizations are disabled; Codex
uses a read-only sandbox with command, apps/plugins, browser and collaboration
features disabled. Article text is untrusted data, not an agent instruction.

Completed results are cached per article and per reader. Requesting GPT and then
both readers reuses GPT's result and calls only Claude. Unselected readers are
labelled `not-requested`; they do not run. Old completed results remain usable,
and old interrupted records keep their held state.

An identical completed packet returns its stored result. Closing a page does
not authorize a retry. An interrupted `started` record holds that packet rather
than launching duplicate work. Partial/error results remain visible. Check the
CLI login/usage status separately in a terminal before making a deliberate new
attempt. To retry a failed or interrupted job, first verify no reader process
for it is active, then move its exact local JSON record into a private recovery
folder. Preserve that receipt; do not clear the entire directory.

## Offline checks

Install the locked function dependencies first with
`npm ci --prefix functions --ignore-scripts`. The checks below use fixtures and
do not request articles or provider responses.

```bash
python3 integrations/ai8-news/native/test_host.py
node --test integrations/ai8-news/extension/tests/*.test.mjs
node --test tests/test-ai8-news*.mjs
node --test tests/test-news-source.mjs
```

These checks do not call either provider. A real login smoke test must be
explicitly performed on the installation; passing offline tests alone does not
prove that an addon is loaded in the user's browser or that a CLI login works.

Primary implementation references:
[Chrome native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging),
[content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts),
[Codex configuration](https://developers.openai.com/codex/config-reference/),
[Claude programmatic mode](https://code.claude.com/docs/en/headless).
