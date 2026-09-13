# Trip LAB: mobile GUI and two-stage Help / Demo

Scope: public `/trip/new/` only; source directory `public/Trip/new/`.
Base main: `bbc5f9bbba95ae5dfab6493864cc03a105ccd064`.

## Changes

- Compact mobile header. About button removed; its reviewed content is the second Help paragraph.
- Help and Demo open native modal summaries. On phones the modal fills the visible viewport, with More / Close at the bottom. Closing restores page scroll and focus. More opens the full LAB article in a separate tab.
- Full bilingual `help.html` and `demo.html`. Help explains the actual editor, matrix, air-distance comparison, manual Brute Force, cancellation, navigation, local storage, sharing, GPX and assistant capabilities.
- Demo retains the original EU14/EU15 evidence and qualifies the observed timing and optimum claims. It distinguishes heuristic search from exhaustive proof.
- Mobile Library occupies the available screen below its heading and search box; the list scrolls inside it. Library / Editor shortcuts do not summon the keyboard.
- Closed assistant occupies only its header. Open chat uses the visual viewport and allows the message field and Send button to fit narrow screens. Input fonts are 16 px to avoid focus zoom on iPhone.
- Comparison rows follow Fast / Deep / Brute Force / Deep Air order. Air results have a distinct style and the detailed explanation is collapsible.
- Application-owned labels and statuses translate between SL and EN without scanning user stops or provider answer text. Only the exact old built-in greeting is migrated.

## Unchanged

No promotion or archive rotation. CURRENT, PREVIOUS and archived versions are not edited. The version selector remains Current / Lab / Previous. Worker, brute-force algorithm, great-circle metric, road matrix, locale engine, trip presets and Gemini backend are byte-identical to the prior LAB release. Brute Force remains manual, up to 16 stops. UI changes do not resolve provider quotas.

## Screenshot handoff — wait for BD

Google Drive: GPT Projects / Trip Optimizer / Mobile GUI / LAB / 2026-09-13.

The full Help has hidden placeholders for these exact replacement filenames:

1. `01_Route_Editor.png`
2. `02_Results_Route_Map.jpeg`
3. `03_Results_Comparison.png`
4. `04_Share_GPX_Library.png`
5. `05_AI_Chatbot.png`
6. `06_AI_Chatbot_Keyboard.png`

Do not crop or publish the superseded GUI screenshots. After BD replaces them, inspect each replacement, then add focused crops with explanations to the relevant Help chapters. Keep original filenames; CSS crops can preserve source bytes. Existing EU14/EU15 historical Demo evidence is separate and remains unchanged.

## Verification

- All LAB JavaScript parses with Node.
- 23 focused tests pass: existing stop/matrix/map/cancellation/air comparison regressions, plus bilingual text, modal restoration and screenshot-placeholder contract.
- Verify responsive LAB and both articles after GitHub's automatic Netlify deployment. Desktop browser checks do not replace BD's final Safari/software-keyboard screenshots.

## Publication protocol

Read latest main before every GitHub mutation. Reuse its full tree, change only the listed LAB files and focused documentation/tests, and update main without force. Preserve unrelated concurrent commits. Use one GitHub-triggered Netlify deployment; do not start a separate manual deploy. Save the finished release ZIP and notes in the existing Trip Optimizer Drive folder without rearranging its folders.
