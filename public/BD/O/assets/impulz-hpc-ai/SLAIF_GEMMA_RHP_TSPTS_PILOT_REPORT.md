# IMPULZ / SLAIF — preverljivi rezultati in naslednji koraki — R4

**21. 10. 2026 · javna redaktirana sinteza.** Seme in prioritete: Bojan Dobrečevič. Eksperimenti in primarna poročila: CLI Codex na HOME. Uredniška sinteza, pregled integritete in načrt nadaljevanja: GPT z RHP 3.0-candidate R2 (T1 + E1; zaporedni pogledi, ne neodvisni agenti).

Ta revizija ne vsebuje novih modelnih, solver ali HPC tekov. Izvirna poročila ostajajo nespremenjena. Javno besedilo izpušča poverilnice, zasebne identifikatorje instance, notranje poti in surova polja reasoning_content. Izvirniki na Drivu lahko zahtevajo pooblastilo; ta povzetek je vsebinsko samostojen.

## 1. Rezultat v eni minuti

Dokumentiranih je 27 dejanskih API zahtev: 26 HTTP 200 in 1 HTTP 400. Dodatna lokalna napaka pred HTTP je ločena. Brez retryjev ali podaljšanja dodelitev. Uspešen HTTP ni dokaz pravilne vsebine. VM/Slurm/GPU ni bil uporabljen; oddaljeni Python je NOT_RUN in trenutno izključen.

Znana poraba uspešnih odgovorov: 53.606 vhodnih + 19.230 izhodnih = 72.836 tokenov. Poraba HTTP 400 je UNKNOWN, ne 0, zato to ni dokončno dokazani skupni obračun. Vsota odjemalskih latenc 551,453 s ni trajanje seje ali čisti čas generiranja. Zaključki: 10 length, 14 stop, 3 UNKNOWN.

Oznaka Gemma 4 26B-A4B IT Q8 je iz portala/predaje, ne audit uteži. Tedanja brezplačnost je bila potrjena od BD, ne neodvisno iz obračunske plošče. Trenutni dostop ni potrjen. Primerjava z GPT/Claude ni bila izvedena.

## 2. Ločeni sklopi, ne en skupni odstotek inteligence

| Sklop | Zahteve | HTTP 200 / 400 | Vsebinski obseg |
|---|---:|---|---|
| R4 | 2 | 2 / 0 | 96 izhodnih tokenov; račun pravilen, jezik/format delna, verjetnost nepopolna; finish_reason ni shranjen |
| R5 | 6 | 6 / 0 | 256 limit; ročna pravilnost 4/6, 4 length in 2 stop |
| RHP 768 | 4 | 4 / 0 | Dve nalogi AB/BA, vsi length |
| Konferenčni R2 | 14 | 14 / 0 | 10 objektivnih nalog + štirje raziskovalni odgovori pri 2048 |
| R2 JSON nastavitev | 1 | 0 / 1 | 400; 4 preostale nastavitve niso poslane |

R4/R5 sta skupaj 8 zahtev stare dodelitve; konferenčni RHP/R2 skupaj 19 zahtev nove dodelitve, od tega 18 HTTP 200 in en 400. Lokalna napaka transportnega stdin pred izdelavo HTTP ne poveča teh 27. Javna CSV priloga vsebuje vse izmerjene vrstice, ne zasebnih identifikatorjev.

## 3. Strojni format in vsebina

Dodatni R2: 9 JSON nalog in ena naloga popravka kode. Strogi izhodni/funkcijski kriterij: 2/10. Točen zahtevani goli JSON: 1/9. Po označenem naknadnem izluščanju: 6/9 celotnih objektov. Popravek kode: 1/1 naloga in 5/5 ciljnih primerov. Sekundarna ekstrakcija ne popravi primarnega rezultata.

EUC_CLOSURE pravilno izračuna robove 3,3,4 in zaprto dolžino 10, a vrne napačno shemo. SYNC3 ima pravilne kontrolne točke v razlagi, izhodni objekt pa se ne dokonča. Slovenski JSON vsebuje pravilne šumnike in dvojino, vendar Markdown. Priklic najde 3/3 vrednosti iz 600 sintetičnih zapisov, ne dokazuje maksimalnega konteksta. En uspešen test vloženega nezaupanega navodila ni varnostna garancija. Generirana funkcija je bila preizkušena pod omejenim AST, ne kot poljubna koda.

Prvi response_format=json_object vrne HTTP 400 v 0,891 s. Telo napake ni ohranjeno. Zato je vzrok UNKNOWN; niti univerzalne nepodprtosti niti delujočega strukturiranega načina ne potrjujemo. Preostale štiri nastavitve so NOT_RUN; reasoning-control ni potrjen. Za nadaljevanje je potrebna dokumentacija ponudnika in nov omejen mandat.

## 4. RHP: tudi neugoden rezultat ostane

| Naloga | Limit | A nevtralno | B RHP | Zaključek |
|---|---:|---:|---:|---|
| HPC_SERVICE | 768 | 5/12 | 6/12 | oba length |
| TSP_HYPOTHESIS | 768 | 6/12 | 7/12 | oba length |
| HPC_SERVICE | 2048 | 7/12 | 5/12 | oba stop |
| TSP_HYPOTHESIS | 2048 | 7/12 | 7/12 | oba stop |

Ocene so ročne, neslepe, od istega Codexa, brez neodvisnega ocenjevalca. N = 2 nalogi, kasneje ponovljeni. B pri 768 skupaj porabi 18.171 vhodnih tokenov, A 383 (47,44×). Vsi štirje 768 odgovori so odrezani; pri 2048 vsi stop, a s posameznimi metodološkimi napakami. To ni dokaz splošne prednosti ali škodljivosti RHP, niti poštena primerjava kakovosti pri isti porabi.

HPC B primerja izvirno domačo in optimizirano oddaljeno kodo ter s tem pomeša algoritem in strojno opremo. TSP B uporabi L_LAG < 0,85 L_NN: to preverja več kot 15 % izboljšanja, ne razpona 5–15 %. Obe TSP različici izpustita pomembne neodvisne kontrole. Daljši izhod zato ni avtomatično pravilnejša metodologija. Primeri v izvirnem auditu so aritmetični protiprimeri, ne novi HPC rezultati.

### Nova uredniška razrešitev SHA (ni nov API test)

Kanonični RHP.md: 37.218 B; SHA-256 0a96871ae46923d5b9f952ad17bc45acd18b7d694a4e3f4d8379b63a692cdd57.
Arhivirani RHP.md: 37.219 B; SHA-256 4ba65def127ac257ccabc79f9498a19cbb94a0f79176797cc0999ff535949c95.
Preverjena zveza: archived_bytes == canonical_bytes + b"\n".
Vsebina protokola se ujema; surova bajtna identiteta ne. Arhiv je preverjeni prefiks zamrznjenega B sistemskega navodila, ki vsebuje še zabeležen izvedbeni dodatek. Stara UNRESOLVED navedba je s tem razrešena za ta konkretni dokazni paket, ne popravljena za nazaj v izvirnikih. RHP ostaja 3.0-candidate R2 / NOT_FIELD_VALIDATED.

## 5. Lokalna evidenca ni rezultat modela

CPCI: 18/18 ciljanih lokalnih testov, od tega 14 CPCI in 4 testi spremenjenih mehanizmov; 100 vsebinsko unikatnih svetov, 500 odstranitev pravil, 116 sprememb izida. Neodvisni oracle preveri 1.000 baseline in 5.000 dodatnih prehodov. To ne pomeni Gemma 18/18 in ničesar ne dokazuje o zavesti.

TSP/LAG: en 30 × 35 pilot s petimi metodami, 16 razvojnih in 14 held-out primerov; neodvisno preverjenih 300 začetnih/končnih poti. Po skupnem 2-opt je osnovni LAG glede na NN +1,8171 % daljši na 15 enakomernih in +0,5781 % na 15 gručastih primerih. Dostopi do razdalj: 2,531× oziroma 1,949× NN. To ni matched-budget test. Sedem held-out gručastih primerov LAG-B+ pri −0,0839 % ne potrjuje splošne zmage. Metode ohranimo za boljšo primerjavo.

Mali eksaktni TSP: 8 primerov po 9 mest, 161.280 ciklov in 40 kandidatnih poti. Optimum NN 6/8, LAG 7/8, LAG-A 6/8, LAG-B+ 7/8, LAG-B− 8/8. Popolna enumeracija je omejena na uporabljeno floating-point geometrijo s toleranco 1e-10, ne splošna trditev o vseh TSP.

## 6. TSPTS HOME in odprt resume

Nespremenjeni TSPTS v0.1; wi29, en CPU delavec, seed 20261021, 128 predlogov. Veljavna pot 27.603; 29 mest, closure in EUC_2D preverjeni neodvisno. Zunanji wall 1,172904 s, CPU 1,078125 s, peak RSS 28,8125 MiB. En mali tek ob drugih aktivnih arenah ne zagotavlja ponovljive primerjave strojne opreme ali potreb po veliki VM.

Veljaven checkpoint, fallback poškodovanega primarnega in zavrnitev konfiguracijskega neujemanja so bili pregledani na kopijah. Toda solve(--resume) lahko ob neveljavnih checkpointih tiho začne iz nič. Pravi crash/resume sprejem NI izveden. Napaka ostaja odprta; ta spletna revizija solverja ne popravlja. Remote wall in pospešek sta null; ni izmerjenega SLAIF Python, Linux/GPU/VM/Slurm teka.

## 7. Kaj ohranimo in kaj predlagamo

Izvedbeni sklep GPT/RHP: najprej obnovljivost in zanesljivost izhoda, potem vzročno boljša primerjava. To je prioritizacija na podlagi dokazov, ne nova meritev. Vse štiri smeri ostajajo: TSPTS resume (offline, prioritetno), JSON/API (dostop in dokumentacija), RHP (novi primeri, slepa presoja, dolžinska kontrola) in TSP/LAG (enak skupni proračun).

Podrobne kontrole, sprejem in omejitve so v NEXT_TESTS_R4.md. Vsi načrti so PROPOSED / NOT_RUN. RHP predlog 27 DODATNIH zahtev je prihodnji proračun, ne del 27 zgodovinskih meritev. Novo brezplačno aktivno dodelitev in izvedbeni mandat je treba potrditi pred API testi. VM/Slurm ostaja izločen. Nobena vloga ali email nista poslana.

Katalog 13 možnosti, 9 projektov in 10 pripravljalnih kljukic je ohranjen. Razpisni pogoji in roki ostanejo datirani konferenčni pregled 21. 10. 2026, ne ponovna pravna ali finančna preverba R4. Arhitekturni predlog CPU VM/60 dni ostaja odložena možnost, ne aktivna prošnja ali dodelitev.

## 8. Preverjanje in provenienca

GPT je ponovno preveril CRC paketa, 95/95 indeksiranih izvornih datotek po velikosti in SHA-256 ter 105 manifestnih vnosov. Seštevki 27 zahtev, statusov, tokenov in latenc so preračunani iz ledgerja. To je kontrola integritete/aritmetike, ne neodvisna ponovitev eksperimentov in ne novo slepo ocenjevanje.

- Codex · celotno poročilo 21. 10. 2026: https://drive.google.com/file/d/1kbdKphsUqH9pf8qIHoYRT_7P0Y-23t6m/view; SHA-256 27a8b0c394a8770577477f428aa35160baa01c66d569b8aad59e3ede4ec28c63
- Codex · RHP A/B pri 768 tokenih: https://drive.google.com/file/d/1AYhuUFNxHW9TwtzNkI0lmhEEMMw2jrKE/view
- Codex · dodatni konferenčni R2 in RHP 2048: https://drive.google.com/file/d/1Y0Zh8xRv_KrtFf6l6mnm14SC-UywPF8G/view
- Interni paket · 95 izvornih dokazil: https://drive.google.com/file/d/1YKzxccTx5VCh21l5FimWHP9ZgY417Xlq/view; SHA-256 f1a07b7b0cc4a9bebb390b7e86e2d4aa783c030af83d6f787632010fe8475cf8

Javne priloge: PUBLIC_EVIDENCE.json, ALL_27_API_REQUESTS_PUBLIC.csv, EDITORIAL_SOURCE_AUDIT.json, NEXT_TESTS_R4.md. Izvorni paket ni javno prekopiran.
