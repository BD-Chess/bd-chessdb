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
The raw precision is retained in the JSON; the existing Trip Editor normalizer
rounds coordinates to six decimal places (roughly a tenth of a metre).

Maps optimization uses great-circle kilometres (or the UI's miles conversion).
It does **not** use the original rounded Euclidean EUC_2D edge weights. Published
benchmark optima must not be compared numerically with this adaptation. Original
benchmarks remain available from the `.tsp` links. Road access has not been verified.

Selecting an entry downloads only that dataset, enables Direct Line and Round Trip,
disables Brute Force, and does not start an optimization or road-matrix request.
The first original node is START. Above 200 points, small markers replace numbered
pins; all nodes remain present. Fast is the suggested first run. Deep is optional;
no extra Deep Air worker starts automatically for direct datasets above 100 nodes.
The road matrix guard remains 100 stops; exhaustive Brute Force remains 16 stops.

Rebuild from original files: `python scripts/build-trip-tsp.py` at repository root.
Validate: `node --test tests/trip-tsp-library.test.mjs tests/trip-new-stops.test.mjs`.
