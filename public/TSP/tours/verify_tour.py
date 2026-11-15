#!/usr/bin/env python3
"""Check a TSPLIB tour against a TSPLIB instance with EUC_2D distances: every city exactly once, and the length.

    python3 verify_tour.py <instance.tsp[.gz]> <tour.tour[.gz]>

It prints »valid tour: <n> cities, each once; length <L>« or says what is wrong. The length uses the TSPLIB
rounding of each edge, nint(sqrt(dx² + dy²)), as Concorde and LKH do. Python 3 only, no other packages.
BD × AI Lab, https://www.mdlxdcc.org/tsp/8ztsp/#downloads
"""
import gzip
import math
import sys


def read(path, section):
    """The header fields and the words of the section that starts with `section`, up to -1 or EOF."""
    opener = gzip.open if path.endswith(".gz") else open
    head, words = {}, []
    with opener(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.strip().upper().startswith(section):
                break
            key, _, value = line.partition(":")
            head[key.strip().upper()] = value.strip()
        else:
            sys.exit(f"{path}: no {section}")
        for line in f:
            for w in line.split():
                if w in ("-1", "EOF"):
                    return head, words
                words.append(w)
    return head, words


if len(sys.argv) != 3:
    sys.exit(__doc__)
instance, tourfile = sys.argv[1], sys.argv[2]
head, words = read(instance, "NODE_COORD_SECTION")
if head.get("EDGE_WEIGHT_TYPE", "EUC_2D") != "EUC_2D":
    sys.exit(f"{instance}: EDGE_WEIGHT_TYPE {head['EDGE_WEIGHT_TYPE']}; this checker knows only EUC_2D")
n = int(head["DIMENSION"])
x, y = [None] * (n + 1), [None] * (n + 1)
for i in range(0, len(words) - 2, 3):
    c = int(words[i])
    if not 1 <= c <= n or x[c] is not None:
        sys.exit(f"{instance}: city number {c} is outside 1..{n} or given twice")
    x[c], y[c] = float(words[i + 1]), float(words[i + 2])
if len(words) != 3 * n or None in x[1:]:
    sys.exit(f"{instance}: expected {n} cities with coordinates")
_, words = read(tourfile, "TOUR_SECTION")
tour = [int(w) for w in words]
seen = bytearray(n + 1)
for c in tour:
    if not 1 <= c <= n or seen[c]:
        sys.exit(f"NOT a tour: city {c} is outside 1..{n} or visited twice")
    seen[c] = 1
if len(tour) != n:
    sys.exit(f"NOT a tour: {len(tour)} of {n} cities")
length = 0
for a, b in zip(tour, tour[1:] + tour[:1]):
    dx, dy = x[a] - x[b], y[a] - y[b]
    length += int(math.sqrt(dx * dx + dy * dy) + 0.5)
print(f"valid tour: {n} cities, each once; length {length}")
