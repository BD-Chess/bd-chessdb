# Public DNA AI Lab

`/ai8-dna-v4` starts with the accepted compact DNA and a small header. **AI Lab** opens ChatGPT on the left and Claude on the right at CSS widths of at least 1100px. Smaller portrait layouts use active-provider tabs; landscape layouts from 700px show two compact bottom panels. The same DOM and document-space DNA geometry survive toggles. Native pinch zoom remains enabled.

`?mode=ai8-live` is a DNA-only display mode for the separately managed native scene. It hides the public header, panels and composer and does not initialize authentication, availability probes or model requests. It grants no privileges and never connects private CLI sessions.

The frontend in `public/assets/dna-lab/` uses the existing `mdlxdcc-guide` and `mdlxdcc-guide-auth` endpoints. Guests see a clearly labelled prepared introduction. Signing in uses the existing cookie/session, account roles and usage limits. No schema, credentials, pricing, owner rules or provider defaults change. The existing landing guide frontend is unchanged.

For a new signed-in conversation, one coordinator requests three short model-generated messages: host asks partner about the public Lab, partner discusses one approved update, host invites the visitor to choose and waits. The host is ChatGPT on odd Europe/Ljubljana calendar dates and Claude on even dates. The host and welcome intent are saved before a request, so hide/show, reload, account refresh and date changes cannot replay an attempted welcome. An interrupted welcome remains stopped. A new conversation is explicit. Ordinary questions call one selected guide; **Ask both** explicitly calls the selected guide and then the other, with labelled shared public history. Busy submissions are rejected. Errors, cancellation and provider unavailability stop the sequence without retries or substitutions.

Each welcome request goes through the same authentication and metered provider transport as other guide questions. Its fixed server instructions allow one 800-token response, no tools and no further turns. Ordinary Lab questions retain the existing public source tools. The editorial digest in `digest.mjs` records one already-published update, its date, sources and registered DNA project. It is dated evidence, not live news. The server explicitly permits this one public DNA page, which the older source index omitted. Client navigation can only highlight a matching entry from the existing public DNA catalogue; it never executes provider code or opens protected/private paths.

Conversation, drafts and provider selection stay in tab-scoped sessionStorage. Incomplete answers are labelled and excluded from provider history. Prepared messages are never passed off as model output or forwarded as prior model answers. Authentication passwords and cookies are never saved in that storage. Closing the guides retains transcripts, draft text and scroll positions. Transcripts and source links use DOM text, with only HTTPS Markdown links rendered as anchors.

Validation commands:

```sh
node --test tests/dna-lab.test.mjs tests/ai8-dna-v4.test.mjs tests/mdlxdcc-guide.test.mjs tests/mdlxdcc-guide-access.test.mjs
node tests/mdlxdcc-guide-client.test.cjs
node tests/mdlxdcc-root-pwa.test.cjs
# Browser harnesses require Playwright Core and Chromium; environment overrides are optional.
node tests/dna-lab-browser.mjs
node tests/ai8-dna-v4-browser.mjs
DNA_ZOOM_LAB=1 node tests/ai8-dna-v4-zoom-browser.mjs
```

Provider fixtures in automated tests are simulations, not live API proof. Browser phone layouts and Safari-coordinate modelling are not physical iPhone/Safari verification. Release and exact-source checks follow `docs/NETLIFY_DEPLOYMENT.md`; publication uses the existing shared prebuilt publisher only.
