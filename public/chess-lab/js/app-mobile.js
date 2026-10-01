/* Unified LAB mobile/native view controller. Desktop keeps the normal LAB layout;
 * phone browsers and Capacitor native builds use one focused view at a time. */
(function (root) {
  'use strict';
  const doc = root.document;
  const ua = root.navigator?.userAgent || '';
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
  const phone = !tablet && (root.navigator?.userAgentData?.mobile === true || /iPhone|iPod|Windows Phone|Android.+Mobile/i.test(ua));
  const native = !!root.Capacitor?.isNativePlatform?.();
  if (!native && !phone) return;
  doc.body.classList.add('app-mobile');
  doc.body.dataset.appRuntime = native ? 'native' : 'phone';
  doc.dispatchEvent(new CustomEvent('chess:mobile-ready', { detail: { native, phone } }));
  const byId = id => doc.getElementById(id);
  const views = new Set(['board', 'moves', 'review', 'deep', 'dcc']);
  const scroll = { moves: 0, dcc: 0 };
  let current = 'board', host = null, miniBoard = null, lastFen = '', movesPly = null, activity = {};
  const LANG_KEY = 'ChessBest:LAB:v2:language';
  const TOP_LINE_KEY = 'ChessBest:LAB:v2:showTopLine';
  let showTopLine = false;
  let lang = 'en', i18nApplying = false, languageObserver = null;
  const textSources = new WeakMap(), attrSources = new WeakMap();
  const TO_SL = new Map(Object.entries({
    'Board':'Šahovnica','Moves':'Poteze','Review':'Pregled','Deep':'Globoko','Analysis board':'Analizna šahovnica',
    'ANALYSIS BOARD':'ANALIZNA ŠAHOVNICA','Simulation / play':'Sim / Play','Sim / Play':'Sim / Play','Simulation':'Sim','Analysis':'Analiza','Deeper SF':'Globlji SF',
    'Hide Eval':'Skrij oceno','Current position':'Trenutni položaj','Starting position':'Začetni položaj','Select a move on the board':'Izberi potezo na šahovnici',
    'Show board':'Pokaži šahovnico','Game library':'Knjižnica partij','New game':'Nova igra','More':'Več','Settings':'Nastavitve',
    'Study':'Študija','Deep analysis':'Globoka analiza','Search depth':'Globina iskanja','Until I stop':'Dokler ne ustavim','Lines':'Linije',
    'Evidence':'Dokazi','Benchmark':'Primerjava','PGN picks':'PGN izbori','Why DCC?':'Zakaj DCC?',
    'White':'Beli','Black':'Črni','Two players':'Dva igralca','Pause game':'Premor igre','End study':'Končaj študijo',
    'Pause':'Premor','Stop replay':'Ustavi ponovitev','End game':'Končaj igro','Stop':'Ustavi','Simulation running':'Simulacija teče',
    'DCC replay running':'DCC ponovitev teče','Game in progress':'Igra poteka','Your next move starts here':'Tvoja naslednja poteza se začne tukaj',
    'CDB pending':'CDB čaka','Show Eval':'Pokaži oceno','Try Later':'Poskusi pozneje','More tools':'Več orodij',
    'Best move is not ready yet.':'Najboljša poteza še ni pripravljena.','Waiting for analysis…':'Analiziram…',
    'TOP LINE · CDB':'GLAVNA LINIJA · CDB','TOP LINE · SF':'GLAVNA LINIJA · SF',
    'Install LAB':'Namesti LAB','Install ChessBest LAB on your Home Screen.':'Namesti ChessBest LAB na domači zaslon.',
    'Application versions':'Različice aplikacije','Language':'Jezik','ChessBest views':'Pogledi ChessBest','Workspace tools':'Orodja delovnega prostora',
    'Position and move controls':'Kontrole položaja in potez','Player clocks and local game controls':'Igralne ure in lokalne kontrole',
    'Chess analysis board':'Šahovska analizna plošča','Interactive chess board':'Interaktivna šahovnica','CDB, SF and DCC comparison':'Primerjava CDB, SF in DCC',
    'Main analysis source':'Glavni vir analize','Board analysis source':'Vir analize šahovnice','Deeper SF analysis':'Globlje SF analiziranje',
    'First position':'Prvi položaj','Previous move':'Prejšnja poteza','Next move':'Naslednja poteza','Last position':'Zadnji položaj',
    'DCC replay':'DCC ponovitev','DCC analysis':'DCC analiza','Review game':'Preglej partijo',
    'Load a game:':'Naloži partijo:','— select —':'— izberi —','Stockfish analysis':'Stockfish analiza','SF depth per position:':'SF globina na položaj:',
    'Bottom tools during Sim:':'Spodnja orodja med simulacijo:','Focus automatically':'Samodejni fokus','Always expanded':'Vedno razširjeno',
    'Workspace width on a wide screen:':'Širina delovnega prostora na širokem zaslonu:','Default':'Privzeto','Compact analysis spacing':'Kompaktni razmiki analize',
    'Pause Sim at an interesting position':'Ustavi simulacijo na zanimivem položaju','Raw engine and DCC choose different moves':'Surovi engine in DCC izbereta različni potezi',
    'Evaluation changes sharply':'Ocena se močno spremeni','Evaluation change (centipawns):':'Sprememba ocene (centipawns):',
    'Required analysis data is missing':'Manjkajo zahtevani podatki analize','Show player timers during games and simulations':'Prikaži igralne ure med igrami in simulacijami',
    'Show move timestamps':'Prikaži časovne oznake potez','Show Top line':'Prikaži vrstico TOP','Show top moves:':'Prikaži najboljše poteze:','Show next-move preview':'Prikaži predogled naslednje poteze',
    'Evaluation method:':'Metoda ocenjevanja:','History height:':'Višina zgodovine:','Font size:':'Velikost pisave:','Piece size:':'Velikost figur:',
    'Main background:':'Glavno ozadje:','Light theme':'Svetla tema','Double size board':'Dvojna velikost šahovnice',
    'DCC Lookahead':'DCC pogled naprej','Enable DCC lookahead':'Vključi DCC pogled naprej','DCC move click:':'Klik DCC poteze:',
    'Details only':'Samo podrobnosti','Play move only':'Samo odigraj potezo','Hybrid · play + details':'Hibrid · odigraj + podrobnosti',
    'Lookahead depth (half-moves):':'Globina pogleda naprej (polpoteze):','Extra inspection pool:':'Dodatni nabor za pregled:',
    'Candidate window (cp below best):':'Okno kandidatov (cp pod najboljšo):','Decision policy:':'Politika odločitve:',
    'Balanced · include all near ties':'Uravnoteženo · vključi vse skoraj izenačene','Legacy · capped candidate pool':'Legacy · omejen nabor kandidatov',
    'Check alternative defensive replies':'Preveri alternativne obrambne odgovore','Defensive replies per candidate:':'Obrambni odgovori na kandidata:',
    'Defence continuation (half-moves):':'Nadaljevanje obrambe (polpoteze):','Structure signal:':'Strukturni signal:','Describe only':'Samo opiši',
    'Allow in experimental ranking':'Dovoli v eksperimentalnem rangiranju','Active ranking sensors':'Aktivni senzorji rangiranja',
    'Stability':'Stabilnost','Evaluation floor':'Spodnja meja ocene','Volatility':'Volatilnost','Structure':'Struktura',
    'DCC only (hide raw ChessDB scores)':'Samo DCC (skrij surove ChessDB ocene)','Sim speed:':'Hitrost simulacije:','Reset Settings':'Ponastavi nastavitve',
    'Tools':'Orodja','Input':'Vnos','Copy':'Kopiraj','Save PGN':'Shrani PGN','Load PGN':'Naloži PGN','Flip board':'Obrni šahovnico',
    'Start':'Začni','Cancel':'Prekliči','Start Replay':'Začni ponovitev','DCC Replay Settings':'Nastavitve DCC ponovitve',
    'White engine':'Engine belega','Black engine':'Engine črnega','Swap White / Black':'Zamenjaj beli / črni','8Z color':'Barva 8Z',
    'Random':'Naključno','Time':'Čas','White name':'Ime belega','Black name':'Ime črnega','Time per player':'Čas na igralca',
    'No limit · elapsed time':'Brez omejitve · pretečeni čas','Increment per move':'Dodatek na potezo','None':'Brez','Start from this position':'Začni iz tega položaja',
    'Explain position':'Razloži položaj','CDB vs DCC':'CDB proti DCC','How to test':'Kako testirati','Ask Gemini about this game':'Vprašaj Gemini o tej partiji',
    'Send ↗':'Pošlji ↗','Close workspace tools':'Zapri orodja delovnega prostora','Close settings':'Zapri nastavitve','Close game library':'Zapri knjižnico partij',
    'Find your next game':'Poišči naslednjo partijo','Players, openings, events or years':'Igralci, otvoritve, dogodki ali leta',
    'Try Carlsen, Sicilian, 2024…':'Poskusi Carlsen, Sicilijanka, 2024…','Collection':'Zbirka','All collections':'Vse zbirke',
    'Matching games':'Ujemajoče se partije','Games':'Partije','Simulation game':'Simulacijska partija',
    'Loading Top Picks…':'Nalaganje Top Picks…','No games match. Try another player, year or collection.':'Ni ujemajočih partij. Poskusi drugega igralca, leto ali zbirko.',
    'Loading game collections…':'Nalaganje zbirk partij…','No collections loaded. Use Load PGN to open a game from your device.':'Nobena zbirka ni naložena. Uporabi Naloži PGN za odprtje partije iz naprave.',
    'Use position in Sim / tournament':'Uporabi položaj v Sim / turnirju','Use the displayed position as a paired opening':'Uporabi prikazani položaj kot otvoritev za obe barvi',
    'Start a new game':'Začni novo igro','Download your game as PGN':'Prenesi svojo partijo kot PGN','Load a PGN file':'Naloži PGN datoteko',
    'Flip the board orientation':'Obrni usmeritev šahovnice','Saved variations and pinned A/B comparison':'Shranjene variante in pripeta primerjava A/B',
    'Toggle deep analysis in the workspace':'Preklopi globoko analizo v delovnem prostoru','Inspect and export the analysis evidence':'Preglej in izvozi dokaze analize',
    'Compare DCC policies and sensors':'Primerjaj DCC politike in senzorje','Chess resources':'Šahovski viri','Email Bojan D.':'Pošlji e-pošto Bojanu D.'
  }));
  const TO_EN = new Map(Object.entries({
    'Tvoja ideja.':'Your idea.','Preverjene alternative.':'Verified alternatives.','Samostojni podatki APP.':'Independent APP data.',
    'Studies brez delnih zapisov.':'Studies without partial records.','Viri analiz ostanejo ločeni.':'Analysis sources stay separate.',
    'Zaženi':'Run','Celotna skupina izenačenih potez.':'Complete near-tied group.','Preverjanje obramb.':'Defense checks.',
    'Deep analysis.':'Deep analysis.','Uravnotežen pregled kandidatov.':'Balanced candidate review.','Senzorji pod drobnogledom.':'Sensors under inspection.',
    'Study in ohranjene variante.':'Study and saved variations.','Pripeta primerjava A/B.':'Pinned A/B comparison.',
    'Pavza ob zanimivem dogodku.':'Pause on an interesting event.','Več udobja pri branju.':'More reading comfort.',
    'Prvi preizkus':'First test','Odpri Help':'Open Help','Nazaj na šahovnico →':'Back to board →','Zapri novosti':'Close what\'s new',
    'Simulacija / igra':'Sim / Play','Simulacija':'Sim'
  }));

  function translateText(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return text;
    let translated = lang === 'sl' ? TO_SL.get(clean) : TO_EN.get(clean);
    if (!translated && lang === 'sl') {
      let m = clean.match(/^Position after (\d+) half-moves$/);
      if (m) translated = `Položaj po ${m[1]} polpotezah`;
      m = clean.match(/^SF depth (\d+) · (\d+) nodes…$/);
      if (!translated && m) translated = `SF globina ${m[1]} · ${m[2]} vozlišč…`;
      if (!translated && clean === 'CDB, SF and DCC analysis…') translated = 'Analiza CDB, SF in DCC…';
      m = clean.match(/^(\d[\d.,]*) games$/);
      if (!translated && m) translated = `Partije: ${m[1]}`;
      m = clean.match(/^(\d[\d.,]*) of (\d[\d.,]*) games$/);
      if (!translated && m) translated = `Partije: ${m[1]} / ${m[2]}`;
      m = clean.match(/^(\d[\d.,]*) (?:game|games) found\. Select a game to load it\.$/);
      if (!translated && m) translated = `Najdene partije: ${m[1]}. Izberi partijo za nalaganje.`;
      m = clean.match(/^Showing 60 of (\d[\d.,]*) matches\. Refine your search to see more\.$/);
      if (!translated && m) translated = `Prikazujem 60 od ${m[1]} zadetkov. Zoži iskanje za več rezultatov.`;
      if (!translated && clean.startsWith('My matches ·')) translated = clean.replace('My matches ·', 'Moji dvoboji ·');
      if (!translated && clean.startsWith('My tournaments ·')) translated = clean.replace('My tournaments ·', 'Moji turnirji ·');
      if (!translated && clean.startsWith('Offline files ready ·')) translated = clean.replace('Offline files ready ·', 'Offline datoteke pripravljene ·');
      if (!translated && clean.startsWith('Preparing offline files…')) translated = clean.replace('Preparing offline files…', 'Pripravljam offline datoteke…');
    }
    if (!translated) return text;
    const lead = text.match(/^\s*/)?.[0] || '', tail = text.match(/\s*$/)?.[0] || '';
    return lead + translated + tail;
  }
  function translateNode(node, dynamic = false) {
    if (!node || node.nodeType !== 3 || !node.nodeValue?.trim()) return;
    if (!textSources.has(node)) textSources.set(node, node.nodeValue);
    else if (dynamic) {
      const source = textSources.get(node);
      if (node.nodeValue !== translateText(source)) textSources.set(node, node.nodeValue);
    }
    node.nodeValue = translateText(textSources.get(node));
  }
  function translateElement(el, dynamic = false) {
    if (!el || /^(SCRIPT|STYLE)$/i.test(el.tagName || '')) return;
    for (const node of el.childNodes || []) if (node.nodeType === 3) translateNode(node, dynamic);
    let stored = attrSources.get(el);
    if (!stored) { stored = {}; attrSources.set(el, stored); }
    for (const attr of ['title', 'aria-label', 'placeholder']) {
      if (!el.hasAttribute?.(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in stored)) stored[attr] = current;
      else if (dynamic && current !== translateText(stored[attr])) stored[attr] = current;
      el.setAttribute(attr, translateText(stored[attr]));
    }
  }
  function observeLanguage() {
    if (!root.MutationObserver) return;
    if (!languageObserver) languageObserver = new MutationObserver(mutations => {
      if (i18nApplying) return;
      languageObserver.disconnect();
      i18nApplying = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') translateNode(mutation.target, true);
          else for (const node of mutation.addedNodes) {
            if (node.nodeType === 3) translateNode(node, true);
            else if (node.nodeType === 1) {
              translateElement(node, true);
              for (const el of node.querySelectorAll?.('*') || []) translateElement(el, true);
            }
          }
        }
      } finally {
        i18nApplying = false;
        languageObserver.observe(doc.body, { subtree: true, childList: true, characterData: true });
      }
    });
    languageObserver.observe(doc.body, { subtree: true, childList: true, characterData: true });
  }
  function applyLanguage(next, persist = true) {
    lang = next === 'sl' ? 'sl' : 'en';
    if (persist) try { root.localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    doc.documentElement.lang = lang;
    languageObserver?.disconnect();
    i18nApplying = true;
    try {
      translateElement(doc.body);
      for (const el of doc.body.querySelectorAll('*')) translateElement(el);
      for (const button of doc.querySelectorAll('[data-app-lang]')) button.setAttribute('aria-pressed', String(button.dataset.appLang === lang));
      if (host) { updatePosition(); updateActivity({}); }
    } finally {
      i18nApplying = false;
      if (languageObserver) languageObserver.observe(doc.body, { subtree: true, childList: true, characterData: true });
    }
  }
  function initLanguage() {
    let saved = null;
    try { saved = root.localStorage.getItem(LANG_KEY); } catch (_) {}
    const initial = saved === 'sl' || saved === 'en' ? saved : (/^sl(?:-|$)/i.test(root.navigator.language || '') ? 'sl' : 'en');
    for (const button of doc.querySelectorAll('[data-app-lang]')) button.addEventListener('click', () => applyLanguage(button.dataset.appLang));
    applyLanguage(initial, false);
    observeLanguage();
  }
  function reviewPanel() { return byId('gameReviewPanel'); }
  function deepPanel() { return byId('deepAnalysisPanel'); }
  function isDccOpen() { return byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true'; }
  function lineToSan(fen, moves) {
    if (!host?.Chess || !Array.isArray(moves) || !moves.length) return [];
    try {
      const board = new host.Chess(fen), out = [];
      for (const uci of moves.slice(0, 10)) {
        if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci)) break;
        const move = board.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' });
        if (!move) break;
        out.push(move.san);
      }
      return out;
    } catch (_) { return []; }
  }
  function setTopLineVisibility(next, persist = true) {
    showTopLine = !!next;
    const toggle = byId('settingAppTopLine');
    if (toggle) toggle.checked = showTopLine;
    if (persist) {
      try { root.localStorage.setItem(TOP_LINE_KEY, showTopLine ? '1' : '0'); } catch (_) {}
    }
    if (host) updateTopLine(host.getContext());
    else if (byId('appTopLine')) byId('appTopLine').hidden = !showTopLine;
  }
  function initTopLineSetting() {
    let saved = null;
    try { saved = root.localStorage.getItem(TOP_LINE_KEY); } catch (_) {}
    showTopLine = saved === '1' || saved === 'true';
    const toggle = byId('settingAppTopLine');
    if (toggle) {
      toggle.checked = showTopLine;
      toggle.addEventListener('change', () => setTopLineVisibility(toggle.checked));
    }
    byId('btnResetSettings')?.addEventListener('click', () => setTopLineVisibility(false));
    if (byId('appTopLine')) byId('appTopLine').hidden = !showTopLine;
  }
  function updateTopLine(context) {
    const card = byId('appTopLine'), label = byId('appTopLineLabel'), movesEl = byId('appTopLineMoves');
    if (!card || !context) return;
    card.hidden = !showTopLine;
    const sources = context.analysisSources || {};
    const cdb = sources.CDB, sf = sources.SF, dcc = sources.DCC;
    const cdbBest = cdb?.allMoves?.[0] || cdb?.candidates?.[0] || null;
    const sfBest = sf?.allMoves?.[0] || sf?.candidates?.[0] || null;
    let source = null, depth = null, pv = null;
    if (cdb?.receipt?.status === 'ready' && cdbBest?.move) {
      source = 'CDB';
      const raw = cdbBest.move;
      const candidate = dcc?.receipt?.provider === 'CDB'
        ? (dcc.candidates || []).find(item => item.move === raw) : null;
      const data = candidate?.data || candidate;
      const continuation = Array.isArray(data?.movePath) ? data.movePath : [];
      pv = [raw, ...continuation];
      depth = Number.isFinite(data?.pvDepth) && data.pvDepth > 0 ? data.pvDepth : null;
    } else if (cdb?.receipt?.status === 'unavailable' && sfBest?.move) {
      source = 'SF';
      pv = Array.isArray(sfBest.pv) && sfBest.pv.length ? sfBest.pv : [sfBest.move];
      depth = Number.isFinite(sfBest.depth) ? sfBest.depth :
        Number.isFinite(sf?.receipt?.depth) ? sf.receipt.depth : null;
    }
    const san = lineToSan(context.fen, pv || []);
    if (source && san.length) {
      label.textContent = depth ? `TOP (d${depth}):` : 'TOP:';
      movesEl.textContent = san.join(' ');
      card.dataset.topSource = source;
      card.title = `${source} · ${lang === 'sl' ? 'Odpri Poteze za isti položaj' : 'Open Moves for the same position'}`;
    } else {
      const statusText = byId('analysisSourceStatus')?.textContent?.trim() || '';
      const cdbSettled = cdb?.receipt?.status === 'ready' || cdb?.receipt?.status === 'unavailable';
      const pending = !cdbSettled || /pending|analysis|depth|nodes|čaka|analiza|globina|vozlišč/i.test(statusText);
      label.textContent = 'TOP:';
      movesEl.textContent = pending
        ? (lang === 'sl' ? 'Analiziram…' : 'Analyzing…')
        : (lang === 'sl' ? 'Glavna linija za ta položaj ni na voljo.' : 'Top line is not available for this position.');
      delete card.dataset.topSource;
      card.title = lang === 'sl' ? 'Odpri Poteze za isti položaj' : 'Open Moves for the same position';
    }
  }
  function updatePosition() {
    if (!host) return;
    const context = host.getContext();
    if (!context?.fen) return;
    const title = byId('boardGameTitle')?.textContent?.trim() || byId('gameTitle')?.textContent?.trim() || 'ChessBest';
    const ply = Array.isArray(context.history) ? context.history.length : null;
    const label = ply == null ? 'Current position' : (ply === 0 ? 'Starting position' : `Position after ${ply} half-moves`);
    byId('appGameName').textContent = title;
    byId('appPositionName').textContent = label;
    byId('appPreviewTitle').textContent = title;
    byId('appPreviewMove').textContent = label;
    updateTopLine(context);
    if (current !== 'board') {
      if (!miniBoard && root.Chessboard) {
        miniBoard = root.Chessboard('appMiniBoard', {
          position: context.fen, draggable: false,
          pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        });
        lastFen = context.fen;
      } else if (miniBoard && context.fen !== lastFen) {
        miniBoard.position(context.fen, false);
        lastFen = context.fen;
      }
    }
    if (current === 'moves' && movesPly !== ply) {
      root.requestAnimationFrame(() => root.requestAnimationFrame(() => revealCurrentMove(ply)));
    }
  }
  function revealCurrentMove(ply) {
    if (current !== 'moves' || !Number.isInteger(ply)) return;
    const move = byId('moves')?.querySelector(`[data-history-ply="${Math.max(0, ply - 1)}"]`);
    const display = byId('workspaceDisplay');
    if (!move || !display) return;
    const visible = display.getBoundingClientRect();
    const selected = move.getBoundingClientRect();
    display.scrollTop += selected.top - visible.top - (visible.height - selected.height) / 2;
    scroll.moves = display.scrollTop;
    movesPly = ply;
  }
  function resizeVisibleBoard() {
    root.requestAnimationFrame(() => root.requestAnimationFrame(() => {
      if (current === 'board') root.dispatchEvent(new Event('8zc:resize'));
      else miniBoard?.resize();
    }));
  }
  function closeReview() {
    if (reviewPanel() && !reviewPanel().hidden) byId('btnGameReview')?.click();
  }
  function closeDeep() {
    if (deepPanel() && !deepPanel().hidden) deepPanel().querySelector('[data-deep="close"]')?.click();
  }
  function closeWorkspaceDrawer() {
    for (const [panelId, buttonId] of [['popularGamesPanel', 'btnCloseGames'], ['settingsPanel', 'btnCloseSettings']]) {
      if (byId(panelId)?.classList.contains('open')) byId(buttonId)?.click();
    }
  }
  function setView(next) {
    if (!views.has(next)) return;
    const display = byId('workspaceDisplay');
    if (current === 'moves' || current === 'dcc') scroll[current] = display.scrollTop;
    closeWorkspaceDrawer();
    if (current === 'review' && next !== 'review') closeReview();
    if (current === 'deep' && next !== 'deep') closeDeep();
    current = next;
    doc.body.dataset.appView = next;
    byId('appPositionPreview').hidden = next === 'board';
    byId('appReplay').hidden = next !== 'dcc';
    for (const tab of byId('appTabs').querySelectorAll('[data-app-tab]')) {
      if (tab.dataset.appTab === next) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    if (next !== 'dcc' && isDccOpen()) byId('btnViewToggle').click();
    if (next === 'dcc' && !isDccOpen()) byId('btnViewToggle').click();
    if (next === 'review' && reviewPanel()?.hidden) byId('btnGameReview').click();
    if (next === 'review' && reviewPanel() && !reviewPanel().dataset.appObserved && root.MutationObserver) {
      const panel = reviewPanel();
      panel.dataset.appObserved = 'true';
      new MutationObserver(() => { if (current === 'review' && panel.hidden) setView('moves'); })
        .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (next === 'deep' && deepPanel()?.hidden) byId('btnDeepAnalysis').click();
    if (next === 'deep' && deepPanel() && !deepPanel().dataset.appObserved && root.MutationObserver) {
      const panel = deepPanel();
      panel.dataset.appObserved = 'true';
      new MutationObserver(() => { if (current === 'deep' && panel.hidden) setView('moves'); })
        .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (next === 'moves' || next === 'dcc') display.scrollTop = scroll[next];
    updatePosition();
    resizeVisibleBoard();
  }
  function updateActivity(detail) {
    activity = { ...activity, ...detail };
    const label = activity.kind === 'replay' ? 'DCC replay running'
      : activity.kind === 'local' ? 'Game in progress' : 'Simulation running';
    const active = activity.kind === 'replay' || activity.kind === 'local' || !!activity.simRunning;
    byId('appActivity').hidden = !active;
    byId('appActivityText').textContent = label;
    byId('appPause').textContent = activity.kind === 'replay' ? 'Stop replay'
      : activity.kind === 'local' ? 'End game' : 'Pause';
    byId('appPause').disabled = !active;
  }
  function init() {
    host = root.ChessLabHost;
    if (!host || !byId('appTabs')) return;
    initTopLineSetting();
    // Move existing controls, keeping their IDs and event listeners intact.
    const controls = byId('appBoardControls');
    const analysisRow = doc.querySelector('.analysis-source-row');
    const navRow = doc.querySelector('.top-buttons');
    const status = byId('analysisSourceStatus');
    const actionRow = doc.createElement('div'); actionRow.className = 'app-action-row';
    const analysisSlot = doc.createElement('div'); analysisSlot.className = 'app-analysis-slot';
    analysisSlot.append(analysisRow);
    actionRow.append(analysisSlot, byId('appSim'));
    controls.append(navRow, actionRow, status, byId('appTopLine'));
    byId('appClocks').append(byId('workspaceClockSlot'), byId('humanSession'));
    host.onChange(updatePosition);
    for (const tab of byId('appTabs').querySelectorAll('[data-app-tab]')) {
      tab.addEventListener('click', () => setView(tab.dataset.appTab));
    }
    byId('appExpandBoard').addEventListener('click', () => setView('board'));
    byId('appNew').addEventListener('click', () => { byId('btnNew').click(); setView('board'); });
    byId('appGames').addEventListener('click', () => {
      setView('moves');
      if (!byId('popularGamesPanel').classList.contains('open')) byId('btnGames').click();
    });
    byId('appMore').addEventListener('click', () => root.ChessLabLayout?.openTools());
    byId('appSim').addEventListener('click', () => byId('btnSim').click());
    byId('appSimMore').addEventListener('click', () => {
      root.ChessLabLayout?.closeTools({ restoreFocus: false });
      setView('board');
      byId('btnSim').click();
    });
    byId('appReplay').addEventListener('click', () => byId('btnReplay').click());
    byId('appTopLine')?.addEventListener('click', () => setView('moves'));
    byId('next')?.addEventListener('click', event => {
      const review = host.getReviewGame?.();
      if (!review || review.cursor < review.totalPly) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = host.getContext();
      const cdb = context.analysisSources?.CDB, sf = context.analysisSources?.SF;
      let best = null;
      if (cdb?.receipt?.status === 'ready') best = cdb.allMoves?.[0] || cdb.candidates?.[0] || null;
      else if (cdb?.receipt?.status === 'unavailable') best = sf?.allMoves?.[0] || sf?.candidates?.[0] || null;
      if (!best?.move || !host.playSuggestedMove?.(best.move)) {
        byId('analysisSourceStatus').textContent = lang === 'sl'
          ? 'Najboljša poteza še ni pripravljena.' : 'Best move is not ready yet.';
      }
    }, true);
    byId('appPause').addEventListener('click', () => doc.dispatchEvent(new CustomEvent('chess:pause-request', { detail: { source: 'app-header' } })));
    // Drawers belong to #controls. Reveal that area before the original action runs.
    byId('labToolsDialog').addEventListener('click', event => {
      const id = event.target.closest('button')?.id;
      if (id === 'btnGames' || id === 'btnSettings') setView('moves');
      if (id === 'btnNew') root.setTimeout(() => setView('board'), 0);
      if (id === 'btnDeepAnalysis') root.setTimeout(() => setView('deep'), 0);
      if (id === 'btnViewToggle') root.setTimeout(() => setView('dcc'), 0);
    }, true);
    byId('labToolsDialog').addEventListener('close', () => byId('appMore').focus({ preventScroll: true }));
    byId('replayStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('simStartBtn')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('humanStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    if (root.MutationObserver) new MutationObserver(() => {
      if (current === 'board' && isDccOpen()) setView('dcc');
    }).observe(byId('btnViewToggle'), { attributes: true, attributeFilter: ['aria-pressed'] });
    doc.addEventListener('chess:activity', event => updateActivity(event.detail || {}));
    const gameTitle = byId('boardGameTitle');
    if (gameTitle && root.MutationObserver) new MutationObserver(updatePosition).observe(gameTitle, { childList: true, characterData: true, subtree: true });
    const refreshTopLine = () => updateTopLine(host.getContext());
    if (root.MutationObserver) for (const watched of [byId('analysisSourceStatus'), byId('dccProgress'), byId('allEvalBadges')]) {
      if (watched) new MutationObserver(refreshTopLine).observe(watched, { childList: true, characterData: true, subtree: true, attributes: true });
    }
    updatePosition();
    resizeVisibleBoard();
  }
  const boot = () => {
    Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(() => {
      initLanguage();
      init();
    }).catch(() => {
      byId('appPositionName').textContent = 'LAB storage is unavailable';
    });
  };
  if (doc.readyState === 'complete') boot();
  else root.addEventListener('load', boot, { once: true });
})(window);
