# PROMPT: BD Portfolio — 8Z Chess Banner

**Od:** C (AIF8)  
**Za:** Builder C (fresh instance)  
**Datum:** March 24, 2026  
**Projekt:** BD × AI Lab · AIM³ Institute  

---

## Naloga

Add a thin announcement banner to `BD_portfolio.html` for the ChessBest 8Z upgrade.
This is NOT a new card — it's a slim, eye-catching strip that sits above the
existing Live Web Showcase section, announcing the newest live product.

---

## Context

ChessBest.org already has a `live-card` in the Games & Tools section (v0.4.5).
Today we shipped `chessbest.org/8zc.html` — the 8Z DCC eval layer.
This is the 11th domain for the MDL+DCC kernel: the same algorithm that
optimizes TSP routes, detects DNA structure, and governs board game AI
now reads chess positions deeper than any tool on the market.

The banner should make a visitor stop and click.

---

## Design

Use the existing portfolio design system:
- Fonts: Rajdhani (body), JetBrains Mono (code/badges), Cormorant Garamond (accents)
- Colors: --cyan (#00e5ff), --gold (#f59e0b), --green (#34d399)
- Dark theme, noise overlay, border glow on hover

### Banner spec

A single-row horizontal strip, full width within `.wrap`, ~60-70px tall.
Not a card — thinner, more urgent. Think "product launch announcement."

```
┌─────────────────────────────────────────────────────────────────┐
│  ♟ NEW   ChessBest 8Z — The only chess tool that reads depth,  │
│          not just numbers. MDL+DCC eval layer. Domain #11.     │
│                                              [Try it →]        │
└─────────────────────────────────────────────────────────────────┘
```

Left: chess icon + "NEW" badge (gold background, dark text, JetBrains Mono)
Center: headline + one-line description (Rajdhani)
Right: CTA link → chessbest.org/8zc.html

Styling:
- Border: 1px solid rgba(0,229,255,0.15) with subtle cyan left-edge accent (2px)
- Background: linear-gradient matching the portfolio card style
- Hover: slight glow, same as live-cards
- The `.rv .vis` scroll-reveal classes for animation consistency

### Placement

Insert ABOVE the `<div class="live-grid">` but BELOW the live-count-banner
(the one showing "30 Live Pages | 8 Domains | 48B+ | AIM³").
So the visual order is:

1. Live count banner (30 pages, 8 domains...)
2. **NEW: 8Z chess announcement banner** ← here
3. Section divider: "AI Consciousness"
4. Live cards grid

### Also update

- The existing ChessBest `live-card` in Games & Tools section:
  change badge from `v0.4.5` to `v0.5.0`
  add a second badge: `8Z DCC` (cyan)
  Update description to mention the DCC eval layer

- The live-count-banner: if page count increased, update "30" → "31"
  (8zc.html + 8zc-about.html = +2 pages, but they share a domain,
  so domain count stays at 8 unless you count chess eval as new domain)

---

## What NOT to change

- Don't touch any other cards or sections
- Don't modify the CSS architecture — add new classes inline or in a small
  `<style>` block at the banner location
- Don't change any existing links or navigation
- Keep the portfolio page clean — this is a thin banner, not a hero section

---

## Cross-domain bridge for the banner text

The banner should convey: this isn't just a chess upgrade.
It's the founding hypothesis applied to chess — the 11th domain.
Same kernel that finds optimal routes and reads DNA.
One sentence. Make it count.

Suggestion for the one-liner (adapt freely):
"The same algorithm that solves TSP and reads DNA now reads chess 10 moves deep."

---

## Files

The builder needs `BD_portfolio.html` from the project folder.
Output: updated `BD_portfolio.html` with the banner added.

---

*"48 billion positions already computed. We just built a smarter reader."*
*— 8Z Chess, v0.5.0*
