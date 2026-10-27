# OmniCPQ visual B2B guide v18

The existing owner-only guide URL, `/.netlify/functions/omnicpq-documents?file=b2b-vodic-v17.html`, now renders the visual v18 guide. The agent's HTML, its links, its cached shell and its knowledge package remain unchanged. `b2b-vodic-v18.html` is an explicit alias for the same output.

The public repository contains the new layout template under `functions/lib/omnicpq/documents/b2b-vodic-v17.html` and 64 original compressed WebP pictures in the adjacent `slike-v18/webp` directory. PNG masters stay outside this repository. The bundled JSON files reproduce those exact template and picture bytes without runtime disk-path assumptions or new dependencies.

Original service descriptions and evidence are still read from the existing immutable private v17 Blobs release. The template contains 71 hashed byte-range references, including all 58 service descriptions. The renderer verifies the complete private base, each fragment, the template and the reconstructed HTML. A missing or changed private base fails closed. No private text or new private seed is introduced into GitHub by this release.

Both guide names and each allowlisted picture use the existing document function's owner authentication, origin policy, no-store headers and byte hashes. Unlisted paths, PNG files and source JSON are unavailable through that endpoint. The HTML receives fresh CSP script hashes and `X-Document-Version: v18`. The Word and coverage documents retain their existing behavior.

Validation is included in `tests/omnicpq/documents-r3.test.mjs`, which the existing production pipeline already runs. It covers URL compatibility, private reconstruction and corruption, owner/demo/anonymous/cross-site access, GET/HEAD behavior, all picture hashes and the absence of private prose from the public template. Production continues through the existing tested main publication workflow.
