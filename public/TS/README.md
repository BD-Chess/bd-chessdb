# TS CPQ SO — zaščitena PWA R3

Javni vhod: `index.html`

Zaščita: 8Z Shield / samostojna zaščita celotne strani z geslom.

## R3 spremembe
- odstranjen opozorilni blok »Interna stran ... ni pripravljena za javno gostovanje ...«
- `Full screen` je v uporabniškem vmesniku zamenjan z `Celoten zaslon`
- dodatno poslovenjeni vidni izrazi `launcher`, `Agent link`, `override`
- ohranjen R2 popravek DecompressionStream deadlocka
- PWA cache zvišan na `ts-cpq-so-protected-r3`

## Objava
V `/TS/` objavi datoteke iz tega paketa.
V `/TS/` ne objavi plaintext `TS_CPQ_SO.html`, ker bi s tem obšel zaščiten `index.html`.

Po zamenjavi stare različice naredi `Ctrl+F5` ali zapri in ponovno odpri nameščeno PWA.
