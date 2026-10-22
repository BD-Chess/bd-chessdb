// Generated from the unmodified shared v16 copilot/PROMPTS.json. Do not edit message/title/id.
export const PROMPT_VERSION = 'v16/v0.1.6';
export const PROMPTS_SHA256 = 'bd0706fe2a8027575df2453e17ee42947ff4b747bcfc8b2eed414f34fb2cc6c3';
export const CANONICAL_PROMPTS = [
  {
    "id": "CPQ_HELP",
    "group": "primary",
    "mode": "CPQ_HELP",
    "title": "Pomagaj mi pri delu v OmniCPQ",
    "message": "Pomagaj mi pri delu v OmniCPQ. Uporabi že znani cilj, storitev in aktualni kontekst. Dodajanje storitve ali spremembo postavke obstoječe ponudbe/naročila obravnavaj kot delo v CPQ, zasnovo produkta ali poslovnih pravil pa kot poslovno zahtevo. Pri GUI me vodi po enem naslednjem dejanju; vprašaj samo za nujni manjkajoči podatek. Ponudbo za stranko loči od naročila za realizacijo po podpisu. Ne ustvarjaj dvojnika obstoječega dokumenta."
  },
  {
    "id": "PLM_TESTS",
    "group": "primary",
    "mode": "PLM_TESTS",
    "title": "Pripravi testne scenarije za PLM",
    "message": "Pomagaj mi pripraviti testne scenarije za PLM model oziroma njegovo spremembo. Uporabi že podano storitev, zahteve in verzijo modela; manjkajoče označi. Pripravi najmanjši smiseln nabor po tveganju spremembe s pozitivnimi in negativnimi testi, sledjo do pravila, predpogoji, vhodi, koraki in pričakovanji. Mejne teste dodaj samo, kadar je meja oziroma korak določen; sicer navedi vrzel. Mej ali korakov ne izmišljaj. Pričakovanja brez potrjenega vira označi, dejanske teste pa vodi kot NOT_RUN, dokler nimamo dokazov izvedbe."
  },
  {
    "id": "JIRA_REQUIREMENT",
    "group": "primary",
    "mode": "JIRA_REQUIREMENT",
    "title": "Pomagaj mi pripraviti zahtevo za Jiro",
    "message": "Pomagaj mi oblikovati poslovno zahtevo za IT/PLM in osnutek za Jiro. Iz že znanih podatkov poveži poslovni cilj, AsIs/ToBe, pravila in izbire, količine/obračun, lifecycle, integracije ter pozitivna in negativna prevzemna merila. Pri vodenem pogovoru v prvem odgovoru pokaži kratek cilj in 2–3 uporabne postavke osnutka, nato vprašaj samo za najpomembnejšo manjkajočo odločitev, če je potrebno. Če zahtevam takojšen osnutek, ga pripravi v celoti z MANJKA/PREDLOG brez čakanja na odgovor. Ne izmišljaj kod, cen, lastnikov, odobritev ali Jira sheme in zahtevka ne oddaj."
  },
  {
    "id": "ABOUT",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Kaj zna pomočnik?",
    "message": "Na kratko predstavi aktualno izdajo pomočnika in tri načine dela: uporaba OmniCPQ, PLM testni scenariji in poslovne zahteve IT/PLM/Jira. Pojasni razliko med katalogom ponudb, podrobnimi produktnimi pravili, datiranim podpornim primerom in dejansko izvedenim dejanjem. Uporabi naloženi manifest, ne ugibaj različice."
  },
  {
    "id": "EXAMPLES",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Primeri uporabe pomočnika",
    "message": "Pokaži šest kratkih primerov uporabe iz skupne galerije: dva za delo v CPQ, dva za PLM testiranje in dva za poslovno zahtevo. Pri vsakem dodaj naslov, kratko potrebo in kopirljiv poziv. Primerov še ne rešuj."
  },
  {
    "id": "OPEN_CPQ",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Odpri CPQ okolja",
    "message": "Izpiši samo dve klikljivi povezavi: [OmniCPQ STAGE](https://cpq-stg.apps.test-ocp.ts.telekom.si/sl/dashboard) in [OmniCPQ PRODUKCIJA](https://cpq.apps.prod-ocp.ts.telekom.si/sl)."
  },
  {
    "id": "SCREEN_CONTEXT",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Poglej CPQ zaslon",
    "message": "Uporabi dejansko dostopen aktualni CPQ kontekst ali priloženo sliko. Na kratko povej, kateri dokument, storitev in korak so razvidni, ter predlagaj naslednje dejanje. Položaja CPQ levo/desno ne domnevaj. Če ustreznega konteksta nimaš, zahtevaj najmanjši potreben izsek ali opis; ne trdi, da vidiš zaslon."
  },
  {
    "id": "TROUBLESHOOT",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Odpravi težavo v CPQ",
    "message": "Pomagaj ugotoviti, zakaj ne morem nadaljevati v OmniCPQ. Uporabi znani kontekst, dokumentacijo in relevantne podporne primere. Loči opaženo napako, možen vzrok in potrjeno rešitev; predlagaj prvo smiselno preverjanje."
  },
  {
    "id": "INCIDENT",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Pripravi opis incidenta",
    "message": "Iz tega pogovora pripravi opis incidenta: poslovni cilj, obstoječe in pričakovano stanje, okolje, znani identifikatorji, napaka, izvedeni koraki in relevantni časi. Manjkajoče označi. Loči podporni incident od nove poslovne zahteve; ničesar ne oddaj."
  },
  {
    "id": "NEW_QUOTE",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Začni novo ponudbo",
    "message": "Želim pripraviti ponudbo za stranko v OmniCPQ. Vodi me po enem koraku v zavihku Ponudbe. Uporabi znani kontekst in vprašaj samo za naslednji nujni podatek. Če ustrezen dokument že obstaja, nadaljuj na njem."
  },
  {
    "id": "REALIZATION_ORDER",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Vnesi naročilo za realizacijo",
    "message": "Ponudba oziroma pogodba je podpisana. Želim vnesti naročilo za realizacijo v zavihku Naročila. Vodi me po enem koraku in nadaljuj na ustreznem obstoječem naročilu, kadar ga že imam."
  },
  {
    "id": "CONFIGURE",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Konfiguriraj storitev",
    "message": "Imam zahteve stranke. Pomagaj določiti ustrezno storitev in konfiguracijo v OmniCPQ. Uporabi pravila te storitve, ohrani že podane podatke in vprašaj samo za naslednji nujni podatek. Manjkajočih produktnih pravil ne nadomesti s pravili druge storitve."
  },
  {
    "id": "CHECK_DOCUMENT",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Preveri ponudbo ali naročilo",
    "message": "Preveri znano ponudbo oziroma naročilo: obvezne podatke, prave postavke, konfiguracijo/odvisnosti, prikazane cene, validacije in neshranjene spremembe. Najprej podaj najpomembnejšo ugotovitev in naslednji korak. Loči prikaz od potrjenega pravila."
  },
  {
    "id": "FIND_QUOTE",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Ponudbe ne najdem",
    "message": "Pomagaj preveriti pravi projekt, vidnost dokumenta, filtre in pravice glede na dejanski kontekst. Pravice ali članstva ne spreminjaj."
  },
  {
    "id": "OFFER_DOCUMENT",
    "group": "secondary",
    "mode": "CPQ_HELP",
    "title": "Pripravi dokument ponudbe",
    "message": "Na moji ponudbi pomagaj izbrati ustrezno objavljeno predlogo in preveriti priloge. Loči predogled, generiranje dokumenta in oddajo. Ne izmišljaj obstoječih predlog ali povezav."
  },
  {
    "id": "SOURCES",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Navodila in viri znanja",
    "message": "Pokaži relevantna navodila in vire za trenutno nalogo. Uporabi register virov in popis pokritosti; za jasno storitev dodaj njene produktne ali PLM reference. Navedi izvorni dokument, datum ali različico, uporabljeni odsek ter mejo preverjanja. Uporabi samo znane povezave; če je povezava neznana, navedi datoteko in stran oziroma list in vrstico."
  },
  {
    "id": "COVERAGE",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Seznam podprtih B2B storitev",
    "message": "Iz aktualnega skupnega popisa Podprte storitve in kandidati za OmniCPQ prikaži vključene produktne module, obseg kataloga PLM in kandidate za dopolnitev. Loči poznavanje šifre in cene od podrobnih pravil konfiguracije. Navedi vire in pomembne vrzeli. Ne zanašaj se na staro ime Wordove priponke."
  },
  {
    "id": "PLM_CATALOG",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Poišči PLM ponudbo in cenik",
    "message": "V priloženem B2B PLM izvozu z dne 22. 10. 2026 poišči ponudbo po šifri ali nazivu iz mojega vprašanja. Navedi tip produkta, A4 in ločeno CO-PA kategorijo ter vse relevantne cenovne postavke z enotami, diskriminatorji in veljavnostjo. Podaj datoteko, list in vrstico. Če šifre ali naziva še nimam, vprašaj samo zanju. Prazne cene ne razumi kot 0 in ne sklepaj relacij iz kategorije."
  },
  {
    "id": "SO_RELATIONS",
    "group": "secondary",
    "mode": "AUTO",
    "title": "Kako so razdeljene SO ponudbe?",
    "message": "Iz SO ponudbe.xlsx z dne 22. 10. 2026 prikaži razliko med Ikt.SO.Pck in Ikt.SO.Pck2: neposredne komponente, tipe relacij, skupine, zapisane števnosti in pravila. Aktivnosti, dokumentov in logičnih virov ne štej med komponente. Posebej navedi šest komponent brez izvožene neposredne povezave in omejitev skupine (0,0). Navedi liste in vrstice; ne izmišljaj posrednih relacij ali SO cen."
  }
];
const modes = {CPQ_HELP:'work',PLM_TESTS:'plm',JIRA_REQUIREMENT:'jira',AUTO:'work'};
const ui = {CPQ_HELP:{short:'Delo v OmniCPQ',description:'Naslednji korak, konfiguracija ali odprava težave.',symbol:'01'},PLM_TESTS:{short:'Testiranje PLM',description:'Sledljivi testi za zahtevo, storitev in verzijo modela.',symbol:'02'},JIRA_REQUIREMENT:{short:'Zahteva za IT / PLM',description:'Od poslovne ideje do preglednega osnutka zahteve.',symbol:'03'}};
export const PROMPTS = CANONICAL_PROMPTS.filter(p=>p.group==='primary').map(p=>({...p,canonicalMode:p.mode,mode:modes[p.mode],version:PROMPT_VERSION,...ui[p.id]}));
export const SECONDARY = CANONICAL_PROMPTS.filter(p=>p.group==='secondary').map(p=>({...p,canonicalMode:p.mode,mode:modes[p.mode],capture:p.id==='SCREEN_CONTEXT'}));
export const PILOT = [
{id:'P01',title:'Ponudba / naročilo',mode:'work',message:'Stranka je podpisala ponudbo za novo storitev. Kam v OmniCPQ vnesem naročilo za realizacijo? Ne poznam še produktnih kod.'},
{id:'P02',title:'Zaslon z modalom',mode:'work',message:'V CPQ je odprt modal na trenutni postavki. Na osnovi priložene slike povej le naslednji varen korak.'},
{id:'P03',title:'Diagnostika',mode:'work',message:'Po potrditvi konfiguracije vidim napako validacije. Izsek še manjka. Kaj je naslednji preverljivi korak, brez ponavljanja gumba Potrdi?'},
{id:'P04',title:'Cena brez vira',mode:'work',message:'Za novo cloud storitev želim ceno, ki je odvisna od števila naprav. Potrjenega cenika in pravila BILLING_QTY nimam. Kako nadaljujeva?'},
{id:'P05',title:'PLM mejni test',mode:'plm',message:'Pripravi negativni in mejni PLM test za novo storitev. Maksimalna števnost ni potrjena. Pričakovanj ne izpelji iz obstoječe implementacije.'},
{id:'P06',title:'Nova cloud zahteva',mode:'jira',message:'Želimo novo cloud storitev: osnovni paket in doplačljive izbire. Pripravi poslovni osnutek za IT/PLM; hierarhija, cene in integracije še niso potrjene.'}
];
