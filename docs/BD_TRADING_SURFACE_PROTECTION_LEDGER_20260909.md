# BD Trading Surface Protection Ledger — 2026-09-09

## Purpose

This is a security/review ledger for the public Trading surface. It records
which HTML pages were moved into the standalone **Trading password-only** 8Z
Shield namespace. It deliberately contains no strategy parameters, source
excerpts, credentials, or protected plaintext.

## Access boundary

- Namespace: `8z-shield:bd-trading:password-only:v1`
- Scope: same-origin browser session storage only
- Credential model: one Trading-only passphrase; no email collection or email
  gate
- Isolation: separate from the MDLxDCC site-wide email Shield namespace
- Before unlock: ciphertext only; after a legitimate unlock the browser may
  display the material. This is access protection, not DRM.

## Surface inventory

| Page | Role | Shield state | Runtime state | Public landing link |
| --- | --- | --- | --- | --- |
| `BD_Trading_Research_Atlas.html` | Bilingual research atlas | Existing five section-level ciphertext blocks, now sharing the Trading session record | Active after Trading unlock | Yes |
| `private-trading/BD_trading_2026.html` | Trading research/evidence page | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/BD_HSR_PiX_v1_3c_FINAL_ANALYSIS_20260621.html` | HSR/PiX analysis | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/BDTS.html` | Dual-book research protocol | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/BBSH.html` | BB Surfing Hedge protocol/calculator | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/BD_HSR_PiX_v1_3c_SOL_MANUAL_PROTOCOLS.html` | HSR/PiX protocols | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/BD_Hedge_Separation_PiX_Strategy_Explainer.html` | HSR/PiX explainer | Full historic body re-encrypted as one 8Z block | Active after Trading unlock | Yes |
| `private-trading/SM_trader.html` | Public-data / virtual-money browser paper interface | Full historic body re-encrypted as one 8Z block | **Engine migration hold** | Yes, as protected archive |
| `private-trading/ZZ_trader.html` | Public-feed / virtual-money browser paper interface | Full historic body re-encrypted as one 8Z block | **Engine migration hold** | Yes, as protected archive |
| `private-trading/DCC_trader.html` | Virtual-balance browser research interface | Full historic body re-encrypted as one 8Z block | **Engine migration hold** | Yes, as protected archive |
| `BD_Trading_Hub.html` | Trading landing/index | Public navigation only; no protected strategy body | Public/noindex | Canonical Trading hub |

## Historic browser-engine hold

SM, ZZ, and DCC were found as browser paper-research interfaces rather than
real-money execution pages. Their historic inner engines were already wrapped
in a separate legacy ciphertext format. The new Trading passphrase does not
decrypt that older inner layer, and no old credential or global email
credential was used to bypass it.

To preserve the one-password-only requirement, the release leaves those inner
engines non-executing after the outer Trading unlock. They can be migrated only
from an approved original plaintext source or through a one-time local
re-encryption with the explicitly approved historic source credential. Until
then, the landing marks them as protected archives rather than runnable
traders.

## Intentionally excluded legacy pages

Older `BD_8Z_*` Trading/DCC archive pages are not linked from the new hub and
were not changed in this review. Their approved original source must be
identified before any migration; preserving an unknown historic ciphertext is
safer than inventing, weakening, or losing protected content.

## Publication posture

- `/bd/trading` and `/bd/trading-research-atlas` are known URLs only.
- The hub and Atlas carry restrictive noindex/noarchive metadata.
- The predecessor source pages are deliberately unchanged in this review
  branch. Existing deployed URLs are rewritten to ciphertext-only copies, so
  the review diff never contains a removal patch that can re-render the old
  plaintext. The earlier repository history is not rewritten.
- No root landing, sitemap, Netlify secrets, global Shield, Trading Python
  arenas, sealed holdouts, or real/live API trading code is changed.
- Historic plaintext existed in earlier repository history before this
  migration. This branch adds no new protected plaintext to version control;
  the review is a forward-facing exposure reduction, not a rewrite of prior
  Git history.

## Required QA before release

- Ciphertext decrypt/roundtrip hash match for every new block.
- Wrong-passphrase rejection for every new block.
- Verify no passphrase, derived credential, protected plaintext, API key, or
  decrypted temporary artifact appears in the diff.
- Check raw source, search, print-before-unlock, desktop, 390px, and 320px.
- Verify one successful Trading unlock is shared within the same browser
  session and remains isolated from the email Shield session.
- Confirm browser-engine hold remains non-executing until its source migration
  is approved.
