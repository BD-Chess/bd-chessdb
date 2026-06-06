# MDLxDCC.org clean LLM maps + CRP hub patch

Date: 2026-06-06

This ZIP is a safe overwrite/deploy patch, not a full website mirror. The file `BD_web_slim2.zip` was not available in the active sandbox, so the package includes only files I could safely update from the provided `/crp/index.html` and the live crawler/root maps.

## Files included

- `crp/index.html` — cleaned Core Research Papers hub. Removed third-party security-gateway injected scripts found in the uploaded file and added `llms-full.txt` footer link.
- `llms.txt` — rebuilt as clean Markdown with one section per heading and canonical uppercase `/BD/` URLs.
- `llms-full.txt` — rebuilt as clean Markdown with one URL per line, status labels, canonical/archive notes, and uppercase `/BD/` URLs.
- `sitemap.xml` — regenerated from the same canonical URL map, using uppercase `/BD/`.
- `site_patch_manifest.json` — hashes and validation notes for this patch.

## Deployment

Unzip this package at the web root of `www.mdlxdcc.org` so these paths overwrite the existing files:

```text
/llms.txt
/llms-full.txt
/sitemap.xml
/crp/index.html
```

## Validation performed

- No lowercase BD URLs remain in the generated map files.
- No third-party security-gateway injected scripts remain in `crp/index.html`.
- `llms.txt` and `llms-full.txt` use line-based Markdown instead of mega-lines.
- `sitemap.xml` parses as XML and contains 260 unique URLs.

## Still not done

Because the full `BD_web_slim2.zip` was not available here, I did not modify root `index.html`, `/BD/index.html`, or any other existing HTML pages. If those files still contain lowercase BD-path links, run a whole-site case-fix pass on the full ZIP.
