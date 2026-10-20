# Travel actions v1 · 2026-10-20

Only authenticated project users; the host fixes actor and tripId. Context is the selected variant/day/city and revision, not the whole private page. list_city_visits combines existing planner candidates and public additions. read_travel_reference accepts a city ID only. No arbitrary URL reader is provided; follow the linked official source for current hours.

propose_visit_changes makes a preview. apply_visit_changes applies allowed catalogue additions/enabling/disabling/duration changes and, if requested, Classical DeepSearch on one untimed segment, then saves through the existing encrypted store. optimize_day_visits can preview or apply/save. save_visit_plan and undo_last_own_change share the manual store. No other database or solver. Each call gets a stable server requestId; duplicate delivery cannot duplicate execution.

A change uses {op:add|enable|disable|duration,id,minutes}; minutes is null except for duration. An existing stop ID or a listed public catalogue ID is required. Fixed events are immutable to AI. Multiple segments require a separate explicit choice. A new unresolved location is a useful preview but cannot be optimised by inventing coordinates; report LOCATION_REQUIRED and preserve the draft. estimate uses existing approximate coordinates only, is not walking distance and costs no provider API.

Execution results distinguish preview/applied_local/saved/conflict/failed/cancelled. Saved includes server write requestId, accepted revision and ETag; the AI endpoint independently checks the server receipt. The encrypted continuation binds actor, scope, expiry, provider transcript, action and input revision. A requested client action is not completion. No retry with a newer revision after conflict. Lock changes epoch, cancels worker/network and discards late results and private history.

## Page navigation · v1.1.0

show_page_section({section,day}) is read-only navigation within this same HTML page. section is one of vrh, nacrti, zemljevid, primerjava, dnevi, najini-ogledi, vodic, prakticno, potrjeno, leti-kritja, proracun, spanje, rezervacije, slike, viri. day is null, except a day card 1–10 in dnevi. No selectors, URLs, code, private DOM extraction, form submission, unlock, state write or paid maps call. It does not select a different planner day or route variant.

Use it immediately for explicit page movement; do not substitute get_maps or a verbal refusal. The host checks session epoch and target visibility, moves keyboard focus, and returns status shown plus navigation {section,day,locked}. Only then describe the section as shown. A locked placeholder remains locked. Failed/cancelled is not shown. Receipt fields must match the signed request. On narrow screens the sidebar closes to reveal the target; the return button restores the same conversation. Literal unambiguous navigation commands may be handled by the page without calling a paid model.

read_travel_topic({topic}) accepts only overview, itinerary, page-guide, food-culture, practical, tickets-access. These and the ten city references are bundled, hashed knowledge; no arbitrary filesystem or URL reader exists. Cite human-readable official links from the loaded reference; do not pretend to have checked them live.
