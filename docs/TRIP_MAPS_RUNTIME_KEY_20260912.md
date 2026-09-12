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
