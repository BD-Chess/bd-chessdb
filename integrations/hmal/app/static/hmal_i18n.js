/* HOME locale controls mirror the main landing page's EN/SL and theme toolbar. */
(() => {
  "use strict";
  const translations = {
    "Rezultati testiranja": "Test results", "Arhiv meritev": "Measurement archive", "Poročilo ni naloženo": "Report not loaded",
    "Shranjene meritve; trenutno stanje je prikazano pri modelih.": "Saved measurements; current status is shown next to the models.",
    "Čakam na shranjeno poročilo …": "Loading saved report …", "Shranjeno poročilo še ni na voljo. Pogovor deluje neodvisno od tega razdelka.": "The saved report is not available yet. Conversation works independently of this section.",
    "Tabela meritev": "Measurement table", "Čas obdelave brez nalaganja; vključuje prefill in generiranje.": "Processing time excluding loading; includes prefill and generation.",
    "Model": "Model", "Reasoning OFF": "Reasoning OFF", "Reasoning ON / native": "Reasoning ON / native",
    "GPT-OSS low ni OFF. Qwen ON je low. Zadnji trije modeli uporabljajo podprto native nastavitev.": "GPT-OSS low is not OFF. Qwen ON means low. The final three models use their supported native setting.",
    "low (ni OFF)": "low (not OFF)", "razmišljanje je zapolnilo kontekst brez končnega odgovora": "reasoning filled the context without a final answer", "Odprto za popravek.": "Open for repair.",
    "Ponovitve": "Repeated cases", "prevzeti prejšnji PASS": "reused earlier PASS", "Potrjeno čiščenje RAM pred/po ponovitvah": "Confirmed RAM cleanup before/after repeated cases",
    "Noben ponovljeni test ni dosegel enournega timeouta. Krmilnik je bil ob koncu meritev prost.": "No repeated case reached the one-hour timeout. The controller was idle at the end of the measurements.",
    "To so posamične meritve. Preostala odprta sprejema: Ministral in običajen večpotezni Chat.": "These are individual measurements. Remaining acceptance items: Ministral and ordinary multi-turn Chat.",
    "Dokazi testiranja": "Test evidence", "Poročilo": "Report", "Merilni paket": "Measurement package", "Predaja": "Handoff",
    "Pogovor": "Conversation", "Modeli": "Models", "Poišči pogovor": "Find conversation", "Izvoz MD": "Export MD",
    "Prostor za odgovor": "Room for the answer", "Nastavljeni kontekst": "Configured context", "Dejanski kontekst": "Effective context", "tokenov": "tokens",
    "V ta prostor morajo priti vprašanje, zgodovina, razmišljanje in odgovor. Dejanski prostor se preveri pred vsako potezo.": "The question, history, reasoning and answer must all fit. Effective capacity is checked before each turn.",
    "Zaključevanje": "Completion policy", "Nativno · brez omejitve razmišljanja": "Native · unrestricted reasoning", "Rezerviraj prostor za končni odgovor": "Reserve room for the final answer", "Rezerva tokenov": "Reserved tokens",
    "Izbirni preizkus: skrajša razmišljanje in pusti prostor za odgovor. Skupni obseg ostane celoten prosti kontekst. Uspeh ni zagotovljen; potreben je nativni preizkus.": "Optional trial: limits reasoning to leave room for the answer. Total generation still uses the available context. Success is not guaranteed; native validation is required.",
    "Soglasje modelov ni dokaz. Gemma Q5 in Q6 sta dve različici istega modela. RHP ohrani ugovore in predlaga preverjanja; sam jih ne izvede.": "Model agreement is not proof. Gemma Q5 and Q6 are variants of one model. RHP preserves objections and proposes checks; it does not execute them.",
    "Priprava": "Preparing", "Obdelava vprašanja in odgovor": "Processing the question and generating", "Vhod": "Input", "Izhod": "Output", "Prostor za generiranje": "Generation capacity", "Zaključek": "Finish",
    "Živo število ustvarjenih tokenov in ETA nista na voljo. Stop ostane na voljo.": "Live generated-token counts and ETA are unavailable. Stop remains available.",
    "Razmišljanje je zapolnilo prostor brez končnega odgovora. Zapis je ohranjen. Preveri dejanski kontekst in nativno predlogo; izbirno preizkusi rezervacijo prostora. Klica ne ponavljamo samodejno.": "Reasoning filled the available space without a final answer. Evidence is preserved. Check effective context and the native template; optionally test answer reservation. Calls are not automatically repeated.",
    "Prejeto je samo razmišljanje. Končni odgovor manjka; izvirni odziv je ohranjen za pregled.": "Only reasoning was received. The final answer is missing; the original response is preserved for review.",
    "Odgovor je prekinjen zaradi omejitve tokenov. Delno besedilo je ohranjeno in ni označeno kot dokončano.": "The response hit the token limit. Partial text is preserved and is not marked complete.",
    "Zaključek odgovora ni potrjen. Izvirni odziv je ohranjen za pregled.": "Response completion is unverified. The original response is preserved for review.",
    "Dejanskega konteksta ni bilo mogoče potrditi. Modelni klic ni bil poslan.": "Effective context could not be verified. No model call was dispatched.",
    "Za izbrano rezervo ni dovolj prostora. Zmanjšaj gradivo ali rezervo oziroma preveri večji kontekst.": "There is insufficient room for the reserve. Reduce the input or reserve, or validate a larger context.",
    "Izbirna rezerva za končni odgovor": "Optional final-answer reserve", "NEPOPOLN ODGOVOR": "INCOMPLETE RESPONSE", "Delni končni odgovor": "Partial final answer", "Kopiraj": "Copy", "Kopirano": "Copied", "Kopiranje ni na voljo. Uporabi izvoz.": "Copying is unavailable. Use export.", "Razmišljanje modela": "Model reasoning", "znakov": "characters", "Ni povezave · prikaz je lahko zastarel": "Offline · displayed data may be stale",
    "Neznana različica pogovora.": "Unknown chat projection.", "Neznan način zaključevanja.": "Unknown completion policy.", "Rezerva mora biti od 128 do 32768 tokenov.": "Reserve must be between 128 and 32768 tokens.",
    "Shrani na Drive": "Save to Drive",
    "Lokalno takoj; na Drive vsakih 5 minut ali na klik.": "Saved locally immediately; to Drive every 5 minutes or on click.",
    "Lokalno takoj. Drive samodejno vsakih 5 minut ali z gumbom Shrani na Drive. Pogovor ne čaka na prenos.": "Saved locally immediately. Drive syncs every 5 minutes or with Save to Drive. Conversation does not wait for the upload.",
    "Brez umetne omejitve odgovora ali časovne meje. Velja prosti kontekst modela. Ustaviš z gumbom Stop.": "No artificial response or time limit. The available model context applies. Use Stop to interrupt.",
    "Ta starejši pogovor ohranja prvotne omejitve. Za odgovor brez umetnih omejitev izberi + Nov.": "This older conversation retains its original limits. Select + New for responses without artificial limits.",
    "Število tokenov ni veljavno; 0 uporabi ves prosti kontekst.": "Invalid token count; 0 uses the entire available context.",
    "Časovna meja ni veljavna; 0 pomeni brez časovne meje.": "Invalid timeout; 0 means no time limit.",
    "Odgovori so lokalno shranjeni. Drive še ni potrdil vseh zapisov. Uporabi Shrani na Drive; pogovor lahko nadaljuješ.": "Responses are saved locally. Drive has not confirmed all records. Use Save to Drive; you can continue the conversation.",

    "Povezujem …": "Connecting …", "Odjava": "Sign out", "Domači modeli": "Home models",
    "Izberi udeležence. Puščici določita vrstni red.": "Select participants. Use the arrows to set their order.",
    "Stanje ni znano": "Unknown state", "Čakam na meritve …": "Waiting for measurements …", "Pogovori": "Conversations", "+ Nov": "+ New",
    "DOMAČI LABORATORIJ": "HOME LABORATORY", "Prostor za tvoje vprašanje.": "A space for your question.", "Izvoz JSON": "Export JSON",
    "En model. Več pogledov. Tvoj nadzor.": "One model. Multiple perspectives. Your control.",
    "Klepetaj z izbranim modelom, primerjaj ločene predloge v HMAL-u ali odpri zaporedno razpravo LOOP.": "Chat with one model, compare independent proposals in HMAL, or start a sequential LOOP discussion.",
    "Vprašanje ali komentar": "Question or comment", "Kaj želiš raziskati?": "What would you like to explore?",
    "Vsak odgovor se shrani lokalno in na Drive.": "Every response is saved locally and to Drive.", "Začni pogovor": "Start conversation",
    "Ena poteza": "One turn", "Premor": "Pause", "Nadaljuj": "Resume", "Preveri Drive": "Check Drive",
    "Preveri shranjeni odgovor": "Check saved response", "Preskoči prekinjeno potezo": "Skip interrupted turn",
    "KAKO BOMO DELALI": "HOW WE WORK", "Nastavitve": "Settings", "Način": "Mode", "Krogi": "Rounds",
    "Preprost pogovor z enim modelom.": "A simple conversation with one model.", "Izberi model.": "Select a model.",
    "Razmišljanje": "Reasoning", "Izberi model na levi. Nastavitev velja za nov pogovor; tekočega odgovora ne spremeni.": "Select a model on the left. This setting applies to a new conversation; it does not change an active response.",
    "Počisti pomnilnik": "Clean memory", "Ročno čiščenje RAM-a; samo ko je krmilnik prost. Modelov ne zažene.": "Manual RAM cleanup, only while the controller is idle. It does not start models.",
    "Omogoči RHP": "Enable RHP", "Več perspektiv, primerjava in načrt preverjanja.": "Multiple perspectives, comparison and a verification plan.",
    "Najprej odpri vprašanja": "Start by opening questions", "Za nejasen okvir ali sporne predpostavke. Lokalna projekcija T1; dodatne faze so vključene v število potez.": "For unclear framing or disputed assumptions. A local T1 projection; extra phases are included in the turn count.",
    "Napredne nastavitve": "Advanced settings", "Kontekst": "Context", "Zadnji prispevki": "Recent contributions", "Prejšnji odgovor + BD": "Previous response + BD", "Celotni pogovor": "Full conversation",
    "Največ tokenov odgovora": "Maximum response tokens", "Meja ene poteze (sekunde)": "Turn timeout (seconds)", "Zaključna sinteza": "Final synthesis",
    "Izbrano gradivo": "Selected material", "Prilepi pomemben odlomek …": "Paste a relevant excerpt …", "Dodaj besedilno datoteko": "Add a text file",
    "Celoten arhiv ostane ohranjen. Kontekst za posamezno potezo je viden v podrobnostih. Predolgega vnosa ne krajšamo potiho.": "The full archive is preserved. Each turn's context is shown in its details. Oversized input is never silently shortened.",
    "Lokalni disk + Google Drive": "Local disk + Google Drive", "Naslednja poteza počaka na potrjen zapis obeh kopij.": "The next turn waits until both copies are confirmed.", "O tej izvedbi": "About this implementation",
    "RHP: HMAL T1 Local R1. Brez samodejnih zunanjih orodij; predlagani testi ostanejo načrti. Modeli odgovarjajo zaporedno. Nativni odjemalec trenutno prikaže celoten odgovor po koncu generiranja. Vsaka poteza model ponovno naloži in ga nato ustavi.": "RHP: HMAL T1 Local R1. No automatic external tools; proposed tests remain plans. Models respond sequentially. The native client currently shows the full response after generation finishes. Each turn reloads the model and stops it afterward.",
    "Zasebni domači pogovori": "Private home conversations", "Premor po tej potezi": "Pause after this turn", "V teku": "Running", "Ustavljam": "Stopping", "Ustavljeno": "Stopped", "Končano": "Completed", "Prekinjeno · potreben pregled": "Interrupted · review required", "Čakam na Drive": "Waiting for Drive", "Nalagam model": "Loading model", "Ni povezave": "Unavailable",
    "Odpiranje vprašanj": "Opening questions", "Zemljevid vprašanj": "Question map", "Ločen začetni predlog": "Independent proposal", "Razprava": "Discussion", "Odgovor": "Response", "Ponovni okvir": "Reframing", "Kristalizacija": "Crystallization", "Načrt preverjanja": "Verification plan", "Spoznanja za nadaljevanje": "Continuation insights", "Sinteza": "Synthesis",
    "model": "model", "izbranih modelov": "selected models", "predvidenih odgovorov": "planned responses", "odgovorov": "responses", "na vrsti": "next", "na disku": "on disk", "pot ni potrjena": "path unverified", "Izberi": "Select", "Višje": "Move up", "Nižje": "Move down", "Vloga": "Role", "neznano": "unknown", "čas ni znan": "time unknown", "RAM prosto": "RAM free", "VRAM": "VRAM",
    "Vsak model pripravi neodvisen začetni predlog.": "Each model prepares an independent initial proposal.", "Modeli pišejo zaporedno po tvojem vrstnem redu.": "Models write sequentially in your chosen order.",
    "Brez razmišljanja · hitro": "No thinking · fast", "Nizko": "Low", "Srednje": "Medium", "Zelo visoko": "Extra high", "Visoko": "High", "Izključeno": "Off", "Vključeno": "On", "Privzeto (profil)": "Default (profile)",
    "Velja za ta HMAL pogovor. Nižje razmišljanje lahko skrajša čakanje.": "Applies to this HMAL conversation. Lower reasoning may reduce waiting time.", "Nativno razmišljanje; ta model nima podprtih stopenj ali stikala.": "Native reasoning; this model has no supported levels or on/off switch.", "Privzeta nastavitev modela.": "Default model setting.",
    "Domači krmilnik je zaseden z drugo nalogo. Ko bo prost, izberi Nadaljuj.": "The home controller is busy with another task. Select Resume when it is idle.",
    "Odgovori so lokalno shranjeni. Drive še ni potrdil vseh zapisov. Izberi Preveri Drive, nato Nadaljuj.": "Responses are saved locally. Drive has not confirmed every record. Select Check Drive, then Resume.",
    "Storitev je bila prekinjena. Preglej zadnjo potezo; modelnega klica ne ponavljamo samodejno.": "The service was interrupted. Review the last turn; model calls are never automatically repeated.",
    "Kontekst presega profil modela. Začni nov pogovor z manj gradiva ali krajšim odgovorom.": "The context exceeds the model profile. Start a new conversation with less material or a shorter response.",
    "Domače testiranje še poteka ali čaka v vrsti. HMAL ohranja njegov vrstni red.": "Home tests are running or queued. HMAL preserves their execution order.",
    "Odgovor je shranjen. Pred naslednjo potezo mora lokalni skrbnik potrditi čiščenje pomnilnika.": "The response is saved. Memory cleanup must be confirmed before the next turn.",
    "Model je porabil omejitev tokenov za razmišljanje in ni vrnil končnega odgovora. Začni nov pogovor z nižjo stopnjo ali brez razmišljanja. Poziva ne ponavljamo samodejno.": "The model exhausted its token limit while thinking and returned no final answer. Start a new conversation with lower reasoning or thinking off. The prompt is not automatically repeated.",
    "Model je vrnil samo razmišljanje brez končnega odgovora. Začni nov pogovor z nižjo stopnjo razmišljanja.": "The model returned only reasoning, with no final answer. Start a new conversation with lower reasoning.",
    "Model je dosegel omejitev tokenov brez končnega odgovora.": "The model reached its token limit without a final answer.", "Odgovor vsebuje drugo identiteto modela; shranjen je za pregled.": "The response has a different model identity and is saved for review.",
    "Model je zahteval orodje, ki v tem pogovoru ni omogočeno.": "The model requested a tool that is not enabled in this conversation.", "Model je vrnil prazen končni odgovor; izvirni odziv je shranjen za pregled.": "The model returned an empty final answer; its original response is saved for review.",
    "Stari adapter je zavrnil identiteto ali vsebino odgovora. Možen je izčrpan obseg razmišljanja; podrobnosti naj pregleda lokalni skrbnik. Poziva ne ponavljamo samodejno.": "The old adapter rejected the response identity or content. The reasoning budget may have been exhausted; the local operator should review the evidence. The prompt is not automatically repeated.",
    "Pošlji vprašanje ↗": "Send question ↗", "Dodaj komentar ↗": "Add comment ↗", "BD-jevo sporočilo bo vidno pri naslednji potezi.": "BD's message will be visible on the next turn.", "Prekinitev": "Interruption", "Sporočilo": "Message", "Drive čaka": "Drive pending", "Podrobnosti poteze": "Turn details",
    "Model pripravlja odgovor. Celotno besedilo bo prikazano po zaključku; stanje in Stop ostajata na voljo.": "The model is preparing a response. The full text appears when it finishes; status and Stop remain available.",
    "Nov pogovor": "New conversation", "Vpiši vprašanje in izberi udeležence.": "Enter a question and select participants.", "Začni pogovor ↗": "Start conversation ↗", "MOCK · PREIZKUS": "MOCK · TEST", "DOMA · POVEZANO": "HOME · CONNECTED", "PRIKLOP ČAKA": "CONNECTION PENDING", "Odgovarja": "Responding", "Ni podatkov": "No data",
    "Čakam na meritve domačega krmilnika …": "Waiting for home controller measurements …", "Priklop čaka na prost krmilnik in nativno preverjanje. Tekoče testiranje ostaja ohranjeno.": "Connection awaits an idle controller and native verification. Existing tests are preserved.",
    "Izberi krajšo besedilno datoteko.": "Choose a smaller text file.", "Gradivo je predolgo ali ni besedilno.": "The material is too long or is not text.", "Najprej se prijavi.": "Sign in first.",
    "Počakaj na dokončanje čiščenja pomnilnika.": "Wait for memory cleanup to finish.", "Najprej počakaj na dokončanje modelne poteze.": "Wait for the model turn to finish first.", "Čiščenje ni dovoljeno: krmilnik je zaseden ali stanje ni potrjeno.": "Cleanup is held: the controller is busy or its state is unverified.",
    "Čiščenje poteka …": "Cleaning memory …", "Čiščenje potrjeno.": "Cleanup confirmed.", "Čiščenje ni potrjeno. Ne ponavljamo samodejno; potreben je lokalni pregled.": "Cleanup is unconfirmed. No automatic retry; local review is required.",
    "Neznan način pogovora.": "Unknown conversation mode.", "Izberi modele.": "Select models.", "Izberi od enega do osem različnih modelnih konfiguracij.": "Choose one to eight distinct model configurations.", "Chat uporablja en model; HMAL in LOOP od dva do osem.": "Chat uses one model; HMAL and LOOP use two to eight.", "Izbrani model ni v preverjenem lokalnem registru.": "The selected model is not in the verified local registry.", "Vpiši vprašanje, dolgo največ 18.000 znakov.": "Enter a question of at most 18,000 characters.", "Izberi od 1 do 100 krogov.": "Choose 1 to 100 rounds.", "Dolžina odgovora mora biti od 64 do 2048 tokenov.": "Response length must be 64 to 2048 tokens.", "Časovna meja poteze mora biti od 30 do 86400 sekund.": "Turn timeout must be 30 to 86400 seconds.", "Neznana izbira konteksta.": "Unknown context selection.", "Vloge niso veljavne.": "Invalid roles.", "Gradivo je predolgo; izberi krajši odlomek.": "The material is too long; choose a shorter excerpt.", "Izbrana stopnja razmišljanja za ta model ni podprta.": "The selected reasoning level is not supported by this model.", "Nastavitve razmišljanja niso veljavne.": "Invalid reasoning settings.",
    "HMAL ni omogočen.": "HMAL is disabled.", "HMAL še ni nastavljen.": "HMAL is not configured yet.", "HMAL še ni priklopljen na domači krmilnik.": "HMAL is not connected to the home controller yet.",
    "ID zahteve ni veljaven.": "Invalid request ID.", "Isti ID dejanja ima drugačno vsebino.": "This operation ID has different content.", "Izvor zahteve ni dovoljen.": "The request origin is not allowed.", "Javni dostop do portala zahteva HTTPS.": "Public portal access requires HTTPS.",
    "Najprej počakaj ali ustavi aktivni HMAL pogovor.": "Wait for or stop the active HMAL conversation first.", "Neznana pot HMAL.": "Unknown HMAL route.", "Neznano dejanje.": "Unknown action.",
    "Ni prekinjene poteze za obnovo.": "There is no interrupted turn to recover.", "Ni prekinjene poteze za preskok.": "There is no interrupted turn to skip.", "Ni zabeležene oddaje za obnovo.": "There is no recorded dispatch to recover.",
    "Pogovora ni mogoče najti.": "Conversation not found.", "Poti ni mogoče najti.": "Path not found.", "Potrjen shranjeni odgovor še ni dosegljiv ali se ne ujema z oddajo.": "A confirmed saved response is unavailable or does not match the dispatch.",
    "Počakaj na dokončan odgovor v načinu Chat.": "Wait for the Chat response to complete.", "Počakaj na svež lokalni register modelov.": "Wait for a fresh local model registry.", "Prekinjene poteze ne ponavljamo. Preskoči zabeleženo vrzel ali začni nov pogovor.": "Interrupted turns are not repeated. Skip the recorded gap or start a new conversation.",
    "Preveč neuspelih prijav. Poskusi čez minuto.": "Too many failed sign-ins. Try again in a minute.", "Prijava ni uspela.": "Sign-in failed.", "Pripeti vir RHP se ne ujema; potreben je pregled povezave.": "The pinned RHP source does not match; review its binding.",
    "Telo zahteve ni veljaven JSON.": "The request body is not valid JSON.", "Varnostna koda zahteve ni veljavna.": "The request security token is invalid.", "Vpiši sporočilo do 18.000 znakov.": "Enter a message of at most 18,000 characters.", "Zahteva mora biti JSON objekt.": "The request must be a JSON object.", "Zahteva presega dovoljeno velikost.": "The request exceeds the size limit.", "Dolžina zahteve ni veljavna.": "Invalid request length.",
    "Datoteka presega dovoljeno velikost.": "The file exceeds the size limit.", "Datoteke trenutno niso dosegljive.": "Files are currently unavailable.", "Upravljanje FRITZ trenutno ni omogočeno.": "FRITZ administration is currently disabled."
  };
  const root = document.documentElement, key = "mdlxdcc-locale-v1";
  const get = name => { try { return localStorage.getItem(name); } catch (_) { return null; } };
  let remembered; try { remembered = JSON.parse(get(key)); } catch (_) {}
  let language = remembered?.lang || get("mdlxdcc-lang") || "sl";
  if (!["en", "sl"].includes(language)) language = "sl";
  const text = source => language === "sl" ? source : translations[source] || source.replace(/^Privzeto \(/, "Default (");
  const nodes = [], attributes = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode, value = node.textContent.trim(); if (translations[value]) nodes.push([node, value]); }
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => { for (const attr of ["placeholder", "aria-label", "title"]) { const value = el.getAttribute(attr); if (translations[value]) attributes.push([el, attr, value]); } });
  function theme(value, persist = false) {
    root.dataset.theme = value === "light" ? "light" : "dark";
    document.getElementById("theme").setAttribute("aria-label", language === "en" ? "Switch color theme" : "Preklopi barvno temo");
    if (persist) try { localStorage.setItem("mdlxdcc-theme", root.dataset.theme); } catch (_) {}
  }
  function choose(value, persist = true) {
    if (!["en", "sl"].includes(value)) return;
    language = value; root.lang = value; root.dataset.lang = value;
    for (const [node, original] of nodes) if (node.isConnected) node.textContent = node.textContent.replace(node.textContent.trim(), text(original));
    for (const [el, attr, original] of attributes) el.setAttribute(attr, text(original));
    document.querySelectorAll("button[data-lang]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.lang === language)));
    if (persist) try { localStorage.setItem("mdlxdcc-lang", value); localStorage.setItem(key, JSON.stringify({ lang: value, source: "manual", at: Date.now() })); } catch (_) {}
    theme(root.dataset.theme); window.dispatchEvent(new CustomEvent("hmal:language"));
  }
  window.HMALLocale = { text, choose, current: () => language };
  document.querySelectorAll("button[data-lang]").forEach(button => button.addEventListener("click", () => choose(button.dataset.lang)));
  document.getElementById("theme").addEventListener("click", () => theme(root.dataset.theme === "light" ? "dark" : "light", true));
  window.addEventListener("storage", event => { if ([key, "mdlxdcc-lang"].includes(event.key)) choose(get("mdlxdcc-lang"), false); if (event.key === "mdlxdcc-theme") theme(get("mdlxdcc-theme")); });
  theme(get("mdlxdcc-theme")); choose(language, false);
})();
