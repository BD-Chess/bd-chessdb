# 8zSudoku privacy and storage review

Observed in bundled LAB code and native bridge. Release descriptions require final checks on iOS and Android devices.

| Storage | Key or route | Retention and control |
| --- | --- | --- |
| Active puzzle, notes, undo history, bounded Game Review, preferences | ai8SudokuNavigatorV020.session, previousGame | Local WebView storage; autosave plus flush on app background. Navigator JSON export/import is explicit. |
| Games played, hints, best times | ai8SudokuNavigatorV020.stats | Local storage; removed by Delete local data. |
| Human action trace | ai8SudokuNavigatorV020.trace and traceConsent | Opt in only; separate trace export/delete controls; full Delete local data removes both. No device ID. |
| Navigator machine observations | ai8SudokuNavigatorV020.machine, consentMachine | Stored only after enabling; disabling removes stored observations and resets the live model. |
| Practice outcomes | ai8SudokuNavigatorV020.tutor, consentTutor | Stored only after enabling; disabling removes stored outcomes and resets the live profile. |

The game does not contain ads, account creation, analytics SDK, telemetry endpoint, automatic fetch or background request. Native plugins are App lifecycle, Filesystem for temporary explicit exports, and Share for a user-chosen destination. A Share action may send the exported JSON to the app/provider the player selects. Cancelled exports are not reported as completed; exported files are not deleted from that destination when game data is later deleted. Temporary local export files are removed after the share sheet closes. External website links open only after a player taps them. Android manifest omits INTERNET permission.

The native app and browser/PWA use separate storage origins, so no automatic PWA migration is claimed. JSON import is deliberate and validates schema and hash before restoring a puzzle; traces have a distinct export path and are never silently imported. The app's Delete local data asks for confirmation, deletes every key under its namespace including statistics, trace and consents, then reloads to prevent an unsaved open game from recreating the data. Other apps, exported files and OS-managed device backups are outside this deletion. Verify actual iCloud/device-backup behavior, Android manifest merger and platform privacy declarations on signed builds before store submission.

Suggested draft store responses based on this source: no data transmitted to the developer, no tracking, no advertising. Optional action traces and tutor outcomes reside on device until consent/revocation or deletion. Any future backend, crash SDK, analytics or third-party plugin change requires a new audit and store-data declaration.
