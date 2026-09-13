/* Translate application-owned text only. User stops and model answers are never scanned. */
(() => {
  'use strict';
  const words={
    'Web search mode':'Način spletnega iskanja','Plan':'Načrt','Map':'Mapa','Help':'Pomoč','More →':'Več →','Close':'Zapri','Open application':'Odpri aplikacijo',
    'Trip Editor':'Urejevalnik poti','Trip Library':'Knjižnica poti','Library ↓':'Knjižnica ↓','Editor ↑':'Urejevalnik ↑',
    'Optimize (Fast)':'Optimiziraj (Fast)','Optimize (Deep)':'Optimiziraj (Deep)','Run Brute Force':'Zaženi Brute Force',
    'Prepare distances':'Pripravi razdalje','Cancel calculation':'Prekliči računanje','🚗 Drive':'🚗 Vožnja','🚶 Walk':'🚶 Hoja',
    '💾 Save':'💾 Shrani','📂 Load':'📂 Naloži','Load Map':'Naloži mapo','Retry Map':'Ponovi nalaganje mape','Map Loaded':'Mapa naložena','Loading API...':'Nalaganje API-ja …',
    'Round Trip':'Povratna pot','Direct Line':'Zračna linija','Results':'Rezultati','See map links ↓':'Navigacijske povezave ↓',
    'Distance:':'Razdalja:','Saving:':'Prihranek:','Road distance:':'Cestna razdalja:','Walking distance:':'Razdalja hoje:','Air distance (great circle):':'Zračna razdalja (veliki krog):','Road saving (table):':'Cestni prihranek (matrika):','Air saving:':'Zračni prihranek:',
    'Map Inactive':'Mapa še ni naložena','Road distance table':'Matrika cestnih razdalj','Loading trips...':'Nalaganje poti …','Loading…':'Nalaganje …',
    'Calculation comparison':'Primerjava izračunov','Method':'Metoda','Compute time':'Čas izračuna','Table distance':'Razdalja po matriki','Result':'Rezultat','How to read this table':'Kako brati tabelo',
    'Our Optimize (Fast)':'Naš Optimize (Fast)','Our Optimize (Deep)':'Naš Optimize (Deep)','Our Optimize (Deep · Air)':'Naš Optimize (Deep · zrak)',
    'Exact optimum for this table':'Dokazan optimum te matrike','Cancelled · best found':'Preklicano · najboljša najdena','Running · best found':'Računanje · najboljša najdena','Best found · optimum not proven':'Najboljša najdena · optimum ni dokazan','Great-circle air · best found, not proven':'Veliki krog · najboljša najdena, ni dokazana','Matches exact optimum':'Ujema se z dokazanim optimumom',
    'Same stops and START. Deep Air searches its own great-circle table; it is not a road saving. Fast and Deep report the best route found. Only completed Brute Force proves the optimum of its table. Times exclude address lookup, table preparation and map drawing.':'Isti postanki in START. Deep Air uporablja svojo matriko razdalj po velikem krogu; rezultat ni cestni prihranek. Fast in Deep pokažeta najboljšo najdeno pot. Optimum svoje matrike potrdi šele dokončan Brute Force. Časi ne vključujejo iskanja naslovov, priprave matrike in risanja mape.',
    'Drive / Walk optimize road distances. Missing distances are prepared automatically.':'Vožnja in Hoja optimizirata cestne razdalje. Manjkajoče razdalje se pripravijo samodejno.',
    'Welcome to 8Z! Load a Library trip or enter your destinations. Ask the assistant for suggestions or help with Trip Optimizer.':'Dobrodošel v 8Z! Naloži pot iz knjižnice ali vnesi svoje kraje. Pomočnika lahko vprašaš za predloge in uporabo aplikacije.',
    'The assistant can consult current web sources; English place queries can also use Maps. Check dates, opening hours and bookable prices at the source.':'Pomočnik lahko preveri aktualne spletne vire; pri vprašanjih o krajih v angleščini tudi Maps. Datume, odpiralni čas in cene rezervacij preveri pri viru.',
    'Open in Google Maps':'Odpri v Google Maps','📍 Pins':'📍 Točke','🏷️ Names':'🏷️ Imena','🔗 Share trip':'🔗 Deli pot','⛰️ Save GPX':'⛰️ Shrani GPX','Tap to navigate here ↗':'Dotakni se za navigacijo ↗','From → To':'Od → Do',
    'ℹ️ Help':'ℹ️ Pomoč','How to use Library?':'Kako uporabljam knjižnico?','Explain Optimization':'Pojasni optimizacijo','✨ Start a New Adventure':'✨ Načrtuj novo potovanje','Create 3-Day Rome Itinerary':'Tri dni v Rimu','Paris Weekend':'Vikend v Parizu','🛏️ Sleeping Strategy':'🛏️ Prenočišča','Find Best Base Camp':'Predlagaj izhodišče za izlete','🍴 Eating':'🍴 Prehrana','Best Cheap Eats':'Dobro in ugodno','Romantic Dinner':'Romantična večerja','🚕 Logistics':'🚕 Prevoz in čas','Time per Stop?':'Čas za posamezen postanek?','Walk vs Taxi':'Peš ali s taksijem?',
    'Trip Editor Updated':'Urejevalnik poti posodobljen','Trip Library format applied.':'Uporabljen je zapis knjižnice poti.','Stops Added':'Postanki dodani','System:':'Sistem:','Session restored.':'Seja obnovljena.','✅ Continue':'✅ Nadaljuj','🗑️ Fresh Start':'🗑️ Začni znova',
    'Shared trip loaded!':'Deljena pot je naložena.','List is empty!':'Seznam je prazen.','Link copied!':'Povezava kopirana.','✅ Copied!':'✅ Kopirano!','Copy this link:':'Kopiraj povezavo:',
    'No optimized route to export.':'Najprej izračunaj pot za izvoz.','GPX Downloaded!':'Datoteka GPX prenesena.','Export failed.':'Izvoz ni uspel.','Session Resumed':'Seja se nadaljuje.',
    'Please wait...':'Počakaj …','Optimizing stop order...':'Optimizacija vrstnega reda …','Loading Map API...':'Nalaganje zemljevida …',
    'Trip Editor text repaired to Trip Library format.':'Zapis poti je usklajen z obliko knjižnice.','Trip Editor updated in Trip Library format.':'Urejevalnik poti je posodobljen.',
    'Enter at least 2 stops, one per line.':'Vnesi vsaj dva postanka, vsakega v svojo vrstico.',
    'Preparing road distances…':'Priprava cestnih razdalj …','Road distances not ready.':'Cestne razdalje še niso pripravljene.',
    'Direct Line: optimization uses great-circle air distances.':'Zračna linija: optimizacija uporablja razdalje po velikem krogu.',
    'Select Drive or Walk and turn off Direct Line to prepare road distances.':'Za cestne razdalje izberi Vožnjo ali Hojo in izklopi Zračno linijo.',
    'Road distances ready. Choose Optimize (Fast) or Optimize (Deep).':'Cestne razdalje so pripravljene. Izberi Optimiziraj (Fast) ali (Deep).',
    'Starting exhaustive search…':'Začetek preverjanja vseh vrstnih redov …','Calculation cancelled.':'Računanje preklicano.',
    'Stopping calculation and keeping the best route…':'Ustavljanje izračuna in ohranjanje najboljše poti …',
    'All orders checked. Exact optimum for this distance table.':'Vsi vrstni redi preverjeni. Optimum te matrike je dokazan.',
    'Calculation cancelled. Best route and comparison kept.':'Računanje preklicano. Najboljša pot in primerjava sta ohranjeni.',
    'Calculation worker failed. Reload the page and try again.':'Izračun je odpovedal. Osveži stran in poskusi znova.',
    'Stops changed. Road distances will be checked on the next optimization.':'Postanki so spremenjeni. Cestne razdalje se preverijo ob naslednji optimizaciji.',
    'Travel mode changed. Road distances will be checked on the next optimization.':'Način potovanja je spremenjen. Cestne razdalje se preverijo ob naslednji optimizaciji.',
    'Stop order ready. Showing great-circle air routes and distances.':'Vrstni red je pripravljen. Prikazane so zračne povezave in razdalje po velikem krogu.',
    'Stop order ready. Loading road route...':'Vrstni red je pripravljen. Nalaganje cestne poti …',
    'Road route displayed. Distance follows the route shown on the map.':'Cestna pot je prikazana. Razdalja ustreza poti na mapi.',
    'Road route displayed. Google did not return a complete distance.':'Cestna pot je prikazana. Google ni vrnil celotne razdalje.',
    'No road route was found for these stops and travel mode.':'Za te postanke in način potovanja ni bilo mogoče najti cestne poti.',
    'Road route request timed out.':'Zahteva za cestno pot je potekla.',
    'Google denied the road route. Check Routes API activation and the Maps key restrictions.':'Google je zavrnil cestno pot. Preveri aktivacijo Routes API in omejitve ključa Maps.',
    'Road route quota reached. Retry later.':'Dosežena je kvota za cestne poti. Poskusi pozneje.',
    'The map software could not process the road route. This needs a code repair.':'Program ni mogel obdelati cestne poti. Potreben je popravek kode.',
    'Map configuration is unavailable.':'Nastavitev zemljevida ni dosegljiva.','Map configuration is incomplete.':'Nastavitev zemljevida ni popolna.',
    'Google denied address lookup. The site owner must enable Geocoding API and check its key restrictions and billing.':'Google je zavrnil iskanje naslova. Lastnik mora preveriti Geocoding API, omejitve ključa in obračunavanje.',
    'Address lookup quota reached. Please retry later.':'Dosežena je kvota za iskanje naslovov. Poskusi pozneje.',
    'Place not found. Add the country or a more precise address.':'Kraj ni najden. Dodaj državo ali natančnejši naslov.',
    'Address could not be read. Check this stop.':'Naslova ni mogoče prebrati. Preveri postanek.',
    'Google could not look up this address. Please retry.':'Google ni mogel poiskati naslova. Poskusi znova.',
    'Gemini usage limit reached. Please try later. The site owner can check the active quota in AI Studio.':'Dosežena je omejitev porabe Gemini. Poskusi pozneje. Lastnik lahko preveri aktivno kvoto v AI Studio.',
    'Gemini took too long to answer. Please try again.':'Gemini se ni odzval pravočasno. Poskusi znova.',
    'Gemini returned no answer. Please try again.':'Gemini ni vrnil odgovora. Poskusi znova.',
    'The chatbot connection failed. Check your connection and try again.':'Povezava s pomočnikom ni uspela. Preveri povezavo in poskusi znova.',
    'Please shorten your message to 12,000 characters.':'Skrajšaj sporočilo na največ 12.000 znakov.',
    ' (backup model)':' (nadomestni model)',
    'Reduction versus entered order with START first, measured using the same directed road distance table.':'Prihranek glede na vneseni vrstni red s START na začetku, izmerjen po isti usmerjeni cestni matriki.',
    'Reduction versus entered order with START first, measured using the same great-circle distances.':'Prihranek glede na vneseni vrstni red s START na začetku, izmerjen po istih razdaljah po velikem krogu.',
    'Ready · progress appears here':'Pripravljeno · tukaj bo napredek',
    'Brute Force unavailable above 16 stops.':'Brute Force je nad 16 postanki izklopljen.',
    'Brute Force: enter 2–16 stops including START.':'Brute Force: vnesi 2–16 postankov, vključno s START.',
    'Brute Force supports 2–16 valid stops including START.':'Brute Force podpira 2–16 veljavnih postankov, vključno s START.',
    'Correct invalid coordinates first.':'Najprej popravi neveljavne koordinate.',
    'START stays fixed; each direction is counted separately.':'START ostane fiksen; vsaka smer se šteje posebej.',
    'Road optimization supports 2–100 stops. Use Direct Line for larger trips.':'Cestna optimizacija podpira 2–100 postankov. Za večje poti izberi Zračno linijo.',
    'Road distance request timed out. Try again.':'Zahteva za cestne razdalje je potekla. Poskusi znova.',
    'Google Route Matrix is unavailable in the loaded Maps library.':'Matrika cestnih razdalj ni na voljo v naloženem zemljevidu.'
  };
  const fragments={
    'Great-circle air distances':'Zračne razdalje po velikem krogu','Road distance table':'Matrika cestnih razdalj','Round trip':'Povratna pot','Open trip':'Enosmerna pot',
    'above exact optimum':'nad dokazanim optimumom','All orders checked; optimum proven for this table.':'Vsi vrstni redi preverjeni; optimum matrike dokazan.','Optimum not yet proven.':'Optimum še ni dokazan.',
    'Best road-table distance:':'Najboljša cestna razdalja po matriki:','Best direct distance:':'Najboljša zračna razdalja:',
    'Full-search time remaining at this rate':'Preostali čas celotnega iskanja pri tej hitrosti','Estimated remaining':'Ocenjeni preostali čas','Elapsed:':'Preteklo:','Speed:':'Hitrost:',
    'Complete':'Končano','Cancelled':'Preklicano','Running':'Računanje','measuring…':'merjenje …',' remaining':' do konca',' done':' končano',
    ' orders checked':' preverjenih vrstnih redov',' orders/s':' vrstnih redov/s',' possible orders.':' možnih vrstnih redov.',
    'Estimated full search:':'Ocenjeni čas celotnega iskanja:','illustration at 1,000,000 orders/s; actual speed depends on this device':'ponazoritev pri 1.000.000 vrstnih redih/s; dejanska hitrost je odvisna od naprave',
    'extrapolated at ':'ocenjeno pri ',' measured with ':' izmerjeno pri ',' stops':' postankov',
    'Kept only for the current open trip.':'Shranjeno le za trenutno odprto pot.',
    ' directed road distances. Optimization runs locally.':' usmerjenih cestnih razdalj. Optimizacija poteka lokalno.',
    'Reusing':'Ponovna uporaba','Ready:':'Pripravljeno:',' · Walk · ':' · Hoja · ',' · Drive · ':' · Vožnja · ',
    '< timer resolution':'pod ločljivostjo časovnika','too large to estimate':'preveliko za oceno',' hours':' h',' days':' dni',' years':' let',
    ' No stops were removed.':' Noben postanek ni odstranjen.',
    ' Road optimization has not run.':' Cestna optimizacija se ni izvedla.',
    ' Dashed lines show stop order, NOT roads. Navigation links remain available.':' Črtkane povezave kažejo vrstni red postankov. Navigacijske povezave ostajajo na voljo.'
  };
  function t(raw, lang=window.MDLxDCCLocale?.current()||'en'){
    const text=String(raw??'');if(lang!=='sl')return text;
    if(words[text])return words[text];
    let s=text;
    // Sentence translations first; proper names/addresses stay exactly as supplied.
    for(const [a,b] of Object.entries(words).sort((a,b)=>b[0].length-a[0].length))if(a.length>40)s=s.split(a).join(b);
    const patterns=[[/^Invalid coordinates for "(.*?)"\. Latitude must be -90…90 and longitude -180…180\.$/,'Neveljavne koordinate za »$1«. Širina mora biti −90…90, dolžina −180…180.'],[/^Address lookup timed out for "(.*?)"\. Please retry\.$/,'Iskanje naslova za »$1« je poteklo. Poskusi znova.'],[/^Loaded: (.*)$/,'Naloženo: $1'],[/^Optimizing (\d+) stops\.\.\.$/,'Optimizacija $1 postankov …'],[/^Looking up (\d+) addresses\.\.\.$/,'Iskanje $1 naslovov …'],[/^AI added (\d+) Trip Editor line\(s\)\.$/,'Pomočnik je dodal $1 vrstic v urejevalnik.'],[/^Leg (\d+) \((\d+) stops\)$/,'Odsek $1 ($2 postankov)'],[/^Reading road distances: (.*?) batches \((.*?) route elements\)\.$/,'Pridobivanje cestnih razdalj: $1 sklopov ($2 elementov poti).'],[/^Air comparison could not complete: /,'Zračna primerjava ni uspela: '],[/^Optimization failed: /,'Optimizacija ni uspela: '],[/^Road route could not be drawn \((.*?)\)\./,'Cestne poti ni bilo mogoče izrisati ($1).'],[/^The chatbot (?:connection returned|request failed \()HTTP (\d+)\)?\. Please try again shortly\.$/,'Povezava s pomočnikom je vrnila HTTP $1. Poskusi znova.']];
    for(const [a,b] of patterns)s=s.replace(a,b);
    for(const [a,b] of Object.entries(fragments).sort((a,b)=>b[0].length-a[0].length))s=s.split(a).join(b);
    return s;
  }
  function set(el,raw){if(!el)return;el.dataset.uiText=String(raw??'');const text=t(raw);if(el.textContent!==text)el.textContent=text;}
  function render(root=document){root.querySelectorAll('[data-ui-title]').forEach(el=>{el.title=t(el.dataset.uiTitle);});root.querySelectorAll('[data-ui-text]').forEach(el=>{const text=t(el.dataset.uiText);if(el.textContent!==text)el.textContent=text;});}
  window.TripUI={t,set,render};
  document.addEventListener('DOMContentLoaded',()=>{
    window.MDLxDCCLocale.subscribe(()=>render());
    // Only marked internal labels are observed; dynamic city names/AI answers are excluded.
    new MutationObserver(records=>{for(const rec of records)for(const node of rec.addedNodes)if(node.nodeType===1){if(node.matches('[data-ui-text]'))set(node,node.dataset.uiText);render(node);}}).observe(document.body,{childList:true,subtree:true});
  });
})();
