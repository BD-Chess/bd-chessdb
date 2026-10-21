# Naslednji testi — IMPULZ / SLAIF — R4

21. 10. 2026. Status: PROPOSED / NOT_RUN.

Izvor odprtih vprašanj: Codexovo celotno poročilo in BD-jev navedeni follow-up. Podrobna izvedbena zasnova: GPT z RHP 3.0-candidate R2; ni nova empirična evidenca. VM/Slurm ostaja izključen.

## 01 — TSPTS: nadaljevanje brez tihega novega teka

PREDNOSTNO · OFFLINE

Odprt hrošč: ob nezdružljivih checkpointih lahko solve(--resume) tiho začne od začetka. To je tveganje za dokazni izvor, ne le za hitrost.

**Poskus:** Najprej zamrznemo kodo, vhod in konfiguracijo. Preverimo veljaven checkpoint, manjkajoč checkpoint, neujemanje konfiguracije ter poškodovan primarni zapis z veljavnim prejšnjim. Nato en kratek nadzorovan stop → resume na kopiji.

**Sprejem:** Neveljaven resume se ustavi z jasno napako in brez novega teka. Dovoljen fallback uporabi samo ujemajočo se identiteto. Veljavno nadaljevanje ohrani stanje, števce, seme/RNG in najboljšo pot; rezultat preveri neodvisni validator.

**Obseg:** Izolirana kopija; izvirni solver in aktivne arene ostanejo nespremenjeni.

**Predlagana meja:** Predlog: največ 5 minut in vnaprej omejeni majhni vhodi. Test nadzorovanega stopa ni test izpada elektrike.

**Gate:** Ni API-ja. Popravek in testi še niso izvedeni; potreben je ločen izvedbeni mandat.

## 02 — JSON/API: najprej pojasnimo HTTP 400

ČAKA POTRJEN DOSTOP

Delujoč HTTP prenos ni pogodba o formatu. Prvi response_format=json_object je vrnil 400; telo napake ni bilo shranjeno, zato vzroka ne poznamo.

**Poskus:** Od ponudnika pridobimo podprt primer. Zamrznemo eno kratko oracle nalogo: osnovni klic, dokumentirani strukturirani način in dokumentirani reasoning parameter samo, če je podprt. Ločeno beležimo status, zaključek, JSON, shemo in pravilnost.

**Sprejem:** Za vsako poslano zahtevo obstaja zapis izida. Neuspeh ima redaktirano kodo/tip/sporočilo napake brez glave Authorization ali ključa. Za strojno uporabo šteje samo celotna zahtevana shema in pravilen rezultat.

**Obseg:** Samo že potrjeni MaaS endpoint; VM/Slurm izključen.

**Predlagana meja:** Predlog: največ 3 nove zahteve, do 60 s in 2.048 izhodnih tokenov na zahtevo; brez retryjev, stop ob prvi napaki. Nepodprta nastavitev se ne pošlje.

**Gate:** Šele po sveže potrjenem aktivnem brezplačnem dostopu in izrecno odobrenem proračunu. Ta stran ne kliče API-ja.

## 03 — RHP: nov vzorec in kontrola dolžine navodil

PO API DIAGNOSTIKI

Dve isti nalogi, neslepo ocenjevanje in zelo različen vhodni proračun ne ločijo učinka RHP od dolžine navodil, načina ocenjevanja ali odrezovanja.

**Poskus:** Pred izidi zamrznemo 3 nove naloge in rubriko: A nevtralno navodilo, B točno pripeti RHP, C vsebinsko nevtralna kontrola s primerljivo dolžino. Po 3 sveže stateless ponovitve na pogoj/nalogo; uravnotežen vrstni red, isti model in izhodni limit.

**Sprejem:** Skrijemo oznake pogojev pred neodvisnim ocenjevalcem; kjer je mogoče dodamo deterministični oracle. Poročamo vse izide, stroške, input/output tokene in odrezane odgovore. RHP slog lahko razkrije pogoj, zato blinding ni zagotovljen.

**Obseg:** Predlog novega vedenjskega preizkusa; ni potrditev protokola ali zavesti.

**Predlagana meja:** To je predlog 3 × 3 × 3 = 27 DODATNIH zahtev, ločen od 27 zgodovinskih. Končni limit in ustavitev določimo pred aktivacijo; brez samodejnega ponavljanja.

**Gate:** Nov omejen mandat in dostop. N = 3 naloge ostaja mali pilot; prag praktične koristi določimo vnaprej, ne po rezultatih.

## 04 — TSP/LAG: kakovost pri enakem delu

OFFLINE · LOČENA PROGA

Doslej so metode po skupnem 2-opt porabile različno število dostopov do razdalj. Enaka zaključna metoda zato ni enak računski proračun.

**Poskus:** Pred meritvijo zamrznemo nove held-out koordinate, semena, pravilo vezanih rezultatov in dve dovolj veliki omejitvi dela. Štejemo konstrukcijo in izboljševanje; vse metode dobijo isti skupni limit. Ločeno spremljamo čas in dostop do matrike.

**Sprejem:** Vsaka zaprta pot je neodvisno veljavna. Poročamo parne vrzeli in krivuljo kakovost–proračun po porazdelitvah; nobenega tuninga na held-out. Primere, kjer konstrukcija preseže limit, zabeležimo, ne skrijemo.

**Obseg:** NN, LAG in variante ohranimo; brez posega v TSPTS ali Cockpit.

**Predlagana meja:** Predlog: majhen n = 35 korpus, vnaprej omejen skupni čas do 5 minut. To ni HPC benchmark, velike kampanje ali nov dokaz splošne prednosti.

**Gate:** Ločen offline mandat. Neodvisno od API dostopa, vendar ne pomeni, da smo ta poskus že izvedli.

## Skupne varovalke

Zamrznjeni vhodi, source/config/seed hashi, en writer, evidence brez skrivnosti. Ustavitev se zapiše; manjkajoči podatki niso nič. Testi ne širijo dovoljenj. Po izoliranem popravku ne promoviramo solverja brez ločenega sprejemnega dokaza. API plan ima ločen potrjeni proračun in trenutno veljaven dostop; brez retryjev, obnovitve instance, VM/Slurm ali plačil iz samega načrta. Noben predlog ni bil izveden ob uredniški posodobitvi R4.
