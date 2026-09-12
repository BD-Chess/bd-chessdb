"""Wake Lab v2 codec. Passwords only via environment/in-memory; never argv/logs.

No networking or execution of journal content. AES-256-GCM plus PBKDF2-SHA256.
The GitHub branch commit is the atomic journal+index publication boundary.
"""
from __future__ import annotations
import base64
import hashlib
import json
import os
from typing import Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(text: str) -> bytes:
    return base64.b64decode(text, validate=True)


def seal(value: Any, key: bytes, aad: str) -> dict:
    nonce = os.urandom(12)
    cipher = AESGCM(key).encrypt(nonce, canonical(value), aad.encode("utf-8"))
    return {"format": "WL-ENC-2", "iv": b64(nonce), "cipher": b64(cipher),
            "sha256": sha256(cipher)}


def open_box(box: dict, key: bytes, aad: str) -> Any:
    if box.get("format") != "WL-ENC-2":
        raise ValueError("unsupported encrypted format")
    data = unb64(box["cipher"])
    if sha256(data) != box["sha256"]:
        raise ValueError("cipher hash mismatch")
    plain = AESGCM(key).decrypt(unb64(box["iv"]), data, aad.encode("utf-8"))
    return json.loads(plain)


def derive(password: str, kdf: dict) -> bytes:
    count = kdf["iterations"]
    if kdf.get("name") != "PBKDF2-SHA256" or not isinstance(count, int) or not 600000 <= count <= 2000000:
        raise ValueError("unsupported KDF")
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                     salt=unb64(kdf["salt"]), iterations=count).derive(password.encode("utf-8"))


def create_vault(password: str, vault_id: str, control_token: str) -> tuple[dict, bytes]:
    key = os.urandom(32)
    kdf = {"name": "PBKDF2-SHA256", "iterations": 600000, "salt": b64(os.urandom(24))}
    vault = {"format": "WL-VAULT-2", "vault_id": vault_id, "kdf": kdf}
    vault["wrap"] = seal({"key": b64(key)}, derive(password, kdf), "WL:wrap:" + vault_id)
    vault["control"] = seal({"token": control_token}, key, "WL:control:" + vault_id)
    return vault, key


def unlock(password: str, vault: dict) -> bytes:
    if vault.get("format") != "WL-VAULT-2":
        raise ValueError("unsupported vault")
    value = open_box(vault["wrap"], derive(password, vault["kdf"]), "WL:wrap:" + vault["vault_id"])
    key = unb64(value["key"])
    if len(key) != 32:
        raise ValueError("invalid master key")
    return key


def validate_event(event: dict, parent: dict | None = None) -> None:
    if event.get("schema") != "wl.event.v2" or event.get("run_id") != "WL-RHP11-20260912":
        raise ValueError("wrong journal identity")
    if type(event.get("seq")) is not int or event["seq"] < 1 or event.get("event_id") != f"e{event['seq']:06d}":
        raise ValueError("invalid event sequence")
    if event.get("author_id") not in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]:
        raise ValueError("unregistered author")
    if not isinstance(event.get("body"), str) or not 1 <= len(event["body"]) <= 24000:
        raise ValueError("invalid body")
    if parent:
        if event["seq"] != parent["seq"] + 1 or event.get("parent_event_id") != parent["event_id"] or event.get("parent_sha256") != sha256(canonical(parent)):
            raise ValueError("broken parent chain")
    elif event["seq"] == 1 and (event.get("parent_event_id") is not None or event.get("parent_sha256") is not None):
        raise ValueError("invalid root")


def validate_state(state: dict) -> None:
    if state.get("schema") != "wl.state.v2" or state.get("run_id") != "WL-RHP11-20260912":
        raise ValueError("wrong state")
    if sorted(m["id"] for m in state["members"]) != [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]:
        raise ValueError("invalid roster")
    for n, ref in enumerate(state["entries"], 1):
        if ref["seq"] != n or ref["event_id"] != f"e{n:06d}" or ref["path"] != f"data/entries/e{n:06d}.enc.json":
            raise ValueError("invalid entry index")
    if state["next_author_id"] not in [m["id"] for m in state["members"]]:
        raise ValueError("invalid next author")


if __name__ == "__main__":
    raise SystemExit("Import this verified codec; use a private in-memory password. No CLI secrets.")
