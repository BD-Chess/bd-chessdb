# TS CPQ SO PWA R1

Glavna datoteka: `TS_CPQ_SO.html`

## Kaj je dodano
- PWA manifest
- service worker za offline app-shell
- ikone 192 / 512 / maskable / Apple touch / favicon iz `TS_SO4.PNG`
- gumb `⬇ Namesti` v Chromium/Edge, ko brskalnik ponudi `beforeinstallprompt`
- obstoječi Temno | Svetlo in Full screen sta ohranjena
- theme-color se prilagaja izbrani temi

## Namestitev / gostovanje
PWA potrebuje HTTPS (ali localhost za razvoj). Odpiranje neposredno kot `file://...` ne omogoči service workerja in prave PWA namestitve.

Vse datoteke iz tega direktorija objavi v isti spletni mapi. Nato odpri:
`TS_CPQ_SO.html`

Na iPhone/iPad Safari se namestitev izvede prek Share -> Add to Home Screen; `beforeinstallprompt` gumb tam ni na voljo.

## Meja offline načina
Landing/app shell deluje offline po prvem uspešnem nalaganju. Zunanje povezave (CPQ, M365 Copilot, Telekom, Siol, LinkedIn, Jira) seveda zahtevajo omrežje in ustrezne pravice.
