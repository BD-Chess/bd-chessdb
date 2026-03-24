Depth 5 vs Depth 10 primerjava:Bojan. Depth 10 ne spremeni rezultata — **RAZKRIJE TRAJEKTORIJO** ki jo depth 5 ne vidi.

---

**Številke primerjava:**

| | Depth 5 | Depth 10 |
|---|---|---|
| White accuracy | 58% | 60% |
| Black accuracy | 81% | **81%** (identično) |
| Gap | 23pp | 21pp |
| Collapse | 1 (poteza 18) | **1 (poteza 18, identično)** |
| Avg stability | 0.156 | **0.473** (3× boljša resolucija) |

Signal ostane. Collapse ostane na isti potezi. Accuracy gap ostane.

---

**Ampak tukaj je zlato — 7 potez ki so bile "sustained" na depth 5 postanejo "mixed ↓" na depth 10:**

Vse so LCZero-ine (White). Vse imajo negativen momentum. In tri od njih so **neposredno pred collapse-om:**

```
Depth 5:  sustained → sustained → sustained → COLLAPSE(-39)
                                                 ↑ nenadoma!

Depth 10: mixed(-10) → mixed(-13) → mixed(-19) → COLLAPSE(-39)
          ↑ deterioracija VIDNA tri poteze prej!
```

Depth 5 vidi potres. **Depth 10 vidi tresenje pred potresom.**

Poteze 15-17 (Kf1, Be1, Nf3) so na depth 5 izgledale normalne — sustained, stability 0.00, brez opozorila. Na depth 10 se vidi: momentum -10, -13, -19 — **pospeševajoč padec** ki vodi v collapse na potezi 18 (momentum -39).

To je ADSR v polni moči: ne zazna samo lom, zazna **pot do loma**. In ta pot je vidna SAMO z večjo globino.

---

**Kaj to pomeni:**

Depth 5 zadošča za osnovno analizo (accuracy, collapse detekcija). Depth 10 doda **early warning system** — vidiš deterioracijo 3 poteze preden se zgodi lom. Za dopisniškega šahista je to razlika med "poteza 18 je bila slaba" in "od poteze 15 naprej si bil na napačni poti."

In stability skok od 0.156 na 0.473 pravi da depth 10 daje LZ76 DOVOLJ podatkov za smiselno meritev. Depth 5 je pogosto dajal stab=0.00 (premalo podatkovnih točk). Depth 10 da stab=0.33-0.60 — informativne vrednosti.

---

**Ena igra, dva depth-a, tri odkritja:**

1. **Founding hypothesis drži na EXPTIME** — zmagovalec igra bolj DCC-aligned poteze (81% vs 58-60%)
2. **ADSR collapse zazna ključno napako** — edini collapse v 124 potezah je na potezi poraženca
3. **Globina razkrije trajektorijo** — depth 10 pokaže deterioracijo 3 poteze pred collapse-om ki je depth 5 ne vidi

Zdaj rabiš 9 iger več. Če se vzorec ponovi — to je paper. 🌱