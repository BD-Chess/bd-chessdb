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
import argparse
import shlex
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--enable-browser-startup', action='store_true',
                    help='Load AI8 view on the next full Chromium start, preserving existing extensions')
args = parser.parse_args()

os.umask(0o077)
source = Path(__file__).resolve().parent
target = Path.home() / ".local/share/ai8-news"
manifest = json.loads((source / "extension/manifest.json").read_text())
digest = hashlib.sha256(base64.b64decode(manifest["key"])).hexdigest()[:32]
extension_id = "".join(chr(ord("a") + int(c, 16)) for c in digest)
stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
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
startup_enabled = False
if args.enable_browser_startup:
    flags = Path.home() / '.config/chromium-flags.conf'
    original = flags.read_text() if flags.exists() else ''
    lines = original.splitlines(keepends=True)
    extension_lines, extensions = [], []
    for index, line in enumerate(lines):
        if line.lstrip().startswith('--load-extension'):
            words = shlex.split(line, comments=True)
            if len(words) != 1 or not words[0].startswith('--load-extension='):
                raise SystemExit('Unrecognized extension flag syntax; startup configuration left unchanged')
            extension_lines.append(index)
            extensions.extend(path for path in words[0].split('=', 1)[1].split(',') if path)
    extensions = list(dict.fromkeys([*extensions, str(target / 'extension')]))
    merged = shlex.quote('--load-extension=' + ','.join(extensions)) + '\n'
    if extension_lines:
        updated = ''.join(merged if i == extension_lines[0] else '' if i in extension_lines else line
                          for i, line in enumerate(lines))
    else:
        updated = original + ('' if not original or original.endswith('\n') else '\n') + merged
    if updated != original:
        backup.mkdir(parents=True, exist_ok=True)
        if flags.exists(): shutil.copy2(flags, backup / flags.name)
        with tempfile.NamedTemporaryFile(mode='w', dir=flags.parent, delete=False) as fp:
            fp.write(updated); temporary = Path(fp.name)
        temporary.replace(flags)
    startup_enabled = True
print(json.dumps({"extensionId": extension_id, "unpackedDirectory": str(target / "extension"),
                  "nativeHostRegistered": True, "browserStartupConfigured": startup_enabled,
                  "browserExtensionEnabled": "on next full Chromium start; current profile not verified" if startup_enabled
                  else "requires Load unpacked in Chromium"}, indent=2))
