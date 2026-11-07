# AI učenje — preverjanje in predaja izboljšav

AI učenje je šesti, lastniški način v istem AI pomočniku za OmniCPQ. Testiranje ostane način za teste storitev in procesov CPQ; AI učenje preverja samega pomočnika. Izboljšave pravil, znanja, programov in testov ne pomenijo samodejnega spreminjanja uteži modela.

## Prva izdaja

Vgrajeni preizkusi preverijo dejanske čiste funkcije šestih pogodb: načine in skupni kontekst, nespremenjena modelna profila, omejitve, potrjene izbire, vezavo dovoljenja na dokument ter nedokončane odgovore. Modelnih klicev ni.
Izbirni API preizkusi uporabijo samo šest fiksnih izmišljenih primerov: prazen panel, odposlano brez shranitve, nepotrjen poslovni oracle, zastarelo opazovanje, potrjeno izbiro in neznan učinek. Pomočnik uporablja izbrani obstoječi profil; tester zahteva GPT-6.1 Terra / max brez zamenjave. Uporabnik pred zagonom izbere čas, obseg in zgornji proračun ter izrecno dovoli omejene API klice.

Katalog vsebuje le javna dokazna pravila. Prva izdaja ne uporablja živega CPQ, slik, odprtega dokumenta, celotne pogovorne zgodovine, prilog, korpusa ali zasebnega produktnega besedila. Nima orodja za poslovni vnos. Preizkus modelnega adapterja s tem katalogom ni preizkus vseh produktnih virov ali celotnega E2E.

## Dokaz in ustavitev

PASS velja samo za navedeni sintetični kontrast in različico. Izjava pomočnika ali ocenjevalca ni poslovni dokaz: pričakovana odločitev se ločeno preveri deterministično. Neveljaven odgovor ni samodejni uspeh; manjkajoč/nezanesljiv dokaz ostane PARTIAL/BLOCKED/NOT_RUN. Povezava, odposlano dejanje, opažen učinek, shranitev in ponovno odprtje so ločene stopnje.
Strežnik preveri lastniško sejo pri vseh operacijah ter pred modelnim klicem in izročitvijo rezultata. Demo ali brskalnikov role/email ne odpre te poti.
Pred klicem nastane nespremenljiv zapis poskusa z rezervirano zgornjo porabo obeh vlog. Zapisi se ustvarjajo samo enkrat in povratno preberejo. Poskus brez potrjenega zaključka se ne ponavlja; obnova začne s preverbo shranjenega stanja. Ni samodejnih modelnih ponovitev ali prilagajanja omejitev.
Pavza ustavi naslednje preizkuse, že začet par se lahko zaključi. Ustavi je terminalen za cikel in ustavi nadaljnje načrtovanje; preklic zahteve ne dokazuje, da že odposlan klic ni bil izveden ali zaračunan. Po izgubi prijave se rezultat ne izroči brez ponovne avtorizacije. Nova različica zahteva nov cikel.
Proračun je zgornja meja po konservativnih cenovnih stropih, ne račun. Usage testerja in pomočnika je ločen; neznana poraba ohrani rezervacijo. Dejanska razpoložljivost modela in računa ni dokazana s konfiguracijo ali sintetičnim preizkusom.

## Enotna predaja za HTML in Copilot

Poročilo navede različice, ID cikla/testa, pričakovanje, omejeno opažanje, izid, razlog, vlogo modela, usage, rezervacijo in meje dokaza. Izvoz ni potrditev prevzema. Predlog je PROPOSED_NOT_INSTALLED:
test → ugotovitev → pregled graditelja → popravek → isti prizadeti regresijski primer → preverjena izdaja.
Sprejeta vsebina mora imeti potrjen vir in ločeno tehnično preverbo za HTML ter Copilot. Copilot ZIP nima PWA panela ali samodejnega izvajalnika; isti protokol je uporaben pri njegovem ročnem, vnaprej omejenem preverjanju. Noben od obeh izdelkov ne sme predloga samodejno spremeniti v poslovno pravilo ali dovoljenje za dejanje.
Masovna vsebinska analiza JSON ostaja ustavljena. Ta funkcija je ne nadaljuje. Živega CPQ, namestitve, plačljivega preizkusa ali učenja na poslovnih podatkih ni dovoljeno razglasiti za preverjeno na podlagi te kode, dokumenta ali ZIP-a.
