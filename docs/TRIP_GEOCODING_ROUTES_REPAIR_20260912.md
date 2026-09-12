# Trip Optimizer: named stops, road rendering, Gemini guidance

The production six-city input (Nova Gorica START, Ljubljana, Maribor, Novo Mesto, Koper, Ptuj) failed because Google's browser Geocoding Service reported that Geocoding API was not activated for the key's project. The app discarded every failed lookup and reported “Need 2+ valid stops.” An older success timer could also hide this error.

Google additionally rejected DirectionsService as a legacy API not enabled for the new project. A rendered basemap and a successful coordinate-only solver test did not verify geocoding or road rendering.

## Changes

- Stop on a failed lookup with a specific, visible error. Keep the editor intact and never solve a partial itinerary or shift START by filtering stops.
- Validate coordinate ranges, bound lookup duration, prevent overlapping address-lookup runs, and cancel old status-hide timers.
- Replace legacy DirectionsService with the Maps JavaScript Routes library. Preserve solver order, batch large routes, handle asynchronous obsolete responses, and clearly distinguish a missing road path from successful stop ordering. Direct Line closes round trips and makes no route API request.
- Retain navigation links when road rendering is unavailable. Distances and savings remain straight-line optimizer estimates, not road distances or proof of global optimality.
- Add server-side Gemini instructions describing actual GUI controls, trip planning, supported ADD/REPLACE actions and their limits. Include current travel settings in the request. This is instruction/context, not model fine-tuning.
- Classify Google's 429 quota errors as zero quota, daily exhaustion or other rate limits, without exposing raw provider messages, keys or account identifiers. No model rotation or quota bypass.

## Required Google configuration

Existing Trip-Maps project: gen-lang-client-0186296984. Enable Geocoding API and Routes API in its Library and allow both, plus Maps JavaScript API, in the existing browser key's API restrictions. Retain mdlxdcc.org/www.mdlxdcc.org website restrictions. Routes API is distinct from Route Optimization API. No new project or secret is required.

## Validation

Before deployment: 21 Node tests passed, including the exact six-city input with mocked Google lookups, unchanged input/START on failure, coordinate input, modern Routes request order/round-trip rendering, direct-line fallback and sanitized Gemini quota classification. Actual Google success still requires the services to be enabled by the project owner. The browser reproduced Google's API-not-activated and legacy-API errors before the patch.

References:
- https://developers.google.com/maps/documentation/javascript/geocoding
- https://developers.google.com/maps/documentation/javascript/routes/get-a-route
- https://developers.google.com/maps/documentation/javascript/reference/route
- https://ai.google.dev/gemini-api/docs/rate-limits
