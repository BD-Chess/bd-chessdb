# BD × AI Lab — MDLxDCC.org & ChessBest.org

This repository is the shared production source for two connected public front doors:

- **[MDLxDCC.org](https://www.mdlxdcc.org/)** — the broader BD × AI Lab ecosystem of research, working tools, experiments, evidence pages, and project history.
- **[ChessBest.org](https://chessbest.org/)** — the chess-analysis application that originally started this repository and has since grown into a much deeper analysis and experimentation environment.

The repository began as a ChessBest codebase. It now also hosts the wider **MDL×DCC / 8Z / AI8 / AIm3** web ecosystem, including multiple applications and research tracks.

---

## MDLxDCC.org

**MDL×DCC** explores a family of search and optimization ideas built around compact descriptions, measured structure, adaptive control, and explicit comparison against baselines.

The site deliberately mixes several kinds of artifacts — working applications, engineering systems, experiments, historical material, and research hypotheses — while keeping their evidence boundaries visible.

### Applications

- **TripOpti** — route and combinatorial optimization experiments.
- **ChessBest** — chess analysis, DCC inspection, Study, simulation, and local engine work.
- **8zSudoku** — interactive Sudoku solving, analysis, and AI/DCC experiments.
- **Flip 4M** — game/search experiments.
- **Crosswords** — crossword tooling and generation work.
- **8z Shield** — protection and access-control tooling.

### Core systems and research

The repository also contains public material for **MDL×DCC, AI8, AIm3 / RHP, TSP research, 8Z and 8Z OS, ToE / Whole-First work, consciousness hypotheses, 8zMaterials, trading research, AMR**, and related BD × AI Lab projects.

The current project map is available directly on **[MDLxDCC.org](https://www.mdlxdcc.org/)**.

---

## ChessBest.org — current chess stack

ChessBest is no longer just a lightweight GUI over ChessDB. The current version is a broader chess-analysis workspace designed to keep **raw engine evidence, alternative lines, DCC measurements, and user study state** visible together.

### Analysis

- **ChessDB + local Stockfish 18 Lite** analysis, including hybrid database/engine fallback.
- **DCC — Dynamic Complexity Controller** analysis of candidate evaluation paths, while keeping raw source scores visible.
- **CDB / SF / DCC comparison** on the current position.
- **Evaluation bar**, candidate badges, move history, and source-aware position analysis.
- **DCC replay** of recorded games and **Review game** navigation for annotated or curated moments.
- Deeper local Stockfish analysis with multiple variations and controlled search settings.

### Study and evidence

- **Study** variation trees with comments and persistent branches.
- Pinned **A/B comparisons** from the same starting position.
- PGN/FEN input plus PGN and JSON export/import paths.
- Evidence capture for source replies, DCC decisions, settings, and reproducible comparisons.
- Benchmark and research tooling that separates synthetic diagnostics, frozen evidence, and deeper-engine follow-up.

### Play, simulation, and tournaments

- Play against the engine or use a local two-player board.
- Simulation policies include **CDB/SF, CDB/SF + DCC, SF, and SF + DCC**.
- Single games, paired duels, and paired round robins.
- Local clocks, pause/resume behavior, position experiments, and recorded decision traces.
- Resumable local tournament state stored in the browser where supported.

### Interface

- Searchable game library and curated Top Picks.
- Responsive desktop, tablet, and phone layouts.
- English / Slovenian interface support.
- Installable PWA behavior: board, saved studies, game library, and local Stockfish can remain available offline; ChessDB, Lichess, and Gemini features require network access.
- Optional Gemini assistant for questions grounded in the current position and available evidence.

Current chess entry points:

- **[ChessBest.org](https://chessbest.org/)**
- **[MDLxDCC.org/chess/](https://www.mdlxdcc.org/chess/)**

---

## Repository map

The repository is intentionally broader than its historical name suggests.

- `public/` — public MDLxDCC.org and ChessBest web applications, research pages, archives, and static assets.
- `public/chess/` — current ChessBest application.
- `public/chess-lab/` — active chess development / research workspace.
- `netlify/functions/` — server-side adapters and protected provider calls used by selected web features.
- `.github/workflows/` — deployment, verification, and operational workflows.
- Additional project-specific directories contain tests, research artifacts, compatibility layers, and archived versions.

Production truth for the public web code is the repository's **`main`** branch.

---

## Run the static site locally

Clone the repository:

```bash
git clone https://github.com/BD-Chess/bd-chessdb.git
cd bd-chessdb
```

For the static pages, one simple option is:

```bash
python -m http.server 8000 -d public
```

Then open:

- `http://localhost:8000/` for MDLxDCC.org
- `http://localhost:8000/chess/` for ChessBest

Some network-backed or serverless features require their configured deployment environment and provider credentials; a plain static server does not reproduce those services.

---

## Research posture

This repository contains both mature working tools and active research. A working implementation, an internal experiment, and a validated scientific claim are not treated as the same thing.

Where the projects make stronger claims, the surrounding material aims to preserve the relevant test conditions, limitations, comparison baselines, provenance, and reproducibility evidence.

---

## Credits

Created and developed by **Bojan Dobrečevič (BD)** with AI collaborators as part of **BD × AI Lab**.

Public sites: **[MDLxDCC.org](https://www.mdlxdcc.org/)** · **[ChessBest.org](https://chessbest.org/)**
