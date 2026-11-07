#!/usr/bin/python3
"""Install the reviewed local host and unpacked Chromium addon, without browser restart."""
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
source = Path(__file__).resolve().parent
target = Path.home() / ".local/share/ai8-news"
manifest = json.loads((source / "extension/manifest.json").read_text())
digest = hashlib.sha256(base64.b64decode(manifest["key"])).hexdigest()[:32]
extension_id = "".join(chr(ord("a") + int(c, 16)) for c in digest)
stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup = target / "backups" / stamp
target.mkdir(parents=True, exist_ok=True)
for sub in ("native", "extension"):
    dest = target / sub
    if dest.exists():
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copytree(dest, backup / sub)
    shutil.copytree(source / sub, dest, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("__pycache__", "test_*.py", "*.test.*"))
native = target / "native/host.py"
native.chmod(0o700)
config = {"extensionId": extension_id,
          "codex": subprocess.check_output(["mise", "which", "codex"], text=True).strip(),
          "claude": subprocess.check_output(["mise", "which", "claude"], text=True).strip(),
          "stateDir": str(target / "private"), "timeoutSeconds": 180}
(native.parent / "local-config.json").write_text(json.dumps(config, indent=2) + "\n")
hosts = Path.home() / ".config/chromium/NativeMessagingHosts"
hosts.mkdir(parents=True, exist_ok=True)
registration = hosts / "org.ai8.news.json"
if registration.exists():
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(registration, backup / registration.name)
registration.write_text(json.dumps({"name": "org.ai8.news", "description": "AI8 view — Codex + Claude",
    "path": str(native), "type": "stdio", "allowed_origins": [f"chrome-extension://{extension_id}/"]}, indent=2) + "\n")
print(json.dumps({"extensionId": extension_id, "unpackedDirectory": str(target / "extension"),
                  "nativeHostRegistered": True, "browserExtensionEnabled": "requires Load unpacked in Chromium"}, indent=2))
