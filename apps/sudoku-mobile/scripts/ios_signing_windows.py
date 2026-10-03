#!/usr/bin/env python3
"""No-Mac CSR, encrypted signing package and GitHub environment-secret helper.
Install the helper dependency: py -m pip install cryptography==46.0.4
Nothing contacts Apple. Only the explicit 'secrets' command writes to GitHub.
"""
from __future__ import annotations
import argparse
import base64
import datetime as dt
import getpass
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

REPO = "BD-Chess/bd-chessdb"
ENVIRONMENT = "8zsudoku-testflight"


def new_password(label: str) -> bytes:
    value = getpass.getpass(label + " (at least 16 characters): ")
    if len(value) < 16 or value != getpass.getpass("Repeat password: "):
        raise ValueError("Password is too short or does not match")
    return value.encode("utf-8")


def safe_output(directory: Path, names: tuple[str, ...]) -> None:
    directory = directory.expanduser().resolve()
    for parent in (directory, *directory.parents):
        if (parent / ".git").exists():
            raise ValueError("Keep signing material outside a Git checkout")
    if any((directory / name).exists() for name in names):
        raise ValueError("Output already exists; never overwrite an existing signing key")
    directory.mkdir(parents=True, exist_ok=True)


def write_new(path: Path, data: bytes) -> None:
    with path.open("xb") as f:
        f.write(data)
    path.chmod(0o600)  # On Windows, also use a private account directory/NTFS permissions.


def certificate(data: bytes) -> x509.Certificate:
    if data.startswith(b"-----BEGIN"):
        return x509.load_pem_x509_certificate(data)
    return x509.load_der_x509_certificate(data)


def make_p12(key_data: bytes, key_password: bytes, cert_data: bytes, password: bytes) -> bytes:
    key = serialization.load_pem_private_key(key_data, password=key_password)
    cert = certificate(cert_data)
    public = lambda k: k.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    if public(key.public_key()) != public(cert.public_key()):
        raise ValueError("The downloaded certificate does not match this CSR private key")
    now = dt.datetime.now(dt.timezone.utc)
    if not cert.not_valid_before_utc <= now < cert.not_valid_after_utc:
        raise ValueError("Certificate is expired or not yet valid")
    # Compatibility profile documented by cryptography for macOS Keychain import.
    # GitHub environment encryption, not PKCS12 encryption, is the storage boundary.
    encryption = (serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000)
                  .key_cert_algorithm(pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC)
                  .hmac_hash(hashes.SHA1()).build(password))
    return pkcs12.serialize_key_and_certificates(b"8zSudoku Apple Distribution", key, cert, None, encryption)


def install_secrets(args: argparse.Namespace) -> None:
    gh = shutil.which("gh")
    if not gh:
        raise ValueError("Install GitHub CLI, run 'gh auth login', then repeat this command")
    if not re.fullmatch(r"[A-Z0-9]{10}", args.team):
        raise ValueError("Invalid Apple team ID")
    if not re.fullmatch(r"[A-Z0-9]{10}", args.key_id):
        raise ValueError("Invalid App Store Connect Key ID")
    uuid.UUID(args.issuer)
    # Do not silently create an unprotected environment.
    result = subprocess.run([gh, "api", f"repos/{REPO}/environments/{ENVIRONMENT}"],
                            text=True, capture_output=True, check=True)
    environment = json.loads(result.stdout)
    if not any(r.get("type") == "required_reviewers" and r.get("reviewers") for r in environment.get("protection_rules", [])):
        raise ValueError("First configure a required reviewer on the GitHub environment")
    password = getpass.getpass("P12 password: ")
    p12_data = args.p12.read_bytes()
    key, cert, _ = pkcs12.load_key_and_certificates(p12_data, password.encode())
    if key is None or cert is None:
        raise ValueError("P12 does not contain a signing key and certificate")
    api_data = args.api_key.read_bytes()
    api_key = serialization.load_pem_private_key(api_data, password=None)
    if not isinstance(api_key, ec.EllipticCurvePrivateKey) or not isinstance(api_key.curve, ec.SECP256R1):
        raise ValueError("Expected an App Store Connect P-256 private key")
    profile = args.profile.read_bytes()
    if not profile:
        raise ValueError("Empty provisioning profile")
    if input(f"Type STORE to save credentials only to {REPO} / {ENVIRONMENT}: ") != "STORE":
        raise ValueError("Cancelled; no secrets changed")
    # Disable uploads before changing any credentials, even if a subsequent write fails.
    subprocess.run([gh, "variable", "set", "IOS_UPLOAD_ENABLED", "--env", ENVIRONMENT, "--repo", REPO],
                   input=b"false", check=True)
    values = {"IOS_DISTRIBUTION_P12_BASE64": base64.b64encode(p12_data),
              "IOS_DISTRIBUTION_P12_PASSWORD": password.encode(),
              "IOS_PROVISION_PROFILE_BASE64": base64.b64encode(profile),
              "ASC_API_KEY_P8": api_data, "ASC_KEY_ID": args.key_id.encode(), "ASC_ISSUER_ID": args.issuer.encode()}
    for name, value in values.items():
        # stdin, never '--body SECRET' or shell interpolation/process-list arguments.
        subprocess.run([gh, "secret", "set", name, "--env", ENVIRONMENT, "--repo", REPO], input=value, check=True)
    subprocess.run([gh, "variable", "set", "IOS_TEAM_ID", "--env", ENVIRONMENT, "--repo", REPO],
                   input=args.team.encode(), check=True)
    print("Credentials stored. Uploads remain OFF; set exact IOS_APPROVED_SHA and approve a TestFlight run separately.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    csr = commands.add_parser("csr", help="Create an encrypted private key and public CSR")
    csr.add_argument("--out", type=Path, required=True)
    csr.add_argument("--name", required=True, help="Your legal name")
    pack = commands.add_parser("pack", help="Combine the matching downloaded Apple certificate with your private key")
    pack.add_argument("--key", type=Path, required=True)
    pack.add_argument("--certificate", type=Path, required=True)
    pack.add_argument("--out", type=Path, required=True)
    store = commands.add_parser("secrets", help="Explicitly store credentials using your authenticated GitHub CLI")
    for name in ("p12", "profile", "api-key"):
        store.add_argument("--" + name, type=Path, required=True)
    for name in ("team", "key-id", "issuer"):
        store.add_argument("--" + name, required=True)
    args = parser.parse_args()
    if args.command == "csr":
        args.out = args.out.expanduser().resolve()
        safe_output(args.out, ("distribution-key.pem", "distribution.csr"))
        password = new_password("Private-key password")
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        request = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, args.name)])).sign(key, hashes.SHA256())
        write_new(args.out / "distribution-key.pem", key.private_bytes(serialization.Encoding.PEM,
                  serialization.PrivateFormat.PKCS8, serialization.BestAvailableEncryption(password)))
        write_new(args.out / "distribution.csr", request.public_bytes(serialization.Encoding.PEM))
        print("Created distribution.csr and encrypted distribution-key.pem. Upload only the CSR to Apple.")
    elif args.command == "pack":
        args.out = args.out.expanduser().resolve()
        safe_output(args.out.parent, (args.out.name,))
        result = make_p12(args.key.read_bytes(), getpass.getpass("Private-key password: ").encode(),
                          args.certificate.read_bytes(), new_password("New P12 password"))
        write_new(args.out, result)
        print("Encrypted P12 created. Do not upload it to a repository, chat or shared drive.")
    else:
        install_secrets(args)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        # Do not print arbitrary subprocess output, file bytes or credentials.
        print(f"Stopped safely: {type(exc).__name__}. Check inputs and the setup guide; no upload to Apple was attempted.", file=sys.stderr)
        sys.exit(1)
