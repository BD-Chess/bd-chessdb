# 8zSudoku mobile

Separate Capacitor 8 application for iPhone and Android, built from the checked Sudoku LAB game. The phone launcher and both proposed store listing names are exactly **8zSudoku**. The identifier **org.chessbest.eightzsudoku** and current icon/splash are proposals for BD to review before distribution.

## Build from a fresh checkout

Requires Node 22 or later. Install from the package lockfile and generate the offline bundle **before opening either native project**:

    cd apps/sudoku-mobile
    npm ci
    npm run verify:donor
    npm run sync
    npm test

The deterministic build checks both SHA-256 and Git blob identities in donor.json and fails if either donor changes. It transforms only a local copy of public/S/new/app.html, then bundles the native bridge into web/index.html and web/bridge.js. The game script, styles, proof engine and worker source are inline; public/S/new/payload/ is not loaded by this donor. The PWA icon is the icon source. The generated web/ and copies in the native project are ignored by Git: run npm run sync after every change and on each new checkout. Do not edit generated copies.

The update procedure is to review the LAB diff, update donor.json with its new commit and hashes, adjust intentional transformations in scripts/build.mjs, run npm run sync and npm test, then review the native app on both devices. When the PWA icon changes, also copy the new icon to assets/icon.png and run npx capacitor-assets generate --ios --android; inspect the native asset diff. The build checks that the tracked icon matches the recorded PWA donor. A changed LAB file cannot silently alter a release bundle.

## Android

Requires Android Studio 2025.2.1 or later, Android SDK API 36, JDK 21, and an emulator or connected phone for device tests. From this directory:

    npm run sync
    npx cap open android
    cd android
    ./gradlew assembleDebug

On Windows, use gradlew.bat assembleDebug. Debug APK output is android/app/build/outputs/apk/debug/app-debug.apk. Install with adb install -r only on your test phone. No release keys, Play signing, or store upload are part of this PR. Capacitor 8 sets compileSdkVersion and targetSdkVersion to 36 in android/variables.gradle. Android uses portrait layout, has no INTERNET permission, and disables app-managed Android backups.

## iPhone 16 Pro before the App Store

Requires a Mac with Xcode 26 or later. From this directory on the Mac:

    npm ci
    npm run sync
    npx cap open ios

Select the App project and App target in Xcode, choose Signing & Capabilities, select your Personal Team (or your existing paid team), and adjust the proposed bundle identifier locally if your team requires another. Connect and trust your iPhone, enable Developer Mode if Xcode asks, select the iPhone as run destination and press Run. You can test on your own iPhone with a free Personal Team; its provisioning may expire after seven days and require a fresh build. This path does not upload anything to TestFlight or the App Store. Xcode uses the iOS project generated with Swift Package Manager; it has not been compiled in this Linux environment.

Phone orientation is portrait; iPad supports all orientations. Native lifecycle saves synchronously when the app backgrounds, then resumes the timer on foreground. Android Back closes an active dialog/help/details first and exits only from the game screen. External website links require a tap and open outside the game. Existing PWA progress has a different storage origin and does not automatically migrate; the game offers explicit JSON export/import, and each native export opens the OS share sheet.

## Review boundary

No changes to public/S/ or the Netlify deploy. Test the debug build and iPhone Xcode run on actual devices; confirm import/export through Files/Share, process termination recovery, offline airplane-mode launch, safe areas, dialogs, all four name surfaces, and accessibility before release. Store text and data declarations are drafts in docs/STORE.md and docs/PRIVACY.md. Developer-account enrollment, payment, TestFlight/Play Console upload, signing with private distribution credentials and store submission need separate BD authorization.
