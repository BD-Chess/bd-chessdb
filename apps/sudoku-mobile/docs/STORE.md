# Store preparation — drafts, no submission

## Exact name

| Surface | Name |
| --- | --- |
| iPhone Home Screen: CFBundleDisplayName | 8zSudoku |
| Android launcher: strings.xml app_name | 8zSudoku |
| Apple App Store listing name | 8zSudoku |
| Google Play listing name | 8zSudoku |

Proposed identifiers and icon require BD review. Verify name availability in each console before reserving or submitting; consult BD if unavailable rather than silently changing it.

## Listing copy

Short description: Play Sudoku offline with checked hints, pencil notes and a review of your moves.

Long description: 8zSudoku offers four puzzle difficulties, pencil notes, undo, classic solver views and DCC Navigator hints that explain checked candidate deductions. Game Review revisits recorded moves and distinguishes a proven deduction from a correct answer whose reasoning is unknown. Your game auto-saves on this device and runs offline. Optional human traces and local learning have separate consent controls; local export and deletion are available in the game. DCC comparisons are experimental and make no measured learning claim.

App Review note: This is an offline Sudoku game bundled into a Capacitor native application from BD's own LAB. Choose a difficulty on first launch, select a square, enter digits with the on-screen keypad, turn on Notes for pencil marks, and use Undo. Open DCC Navigator to request Where to look / Why? / Reveal; Game Review becomes available after a move. No account or server is required. Optional trace collection requires explicit consent. The app offers local data deletion and explicit JSON export via the OS share sheet. Website references open externally only on a tap. It is a Sudoku game with an interactive, checked hint/review engine; the web origin is disclosed.

## Media and classification

- Icon: current PWA Sudoku grid icon reused and generated into platform assets; verify on phone and approve final identity.
- Splash: matching dark background. Use real screenshots captured on each device (welcome, active grid and keypad, Navigator hints, Game Review, settings and privacy). Confirm current required phone/tablet resolutions in both store consoles before upload. Do not fabricate screenshots.
- Age content: Sudoku has no violence, gambling, ads, chat, user-uploaded public content, or account feature observed; answer current age questionnaires in the consoles against the final binary.
- Privacy: use docs/PRIVACY.md and verify on final signed binary; do not claim platform approval. Provision store-facing support/privacy URLs before publishing.

Apple App Review Guideline 4.2 evaluates the actual app's sustained utility and UI, not whether its website was promoted. Google Play requires adequate functionality; new Android apps need API 36 or later under the current target API policy. App Store distribution currently requires Xcode 26 with iOS 26 SDK. Inspect these policies again just before submission.

Official references: https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution ; https://support.google.com/googleplay/android-developer/answer/9898783?hl=en ; https://support.google.com/googleplay/android-developer/answer/11926878?hl=en ; https://capacitorjs.com/docs/android/setting-target-sdk .
