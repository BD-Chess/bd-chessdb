# Razvoj in prototip R2

2026-10-19 · BD × AI Lab. Prednostni vrstni red pomeni najcenejše uporabno učenje; po meritvi ga spremeni.

**S0 — karakterizacija:** že zaprt komercialni termoaktuator ali strokovno izbrana nizkoenergijska celica. Pred gradnjo zamrzni podatkovni list, temperature, sile, hod, tlak, zaščito in merilna območja. Izmeri celotno F(x,T) oziroma p–V zanko, oba hoda, čas, Q in reset. Neto delo mora preseči negotovost ter vse stroške vrnitve. Lastna visokotlačna posoda ni prvi poskus.

**S1 — prenos A/B:** isto vzmet napni na isto izmerjeno stanje. Primerjaj počasno praznjenje prek generatorja in hitro prek zapaha. Izmeri mehanski vhod ter ∫VI dt. Zapah ohrani samo ob boljši uporabni storitvi ali energiji iz istega vhoda. Prednapetost vodi ločeno.

**S2 — dogodek:** topli prag pripravi bit, hladni prag sproži. Primerjalni izhodi: mehanski števec, neposredno breme 20 N ×5 mm (=0,1 J), električni hranilnik s ciljem ≥150 mJ neto.

Sintetično breme: 3,3 V, trikrat 30 mA po 100 ms in 1 mA za 10 ms merjenja; nominalno 29,733 mJ. Sprejem ≥29,7 mJ in ≥2,97 V. Ni univerzalni LoRaWAN profil.

**S3-P:** cilj ≥10 J neto/cikel, ≤900 s, 100 ponovitev. 100 g PCM je raziskovalna predpostavka; tlak, material in čas še niso potrjeni.

**S3-V:** po nizkem vodenem oscilatorju cilj ≥15 J mehansko po izgubah, ≤120 s, 100 ponovitev pri posebej izbranem večjem poskusu. Realni fluid in membrana potrebujeta lastno presojo.

Predlagani sintetični temperaturni profil: 25 °C 60 min →65 °C v 10 min →65 °C 15 min →25 °C v 40 min →25 °C 30 min. Pragova 55/35 °C preverjata logiko zapaha; ne kvalificirata RT64HC. Izberi medij za konkretni proces.

- 25→45→25 ne sme dati polnega dogodka.
- 25→65→50→65→25 da natanko en dogodek.
- Preveri dolg vroči premor, 24 h hladnega čakanja, relaksacijo vzmeti, lepljenje zapaha in puščanje hranilnika.
- Primerjaj neposredni termoaktuator/bimetal+ragljo, baterijo z istim dovoljenim pasivnim termičnim stikalom ter TEG s toplotno maso/PCM.
- Ohrani isto nalogo, temperaturni profil, velikostni okvir, hladni zagon in stroške vzdrževanja.

Najprej išči predmet, ki se že sam segreva in hladi. Če ustvarjaš cikel samo zaradi generatorja, šteješ njegove stroške. Trg je še odprt; števcu gospodinjskih ciklov ne pripiši potrjevanja sterilizacije.

Za VS nariši eno vodeno telo in sklenjeno vrvno zanko z zgornjo/spodnjo jermenico. Dve prikazani fazi sta isto telo ob drugem času. Odprava zapor je predlog; trenje, mešanje in kondenzacija ostajajo. Za P/L pokaži stacionarni aktivni vložek in hladni magnet, prenos ter elektroniko. Risba je koncept, ne kvalificiran gradbeni načrt.

Programske preverbe R2 potrjujejo navedene enačbe in poročilo, ne naprave, materiala, življenjske dobe ali ekonomike. Število testov ali agentov ni število empiričnih ponovitev.
