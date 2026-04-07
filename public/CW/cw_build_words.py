#!/usr/bin/env python3
"""Build raw crossword word lists for multiple languages.

Step 1 of the crossword pipeline:
- download Hunspell dictionary for the target language (if not already local)
- filter for crossword suitability
- emit cw_{lang}_raw.json

Supported: sl, en, de, fr, es, it, pt, hr, nl, sv
Target platform: Windows 11, Python 3.12+
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

MIN_LEN = 3
MAX_LEN = 15

# ═══════════════════════════════════════════════════════════════════
# Per-language configuration
# ═══════════════════════════════════════════════════════════════════

_LIBRE_RAW = "https://raw.githubusercontent.com/LibreOffice/dictionaries/master"

LANG_CONFIG = {
    "sl": {
        "name": "Slovenščina",
        "dict_url": f"{_LIBRE_RAW}/sl_SI/sl_SI.dic",
        "dict_file": "sl_SI.dic",
        "allowed_re": re.compile(r"^[A-ZČŠŽ]+$"),
        "vowels": set("AEIOU"),
        "excluded": {"KURBA", "PIČKA", "FUK", "JEBATI", "JEBEMTI", "DREK"},
    },
    "en": {
        "name": "English",
        "dict_url": f"{_LIBRE_RAW}/en/en_US.dic",
        "dict_file": "en_US.dic",
        "allowed_re": re.compile(r"^[A-Z]+$"),
        "vowels": set("AEIOU"),
        "excluded": {"FUCK", "SHIT", "CUNT", "DICK", "COCK", "ARSE", "BITCH", "SLUT", "NIGGER", "PISS"},
    },
    "de": {
        "name": "Deutsch",
        "dict_url": f"{_LIBRE_RAW}/de/de_DE_frami.dic",
        "dict_file": "de_DE_frami.dic",
        "allowed_re": re.compile(r"^[A-ZÄÖÜẞ]+$"),
        "vowels": set("AEIOUÄÖÜ"),
        "excluded": {"FICKEN", "SCHEI", "ARSCH", "FOTZE", "WICHSER"},
    },
    "fr": {
        "name": "Français",
        "dict_url": f"{_LIBRE_RAW}/fr_FR/fr.dic",
        "dict_file": "fr.dic",
        "allowed_re": re.compile(r"^[A-ZÀÂÆÇÉÈÊËÏÎÔŒÙÛÜŸ]+$"),
        "vowels": set("AEIOUYÀÂÆÉÈÊËÏÎÔŒÙÛÜŸ"),
        "excluded": {"MERDE", "PUTAIN", "CONNARD", "SALAUD", "ENCULER"},
    },
    "es": {
        "name": "Español",
        "dict_url": f"{_LIBRE_RAW}/es/es_ES.dic",
        "dict_file": "es_ES.dic",
        "allowed_re": re.compile(r"^[A-ZÁÉÍÓÚÑÜ]+$"),
        "vowels": set("AEIOUÁÉÍÓÚ"),
        "excluded": {"MIERDA", "PUTA", "JODER", "COÑO", "CABRÓN"},
    },
    "it": {
        "name": "Italiano",
        "dict_url": f"{_LIBRE_RAW}/it_IT/it_IT.dic",
        "dict_file": "it_IT.dic",
        "allowed_re": re.compile(r"^[A-ZÀÈÉÌÍÒÓÙÚ]+$"),
        "vowels": set("AEIOUÀÈÉÌÍÒÓÙÚ"),
        "excluded": {"CAZZO", "MERDA", "STRONZO", "PUTTANA", "MINCHIA"},
    },
    "pt": {
        "name": "Português",
        "dict_url": f"{_LIBRE_RAW}/pt_BR/pt_BR.dic",
        "dict_file": "pt_BR.dic",
        "allowed_re": re.compile(r"^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]+$"),
        "vowels": set("AEIOUÁÀÂÃÉÊÍÓÔÕÚ"),
        "excluded": {"MERDA", "CARALHO", "PORRA", "FODER"},
    },
    "hr": {
        "name": "Hrvatski",
        "dict_url": f"{_LIBRE_RAW}/hr_HR/hr_HR.dic",
        "dict_file": "hr_HR.dic",
        "allowed_re": re.compile(r"^[A-ZČĆĐŠŽ]+$"),
        "vowels": set("AEIOU"),
        "excluded": {"KURAC", "JEBATI", "PIČKA", "SRANJE"},
    },
    "nl": {
        "name": "Nederlands",
        "dict_url": f"{_LIBRE_RAW}/nl_NL/nl_NL.dic",
        "dict_file": "nl_NL.dic",
        "allowed_re": re.compile(r"^[A-Z]+$"),
        "vowels": set("AEIOU"),
        "excluded": {"KONT", "LULL", "HOER"},
    },
    "sv": {
        "name": "Svenska",
        "dict_url": f"{_LIBRE_RAW}/sv_SE/sv_SE.dic",
        "dict_file": "sv_SE.dic",
        "allowed_re": re.compile(r"^[A-ZÅÄÖ]+$"),
        "vowels": set("AEIOUÅÄÖ"),
        "excluded": set(),
    },
}

# Slovenian builtin fallback (other langs rely on Hunspell download)
SL_BUILTIN = """
OKO NOS UHO DAN NOČ LES MIR SOL MED LED ROK PES KOT ROG SIR VRT DOM POT DIM
BOR TIS DOL KOS LET LOV RAK REP ROJ SOK TOK URA VAL VES VIR VOL VRH ZID ZOB
KOŠ MOČ PEČ RIŽ RIS ŽAR LAN OSA SEN GRM LAZ LOG MAK SAJ TAL REZ PAS TOR NIZ
VRV CEP ČAS GAS JAZ KAL KAP LAK MAH MOL NAD PAD RAJ SAM SIT TOP VOZ ZEL DUH
REKA GORA HIŠA OKNO MOST SVET CVET KROG MIZA STOL VODA ZIMA JAMA PIVO RIBA
ŽABA SOVA OREL JELA LIPA BREG GRAD PLES IGRA SLAP OTOK ROSA LUNA DLAN BRAT
MAMA OSEL KOZA MESO KOST ODER KOLO PAST GOST LIST MRAK SLED KMET KLAS TRG
POTOK GOZD POLJE MESTO SONCE OBLAK DOLINA JUTRO VEČER JEZERO PRAG CESTA STEZA
STENA SKALA ROKA NOGA GLAVA OBRAZ JEZIK BRADA PRST KRILO ČOLN LADJA VLAK KLET
SOBA DVOR VRATA TORBA KNJIGA ZVEZDA ISKRA KRONA SNEG TRAVA SENO NJIVA JABOLKO
HRUŠKA SLIVA GROZD KROMPIR GRAH ZELJE ČEBULA KRUH MLEKO MASLO JAJCE JUHA KAVA
OLJE SRCE MORJE MESEC ŠOLA MAČKA MISEL JUNAK KAMEN BREZA JESEN SLIKA OTROK
ŽIVAL PISATI BRATI PETI DELATI VIDETI HODITI STATI SPATI JESTI PITI DATI BITI
ZNATI PRITI KUPITI KUHATI UČITI RASTI DRUŽINA NARAVA POLETJE POMLAD ZDRAVJE
UČENEC SLOVAR DENAR BANKA STREHA SEME PLOD ČLOVEK SREČA STRAH BARVA ZAKON
"""


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def get_config(lang: str) -> dict:
    if lang not in LANG_CONFIG:
        supported = ", ".join(sorted(LANG_CONFIG))
        raise SystemExit(f"Unsupported language '{lang}'. Supported: {supported}")
    return LANG_CONFIG[lang]


def try_read_text(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1250", "latin-1", "iso-8859-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="replace")


def download_dictionary(url: str, target: Path) -> bool:
    eprint(f"[cw] Downloading: {url}")
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            target.write_bytes(resp.read())
        eprint(f"[cw] Saved dictionary: {target.name}")
        return True
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        eprint(f"[cw] Download failed: {exc}")
        return False


def ensure_dictionary(cfg: dict, workdir: Path) -> Path | None:
    path = workdir / cfg["dict_file"]
    if path.exists():
        eprint(f"[cw] Found local dictionary: {path.name}")
        return path
    if download_dictionary(cfg["dict_url"], path):
        return path
    return None


def parse_hunspell(path: Path) -> list[str]:
    eprint(f"[cw] Parsing: {path.name}")
    text = try_read_text(path)
    words = []
    for i, line in enumerate(text.splitlines()):
        line = line.strip()
        if not line or (i == 0 and line.isdigit()):
            continue
        stem = line.split()[0].split("/", 1)[0].strip()
        if stem:
            words.append(stem)
    eprint(f"[cw] Parsed {len(words):,} entries")
    return words


def is_crossword_word(word: str, raw: str, cfg: dict, *, curated: bool = False) -> bool:
    if len(word) < MIN_LEN or len(word) > MAX_LEN:
        return False
    if not cfg["allowed_re"].fullmatch(word):
        return False
    if word in cfg["excluded"]:
        return False
    if not any(ch in cfg["vowels"] for ch in word):
        return False
    # Reject proper nouns from dictionary (start uppercase in raw form)
    if not curated and raw[0:1].isupper() and not raw.isupper():
        return False
    return True


def normalize(candidates: Iterable[str], cfg: dict, *, curated: bool = False) -> set[str]:
    out = set()
    for raw in candidates:
        raw = raw.strip()
        if not raw:
            continue
        word = raw.upper()
        if is_crossword_word(word, raw, cfg, curated=curated):
            out.add(word)
    return out


def build_words(lang: str, workdir: Path) -> tuple[set[str], list[str]]:
    cfg = get_config(lang)
    sources = []
    words: set[str] = set()

    # Hunspell dictionary
    dpath = ensure_dictionary(cfg, workdir)
    if dpath:
        try:
            hw = normalize(parse_hunspell(dpath), cfg)
            if hw:
                words.update(hw)
                sources.append("hunspell")
                eprint(f"[cw] Kept {len(hw):,} crossword-suitable words")
        except Exception as exc:
            eprint(f"[cw] Parse error: {exc}")

    # Builtin fallback (Slovenian only)
    if lang == "sl":
        bw = normalize(SL_BUILTIN.split(), cfg, curated=True)
        words.update(bw)
        sources.append("builtin")
        eprint(f"[cw] Added {len(bw):,} builtin fallback words")

    return words, sources


def to_payload(lang: str, words: set[str], sources: list[str]) -> dict:
    buckets: dict[int, list[str]] = defaultdict(list)
    for w in sorted(words):
        buckets[len(w)].append(w)

    grouped = {}
    by_length = {}
    for length in sorted(buckets):
        key = str(length)
        grouped[key] = [{"w": w, "h": ""} for w in buckets[length]]
        by_length[key] = len(buckets[length])

    return {
        "lang": lang,
        "lang_name": LANG_CONFIG[lang]["name"],
        "source": "+".join(sources) or "none",
        "generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "stats": {"total": sum(by_length.values()), "by_length": by_length},
        "words": grouped,
    }


def write_json(payload: dict, path: Path) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8")
    # Validate round-trip
    json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser(description="Build crossword word list")
    ap.add_argument("--lang", default="sl", help=f"Language: {', '.join(sorted(LANG_CONFIG))}")
    ap.add_argument("--out", default=None, help="Output path (default: cw_{lang}_raw.json)")
    args = ap.parse_args()

    lang = args.lang.lower()
    out = Path(args.out) if args.out else Path(f"cw_{lang}_raw.json")

    eprint(f"[cw] Building word list: {lang} ({LANG_CONFIG.get(lang, {}).get('name', '?')})")
    words, sources = build_words(lang, Path.cwd())

    if not words:
        raise SystemExit("No words collected. Is the dictionary downloadable?")

    payload = to_payload(lang, words, sources)
    write_json(payload, out)

    # Summary
    for length in (3, 5, 7):
        bucket = payload["words"].get(str(length), [])
        sample = ", ".join(x["w"] for x in bucket[:5])
        eprint(f"[cw]   len={length}: {len(bucket)} words  e.g. {sample}")
    eprint(f"[cw] Total: {payload['stats']['total']:,} words → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
