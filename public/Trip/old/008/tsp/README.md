# National TSP collection — Google Maps adaptation

This is the complete nine-file collection supplied in BD’s `tsplib_folder.zip`,
not all datasets published by TSPLIB or the National TSP project.
Source: https://www.math.uwaterloo.ca/tsp/world/countries.html

| Dataset | Area | Nodes | Latitude sign | Longitude sign |
|---|---|---:|:---:|:---:|
| wi29 | Western Sahara | 29 | + | − |
| dj38 | Djibouti | 38 | + | + |
| qa194 | Qatar | 194 | + | + |
| uy734 | Uruguay | 734 | − | − |
| zi929 | Zimbabwe | 929 | − | + |
| lu980 | Luxembourg | 980 | + | + |
| rw1621 | Rwanda | 1621 | − | + |
| mu1979 | Oman | 1979 | + | + |
| nu3496 | Nicaragua | 3496 | + | − |

Total: **10,000 nodes**. The original `.tsp` files are unchanged and individually
hashed in `../tsp-catalog.js`. JSON files preserve every node ID and coincident
location. Labels identify dataset and node number; they do not invent town names.

These nine files encode absolute decimal degrees multiplied by 1000. The adapter
divides by 1000 and restores each known hemisphere as listed above. This mapping
is specific to these files: arbitrary EUC_2D coordinates cannot be assumed to be GPS.
The raw precision is retained in the JSON and TSP editor rows.

Selecting a collection enables Direct Line, Planar distances (TSP) and Round Trip.
It does not start a calculation. Map coordinates remain geographic display data.
Planar optimization loads the original .tsp bytes, verifies their SHA-256, and uses
`floor(hypot(x1-x2,y1-y2)+0.5)` for each edge. Values are original EUC_2D units,
never kilometres or miles. Disabling Planar restores great-circle kilometres.
Ordinary trips retain the existing road/great-circle behaviour.

`../tsp-optima.json` records all nine proven optima, count, original SHA-256 and
sources (University of Waterloo National TSP summary, checked 2026-09-13).
A returned complete Hamiltonian cycle is independently checked against the
original nodes and its score recomputed before "Known optimum reached" is shown.
Open/partial/edited inputs and other metrics cannot inherit that proof. Other
complete EUC_2D results show the absolute and percentage gap to the reference.
Known optimum matching does not mean every heuristic run finds an optimum.

Duplicate locations keep distinct node IDs. Original files remain unchanged.
The first node is START. Road access is unverified. Above 200 points, small markers
replace numbered pins. No extra Deep Air search runs in Planar mode. Road matrices
support up to 100 stops; manually selected Brute Force supports up to 20 including
START, with exact BigInt counts and JSON-compatible in-tab pause/resume state.

Rebuild mapped JSON from originals: `python scripts/build-trip-tsp.py`.
The separate optimum metadata must keep matching the original checksums.
Validate with the focused `tests/trip-*.test.mjs` suite.
