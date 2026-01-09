ChessBest Trip Optimizer (static site)

Deploy:
1) Unzip this bundle.
2) Upload the contents of the folder to:
   https://chessbest.org/trip/
   so that https://chessbest.org/trip/index.html exists.

Files:
- index.html  (main page)
- style.css   (dark mode UI)
- app.js      (UI logic)
- worker.js   (solver runs in a Web Worker)

Notes:
- The right pane tries to embed Google Maps in an iframe. Google may block embedding.
  If blank, use the generated route links (Open in new tab).
- Optimization works best with coordinates: "Name | lat,lon".
- Balanced profile runs multiple deterministic starts + deeper 2-opt.

No external libraries, no CDN.
