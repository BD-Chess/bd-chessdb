# LLM index captures

BD requested selectable capture dates on 2026-11-16. The dated JSON files are
intentional published observations, not source backup copies.

- public/llms/captures.json lists captures newest first and names the latest.
- Each data/YYYY-MM-DD/ directory contains meta_index.json, sources.json
  and commentary_sl.json. Its data date must match its directory.
- The three root JSON files are byte-identical to the latest dated capture,
  so existing direct links continue to work.
- /llms/?d=YYYY-MM-DD selects a listed historical capture; an unknown date
  falls back to the latest. Language/theme preferences, filters and sorting
  survive changing the capture.
- Preserve accepted earlier capture bytes before changing root JSON. The
  2026-10-30 baseline is main d6ce5f37983f82ebae0980080344538deb8e9331,
  including the approved PR476 factual correction.

Collect new observations for a new capture date; changing a build date alone
does not refresh old observations. Raw research inputs are not published here.
Authorized factual errors are corrected in place within the relevant capture,
with the expected integrity values reviewed in the same change; Git retains
the source history.

The scoped llms-captures.yml check runs the page tests and real Chromium/WebKit
layout, date-selection and preference checks without vendor calls. Evidence
includes screenshots and a machine-readable report. This workflow covers the
new capture-specific browser checks. It only verifies; the shared tested-main
Netlify workflow remains the sole publisher.

## Adjustable Value view

The quality-floor list defaults to 50 and offers 0 (no floor), 40, 50, 60,
70 and 80. Share links use `qf`; `q` remains the text search. Changing the
capture, filters or sort preserves this choice. The displayed Value is
`max(0, overall - floor) / blended_3to1`. Below-floor observations and unknown
or nonpositive prices have no displayed Value and sort last in either Value
direction; a priced model exactly at the floor has Value zero. This is a
chosen cutoff on relative scores, not a claim that 50 is their median.

The view recomputes tier winners. A best-trade-off (Pareto) badge means no
other ranked, positively priced observation has both score >= this score and
price <= this price with at least one strict inequality. Only observations
meeting the selected floor show a badge. Equal score/price observations do
not dominate each other. Neither the badges nor token prices guarantee
quality or cost on a particular task.

Captured `value_score_per_usd` and `value_tiers` retain their original meanings
and bytes; the adjustable metric is a separate browser view. The last tier
column explicitly remains score/price without a floor.
