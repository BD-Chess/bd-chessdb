MDLxDCC root + ChessBest link patch
=====================================

Purpose:
- Make /index.html the MDL×DCC complete research-map homepage.
- Make /chess.html the canonical ChessBest / 8ZC chess page.
- Prevent old chess index.html from overwriting the new homepage.
- Update chess helper pages so their home/back links point to chess.html, not index.html.

Important:
- The original chess.zip contained an old duplicate index.html chess page.
- This package intentionally does NOT include that old chess index.html.
- This package includes the new root index.html homepage instead.

Patched chess files:
- chess.html: canonical/OG/schema now point to /chess.html; full map link points to /.
- 8zc.html: ChessBest header points to chess.html; footer includes ChessBest home and MDL×DCC home.
- 8zc-about.html, 8zc-pgn.html, 8zc-why.html, facts.html, games-info.html: added small top nav to ChessBest home, 8ZC board, and MDL×DCC home.
- index-chess.html: noindex redirect to chess.html.
- i.html: noindex redirect to root homepage.

Upload:
- Unzip this package into the GitHub/Netlify root.
- Let it overwrite root index.html, chess.html, sitemap.xml, robots.txt, llms.txt, llms-full.txt, and chess helper files.
- Do not upload the original chess.zip index.html over the new root homepage.
