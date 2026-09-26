# 8zSudoku: iPhone builds without owning a Mac

2026-09-25 · BD-directed continuation of draft PR #26. The existing Capacitor application is retained; only CI, signing helpers and documentation are added. This guide is implementation-specific. A workflow definition is not proof that an iOS build or Apple upload has succeeded; consult the dated verification receipt and the exact GitHub run.

## What runs, and what does not

`.github/workflows/8zsudoku-ios.yml` uses standard `macos-26` GitHub-hosted runners. A push of relevant code to `feat/8zsudoku-mobile` checks the locked web dependencies and donor hashes, runs the existing Node tests and new synthetic Python tests, compiles the iOS simulator app, verifies its bundled files, and installs/launches/relaunches it. It uploads only one small simulator screenshot, retained for three days. There is no IPA, keychain, provisioning profile, private key or archive uploaded as a GitHub artifact.

A signed build runs only after a deliberate `8zsudoku-testflight-*` tag push, successful verification, the protected `8zsudoku-testflight` environment approval, `IOS_UPLOAD_ENABLED=true`, and an exact full `IOS_APPROVED_SHA` match. The signing job imports a matching distribution certificate/profile into an ephemeral keychain, archives the app, exports a manually signed IPA, validates it and attempts exactly one App Store Connect upload. Temporary credentials are cleaned up on normal exit; the hosted VM is disposable. Cleanup after an abrupt VM kill cannot be attested by an EXIT trap.

No merge to `main`, website change, developer enrollment, payment, external tester invitation, App Review submission or App Store release is performed by this workflow. App Store Connect upload is not public App Store publication. Apple processing, export-compliance answers and assigning a build to an internal TestFlight group remain separate steps.

The tag route works before merging this draft. A `workflow_dispatch` button would require the workflow to be registered on the default branch, which is deliberately not changed here. Regular commits cannot expose Apple credentials. Configure environment secrets, not repository-wide secrets.

## 1. Apple account and enrollment (iPhone or browser)

Install Apple's **Apple Developer** app on the iPhone. Open **Account**, sign in with your Apple Account with two-factor authentication, then choose **Enroll Now**. Complete the identity and agreement steps yourself. An existing active Developer Program membership can be reused; do not purchase a duplicate.

Choose **Individual** only when publishing personally: your legal name is the App Store seller name. Choose **Organization** when publishing as an eligible legal entity; Apple's organization verification requirements apply. Do not substitute a lab nickname for a legal entity. Membership is USD 99/year or the local price shown by Apple; enrollment in the app is an auto-renewable subscription. This preparation has not purchased or activated any membership.

After activation, sign in at https://developer.apple.com/account/ and https://appstoreconnect.apple.com/. In the developer account's **Membership details**, record the ten-character **Team ID**. An Apple login is not a GitHub signing secret, and your Apple password or two-factor codes must never be sent to a chat or committed.

## 2. Register the app and obtain an upload API key

The code currently uses **`org.chessbest.eightzsudoku`**, display name **8zSudoku**. Confirm that this existing proposed identifier is the one you intend to keep before registering it. The CI deliberately rejects another bundle identifier; a different choice needs a reviewed code/config change, not a mismatching profile.

In the developer portal, open **Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App**. Register an explicit Bundle ID `org.chessbest.eightzsudoku` with description `8zSudoku`; do not add unrelated capabilities. In App Store Connect, choose **Apps → + → New App**, platform **iOS**, name **8zSudoku**, your intended primary language, that Bundle ID and a unique internal SKU such as `8zsudoku-ios-001`. Creating an app record is not submitting it for review. Name/identifier availability is determined by Apple, not by this guide.

For this pipeline use an **App Store Connect team API key**: **Users and Access → Integrations → App Store Connect API → Team Keys → Generate API Key** (or +). The Account Holder may first need to request API access. Name it `8zSudoku GitHub upload`; choose **Developer** access for build upload, not Admin. A team key's access spans the account's apps; the role narrows operations, not the list of apps. This pipeline specifically expects a team key with an Issuer ID, not an individual key.

Download `AuthKey_<KEY_ID>.p8` once and record the **Key ID** and **Issuer ID**. Keep the file private. Do not paste it here. The API key authorizes upload; it is NOT the certificate/private key that signs the app.

## 3. Produce signing material on Windows (no Mac)

The supplied `scripts/ios_signing_windows.py` generates a standard RSA-2048 CSR and an encrypted private key using Python, then packages your matching Apple certificate as an encrypted PKCS12 file. Apple's help illustrates CSR creation with Mac Keychain; this helper is our alternative implementation, not an assertion that Apple's page documents a Windows flow. Synthetic round-trip tests are distinct from Apple issuance/Keychain acceptance.

Use the supplied helper/guide ZIP or this branch's `apps/sudoku-mobile` directory; a full local app checkout is NOT needed to prepare keys. Use a private local directory outside Git and outside cloud-synced/shared folders. Save both passwords in your password manager. On Windows, NTFS permissions/private account storage matter; Python's chmod alone does not create a private Windows ACL.

In PowerShell, from the folder containing `scripts`:

```powershell
py -m venv .signing-venv
.\.signing-venv\Scripts\python.exe -m pip install cryptography==46.0.4
$keys = Join-Path $env:LOCALAPPDATA '8zSudoku-Signing'
.\.signing-venv\Scripts\python.exe scripts\ios_signing_windows.py csr --out "$keys" --name "Bojan Dobrečevič"
```

This creates `distribution.csr` and encrypted `distribution-key.pem`. In **Certificates, Identifiers & Profiles → Certificates → +**, select **Apple Distribution**, upload **only** `distribution.csr`, generate and download the issued `.cer`. Save it as `$keys\distribution.cer`. Do not revoke existing certificates merely because issuance reaches an account limit; resolve that with the account owner first.

```powershell
.\.signing-venv\Scripts\python.exe scripts\ios_signing_windows.py pack --key "$keys\distribution-key.pem" --certificate "$keys\distribution.cer" --out "$keys\distribution.p12"
```

The helper asks for the original private-key password and a new P12 password. It rejects a mismatching/expired certificate and never overwrites an existing output. It does not validate Apple's entire trust chain locally; macOS `security` and Xcode perform actual signing validation later.

In the developer portal, **Profiles → + → Distribution → App Store Connect**, select the explicit 8zSudoku App ID and the exact Apple Distribution certificate just issued. Name it `8zSudoku TestFlight`, generate, download and save as `$keys\8zSudoku.mobileprovision`. An ad hoc, enterprise or development profile will be rejected. Save your downloaded API `.p8` in the same private directory.

## 4. GitHub credential approval and protected environment

Open https://github.com/BD-Chess/bd-chessdb/settings/environments and create **`8zsudoku-testflight`**. Under deployment protection rules, enable **Required reviewers**, select **BD-Chess**, and save. As the single owner who also starts the run, leave **Prevent self-review** OFF. Restrict deployment branches/tags to **Selected branches and tags → tag `8zsudoku-testflight-*`**. Prefer disabling administrator bypass where available. Do not choose an unrelated branch pattern or make Apple secrets repository-wide.

Environment setup is a real owner/admin action. The ChatGPT GitHub connector used for this work does not expose environment/secret administration; this guide does not claim those settings have been applied. The helper refuses to store secrets until a required-reviewer rule exists.

Install GitHub CLI from https://cli.github.com/ (or `winget install --id GitHub.cli -e`), reopen PowerShell if needed, then run:

```powershell
gh auth login --hostname github.com --web --git-protocol https
```

Choose/approve your **BD-Chess** account in the browser. This is GitHub's credential approval, separate from Apple enrollment and the `.p8` key. If the organization/account restricts token access, use its approved authorization route; do not disclose a token in chat.

Run the explicit storage command with the downloaded paths and your real identifiers:

```powershell
.\.signing-venv\Scripts\python.exe scripts\ios_signing_windows.py secrets --p12 "$keys\distribution.p12" --profile "$keys\8zSudoku.mobileprovision" --api-key "$keys\AuthKey_YOURKEYID.p8" --team YOURTEAMID --key-id YOURKEYID --issuer YOUR-ISSUER-UUID
```

The helper asks for the P12 password and a literal `STORE` confirmation. Secret values are passed to `gh secret set` via standard input, never process arguments. It disables uploading BEFORE altering credentials, then writes these environment secrets:

| Secret | Value |
|---|---|
| `IOS_DISTRIBUTION_P12_BASE64` | Base64 of the encrypted P12 |
| `IOS_DISTRIBUTION_P12_PASSWORD` | P12 password |
| `IOS_PROVISION_PROFILE_BASE64` | Base64 of the App Store Connect profile |
| `ASC_API_KEY_P8` | Actual PEM text of the downloaded `.p8`, not base64 |
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Team API Issuer ID |

It also sets environment variable `IOS_TEAM_ID` and leaves `IOS_UPLOAD_ENABLED=false`. `IOS_APPROVED_SHA` is intentionally not set by credential installation. On a partial secret-write failure, uploading remains OFF; repair/repeat only after examining the error. Do not upload private signing folders to Drive, email or this public repository.

## 5. Approve and launch the first TestFlight build

First inspect the unsigned verification results for the intended commit and review the app's name/icon/privacy drafts. In the protected environment's **Variables**, set `IOS_APPROVED_SHA` to the exact full 40-character reviewed commit and `IOS_UPLOAD_ENABLED=true` for the authorized upload.

No full clone is required to push the deliberate tag. With your authenticated GitHub CLI, PowerShell can create a fresh lightweight Git ref (this starts the workflow; use only after approval):

```powershell
$sha = 'REPLACE_WITH_REVIEWED_FULL_40_CHARACTER_COMMIT'
$tag = '8zsudoku-testflight-20260925-01'
$body = @{ ref = "refs/tags/$tag"; sha = $sha } | ConvertTo-Json -Compress
$body | gh api --method POST repos/BD-Chess/bd-chessdb/git/refs --input -
```

Use a new tag each time; never delete/move an old release tag to disguise another commit. You can also ask the connected coding session to create the explicitly approved tag. Tag creation is not part of ordinary credential setup.

Go to **Actions → 8zSudoku iOS cloud build → the tag run**. After verification, select **Review deployments**, check `8zsudoku-testflight`, inspect the commit, then **Approve and deploy**. That action authorizes signing and the App Store Connect upload, NOT public release. Change `IOS_UPLOAD_ENABLED` back to `false` afterward as an extra guard.

An upload/network error can leave Apple processing a build even when CI looks unsuccessful. Check App Store Connect before a retry; this pipeline deliberately has no automatic upload retry. The workflow-derived build number changes with run/attempt, but old-run retries after a newer build may still be rejected by Apple's version ordering. Generate a new reviewed tag rather than repeatedly rerunning an old upload.

## 6. Install on the iPhone

After Apple finishes processing, resolve any **Missing Compliance** or agreement warning in App Store Connect using the actual app's behavior. We have not silently set `ITSAppUsesNonExemptEncryption` or answered compliance for you.

Open **Apps → 8zSudoku → TestFlight → Internal Testing → +**. Create a small private group such as `BD`, add your own App Store Connect account, and use **Add Builds** to assign the processed build. For the first build, keep group distribution manual. Install Apple's **TestFlight** app on the iPhone and accept the invitation to install **8zSudoku**. This is an installed iOS application, not a Safari bookmark. The UI remains the shared Capacitor web game inside the iOS app, not a rewrite in SwiftUI.

Check new games, notes/undo, hint/review, offline airplane-mode launch, background/force-quit recovery, Files import/export, safe areas and data deletion on the actual iPhone. Simulator launch alone does not certify these. External testers/public links and App Store submission need separate approval; neither is necessary for this initial internal test. TestFlight builds are time-limited (currently up to 90 days), not permanent App Store releases.

## Costs, evidence and recovery

This repository was verified public. Standard GitHub-hosted macOS runners are free for public repositories; do not substitute a larger paid runner. Artifact storage has separate quotas: this workflow retains only a small screenshot for three days, no caches or IPA archives. Future repository visibility, billing plans or policies can change costs. Apple charges the membership price it shows; enrollment/payment are yours to approve.

Tests are recorded against exact source hashes. The Python tests use synthetic certificates/profiles and local fixtures. They do not prove native Windows execution, Apple certificate issuance, a successful iOS device archive, valid signing credentials, TestFlight processing or App Store approval. A successful verify job establishes only its listed checks. Keep the original PR source/verification history; do not relabel earlier 8/8 Node results as a new run.

Rollback: ordinary branch commits never upload. Set `IOS_UPLOAD_ENABLED=false`, cancel the tag run if still pending, and do not approve its protected environment. Disable the workflow if needed. Revert only this change set on the feature branch; do not reset unrelated commits. Credential compromise requires revocation in the appropriate Apple/GitHub portal, not deleting a log or repository file.

## Primary references checked for this implementation

- Apple enrollment: https://developer.apple.com/help/account/membership/enrolling-in-the-app
- Program enrollment/pricing: https://developer.apple.com/help/account/membership/program-enrollment
- Team API keys/security: https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api
- CSR concept/Apple workflow: https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request
- App Store profile: https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile
- Upload and supported Xcode: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- Internal testing: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- Hosted runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- Environment protection: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- PKCS12 compatibility: https://cryptography.io/en/latest/hazmat/primitives/asymmetric/serialization/
