# MDL×DCC Guide

The landing now has separate **MDL×DCC → Start**, **BD → /BD/**, **AI → left guide**, and **LAB → the existing Growth through time dialog** controls. AI is closed initially. Closing it keeps the same DOM, transcript, request and frame. A tab-scoped transcript also survives a reload. The existing landing studies, galleries, languages, typography, theme and search remain in place.

The assistant is a site-owned API application with **GPT** and **Claude** choices in the chat header. The choice controls the next answer in one shared conversation; every assistant answer carries its provider label. Switching preserves the transcript, draft and scene and pauses a running tour. It does not embed chatgpt.com, use a visitor's personal subscription, inherit the owner's account/Drive, or expose a provider credential to the browser.

## Runtime and release

- Frontend: `public/assets/mdlxdcc-guide/guide.js` and `guide.css`.
- Endpoint: `functions/mdlxdcc-guide.mjs`, served at `/.netlify/functions/mdlxdcc-guide`.
- Knowledge/tools: `functions/lib/mdlxdcc-guide/runtime.mjs`.
- Tour: `public/assets/mdlxdcc-guide/tour.json`.
- Tests: `node --test tests/mdlxdcc-guide.test.mjs tests/mdlxdcc-guide-access.test.mjs`.

Install function dependencies with `npm ci --prefix functions --ignore-scripts` or the existing deployment workflow's `npm install --prefix functions`. The official OpenAI and Anthropic SDKs consume runtime `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. Both are production secrets in the existing **mdlxdcc** Netlify project, with Functions included in their scope. Netlify AI Gateway is not required. Never put a key in index.html, sessionStorage, a public file, or chat. The existing private MAL application has its own encrypted configuration and browser-to-provider relay; the public Guide does not load that private application or obtain credentials from it at runtime.

`MDLXDCC_GUIDE_MODEL` optionally selects the OpenAI model (default `gpt-6-luna`). `MDLXDCC_GUIDE_CLAUDE_MODEL` optionally selects the Claude model (default `claude-sonnet-5-5`). Only the selected provider is called; there is no automatic cross-provider retry or paid-plan change. GPT uses Responses streaming, low reasoning and `store:false`. Claude uses Messages streaming, low effort and `between_tools` on Sonnet 5.5. Its complete signed assistant content is passed back unchanged inside an append-only tool loop, with fixed system instructions and tool definitions. Both use the same public knowledge, tools, six-round/eight-tool bound, output limit, overall timeout and redacted errors. Thinking content is not streamed to visitors.

GET reports availability separately for GPT and Claude; it does **not** prove a successful provider call. Before calling either provider live, complete one real short question and verify a `done` event with a useful answer, provider identity and source. Tests use simulated providers and must not be described as real API successes. A missing key for one choice does not disable the other or silently route to it.

The current Netlify Git-build suppression and weekly release policy remain. A GitHub push updates Pages through its existing workflow, while Netlify Functions need the existing approved release path. GitHub Pages alone cannot run this endpoint; on that host the UI reports that the assistant connection is unavailable, and the public tour can use explicitly labelled script comments. No wildcard CORS proxy is introduced.

## Skill selection

At request time the server fetches the public `ai/skills/registry.json` from GitHub main (three-minute in-memory cache). It loads the general guide, answering rules and site map, and gives the model metadata for all `availability: "ready"` skills. The model selects project bodies semantically using the question, current public page and conversation history. It can load multiple project skills and their public Markdown references.

DGTE is registered as ready at `public/ai/skills/dgte-advisor/SKILL.md` and is available to both providers. Future project skills need metadata in `skills` with `availability: "ready"`, a specific description, `skill_path` and relevant `reference_paths`. Keep the existing registry entries. A new skill is then available without changing the chat code or redeploying the backend. A file uploaded without a ready registry entry stays inactive.

Actual tools are `search_public_sources`, `read_public_source`, `load_skill`, `read_skill_reference`, `calculate`, and `show_public_page`. Markdown instructions and references are loaded as context; arbitrary code/scripts in public skill packages are not executed. A project requiring a special simulation or calculator needs a separately implemented, reviewed tool. The basic arithmetic tool already supports monthly energy/revenue scenarios with explicit net power, hours and tariff assumptions.

The public search index is a discovery map, not evidence for a quantitative claim. Detailed answers read actual public HTML from repository main. Sources include canonical page and repository URLs and a retrieval time; main may precede a live site release. Protected sources, owner APIs, private paths and arbitrary external URLs are excluded. A noindex page is read only when it is an explicitly curated public entry, such as the publicly linked teaching demo; unclassified noindex pages are excluded. Page observations and retrieved HTML are untrusted data rather than instructions.

## Tour behavior

`glance` starts the ten-scene main tour. Optional variants: `glance it`, `glance devices`, `glance creative`, `glance ai8`, `glance theories`. Pages open in one same-origin frame beside the persistent chat. The visual opening selects the One rule study and verifies eight curves. Other adapters only perform bounded public demonstrations; games, accounts, saved data and audio controls are untouched. Protected MentalArena scenes are excluded.

Navigation and visible content are checked before commentary. With the selected provider available and a signed-in account, GPT or Claude receives the observed page and interaction for its comment. Otherwise the public prepared commentary is explicitly labelled **Comment from the tour script**. The 60-second timer starts after the complete comment. Next / a standalone `n`, `next`, or `naprej` advances immediately. Typing a question, changing provider, closing the panel or hiding the tab pauses the timer; a question is answered before the visitor resumes. Stop ends the tour and leaves the current page visible.

On phones AI opens a full-width bottom chat panel; during a tour the scene stays above it. The composer follows the visual viewport when the on-screen keyboard opens. The AI control and close button hide the same panel without losing the conversation or draft. On larger screens the chat stays at the left. Right-hand browser sidebars remain outside the webpage's layout. Tour links preserve the selected site language.

Redirects to Netlify's lowercase, extensionless HTML URLs are matched only to already registered public paths. Snapshots keep the original repository path for source retrieval. Unregistered URLs remain unavailable.

## Privacy and usage

The transcript and selected provider are stored only in this tab's sessionStorage. The bounded shared conversation is sent to **the provider selected for the next submitted question**: OpenAI for GPT or Anthropic for Claude. The interface names that provider beside the composer. Switching alone makes no provider call. Earlier answers from the other provider are labelled in the model's context. The app does not archive visitor conversations or accept provider response/thread IDs from the client. Requests use public sources, not personal account data.

Paid questions require a site-owned email/password account. Visitors register and sign in through `/.netlify/functions/mdlxdcc-guide-auth`; passwords are salted scrypt hashes in a private Supabase schema. Mailbox ownership is not verified in this version. An HttpOnly, Secure, SameSite=Strict, eight-hour signed cookie authenticates requests. No password or session token is put in browser storage. The unauthenticated public `glance` uses labelled prepared comments and cannot invoke a paid provider.

The owner signs in using the configured owner email and existing OWNER password. The server verifies only the public BD_ACCESS_V1 key wrap from the current protected MAL shell; it never decrypts private content. Email alone and client-provided roles cannot grant owner access. Owner API questions bypass the visitor ledger and its question limit. Owner API charges remain payable to the provider, outside the visitor budget; unlimited access does not mean free API usage.

Visitors share **one $100 USD monthly pool across GPT and Claude**, using Europe/Ljubljana calendar months. Before every provider call, including each tool round, the database atomically reserves a conservative upper bound under a row lock. It then settles from returned token/cache usage, with a 10% conservative region margin. Missing usage, timeouts and abandoned calls retain their full reservation; stale holds become conservative charges, never refunds. Unknown pricing fails closed for visitors. Eight questions per minute per account limits bursts; tool rounds count as part of the same question. Auth has a separate twelve-requests-per-minute IP limit. Owner calls never enter these monthly or per-account counters.

`functions/lib/mdlxdcc-guide/access.mjs` implements auth and the server-only database RPC. `cost.mjs` pins pricing to the default model IDs and uses integer nanodollars. The SQL migration is `supabase/migrations/20261019164920_mdlxdcc_guide_access_budget.sql`; meaningful tests execute it in an actual PGlite Postgres engine, including RLS denial, holds at the cap, idempotent settlement and unknown charges. The live database has RLS on every table, a private unexposed schema and SECURITY INVOKER functions; it does not use a service-role key. A private custom-header server credential is verified against its hash, seeded separately from the public migration.

Netlify production requires `MDLXDCC_GUIDE_DATABASE_URL`, `MDLXDCC_GUIDE_DATABASE_PUBLISHABLE_KEY`, `MDLXDCC_GUIDE_DATABASE_SECRET`, `MDLXDCC_GUIDE_SESSION_SECRET`, and `MDLXDCC_GUIDE_OWNER_EMAIL`, in addition to both provider secrets. All are configured as production secrets with Functions scope included. Never commit their values. The dedicated Supabase project is `mdlxdcc-guide` in the existing MDLxDCC organization. No Netlify billing-plan migration, recharge or paid add-on is used.

The pool covers these Guide endpoints only. Existing MAL and other applications have their own provider usage and do not become subject to this ledger. Provider/platform billing can differ from the conservative estimate. If storage, auth or settlement is unavailable, visitor paid questions stop; no unmetered fallback exists.
