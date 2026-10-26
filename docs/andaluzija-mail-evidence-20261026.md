# Andaluzija private mail evidence

BD approved the mail review additions and production deployment on 2026-10-26.
The reviewed reservation details, cancellation deadlines and budget reconciliation
were already present. They are preserved rather than duplicated or re-estimated.

The existing protected reservation section now includes an arrival task summary,
a Camas-to-city transit link, and three original PNG screenshots from the owner's
authorized mail review. Flight numbers and outbound seat assignments are added
inside the protected data only. The raw screenshots are not public static files
and are not reconstructed as DualFrame illustrations.

The existing Shield header and every wrapped-key slot are preserved byte for
byte. Only content IV/ciphertext changes. All other protected sections, booking
records and monetary inputs are unchanged. The local builder verifies the full
content roundtrip and records original image hashes outside the publish tree.

Private HTML sanitization permits bounded PNG data URLs only on image sources;
SVG, executable markup and data links remain excluded. Lock restores the original
private placeholders and removes the inline images with their section. The AI
context allowlist and shared planner state are unchanged.

Targeted check: `node --test tests/andaluzija-private-images.test.mjs`.
Production publication uses the existing main prebuilt pipeline. No manual
Netlify upload, provider call, live shared-plan write or credential change is
part of this content update.
