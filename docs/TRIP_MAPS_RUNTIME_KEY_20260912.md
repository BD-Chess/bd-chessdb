# Trip Maps runtime key repair — 2026-09-12

Base commit: 4766310b25f8020f99c2b92d20071c2ee3cc3c37

## Change
- Read TRIP_GOOGLE_MAPS_API_KEY through a dedicated Netlify function at runtime.
- Remove the retired hardcoded Maps browser key from public/Trip/app.js.
- Keep existing maps, geocoding, DirectionsService and optimizer behavior.
- Cache-bust app.js; show a retryable configuration error if configuration is absent.
- GEMINI_API_KEY remains exclusive to the Gemini server endpoint.

## Credential boundary
The Maps JavaScript browser key is intentionally visible to the browser and must have Google website/API restrictions. Netlify Secret masks its management value; it does not make a Maps browser credential private. No Gemini credential is returned by the Maps configuration endpoint.

## Verification before deployment
- JavaScript syntax passed.
- Handler checks passed: Maps-only response; no reads of Gemini credentials; no-store; POST 405; missing Maps configuration 503.
- Production integration will be checked after deployment.

## Production observations and Gemini correction
- Maps loaded on www.mdlxdcc.org and a Ljubljana/Kranj/Bled itinerary optimized and displayed.
- Google models.list includes gemini-2.5-flash, but generateContent returned HTTP 404 with: "This model models/gemini-2.5-flash is no longer available to new users."
- Catalog presence therefore is not sufficient proof that inference is available to a new project.
- Default changed to gemini-3.5-flash-lite, listed in the authenticated catalog and official stable-model documentation.
- Google pricing documents free inference but no free Google Search grounding for this model. Search tools are disabled by default and require explicit server opt-in TRIP_GEMINI_SEARCH=true. The UI no longer advertises Internet Enabled.
- Added system instruction to avoid claiming current web verification without search.
- Temporary public model diagnostics removed; provider errors again fully normalized.
- All 13 Gemini regression tests pass, including no search tools by default and explicit search opt-in.
- Official references: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite and https://ai.google.dev/gemini-api/docs/pricing
