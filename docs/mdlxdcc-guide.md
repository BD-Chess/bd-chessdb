# MDL×DCC Guide

The landing now has separate **MDL×DCC → Start**, **BD → /BD/**, **AI → left guide**, and **LAB → the existing Growth through time dialog** controls. AI is closed initially. Closing it keeps the same DOM, transcript, request and frame. A tab-scoped transcript also survives a reload. The existing landing studies, galleries, languages, typography, theme and search remain in place.

The assistant is a site-owned OpenAI API application. It does not embed chatgpt.com, use a visitor's personal ChatGPT subscription, inherit the owner's account/Drive, or expose a provider credential to the browser.

## Runtime and release

- Frontend: `public/assets/mdlxdcc-guide/guide.js` and `guide.css`.
- Endpoint: `functions/mdlxdcc-guide.mjs`, served at `/.netlify/functions/mdlxdcc-guide`.
- Knowledge/tools: `functions/lib/mdlxdcc-guide/runtime.mjs`.
- Tour: `public/assets/mdlxdcc-guide/tour.json`.
- Tests: `node --test tests/mdlxdcc-guide.test.mjs`.

Install function dependencies with `npm ci --prefix functions --ignore-scripts` or the existing deployment workflow's `npm install --prefix functions`. The OpenAI SDK consumes runtime `OPENAI_API_KEY` / `OPENAI_BASE_URL`. Netlify AI Gateway can supply them automatically **only if the existing team plan and AI features support it**. An alternative is an owner-provided OpenAI key stored as a secret with Functions scope in the existing Netlify project's environment settings. Never put a key in index.html, sessionStorage, a public file, or chat.

`MDLXDCC_GUIDE_MODEL` optionally selects the OpenAI model. The default is `gpt-6-luna`, chosen for a public guide with short answers and arithmetic/source tools. No automatic switch to another provider or a paid plan is performed. The SDK uses the Responses API with low reasoning, streaming, `store:false`, a bounded tool loop and an overall timeout. Provider errors are redacted.

GET on the endpoint reports credential availability; it does **not** prove a successful provider call. Before calling the agent live, complete one real short question and verify a `done` event with a useful answer and source. Tests use a simulated provider and must not be described as a successful real OpenAI call.

The current Netlify Git-build suppression and weekly release policy remain. A GitHub push updates Pages through its existing workflow, while Netlify Functions need the existing approved release path. GitHub Pages alone cannot run this endpoint; on that host the UI reports that the assistant connection is unavailable, and the public tour can use explicitly labelled script comments. No wildcard CORS proxy is introduced.

## Skill selection

At request time the server fetches the public `ai/skills/registry.json` from GitHub main (three-minute in-memory cache). It loads the general guide, answering rules and site map, and gives the model metadata for all `availability: "ready"` skills. The model selects project bodies semantically using the question, current public page and conversation history. It can load multiple project skills and their public Markdown references.

DGTE belongs at `public/ai/skills/dgte-advisor/SKILL.md`. When its builder is ready, move its metadata from `planned_skills` to `skills`, use `skill_path: "dgte-advisor/SKILL.md"`, set `availability: "ready"`, and supply a specific description plus `reference_paths`. Keep the existing registry entries. The new skill is then available without changing the chat code or redeploying the backend. A file uploaded without a ready registry entry stays inactive.

Actual tools are `search_public_sources`, `read_public_source`, `load_skill`, `read_skill_reference`, `calculate`, and `show_public_page`. Markdown instructions and references are loaded as context; arbitrary code/scripts in public skill packages are not executed. A project requiring a special simulation or calculator needs a separately implemented, reviewed tool. The basic arithmetic tool already supports monthly energy/revenue scenarios with explicit net power, hours and tariff assumptions.

The public search index is a discovery map, not evidence for a quantitative claim. Detailed answers read actual public HTML from repository main. Sources include canonical page and repository URLs and a retrieval time; main may precede a live site release. Protected sources, owner APIs, private paths and arbitrary external URLs are excluded. A noindex page is read only when it is an explicitly curated public entry, such as the publicly linked teaching demo; unclassified noindex pages are excluded. Page observations and retrieved HTML are untrusted data rather than instructions.

## Tour behavior

`glance` starts the ten-scene main tour. Optional variants: `glance it`, `glance devices`, `glance creative`, `glance ai8`, `glance theories`. Pages open in one same-origin frame beside the persistent chat. The visual opening selects the One rule study and verifies eight curves. Other adapters only perform bounded public demonstrations; games, accounts, saved data and audio controls are untouched. Protected MentalArena scenes are excluded.

Navigation and visible content are checked before commentary. With the provider available, GPT receives the observed page and interaction for its comment. Otherwise the public prepared commentary is explicitly labelled **Comment from the tour script**. The 60-second timer starts after the complete comment. Next / a standalone `n`, `next`, or `naprej` advances immediately. Typing a question, closing the panel or hiding the tab pauses the timer; a question is answered before the visitor resumes. Stop ends the tour and leaves the current page visible.

On phones the normal chat occupies the area below the header; during a tour it moves below the scene so both remain visible. On larger screens it stays at the left. Right-hand browser sidebars remain outside the webpage's layout.

## Privacy and usage

The transcript is stored only in this tab's sessionStorage and sent as bounded conversation context to the endpoint. The app does not archive visitor conversations or accept provider response/thread IDs from the client. Requests use public sources, not personal account data. OpenAI processes the questions; the interface says so.

The function accepts same-origin JSON, caps question/history sizes, excludes system/tool roles supplied by visitors, limits tool calls/output, and has Netlify rate limiting of eight requests per minute per IP and domain combination. This is **not** a monthly currency hard cap. Keep the platform's existing credit/spend limits and auto-recharge settings under the owner's control; no new purchase, recharge or billing-plan change is part of this implementation.
