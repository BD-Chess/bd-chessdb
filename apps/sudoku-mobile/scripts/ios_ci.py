#!/usr/bin/env python3
"""Small, stdlib-only signing guards. Never print a profile or a secret."""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import sys

BUNDLE = "org.chessbest.eightzsudoku"
REPO = "BD-Chess/bd-chessdb"
RELEASE_ID = "504EC3181FED79650016851F"


def approval(env: dict[str, str]) -> None:
    """Environment protection is configured by BD; this is an additional gate."""
    if env.get("GITHUB_REPOSITORY") != REPO or env.get("GITHUB_EVENT_NAME") != "push":
        raise ValueError("TestFlight requires a tag push in the original repository")
    if not re.fullmatch(r"refs/tags/8zsudoku-testflight-[A-Za-z0-9._-]+", env.get("GITHUB_REF", "")):
        raise ValueError("Not an explicit 8zSudoku TestFlight tag")
    sha = env.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha) or env.get("IOS_APPROVED_SHA") != sha:
        raise ValueError("IOS_APPROVED_SHA must match this exact full commit SHA")
    if env.get("IOS_UPLOAD_ENABLED") != "true":
        raise ValueError("IOS_UPLOAD_ENABLED is not true; nothing will be signed or uploaded")
    if not re.fullmatch(r"[A-Z0-9]{10}", env.get("IOS_TEAM_ID", "")):
        raise ValueError("IOS_TEAM_ID must be the 10-character Apple team identifier")


def build_number(run: int, attempt: int) -> str:
    # Apple's numeric 4.2.2 component limits; retries get distinct third components.
    if not 1 <= run <= 999899 or not 1 <= attempt <= 99:
        raise ValueError("Run/attempt outside the declared CFBundleVersion range")
    return f"{1 + run // 100}.{run % 100}.{attempt}"


def profile_info(profile: dict, team: str, now: dt.datetime | None = None) -> tuple[str, str]:
    if not re.fullmatch(r"[A-Z0-9]{10}", team):
        raise ValueError("Invalid Apple team ID")
    expiry = profile.get("ExpirationDate")
    now = now or dt.datetime.now(dt.timezone.utc)
    if not isinstance(expiry, dt.datetime):
        raise ValueError("Profile has no valid expiry")
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=dt.timezone.utc)
    if expiry <= now:
        raise ValueError("Provisioning profile expired")
    ent = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [team] or ent.get("com.apple.developer.team-identifier") != team:
        raise ValueError("Provisioning profile belongs to another team")
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    if len(prefixes) != 1 or not re.fullmatch(r"[A-Z0-9]{10}", prefixes[0]):
        raise ValueError("Invalid App ID prefix")
    if ent.get("application-identifier") != f"{prefixes[0]}.{BUNDLE}":
        raise ValueError("Wrong app identifier or wildcard profile")
    if ent.get("get-task-allow") is not False or ent.get("beta-reports-active") is not True:
        raise ValueError("Not an App Store Connect distribution profile")
    if "ProvisionedDevices" in profile or "ProvisionsAllDevices" in profile:
        raise ValueError("Development/ad hoc/enterprise profiles are not accepted")
    certs = profile.get("DeveloperCertificates", [])
    if len(certs) != 1 or not isinstance(certs[0], bytes) or not certs[0]:
        raise ValueError("Expected exactly one distribution certificate")
    uid = profile.get("UUID", "")
    if not re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", uid):
        raise ValueError("Invalid provisioning profile UUID")
    # SHA-1 here is the Apple signing identity selector, not a security claim.
    return uid, hashlib.sha1(certs[0]).hexdigest().upper()


def patch_release(text: str, team: str, uid: str, fingerprint: str, number: str) -> str:
    """Patch only App's Release settings in the disposable CI checkout."""
    if not re.fullmatch(r"[A-Z0-9]{10}", team):
        raise ValueError("Invalid team")
    if not re.fullmatch(r"[0-9A-Fa-f-]{36}", uid) or not re.fullmatch(r"[0-9A-F]{40}", fingerprint):
        raise ValueError("Invalid signing identity")
    if not re.fullmatch(r"[1-9][0-9]{0,3}\.[0-9]{1,2}\.[0-9]{1,2}", number):
        raise ValueError("Invalid build number")
    pattern = re.compile(r"(" + RELEASE_ID + r" /\* Release \*/ = \{\s*isa = XCBuildConfiguration;\s*buildSettings = \{)(.*?)(\n\s*\};\s*name = Release;)", re.S)
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise ValueError("App Release configuration changed; review before signing")
    match = matches[0]
    body = match.group(2)
    if f"PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE};" not in body:
        raise ValueError("Unexpected release bundle ID")
    values = {"CODE_SIGN_STYLE": "Manual", "DEVELOPMENT_TEAM": team,
              "CODE_SIGN_IDENTITY": f'"{fingerprint}"', "PROVISIONING_PROFILE_SPECIFIER": f'"{uid}"',
              "CURRENT_PROJECT_VERSION": number}
    for key, value in values.items():
        p = re.compile(r"(?m)^(\s*)" + key + r" = [^;]*;")
        count = len(p.findall(body))
        if count > 1:
            raise ValueError(f"Duplicate {key}")
        if count:
            body = p.sub(lambda m: m.group(1) + key + " = " + value + ";", body)
        else:
            body += f"\n\t\t\t\t{key} = {value};"
    return text[:match.start(2)] + body + text[match.end(2):]


def export_options(team: str, uid: str, fingerprint: str) -> dict:
    return {"method": "app-store-connect", "destination": "export", "signingStyle": "manual",
            "teamID": team, "signingCertificate": fingerprint, "provisioningProfiles": {BUNDLE: uid},
            "manageAppVersionAndBuildNumber": False, "stripSwiftSymbols": True, "uploadSymbols": True}


def verify_bundle(app: Path, web: Path) -> None:
    with (app / "Info.plist").open("rb") as f:
        info = plistlib.load(f)
    if info.get("CFBundleIdentifier") != BUNDLE or info.get("CFBundleDisplayName") != "8zSudoku":
        raise ValueError("Built app identity mismatch")
    for name in ("index.html", "bridge.js"):
        if (web / name).read_bytes() != (app / "public" / name).read_bytes():
            raise ValueError(f"Bundled asset mismatch: {name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["guard", "prepare", "verify-bundle"])
    parser.add_argument("--temp", type=Path)
    parser.add_argument("--app", type=Path)
    args = parser.parse_args()
    if args.command == "guard":
        approval(dict(os.environ))
    elif args.command == "prepare":
        approval(dict(os.environ))
        if args.temp is None:
            parser.error("--temp required")
        with (args.temp / "profile.plist").open("rb") as f:
            profile = plistlib.load(f)
        team = os.environ["IOS_TEAM_ID"]
        uid, fingerprint = profile_info(profile, team)
        number = build_number(int(os.environ["GITHUB_RUN_NUMBER"]), int(os.environ["GITHUB_RUN_ATTEMPT"]))
        target = Path("ios/App/App.xcodeproj/project.pbxproj")
        target.write_text(patch_release(target.read_text(), team, uid, fingerprint, number))
        with (args.temp / "ExportOptions.plist").open("wb") as f:
            plistlib.dump(export_options(team, uid, fingerprint), f)
        (args.temp / "identity.json").write_text(json.dumps({"uuid": uid, "fingerprint": fingerprint, "build_number": number}))
    else:
        if args.app is None:
            parser.error("--app required")
        verify_bundle(args.app, Path("web"))
    print(f"ios_ci {args.command}: PASS")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, plistlib.InvalidFileException) as exc:
        print(f"iOS preflight failed: {exc}", file=sys.stderr)
        sys.exit(1)
