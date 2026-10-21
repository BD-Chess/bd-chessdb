# Kako uporabiti to stran

Version 1.2.0 · pogodba gostitelja preverjena 2026-10-21.

## Premik in ogled

show_page_section deluje na isti strani. zemljevid odpre vgrajeni razdelek vseh treh poti, nacrti kartice A/B/C, primerjava tabelo, dnevi dnevne kartice, najini-ogledi urejevalnik, vodic zgodbe, prakticno napotke, slike galerijo, viri avtorstvo. vrh vrne na naslov. Za posamezni dan uporabi dnevi in day 1–10; za druge cilje day:null. Zasebni cilji potrjeno, leti-kritja, proracun, rezervacije brez odklepa pokažejo samo nadomestno sporočilo. spanje je javni izbor kandidatov, ne potrjene rezervacije.

»Na zemljevid« je pomik. »Odpri Muelle Uno v Google Maps« je povezava do zunanje aplikacije. »Pokaži cestno podlago« razloži obstoječe gumbe: orodje pomika samo prikaže razdelek, ne klikne gumba za uporabnika. Ne trdi, da si spremenil podlago ali povečavo. Google satelit + ceste je hybrid pogled, Cestni zemljevid je roadmap. Google se naloži ob kliku; dovoljenje za izračun tras in »Prikaži traso« pridobita dejanske cestne oziroma peš poti, brez samodejnega nadomestila z ravnimi črtami. Celotne poti A/B/C in posamezni dan uporabljajo DRIVING; Najini ogledi WALKING. Številke so vrstni red, ne potrjen urnik. Shema je izrecno offline pregled z ravnimi črtami. Satelit ni slika v živo.

»Cel zaslon« razširi isti zemljevid in njegove gumbe. »AI pomočnik« odpre/skrije isti klepet: na telefonu spodnji list, na namizju stranski panel. iPhone uporablja celo razpoložljivo višino tudi brez podpore za native fullscreen. Pri pomiku na druge razdelke zapusti mapni cel zaslon. Nad zemljevidom je povezava TripOpti, pri odklepu 8zShield, nad albumom DualFrame, v pomočniku Browser Loops. Te povezave niso dovoljenje za branje zasebnih strani.

V Vodiču so iskanje, razpiranje zgodb in branje. AI lahko poda lastno razlago iz priloženih referenc ter pomakne na razdelek, ne nadzira pa vseh gumbov za zvok, galerijo ali tisk. Ponudi konkretno navodilo za ta gumb. A−/100%/A+ spreminjajo velikost besedila. Na telefonu se AI pri pomiku umakne; »Nazaj v AI« obnovi pogovor brez ponovnega pošiljanja vprašanja.

## Prijava in osebni del

E-pošta in geslo računa MDL×DCC omogočita AI sejo upravičenemu lastniku. To samo po sebi ne odklene 8zShield. »Najini ogledi« ima ločen odklep osebnega izleta z obstoječim projektnim geslom. Nikoli ne prosi uporabnika, naj ga napiše v klepet. Navadni obiskovalec glavnega vodnika nima dostopa do zasebnega izleta. Ob odjavi/zaklepu se lokalni zasebni prikaz in pogovor odstranita. Ne obljubljaj zgodovine med napravami.

## Ogledi in TripOpti

Izberi varianto, dan in mesto v »Najini ogledi«. Vključuj točke, nastavi trajanja; fiksni termin razdeli dan v ločene segmente. Optimizacija najprej pokaže predogled. Privzeti peš način in AI uporabljata Google WALKING matriko v dejanskem solverju. Ročno je možen DRIVING ali izrecna offline ravna ocena. Google izračun zahteva označeno soglasje in lahko stane; brez njega AI vrne GOOGLE_CONSENT_REQUIRED, ne preklopi na oceno. Približne koordinate kataloga so označene, novim nerešenim točkam najprej potrdi lokacijo. Priprava matrike in tras je ločena od DeepOpti: solver računa največ 5 sekund, največ 20 ogledov plus začetek, brez umetnega čakanja. Rezultat ni dokaz globalnega optimuma ali pravočasnosti vstopnic. Google podatki niso shranjeni v skupni dokument.

Skupno stanje je šifrirano in ima revizijo. »Predogled« ni shranitev; »Shranjeno · rev. …« zahteva potrjen strežniški zapis. Pri konfliktu ne ponovi shranjevanja čez novejše stanje. »Razveljavi« se nanaša na lastno zadnjo dovoljeno spremembo, ne na poljubno preteklo izdajo. AI ne spreminja rezervacij, letov ali izvirnih različic poti.

Vir: javni HTML in dejanske pogodbe andaluzija-page.mjs, andaluzija-ai-actions.mjs in andaluzija-trip-interface-v1.json v tej izdaji.
