#!/bin/bash
# Run from apps/sudoku-mobile after npm ci, build, cap sync ios and npm test.
set -euo pipefail
umask 077
mode="${1:-verify}"
[[ "$mode" == verify || "$mode" == testflight ]] || { echo 'Unknown mode'; exit 2; }
[[ "$(uname -s)" == Darwin ]] || { echo 'Use the macos-26 GitHub runner'; exit 2; }
: "${RUNNER_TEMP:?GitHub-hosted runner required}"
work="$(mktemp -d "$RUNNER_TEMP/8zsudoku-ios.XXXXXX")"
keychain=''
profile_uuid=''
installed_profiles=()
api_key_file=''
simulator=''
cleanup() {
  set +e
  set +u
  if [[ -n "$simulator" ]]; then
    xcrun simctl shutdown "$simulator" >/dev/null 2>&1
    xcrun simctl delete "$simulator" >/dev/null 2>&1
  fi
  if [[ -f "$work/keychains.json" ]]; then
    python3 - "$work/keychains.json" <<'PY'
import json, subprocess, sys
subprocess.run(['security', 'list-keychains', '-d', 'user', '-s', *json.load(open(sys.argv[1]))], check=False)
PY
  fi
  [[ -z "$keychain" ]] || security delete-keychain "$keychain" >/dev/null 2>&1
  for installed in "${installed_profiles[@]}"; do rm -f "$installed"; done
  [[ -z "$api_key_file" ]] || rm -f "$api_key_file"
  rm -rf "$work"
}
trap cleanup EXIT
xcodebuild -version
xcodebuild -version | awk 'NR==1 {if ($2+0 < 26) exit 1}'
xcrun --sdk iphoneos --show-sdk-version | awk '{if ($1+0 < 26) exit 1}'
project='ios/App/App.xcodeproj'
if [[ "$mode" == verify ]]; then
  xcodebuild -project "$project" -scheme App -resolvePackageDependencies
  xcodebuild -project "$project" -scheme App -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$work/derived" \
    CODE_SIGNING_ALLOWED=NO build
  app="$work/derived/Build/Products/Debug-iphonesimulator/App.app"
  python3 scripts/ios_ci.py verify-bundle --app "$app"
  # A real simulator launch check, not a claim of gameplay or physical-device acceptance.
  xcrun simctl list --json > "$work/simulators.json"
  python3 - "$work/simulators.json" > "$work/simulator-choice.txt" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))
r = [r for r in s['runtimes'] if r.get('isAvailable') and '.iOS-' in r['identifier']]
r.sort(key=lambda r: tuple(map(int, r['version'].split('.'))), reverse=True)
d = [d for d in s['devicetypes'] if 'iPhone' in d['name']]
d.sort(key=lambda d: (d['name'] != 'iPhone 16 Pro', d['name']))
for runtime in r:
    major = int(runtime['version'].split('.')[0]) << 16
    for device in d:
        if device.get('minRuntimeVersion', 0) <= major <= device.get('maxRuntimeVersion', 0xffffffff):
            print(device['identifier']); print(runtime['identifier']); sys.exit(0)
raise SystemExit('No compatible iPhone simulator runtime')
PY
  device="$(sed -n '1p' "$work/simulator-choice.txt")"
  runtime="$(sed -n '2p' "$work/simulator-choice.txt")"
  simulator="$(xcrun simctl create 8zSudoku-CI "$device" "$runtime")"
  xcrun simctl boot "$simulator"
  xcrun simctl bootstatus "$simulator" -b
  xcrun simctl install "$simulator" "$app"
  xcrun simctl launch "$simulator" org.chessbest.eightzsudoku
  sleep 5
  mkdir -p "$RUNNER_TEMP/8zsudoku-evidence"
  xcrun simctl io "$simulator" screenshot "$RUNNER_TEMP/8zsudoku-evidence/simulator.png"
  xcrun simctl terminate "$simulator" org.chessbest.eightzsudoku
  xcrun simctl launch "$simulator" org.chessbest.eightzsudoku
  echo 'PASS: iOS Simulator compiled, bundled assets matched, app installed/launched/relaunched.'
  echo 'NOT TESTED: physical iPhone, native Share, airplane-mode gameplay, signed distribution.'
  exit 0
fi
python3 scripts/ios_ci.py guard
# Secrets exist only for this step; never enable shell tracing or upload this directory.
python3 - "$work" <<'PY'
import base64, os, pathlib, re, sys, uuid
p = pathlib.Path(sys.argv[1])
for name in ('IOS_DISTRIBUTION_P12_BASE64','IOS_DISTRIBUTION_P12_PASSWORD','IOS_PROVISION_PROFILE_BASE64','ASC_API_KEY_P8','ASC_KEY_ID','ASC_ISSUER_ID'):
    if not os.environ.get(name): raise SystemExit('Missing required signing secret: ' + name)
if not re.fullmatch(r'[A-Z0-9]{10}', os.environ['ASC_KEY_ID']): raise SystemExit('Invalid API Key ID')
uuid.UUID(os.environ['ASC_ISSUER_ID'])
for secret, name in [('IOS_DISTRIBUTION_P12_BASE64','distribution.p12'),('IOS_PROVISION_PROFILE_BASE64','profile.mobileprovision')]:
    (p/name).write_bytes(base64.b64decode(os.environ[secret], validate=True))
key = os.environ['ASC_API_KEY_P8'].strip()
if not key.startswith('-----BEGIN PRIVATE KEY-----') or not key.endswith('-----END PRIVATE KEY-----'):
    raise SystemExit('Invalid API private-key PEM format')
(p/'api.p8').write_text(key + '\n')
PY
security cms -D -i "$work/profile.mobileprovision" > "$work/profile.plist"
python3 scripts/ios_ci.py prepare --temp "$work"
profile_uuid="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["uuid"])' "$work/identity.json")"
fingerprint="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["fingerprint"])' "$work/identity.json")"
python3 - "$work/keychains.json" <<'PY'
import json, shlex, subprocess, sys
chains = shlex.split(subprocess.check_output(['security','list-keychains','-d','user'], text=True))
json.dump(chains, open(sys.argv[1], 'w'))
PY
keychain="$work/signing.keychain-db"
keychain_password="$(openssl rand -hex 32)"
security create-keychain -p "$keychain_password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$keychain_password" "$keychain"
security import "$work/distribution.p12" -P "$IOS_DISTRIBUTION_P12_PASSWORD" -t cert -f pkcs12 -k "$keychain" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keychain_password" "$keychain" >/dev/null
python3 - "$work/keychains.json" "$keychain" "$fingerprint" <<'PY'
import json, subprocess, sys
subprocess.run(['security','list-keychains','-d','user','-s',sys.argv[2],*json.load(open(sys.argv[1]))],check=True)
identities = subprocess.check_output(['security','find-identity','-v','-p','codesigning',sys.argv[2]],text=True)
if sys.argv[3] not in identities.upper(): raise SystemExit('Imported certificate does not match the profile or is not valid for signing')
PY
for profiles in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$profiles"
  [[ ! -e "$profiles/$profile_uuid.mobileprovision" ]] || { echo 'Refusing to overwrite an existing profile'; exit 1; }
  cp "$work/profile.mobileprovision" "$profiles/$profile_uuid.mobileprovision"
  installed_profiles+=("$profiles/$profile_uuid.mobileprovision")
done
xcodebuild -project "$project" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$work/8zSudoku.xcarchive" archive
python3 scripts/ios_ci.py verify-bundle --app "$work/8zSudoku.xcarchive/Products/Applications/App.app"
xcodebuild -exportArchive -archivePath "$work/8zSudoku.xcarchive" \
  -exportPath "$work/export" -exportOptionsPlist "$work/ExportOptions.plist"
ipa="$(find "$work/export" -maxdepth 1 -name '*.ipa' -type f)"
[[ -n "$ipa" && "$ipa" != *$'\n'* ]] || { echo 'Expected exactly one IPA'; exit 1; }
unzip -q "$ipa" -d "$work/ipa"
python3 scripts/ios_ci.py verify-bundle --app "$work/ipa/Payload/App.app"
codesign --verify --deep --strict "$work/ipa/Payload/App.app"
mkdir -p "$HOME/.appstoreconnect/private_keys"
api_key_file="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
[[ ! -e "$api_key_file" ]] || { api_key_file=''; echo 'Refusing to overwrite API key'; exit 1; }
cp "$work/api.p8" "$api_key_file"
# Validate, then one upload attempt. Do not automatically retry an ambiguous upload.
xcrun altool --validate-app --type ios --file "$ipa" --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
xcrun altool --upload-app --type ios --file "$ipa" --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
shasum -a 256 "$ipa" | awk '{print "Uploaded IPA SHA-256: " $1}'
python3 - "$work/identity.json" <<'PY'
import json, os, sys
print('App: 8zSudoku; commit: ' + os.environ['GITHUB_SHA'] + '; build: ' + json.load(open(sys.argv[1]))['build_number'])
print('Upload accepted by altool. Apple processing/compliance/TestFlight availability are separate pending gates.')
PY
