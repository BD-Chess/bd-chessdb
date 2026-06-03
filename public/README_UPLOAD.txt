# MDLxDCC Hub Index Reorganization Bundle

Upload the contents of this ZIP into the GitHub/Netlify root of www.MDLxDCC.org.

Folder layout inside this ZIP is already deploy-ready:

- `index.html` → root homepage / complete public map
- `i.html` → compatibility redirect to `/`
- `bd/index.html` → BD portfolio hub
- `crp/index.html` → Core Research Papers hub
- `acp/index.html` → ACP / CCH papers hub
- `index-bd.html`, `index-crp.html`, `index-acp.html`, `index-chess.html`, `index-main.html` → noindex compatibility redirects
- `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` → crawler / LLM discovery files

Design rule now used:

- `/` = complete public map / crawler landing page
- `/bd/` = BD portfolio, practical demos, achievements, AIM³, applied systems
- `/crp/` = canonical Core Research Papers only
- `/acp/` = canonical Absolute Consciousness / CCH papers

This bundle does not include the chess JS/API-token patch. Keep that separate unless you want to merge it manually.
