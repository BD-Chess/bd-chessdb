#!/usr/bin/env python3
"""Score and filter Slovenian crossword words.

Step 2 of the crossword pipeline:
- read cw_sl_raw_full.json
- score each word for crossword fitness
- keep only score >= 30
- assign tiers and write cw_sl_scored.json

Target platform: Windows 11, Python 3.12+
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

PROGRESS_EVERY = 10_000

TIER_1_LETTERS = set("AEIONRST")
TIER_2_LETTERS = set("LDVPKMJ")
TIER_3_LETTERS = set("UZBGČ")
TIER_4_LETTERS = set("HŠŽCF")

LETTER_POINTS = {ch: 4 for ch in TIER_1_LETTERS}
LETTER_POINTS.update({ch: 3 for ch in TIER_2_LETTERS})
LETTER_POINTS.update({ch: 2 for ch in TIER_3_LETTERS})
LETTER_POINTS.update({ch: 1 for ch in TIER_4_LETTERS})

VOWELS = set("AEIOU")
TIER_1_2_LETTERS = TIER_1_LETTERS | TIER_2_LETTERS

FOREIGN_ADJ_SUFFIXES = (
    "SKEGA",
    "SKEMU",
    "SKIM",
    "SKI",
    "SKA",
    "SKO",
)

# Spec examples plus a few obviously foreign-looking variants in the same spirit.
RARE_TRIGRAMS = (
    "TST",
    "FTH",
    "GHT",
    "SCH",
    "TCH",
)

# Spec examples plus closely related high-signal Slovene inflection/conjugation endings.
DECLINED_OR_CONJUGATED_SUFFIXES = (
    "SKEGA",
    "SKEMU",
    "SKIM",
    "SKIH",
    "SKIMI",
    "AMA",
    "AMI",
    "EGA",
    "EMU",
    "AJOČ",
    "IRAJOČ",
    "IRANJE",
    "ANJE",
    "ENJE",
    "AH",
    "AM",
    "EM",
    "IM",
    "OM",
    "IH",
    "IMI",
    "JO",
    "MO",
    "VA",
    "TA",
    "TE",
    "LA",
    "LI",
    "LO",
    "LE",
)

# More conservative list for withholding the +5 base-form bonus.
BASE_FORM_BLOCK_SUFFIXES = DECLINED_OR_CONJUGATED_SUFFIXES + FOREIGN_ADJ_SUFFIXES

LEMMAISH_SUFFIXES = (
    "TI",
    "ČI",
    "EC",
    "EK",
    "EN",
    "AN",
    "AR",
    "OR",
    "AL",
    "EL",
    "ICA",
    "INA",
    "OST",
    "NOST",
    "TELJ",
    "NIK",
)


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)



def load_builtin_words(script_dir: Path) -> set[str]:
    """Load BUILTIN_WORDS from cw_build_words.py.

    First try importing the file. If that fails, fall back to a simple text parse.
    """
    path = script_dir / "cw_build_words.py"
    if not path.exists():
        return set()

    try:
        spec = importlib.util.spec_from_file_location("cw_build_words", path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, "iter_builtin_words"):
                return {str(w).strip().upper() for w in module.iter_builtin_words() if str(w).strip()}
            if hasattr(module, "BUILTIN_WORDS"):
                return {token.strip().upper() for token in str(module.BUILTIN_WORDS).split() if token.strip()}
    except Exception as exc:
        eprint(f"[cw] Import fallback for BUILTIN_WORDS failed: {exc}")

    try:
        text = path.read_text(encoding="utf-8")
        match = re.search(r'BUILTIN_WORDS\s*=\s*"""(.*?)"""', text, flags=re.DOTALL)
        if match:
            return {token.strip().upper() for token in match.group(1).split() if token.strip()}
    except Exception as exc:
        eprint(f"[cw] Text fallback for BUILTIN_WORDS failed: {exc}")

    return set()



def load_raw_words(input_path: Path) -> tuple[str, list[dict[str, str]]]:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    lang = str(data.get("lang", "")).strip() or "sl"
    flat: list[dict[str, str]] = []
    for length_key, items in data.get("words", {}).items():
        for item in items:
            word = str(item.get("w", "")).strip().upper()
            hint = str(item.get("h", ""))
            if word:
                flat.append({"w": word, "h": hint})
    return lang, flat



def letter_quality(word: str) -> float:
    score = (sum(LETTER_POINTS.get(ch, 0) for ch in word) / len(word)) * 7.5
    return min(30.0, score)



def vowel_balance(word: str) -> float:
    ratio = sum(ch in VOWELS for ch in word) / len(word)
    if 0.30 <= ratio <= 0.50:
        return 15.0
    if ratio <= 0.0:
        return 0.0
    if ratio < 0.30:
        return max(0.0, 15.0 * (ratio / 0.30))
    if ratio >= 0.70:
        return 0.0
    return max(0.0, 15.0 * ((0.70 - ratio) / 0.20))



def length_fitness(word: str) -> float:
    n = len(word)
    if 3 <= n <= 4:
        return 12.0
    if 5 <= n <= 6:
        return 15.0
    if 7 <= n <= 8:
        return 12.0
    if 9 <= n <= 10:
        return 8.0
    if 11 <= n <= 12:
        return 4.0
    return 2.0



def pattern_diversity(word: str) -> float:
    ratio = len(set(word)) / len(word)
    if ratio < 0.30:
        return 2.0
    if ratio <= 0.50:
        return 2.0 + ((ratio - 0.30) / 0.20) * (8.0 - 2.0)
    return 8.0 + ((ratio - 0.50) / 0.50) * (15.0 - 8.0)



def looks_like_foreign_proper_noun_adjective(word: str) -> bool:
    if not word.endswith(FOREIGN_ADJ_SUFFIXES):
        return False

    if word.startswith(("AA", "AE")):
        return True

    if len(word) >= 3 and word.startswith("AB") and word[2] not in VOWELS:
        return True

    return False



def has_rare_trigram(word: str) -> bool:
    return any(trigram in word for trigram in RARE_TRIGRAMS)



def looks_declined_or_conjugated(word: str, builtin_words: set[str]) -> bool:
    if word in builtin_words:
        return False

    for suffix in DECLINED_OR_CONJUGATED_SUFFIXES:
        if word.endswith(suffix):
            # Short words such as JAMA, MAMA, KITA should not be auto-penalized.
            if len(word) >= 5 or len(suffix) >= 4:
                return True
    return False



def likely_base_form(word: str, builtin_words: set[str]) -> bool:
    if word in builtin_words:
        return True

    if looks_like_foreign_proper_noun_adjective(word):
        return False

    if has_rare_trigram(word):
        return False

    if any(word.endswith(suffix) for suffix in BASE_FORM_BLOCK_SUFFIXES):
        if len(word) >= 5 or any(word.endswith(s) for s in ("SKEGA", "SKEMU", "SKIM", "SKIH", "SKIMI", "AJOČ", "IRAJOČ", "IRANJE", "ANJE", "ENJE", "EGA", "EMU")):
            return False

    if len(word) >= 5 and word.endswith(("TI", "ČI")):
        return True

    if len(word) >= 4 and word.endswith(LEMMAISH_SUFFIXES):
        return True

    if len(word) >= 5 and word[-1] not in VOWELS and word[-1] not in {"J", "M", "V"}:
        return True

    return False



def commonality_adjustment(word: str, builtin_words: set[str]) -> int:
    score = 0

    if word in builtin_words:
        score += 10

    if likely_base_form(word, builtin_words):
        score += 5

    if set(word) <= TIER_1_2_LETTERS:
        score += 3

    if looks_like_foreign_proper_noun_adjective(word):
        score -= 15

    if has_rare_trigram(word):
        score -= 15

    if looks_declined_or_conjugated(word, builtin_words):
        score -= 10

    if len(word) > 10:
        score -= 5

    return score



def score_word(word: str, builtin_words: set[str]) -> int:
    total = (
        letter_quality(word)
        + vowel_balance(word)
        + length_fitness(word)
        + pattern_diversity(word)
        + commonality_adjustment(word, builtin_words)
    )
    total = max(0.0, min(100.0, total))
    return int(round(total))



def tier_for_score(score: int) -> int | None:
    if score >= 65:
        return 1
    if score >= 45:
        return 2
    if score >= 30:
        return 3
    return None



def summarize_top(grouped_words: dict[str, list[dict[str, object]]], length: str) -> list[str]:
    return [str(item["w"]) for item in grouped_words.get(length, [])[:10]]



def summarize_bottom(candidates: Iterable[dict[str, object]]) -> list[str]:
    items = sorted(candidates, key=lambda item: (int(item["s"]), str(item["w"])))
    return [f"{item['w']}:{item['s']}" for item in items[:10]]



def build_payload(lang: str, rows: list[dict[str, object]]) -> dict:
    by_length_counter: Counter[str] = Counter()
    by_tier_counter: Counter[str] = Counter()
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)

    for row in rows:
        length_key = str(len(str(row["w"])))
        by_length_counter[length_key] += 1
        by_tier_counter[str(row["t"])] += 1
        grouped[length_key].append(row)

    for length_key in grouped:
        grouped[length_key].sort(key=lambda item: (-int(item["s"]), str(item["w"])))

    ordered_words = {key: grouped[key] for key in sorted(grouped, key=lambda x: int(x))}
    ordered_lengths = {key: by_length_counter[key] for key in sorted(by_length_counter, key=lambda x: int(x))}
    ordered_tiers = {key: by_tier_counter[key] for key in ("1", "2", "3") if by_tier_counter.get(key, 0)}

    return {
        "lang": lang,
        "source": "scored from cw_sl_raw_full.json",
        "generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "stats": {
            "input_total": 0,  # filled later
            "output_total": len(rows),
            "by_tier": ordered_tiers,
            "by_length": ordered_lengths,
        },
        "words": ordered_words,
    }



def validate_json(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    _ = json.dumps(data, ensure_ascii=False)



def main() -> int:
    parser = argparse.ArgumentParser(description="Score and filter Slovenian crossword words.")
    parser.add_argument("--input", default="cw_sl_raw_full.json", help="Path to raw input JSON.")
    parser.add_argument("--out", default="cw_sl_scored.json", help="Path to output scored JSON.")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    input_path = Path(args.input)
    if not input_path.is_absolute():
        input_path = Path.cwd() / input_path
    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = Path.cwd() / out_path

    builtin_words = load_builtin_words(script_dir)
    eprint(f"[cw] Loaded {len(builtin_words):,} BUILTIN words for bonus scoring")

    lang, flat_words = load_raw_words(input_path)
    total_input = len(flat_words)
    eprint(f"[cw] Loaded {total_input:,} raw words from {input_path.name}")

    kept: list[dict[str, object]] = []
    bottom_band: list[dict[str, object]] = []
    tier_counter: Counter[int] = Counter()
    discard_count = 0

    for idx, item in enumerate(flat_words, start=1):
        word = str(item["w"])
        score = score_word(word, builtin_words)
        tier = tier_for_score(score)

        if tier is None:
            discard_count += 1
        else:
            row = {"w": word, "h": "", "s": score, "t": tier}
            kept.append(row)
            tier_counter[tier] += 1
            if 30 <= score <= 35:
                bottom_band.append(row)

        if idx % PROGRESS_EVERY == 0:
            eprint(f"[cw] Processed {idx:,} / {total_input:,} words")

    payload = build_payload(lang, kept)
    payload["stats"]["input_total"] = total_input

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validate_json(out_path)

    eprint("[cw] Done")
    eprint(f"[cw] Input total   : {total_input:,}")
    eprint(f"[cw] Output total  : {len(kept):,}")
    eprint(f"[cw] Discard total : {discard_count:,}")
    eprint(f"[cw] Per-tier      : {{1: {tier_counter[1]:,}, 2: {tier_counter[2]:,}, 3: {tier_counter[3]:,}}}")
    eprint(f"[cw] Per-length    : {payload['stats']['by_length']}")
    eprint(f"[cw] Top len 3     : {summarize_top(payload['words'], '3')}")
    eprint(f"[cw] Top len 5     : {summarize_top(payload['words'], '5')}")
    eprint(f"[cw] Top len 7     : {summarize_top(payload['words'], '7')}")
    eprint(f"[cw] Bottom kept   : {summarize_bottom(bottom_band)}")
    eprint(f"[cw] Wrote output  : {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
