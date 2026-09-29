/* ChessBest APP EN/SL presentation layer. Technical identifiers remain unchanged. */
(function (root) {
  'use strict';
  const doc = root.document;
  const KEY = 'ChessBest:APP:v1:language';
  const exact = {
    "Skip to chess board":"Preskoči na šahovnico","Application versions":"Različice aplikacije","Language":"Jezik",
    "Game library":"Knjižnica partij","New game":"Nova partija","More tools":"Več orodij","Analysis board":"Analizna šahovnica",
    "ANALYSIS BOARD":"ANALIZNA ŠAHOVNICA","Simulation running":"Simulacija teče","Pause":"Pavza","Engine best":"Najboljša poteza motorja",
    "DCC line data":"Podatki linije DCC","Game continuation":"Nadaljevanje partije","A second view of the same position.":"Drug pogled istega položaja.",
    "Read the scores":"Preberi ocene","Current position":"Trenutni položaj","Starting position":"Začetni položaj","Select a move on the board":"Izberi potezo na šahovnici",
    "Show board":"Pokaži šahovnico","DCC replay":"DCC replay","YOUR WORKSPACE":"TVOJ DELOVNI PROSTOR","White":"Beli","Black":"Črni",
    "Elapsed per player · no time limit":"Pretečeni čas na igralca · brez časovne omejitve","Your next move starts here":"Tvoja naslednja poteza se začne tukaj",
    "Analysis":"Analiza","CDB pending":"CDB čaka","Simulation":"Simulacija","DCC analysis":"DCC analiza","Review game":"Preglej partijo",
    "Simulation: watch a match or choose a side to play against the engine.":"Simulacija: opazuj dvoboj ali izberi stran za igro proti motorju.",
    "Hide Eval":"Skrij oceno","Two players":"Dva igralca","Pause game":"Pavza partije","End study":"Končaj študijo","Clear":"Počisti","Ask":"Vprašaj",
    "Load a game:":"Naloži partijo:","— select —":"— izberi —","Settings":"Nastavitve","Stockfish analysis":"Stockfish analiza",
    "SF depth per position:":"SF globina na položaj:","Workspace & simulation":"Delovni prostor in simulacija","Bottom tools during Sim:":"Spodnja orodja med simulacijo:",
    "Focus automatically":"Samodejno fokusiraj","Always expanded":"Vedno razširjeno","Workspace width on a wide screen:":"Širina delovnega prostora na širokem zaslonu:",
    "Default":"Privzeto","Compact analysis spacing":"Kompaktni razmiki analize","Pause Sim at an interesting position":"Ustavi simulacijo pri zanimivem položaju",
    "Raw engine and DCC choose different moves":"Surovi motor in DCC izbereta različni potezi","Evaluation changes sharply":"Ocena se močno spremeni",
    "Evaluation change (centipawns):":"Sprememba ocene (centipešaki):","Required analysis data is missing":"Manjkajo zahtevani podatki analize",
    "Show player timers during games and simulations":"Pokaži uri igralcev med partijami in simulacijami","Show move timestamps":"Pokaži časovne oznake potez",
    "Two players · same board":"Dva igralca · ista šahovnica","Show top moves:":"Pokaži najboljše poteze:","All":"Vse","Show next‑move preview":"Pokaži predogled naslednje poteze",
    "Evaluation method:":"Način ocenjevanja:","Direct":"Neposredno","History height:":"Višina zgodovine:","Smallest":"Najmanjša","Small":"Majhna","Medium":"Srednja","Big":"Velika",
    "Font size:":"Velikost pisave:","Large":"Velika","Badge notation:":"Prikaz oznak:","Score":"Ocena","Dot":"Pika","Piece size:":"Velikost figur:",
    "Main background:":"Glavno ozadje:","Forest charcoal":"Gozdno oglje","Dark Gray":"Temno siva","Light Gray":"Svetlo siva","Dark Brown":"Temno rjava","Light Brown":"Svetlo rjava",
    "Dark Blue":"Temno modra","Light Blue":"Svetlo modra","Light theme":"Svetla tema","Double size board":"Dvojna velikost šahovnice",
    "DCC Lookahead":"DCC pogled naprej","Enable DCC lookahead":"Vključi DCC pogled naprej","DCC move click:":"Klik na DCC potezo:","Details only":"Samo podrobnosti",
    "Play move only":"Samo odigraj potezo","Hybrid · play + details":"Hibridno · poteza + podrobnosti","Lookahead depth (half-moves):":"Globina pogleda naprej (polpoteze):",
    "Extra inspection pool:":"Dodatni nabor za pregled:","3 (default)":"3 (privzeto)","10 (thorough)":"10 (temeljito)","Candidate window (cp below best):":"Okno kandidatov (cp pod najboljšo):",
    "80cp (default)":"80cp (privzeto)","120cp (wide)":"120cp (široko)","200cp (very wide)":"200cp (zelo široko)","Decision policy:":"Politika odločitve:",
    "Balanced · include all near ties":"Uravnoteženo · vključi vse skoraj izenačene","Legacy · capped candidate pool":"Legacy · omejen nabor kandidatov",
    "Check alternative defensive replies":"Preveri alternativne obrambne odgovore","Defensive replies per candidate:":"Obrambni odgovori na kandidata:",
    "Defence continuation (half-moves):":"Nadaljevanje obrambe (polpoteze):","Structure signal:":"Signal strukture:","Describe only":"Samo opiši",
    "Allow in experimental ranking":"Dovoli v eksperimentalni razvrstitvi","Active ranking sensors":"Aktivni senzorji razvrščanja","Stability":"Stabilnost",
    "Evaluation floor":"Dno ocene","Volatility":"Volatilnost","Trend":"Trend","Structure":"Struktura","DCC only (hide raw ChessDB scores)":"Samo DCC (skrij surove ChessDB ocene)",
    "Sim speed:":"Hitrost simulacije:","Study (5s/move)":"Študij (5 s/potezo)","Slow (2s/move)":"Počasi (2 s/potezo)","Normal (1s)":"Normalno (1 s)",
    "Fast (0.4s)":"Hitro (0,4 s)","Fast (keep board visible)":"Hitro (šahovnica ostane vidna)","Thresholds ▼":"Pragovi ▼","Reset Settings":"Ponastavi nastavitve",
    "More":"Več","SIM FOCUS":"FOKUS SIM","Tools":"Orodja","Input":"Vnos","Copy":"Kopiraj","Save PGN":"Shrani PGN","Load PGN":"Naloži PGN",
    "Flip board":"Obrni šahovnico","Study":"Študij","Deep analysis":"Globoka analiza","Evidence":"Dokazi","Benchmark":"Primerjava","PGN picks":"PGN izbori","Why DCC?":"Zakaj DCC?",
    "Experimental analysis":"Eksperimentalna analiza","Board":"Šahovnica","Moves":"Poteze","Review":"Pregled","Deep":"Globoko","Workspace tools":"Orodja delovnega prostora",
    "Simulation / play":"Simulacija / igra","Simulation continues until you pause or choose an action that changes the position.":"Simulacija teče, dokler je ne ustaviš ali izbereš dejanja, ki spremeni položaj.",
    "Install APP":"Namesti APP","Open APP without frame ↗":"Odpri APP brez okvirja ↗","Install ChessBest APP on your Home Screen.":"Namesti ChessBest APP na domači zaslon.",
    "Choose a source and controller independently for each side.":"Za vsako stran neodvisno izberi vir in krmilnik.","Local engines":"Lokalni motorji","Lichess Bot · native setup pending":"Lichess Bot · native nastavitev še čaka",
    "Level":"Nivo","White engine":"Motor belih","Black engine":"Motor črnih","SF root budget":"SF začetni proračun","Move pause":"Pavza med potezami",
    "Swap White / Black":"Zamenjaj bele / črne","8Z color":"Barva 8Z","Random":"Naključno","Time":"Čas","Start":"Začni","Cancel":"Prekliči",
    "DCC Replay Settings":"Nastavitve DCC replaya","Lookahead depth:":"Globina pogleda naprej:","Top candidates:":"Najboljši kandidati:","Speed per move:":"Hitrost na potezo:",
    "Start Replay":"Začni replay","Play together on this device. CDB + DCC observes both players.":"Igrajta skupaj na tej napravi. CDB + DCC opazuje oba igralca.",
    "White name":"Ime belih","Black name":"Ime črnih","Time per player":"Čas na igralca","No limit · elapsed time":"Brez omejitve · pretečeni čas",
    "1 minute":"1 minuta","3 minutes":"3 minute","5 minutes":"5 minut","10 minutes":"10 minut","15 minutes":"15 minut","30 minutes":"30 minut","60 minutes":"60 minut",
    "Increment per move":"Dodatek na potezo","None":"Brez","1 second":"1 sekunda","2 seconds":"2 sekundi","3 seconds":"3 sekunde","5 seconds":"5 sekund","10 seconds":"10 sekund",
    "Start from this position":"Začni iz tega položaja","Each question shares the current board and available CDB/DCC analysis with Gemini.":"Vsako vprašanje z Gemini deli trenutni položaj in razpoložljivo CDB/DCC analizo.",
    "Explain position":"Razloži položaj","CDB vs DCC":"CDB proti DCC","How to test":"Kako testirati","Ask Gemini about this game":"Vprašaj Gemini o tej partiji",
    "Send ↗":"Pošlji ↗","Advice is tied to the position at the time of your question.":"Nasvet je vezan na položaj v trenutku vprašanja.",
    "First position":"Prvi položaj","Previous move":"Prejšnja poteza","Next move":"Naslednja poteza","Last position":"Zadnji položaj",
    "Position and move controls":"Kontrole položaja in potez","Moves and DCC analysis":"Poteze in DCC analiza","APP installation and offline access":"Namestitev APP in dostop brez povezave",
    "Close workspace tools":"Zapri orodja delovnega prostora","Close game library":"Zapri knjižnico partij","Close settings":"Zapri nastavitve",
    "TOP LINE":"TOP LINIJA","Top line":"Top linija","ANALYSIS":"ANALIZA","Analysis pending":"Analiza čaka",
    "Top line appears when a measured continuation is available.":"Top linija se prikaže, ko je na voljo izmerjeno nadaljevanje.",
    "Top line appears when CDB or SF has a measured continuation.":"Top linija se prikaže, ko ima CDB ali SF izmerjeno nadaljevanje.",
    "DCC replay running":"DCC replay teče","Game in progress":"Partija poteka","Stop replay":"Ustavi replay","End game":"Končaj partijo",
    "APP storage is unavailable":"Shramba APP ni na voljo","Offline files ready · Board, saved studies, bundled games and local Stockfish are available without internet.":"Datoteke brez povezave so pripravljene · Šahovnica, shranjene študije, vključene partije in lokalni Stockfish delujejo brez interneta.",
    "Preparing offline files… Keep APP open until ready.":"Pripravljam datoteke za delo brez povezave… APP pusti odprt, dokler niso pripravljene."
  };
  const textBase = new WeakMap(), attrBase = new WeakMap();
  let lang = 'en', busy = false;
  function translateValue(value) {
    const trimmed = value.trim();
    if (exact[trimmed]) return value.replace(trimmed, exact[trimmed]);
    let m = trimmed.match(/^Position after (\d+) half-moves$/);
    if (m) return value.replace(trimmed, 'Položaj po ' + m[1] + ' polpotezah');
    m = trimmed.match(/^SF depth (\d+)(.*)$/);
    if (m) return value.replace(trimmed, 'SF globina ' + m[1] + m[2]);
    return value;
  }
  function textNode(node) {
    if (!node || node.nodeType !== 3 || !node.nodeValue.trim()) return;
    const current = node.nodeValue;
    const saved = textBase.get(node);
    if (lang === 'sl') {
      if (!saved || current !== translateValue(saved)) textBase.set(node, current);
      const base = textBase.get(node);
      const translated = translateValue(base);
      if (current !== translated) node.nodeValue = translated;
    } else if (saved && current !== saved) node.nodeValue = saved;
  }
  function attrs(el) {
    if (!el || el.nodeType !== 1) return;
    let base = attrBase.get(el); if (!base) { base = {}; attrBase.set(el, base); }
    for (const name of ['aria-label','title','placeholder']) {
      if (!el.hasAttribute(name)) continue;
      const current = el.getAttribute(name), saved = base[name];
      if (lang === 'sl') {
        if (!saved || current !== translateValue(saved)) base[name] = current;
        const translated = translateValue(base[name]);
        if (current !== translated) el.setAttribute(name, translated);
      } else if (saved && current !== saved) el.setAttribute(name, saved);
    }
  }
  function walk(rootNode) {
    if (!rootNode) return;
    if (rootNode.nodeType === 3) { textNode(rootNode); return; }
    if (rootNode.nodeType !== 1 && rootNode.nodeType !== 9 && rootNode.nodeType !== 11) return;
    if (rootNode.nodeType === 1) attrs(rootNode);
    const walker = doc.createTreeWalker(rootNode, root.NodeFilter.SHOW_ELEMENT | root.NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) node.nodeType === 3 ? textNode(node) : attrs(node);
  }
  function render() {
    busy = true; doc.documentElement.lang = lang; walk(doc.body);
    for (const button of doc.querySelectorAll('[data-app-lang]')) button.setAttribute('aria-pressed', String(button.dataset.appLang === lang));
    busy = false;
  }
  function setLang(next, persist) {
    lang = next === 'sl' ? 'sl' : 'en';
    if (persist !== false) try { root.localStorage.setItem(KEY, lang); } catch (_) {}
    api.lang = lang; render();
    doc.dispatchEvent(new root.CustomEvent('chess:language', { detail: { lang } }));
  }
  const api = { lang, setLang, translate: translateValue };
  root.ChessAppI18n = api;
  function start() {
    let saved = null; try { saved = root.localStorage.getItem(KEY); } catch (_) {}
    setLang(saved || (/^sl(?:-|$)/i.test(root.navigator.language || '') ? 'sl' : 'en'), false);
    for (const button of doc.querySelectorAll('[data-app-lang]')) button.addEventListener('click', () => setLang(button.dataset.appLang, true));
    if (root.MutationObserver) new MutationObserver(records => {
      if (busy) return;
      busy = true;
      for (const record of records) {
        if (record.type === 'characterData') textNode(record.target);
        else for (const node of record.addedNodes) walk(node);
      }
      busy = false;
    }).observe(doc.body, { subtree: true, childList: true, characterData: true });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(window);
