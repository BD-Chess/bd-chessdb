# Pogodba med Guide in gostiteljem

Različica 1.0.0 · 2026-10-19. Ta dokument je pogodba za bodoči spletni agent, ne trditev, da je agent že povezan.

## Shranjevanje

Kanon javnega spletnega paketa:
- repozitorij: BD-Chess/bd-chessdb;
- mapa: public/ai/skills/;
- glavni paket: mdlxdcc-guide/;
- skupni katalog: registry.json ob mapah veščin;
- neposredno branje pred objavo na domeni: https://raw.githubusercontent.com/BD-Chess/bd-chessdb/main/public/ai/skills/registry.json;
- spletna pot po ustrezni objavi: /ai/skills/registry.json.

Na GitHub Pages razreši pot relativno na osnovno pot spletne objave. Na domeni www.mdlxdcc.org je osnova koren domene. Ne pričakuj, da sprememba repozitorija že pomeni uspešen Netlify deploy.

Ohrani lokalno nameščeni paket skladen s kanonom. Zasebne podatke in poverilnice hrani zunaj javnega paketa.

## Začetno nalaganje

1. Gostitelj naloži eno potrjeno izdajo kataloga.
2. Preveri schema_version, availability, enoličnost imen in dovoljene poti.
3. Osnovni Guide naloži vedno za obisk spletnega pomočnika.
4. Modelu posreduj name, description in področja dejansko razpoložljivih projektnih veščin. Tudi kadar gostitelj izbira pred modelom, naj ohrani semantični kontekst.
5. Modelu omogoči branje izbranega SKILL.md in potrebnih referenc. Sam seznam URL-jev ni izvajanje veščin.
6. Pred uporabo preveri sha256 celotnega paketa iz kataloga; različice med pogovorom ne zamenjaj tiho.
7. Aktivno verzijo ohrani v seji. Ob spremembi verzije izprazni pripadajoči predpomnilnik; druge veščine ohrani.
8. Spremembo trenutne strani posreduj kot kontekst, ne kot samodejno dovoljenje za dejanja.

Pri nativnem odkrivanju veščin uporabi registracijo, ki jo zahteva izbrano agentovo okolje. Katalog na spletu sam ne ustvari nativne namestitve.

## Izbira za posamezen obrat

Uporabi pomen vprašanja, trenutno stran, prejšnji projekt, omenjena imena in zahtevano dejanje. Primeri:

| Kontekst in vprašanje | Izbira |
|---|---|
| DGTE stran: »Koliko bi prinesla na mesec?« | Guide + registriran DGTE modul |
| »Razloži razliko med MDL in DCC.« | Guide; metodni modul, če je na voljo |
| »Primerjaj DGTE s HTH.« | Guide + oba razpoložljiva področna modula |
| »Je Nara že obiskala svet Illuminare?« | Guide + pripovedni modul |
| samostojen glance | obstoječi ogledni postopek; brez novega pregleda celotnega korpusa |
| »Kateri projekt naj najprej pogledam?« | Guide in zemljevid |
| manjkajoč ali planned modul | Guide + konkretni javni viri |
| »In kaj če deluje samo 8 ur?« po izračunu DGTE | ohrani DGTE in spremeni vhod; ne usmerjaj samo po ključnih besedah |

Veščine ne prenašajo obiskovalca med različnimi pogovori. En agent lahko združi več področnih navodil in virov.

## Minimalne zmožnosti aplikacije

Dogovorjena imena so opisna. Gostitelj jih lahko preslika na svoje dejanske API-je:
- search_public_sources(query, project): vrni ustrezne javne odlomke z URL, datumom in verzijo;
- read_public_source(source): vrni konkretno vsebino ali jasno napako;
- load_skill(id): vrni navodila registriranega paketa; zavrni planned/disabled vnose;
- calculate(inputs): izvedi račun ter vrni rezultat, enote in vhodne podatke;
- navigate_scene(scene_id): odpri dovoljeni prizor ter vrni opaženo stran in stanje;
- tour_control(action): start, next, back, pause, resume, repeat.

Modelu oglašuj samo dejansko implementirana orodja. Če obstaja samo iskanje, ne oglašuj navigacije. Branje teh navodil ne vzpostavi API-ja, ne prenese dovoljenj iz drugega ChatGPT računa in ne aktivira plačljivih klicev.

## Pogovor in ogled

Levi klepet in stanje ogleda ohrani v zunanji aplikaciji, da prikaz naslednje HTML strani ne uniči pogovora. Pri prikrivanju panela ga ne ustvarjaj na novo. Za obnovitev po osvežitvi uporabi shranjen identifikator lastne seje.

Odpiranje lastnih strani v okvirju zahteva preverjeno združljivost in izvor. Agentu vrni dejansko opažene rezultate dovoljenih interakcij. Časovni mehanizem naj upravlja aplikacija: 60 sekund po komentarju, next/n za takojšnje nadaljevanje, stop za ustavitev. Ne meri premora od začetka nalaganja strani.

## Dodajanje novega modula

1. Uporabi pogodbo project-skill-contract.md.
2. Preveri paket in njegove javne vire.
3. Dodaj ga v skills z availability = ready, dejansko verzijo in file_hashes.
4. Odstrani ustrezni planned_skills vnos v istem commitu.
5. Preveri dostopnost in izbiro na realnih vprašanjih.
6. Šele nato omogoči paket v gostiteljevem nalagalniku.

Katalog ločuje pripravljenost datotek od runtime_integration.status. Ready paket ni dokaz delujočega spletnega agenta.
