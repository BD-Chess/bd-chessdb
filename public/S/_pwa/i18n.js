'use strict';
// Local EN/SL presentation only. Machine values, exports, solver evidence and
// user-entered text are never translated. Embedded verbatim in standalone LAB.
(() => {
 if (window.SudokuI18n) return;
 const KEY='8zSudoku.ui.language';
 const SL={
 'Play':'Igra','Learn':'Učenje','Lab':'Laboratorij','Game views':'Pogledi igre',
 'CURRENT':'CURRENT','LAB':'LAB','PREVIOUS':'PREVIOUS','INSTALL':'NAMESTI','INSTALLED':'NAMEŠČENO','INSTALL CURRENT':'NAMESTI CURRENT',
 'Sudoku versions':'Različice Sudoku','English':'Angleščina','Slovenian':'Slovenščina','Language':'Jezik',
 'What’s new':'Kaj je novega','Quick tutorial · optional':'Kratka vaja · neobvezno','Got it':'Razumem',
 'Arena gold, distilled back into one local-first game.':'Znanje iz arene v igri, ki deluje na tvoji napravi.',
 'New Game':'Nova igra','NEW GAME':'NOVA IGRA','New game':'Nova igra','Numbers':'Številke','Easy':'Lahka','Medium':'Srednja','Hard':'Težka','Evil':'Zelo težka','Evil ☠':'Zelo težka ☠',
 'easy':'Lahka','medium':'Srednja','hard':'Težka','evil':'Zelo težka','Imported':'Uvožena','unrated':'Neocenjena',
 'Choose a difficulty to begin':'Za začetek izberi težavnost','Select difficulty to begin':'Za začetek izberi težavnost','choose your difficulty':'izberi težavnost','Ready to play':'Pripravljeno za igro','Saved game recovered':'Shranjena igra obnovljena','Generating...':'Ustvarjam uganko …','Paused':'Premor',
 'Notes':'Zapiski','Notes: OFF':'Zapiski: NE','Notes: ON':'Zapiski: DA','Notes on':'Zapiski vključeni','Notes off':'Zapiski izključeni','Erase':'Izbriši','Undo':'Razveljavi','Redo':'Uveljavi znova','Hint':'Namig','Why?':'Zakaj?','AI Solve':'Reši z AI','More':'Več','More ⋯':'Več ⋯','Settings':'Nastavitve','Help':'Pomoč','? Help':'? Pomoč','Help / About':'Pomoč / O igri','8zSudoku · Help / About':'8zSudoku · Pomoč / O igri',
 'Close':'Zapri','Cancel':'Prekliči','Continue':'Nadaljuj','Resume':'Nadaljuj','Pause':'Premor','Stop':'Ustavi','Reset':'Ponastavi','Step':'Korak','Start':'Začni','Save':'Shrani','Delete':'Izbriši','Clear':'Počisti','Export':'Izvozi','Import':'Uvozi','Review':'Pregled','No moves yet':'Potez še ni','No moves yet.':'Potez še ni.',
 'Theme':'Tema','Dark':'Temna','Light':'Svetla','System':'Sistemska','Notes size':'Velikost zapiskov','Timer':'Časovnik','Motion':'Animacije','Automatic entry feedback':'Samodejno opozarjanje na vnose','Input mode':'Način vnosa','Auto-clean Notes':'Samodejno čiščenje zapiskov','Normal':'Običajna','Large':'Velika','Extra large':'Zelo velika','Show':'Pokaži','Hide':'Skrij','Quiet':'Mirno','None':'Brez','Direct conflicts':'Neposredna nasprotja','Cell-first':'Najprej celica','Number-first':'Najprej številka','Off':'Izključeno','On':'Vključeno','Auto':'Samodejno',
 'Number Picker Position':'Položaj izbirnika številk','Number picker position':'Položaj izbirnika številk','Picker size':'Velikost izbirnika','Number Picker Size':'Velikost izbirnika številk','Number picker size':'Velikost izbirnika številk','At cell':'Ob celici','Keep context visible':'Ohrani pogled na okolico','Candidate Assist':'Pomoč pri kandidatih','Candidate assist':'Pomoč pri kandidatih','Saved on this device.':'Shranjeno na tej napravi.','For this tab only — storage unavailable.':'Velja le v tem zavihku — shramba ni na voljo.',
 'My games':'Moje igre','Daily puzzles':'Dnevne uganke','Share puzzle':'Deli uganko','Check correctness':'Preveri pravilnost','Game Review':'Pregled igre','Import session':'Uvozi igro','Export session':'Izvozi igro','Delete all LAB data':'Izbriši vse podatke LAB','Return to my game':'Vrni se v mojo igro','In progress':'V teku','Completed':'Končane','Favorites':'Priljubljene','★ Favorite':'★ Priljubljena','☆ Favorite':'☆ Med priljubljene','Delete game':'Izbriši igro','Recovery & storage':'Obnovitev in shramba','Recovery options':'Možnosti obnovitve','Export current game':'Izvozi trenutno igro','Export recovery copies':'Izvozi obnovitvene kopije','Reload latest':'Naloži najnovejše','No saved games in this group yet.':'V tej skupini še ni shranjenih iger.','No storage error reported.':'Ni prijavljene napake pri shranjevanju.',
 'Learn one technique':'Nauči se ene tehnike','Research controls':'Raziskovalne nastavitve','Controller comparisons and local observations stay optional. Opening this view starts no analysis.':'Primerjave krmilnikov in lokalna opazovanja so neobvezni. Odpiranje tega pogleda ne zažene analize.',
 'Naked single':'Edini kandidat','Hidden single':'Skriti edini kandidat','Pointing':'Usmerjanje iz kvadrata','Claiming':'Usmerjanje v kvadrat','Naked pair':'Goli par','Naked subset':'Gola podmnožica','Hidden subset':'Skrita podmnožica','X-Wing':'X-krilo','XY-Wing':'XY-krilo','Digit-path support':'Podpora poti števke',
 'A small practice space':'Majhen prostor za vajo','Tutorial cell':'Celica za vajo','Skip / return to game':'Preskoči / vrni se v igro','Select the square.':'Izberi kvadrat.','Now choose 4.':'Zdaj izberi 4.','Slide to 4, then release.':'Premakni na 4 in spusti.','Good. Undo reverses this demonstration action.':'Dobro. Razveljavi povrne prejšnje stanje te vaje.','Note 4':'Zapisek 4','Try the short tutorial':'Preizkusi kratko vajo','Start independent exercise':'Začni samostojno vajo',
 'Teaching example: a candidate-state relationship, not a claim that this blank board is a unique puzzle.':'Učni primer prikazuje odnose med kandidati. Ta prazna mreža ni predstavljena kot uganka z eno samo rešitvijo.',
 'Outlined cells are the source; dashed cells are the checked consequences. Next, try an independently generated exercise without its answer displayed.':'Obrobljene celice so izvor sklepa, črtkane pa preverjene posledice. Nato poskusi novo samostojno vajo brez prikazane rešitve.',
 'This demonstration does not change your game, timer, statistics or learning profile. Tap the empty square, then 4. Try Notes and Undo. Hold the square for 300 ms, slide to 4 and release.':'Ta vaja ne spremeni tvoje igre, časa, statistike ali učnega profila. Izberi prazni kvadrat in nato 4. Poskusi Zapiski in Razveljavi. Lahko tudi držiš kvadrat 300 ms, premakneš na 4 in spustiš.',
 'This demonstration does not change your game. Select the square, choose 4, then try Notes and Undo.':'Ta vaja ne spremeni tvoje igre. Izberi kvadrat in 4, nato poskusi Zapiski in Razveljavi.',
 'Install CURRENT directly. Play and Learn keep the board centered. Choose English or Slovenian. Your game is saved before an update. The stable Sudoku engine is unchanged.':'CURRENT lahko namestiš neposredno. V pogledih Igra in Učenje je mreža na sredini. Izbereš lahko angleščino ali slovenščino. Pred posodobitvijo se igra shrani. Stabilno jedro Sudoku ostaja enako.',
 'Play / Learn / Lab, Light and System themes, optional number-first, Redo, visible-conflict feedback, checked technique profiles, saved games, UTC daily puzzles and givens-only sharing.':'Igra / Učenje / Laboratorij, svetla in sistemska tema, neobvezen vnos najprej številke, ponovna uveljavitev potez, opozorila na vidna nasprotja, preverjeni profili tehnik, shranjene igre, dnevne uganke po UTC ter deljenje začetne mreže.',
 'Check correctness?':'Preverim pravilnost?','Answer comparison':'Primerjava z rešitvijo','Show answer comparison':'Pokaži primerjavo z rešitvijo','No entered values differ from the certified unique solution.':'Nobena vnesena vrednost se ne razlikuje od preverjene enolične rešitve.',
 'This compares your entries with the certified unique solution. Seeing the result is recorded as assistance. It does not enter or erase values.':'Tvoje vnose primerja s preverjeno enolično rešitvijo. Ogled rezultata se zabeleži kot pomoč. Ne vnaša in ne briše številk.',
 'Answer information was shown; this is separate from a logical deduction.':'Prikazana je bila informacija iz rešitve; to se razlikuje od logičnega sklepa.',
 'Only the original givens and format version are included. Your entries, Notes, history, assistance and solution stay here.':'Povezava vsebuje le začetne številke in različico zapisa. Tvoji vnosi, zapiski, zgodovina, pomoč in rešitev ostanejo tukaj.',
 'Copy link or puzzle text':'Kopiraj povezavo ali zapis uganke','Copy link':'Kopiraj povezavo','Show puzzle text':'Pokaži zapis uganke','Copied.':'Kopirano.','Select and copy the text manually.':'Besedilo označi in kopiraj ročno.','Open shared puzzle?':'Odprem deljeno uganko?','Save current and open':'Shrani trenutno in odpri',
 'The current game will be saved before replacement. No device preferences or consent are imported.':'Trenutna igra se pred zamenjavo shrani. Nastavitve naprave in soglasja se ne uvozijo.',
 'Daily puzzle · UTC':'Dnevna uganka · UTC','Suggest practice':'Predlagaj vajo','Learning profile':'Učni profil','Your turn. Navigator stays quiet until you ask where to look.':'Na vrsti si. Navigator počaka, dokler ne vprašaš, kam pogledati.',
 'Saved game recovered. Rechecked uniqueness and replayed retained candidate deductions.':'Shranjena igra je obnovljena. Enoličnost je znova preverjena, ohranjeni sklepi o kandidatih pa ponovljeni.',
 'Find the next useful thought.':'Poišči naslednji koristen sklep.','Goal':'Cilj','Flow · keep moving':'Potek · nadaljuj reševanje','Practice a technique':'Vadi tehniko','Technique':'Tehnika','◎ Where to look':'◎ Kam pogledati','Where to look':'Kam pogledati','Reveal':'Razkrij','Keep this checked elimination':'Ohrani to preverjeno izločitev','Compare paths':'Primerjaj poti','New practice':'Nova vaja','Cancel analysis':'Prekliči analizo','Candidate to exclude':'Kandidat za izločitev','Check selected cell':'Preveri izbrano celico','Views, learning & laboratory':'Pogledi, učenje in laboratorij','Digit slice':'Pogled števke','Normal grid':'Običajna mreža','Controller':'Krmilnik','DCC · real signal':'DCC · pravi signal','OFF · cheap checked baseline':'OFF · osnovni preverjeni postopek','Ordinary adaptive':'Običajni prilagodljivi','SHAM · matched measurements':'SHAM · primerljive meritve','Allow bounded digit-path specialist when needed':'Po potrebi dovoli omejeno preverjanje poti števke','Machine memory: session':'Strojni spomin: seja','Machine memory: ON':'Strojni spomin: DA','Enable tutor profile':'Vključi učni profil','Tutor profile: ON':'Učni profil: DA','Machine learning':'Strojno učenje','Delete local data':'Izbriši lokalne podatke','Compare controllers on this position':'Primerjaj krmilnike na tem položaju','No analysis requested.':'Analiza ni zahtevana.',
 'Choose a puzzle. The Navigator will remain quiet until you ask.':'Izberi uganko. Navigator počaka na tvoje vprašanje.',
 'Choose a puzzle. The coach keeps a separate verified candidate state; player notes are never treated as proof.':'Izberi uganko. Učitelj ločeno vodi preverjene kandidate; tvojih zapiskov ne uporablja kot dokaz.',
 'Proof Coach':'Učitelj logičnih korakov','Proof Edition':'Različica z logičnimi dokazi','Nudge':'Usmeri','Explain':'Pojasni','Proof profile: —':'Profil dokazovanja: —','AI Solver':'Reševalnik AI','Strategy':'Strategija','Random':'Naključno','Naked':'Goli','Full':'Celovito','Human':'Človeško','Hidden':'Skriti','Point':'Usmerjanje','Guess':'Ugibanje','Speed':'Hitrost','▶ AI Solve':'▶ Reši z AI','⏸ Pause':'⏸ Premor','▶ Continue':'▶ Nadaljuj','💡 Proof Hint':'💡 Logični namig','⚡ Compare All':'⚡ Primerjaj vse','⚡ Compare all':'⚡ Primerjaj vse','⊕ Navigator hint':'⊕ Namig Navigatorja',
 'Live Metrics':'Sprotne meritve','Steps':'Koraki','Backtracks':'Vračanja','Guesses':'Ugibanja','Candidates':'Kandidati','Progress':'Napredek','Phase 1 Sensors':'Senzorji 1. faze','LZ Complexity':'Kompleksnost LZ','Gini Cascade':'Gini kaskad','Cascade Power':'Moč kaskad','Density Flow':'Tok gostote','Less describes more.':'Manj opiše več.',
 'Enable with consent':'Vključi s soglasjem','Continue recovered session':'Nadaljuj obnovljeno sejo','Ignore hint':'Prezri namig','Consent required · local only':'Potrebno je soglasje · samo lokalno','Human Trace v1.2':'Sled človekovih potez v1.2','Correct':'Pravilno','Incorrect':'Nepravilno','Unknown':'Neznano','unknown':'neznano','NEW':'NOVO',
 'Board changed · proof state refreshed.':'Mreža je spremenjena · stanje dokazovanja je osveženo.','No hints available':'Namigi niso na voljo','Puzzle is already solved ✓':'Uganka je že rešena ✓','No stored trace to recover.':'Ni shranjene sledi za obnovitev.','Human trace and consent deleted locally':'Sled potez in soglasje sta izbrisana lokalno',
 'Export raw recovery before replacing damaged data. Reload reads the latest library; no tab may silently overwrite a detected newer revision.':'Pred zamenjavo poškodovanih podatkov izvozi obnovitvene kopije. Ponovno nalaganje prebere najnovejšo knjižnico; zavihek ne sme tiho prepisati novejše različice.',
 'Direct conflicts use visible duplicates only. Candidate Assist is independent. Auto-clean removes the entered digit from empty peer Notes only for a nonconflicting entry, in the same reversible move. Turning it on changes no existing Notes.':'Neposredna nasprotja temeljijo le na vidnih ponovitvah. Pomoč pri kandidatih je ločena. Samodejno čiščenje ob veljavnem vnosu odstrani to števko iz zapiskov praznih povezanih celic, kot del iste razveljavljive poteze. Vklop ne spremeni obstoječih zapiskov.',
 'Tap a cell, then a digit. Notes makes pencil marks. Undo and Redo (Ctrl/Cmd+Z, Shift+Z or Ctrl+Y) restore moves, not information already seen. Number-first is optional in Settings; choose a digit and tap empty cells. Escape disarms it.':'Izberi celico in nato številko. Zapiski vnesejo kandidate. Razveljavi in Uveljavi znova (Ctrl/Cmd+Z, Shift+Z ali Ctrl+Y) povrneta poteze, ne pa že videnih informacij. V nastavitvah lahko vključiš vnos najprej številke: izberi številko in prazne celice. Escape ta način prekliče.',
 'Hold an empty cell for 300 ms, then move at least 8 px to a digit and release. Still holds or releases in gaps cancel. Hold a filled cell for a read-only magnifier. At cell is the default; Settings also offers Keep context visible and three sizes.':'Prazno celico drži 300 ms, premakni vsaj 8 px do števke in spusti. Držanje brez premika ali spust v vrzeli prekliče vnos. Držanje polne celice odpre povečevalnik brez urejanja. Privzeti položaj je Ob celici; nastavitve ponujajo tudi Ohrani pogled na okolico in tri velikosti.',
 'Hint / Why? never silently enters a digit. Deductions from your entries are conditional. Check correctness explicitly reveals answer information.':'Namig / Zakaj? nikoli samodejno ne vpiše števke. Sklepi iz tvojih vnosov so pogojni. Preveri pravilnost izrecno razkrije informacije iz rešitve.',
 'Play, Learn and Lab share one live game. Practice keeps a Return to my game route. This file uses no external runtime assets; first-time URL loading requires a network. Downloaded file storage and worker support depend on your browser.':'Igra, Učenje in Laboratorij uporabljajo isto odprto igro. Po vaji se lahko vrneš v svojo igro. Ta datoteka nima zunanjih izvajalnih virov; prvi obisk naslova potrebuje povezavo. Shramba prenesene datoteke in podpora delovnim nitim sta odvisni od brskalnika.',
 'PREPARING OFFLINE':'PRIPRAVLJAM DELO BREZ POVEZAVE','OFFLINE READY':'PRIPRAVLJENO BREZ POVEZAVE','OFFLINE':'BREZ POVEZAVE','OFFLINE NOT READY':'DELO BREZ POVEZAVE NI PRIPRAVLJENO','OFFLINE SETUP FAILED':'PRIPRAVA BREZ POVEZAVE NI USPELA','OFFLINE UNAVAILABLE':'DELO BREZ POVEZAVE NI NA VOLJO','Save & update':'Shrani in posodobi','Save & reload':'Shrani in osveži','Game saved. Updating…':'Igra je shranjena. Posodabljam …',
 'A new version of this channel is ready. Save your game and update when convenient.':'Nova različica tega kanala je pripravljena. Shrani igro in posodobi, ko ti ustreza.',
 'Your game could not be saved yet. Finish the current action or pause the solver. If storage is full, export your game, then retry.':'Igre še ni bilo mogoče shraniti. Dokončaj dejanje ali ustavi reševalnik. Če je shramba polna, izvozi igro in poskusi znova.',
 'Update activated. Finish the current action or resolve the save issue, then save and reload.':'Posodobitev je aktivna. Dokončaj dejanje ali odpravi težavo pri shranjevanju, nato shrani in osveži.',
 'An update is active. Save and reload to use it in this window.':'Posodobitev je aktivna. Shrani in osveži, da jo uporabiš v tem oknu.',
 'Install 8zSudoku':'Namesti 8zSudoku','Install 8zSudoku LAB':'Namesti 8zSudoku LAB',
 'On iPhone or iPad, open this address in Safari, tap Share, then Add to Home Screen. On Android or desktop, use your browser’s Install app option. Wait for OFFLINE READY before going offline.':'Na iPhonu ali iPadu odpri ta naslov v Safariju, izberi Deli in Dodaj na začetni zaslon. Na Androidu ali računalniku uporabi možnost Namesti aplikacijo v brskalniku. Pred odklopom počakaj na PRIPRAVLJENO BREZ POVEZAVE.',
 'CURRENT and LAB are separate installations. Updates ask you to save first.':'CURRENT in LAB sta ločeni namestitvi. Pred posodobitvijo se igra shrani.'
 };
 Object.assign(SL,{
 'Looking for a checked continuation…':'Iščem preverjen naslednji korak …','Looking for checked continuations…':'Iščem preverjene naslednje korake …',
 'Conditional on your currently entered values.':'Velja ob predpostavki, da so tvoji trenutni vnosi pravilni.',
 'Choose a difficulty.':'Izberi težavnost.','Choose a difficulty. Your unfinished game is kept until the new puzzle is certified.':'Izberi težavnost. Nedokončana igra ostane ohranjena, dokler nova uganka ni preverjena.',
 'Replace unfinished game?':'Zamenjam nedokončano igro?','Start new game':'Začni novo igro','AI demonstration':'Prikaz reševanja z AI','Start demonstration':'Začni prikaz','Return to your game':'Vrni se v svojo igro','Return to game':'Vrni se v igro','Stop demonstration':'Ustavi prikaz',
 'This puzzle is already solved':'Ta uganka je že rešena','Export/Delete the active Human Trace first':'Najprej izvozi ali izbriši aktivno sled človekovih potez','Export/Delete the active Human Trace first.':'Najprej izvozi ali izbriši aktivno sled človekovih potez.',
 'No proof found in the inspected families. Enable digit-path work in Lab for a broader bounded check.':'Med preverjenimi družinami tehnik ni najdenega dokaza. V Laboratoriju lahko omogočiš širše omejeno preverjanje poti števke.',
 'Analysis budget reached; this is not proof that no deduction exists.':'Dosežena je omejitev analize. To ne pomeni, da veljaven sklep ne obstaja.',
 'Stale proof rejected. Analyze the current position again.':'Zastarel dokaz je zavrnjen. Znova analiziraj trenutni položaj.',
 'Literal codec SUDOKU_PROOF_CODEC_V1; current state + fixed checker are shared side information. Not a human skill score.':'Dobesedni kodek SUDOKU_PROOF_CODEC_V1; trenutno stanje in nespremenljiv preverjevalnik sta skupna dodatna podatka. To ni ocena človekove spretnosti.',
 'row':'vrstica','column':'stolpec','box':'kvadrat','naked single':'edini kandidat','hidden single':'skriti edini kandidat','pointing':'usmerjanje iz kvadrata','claiming':'usmerjanje v kvadrat','naked subset':'gola podmnožica','hidden subset':'skrita podmnožica','x-wing':'X-krilo','xy-wing':'XY-krilo','digit-path support':'podpora poti števke',
 'Export recovery before clearing saved data.':'Pred brisanjem shranjenih podatkov izvozi obnovitveno kopijo.',
 'Import this local research/game file? Your current Navigator game will be retained as previousGame.':'Uvozim to lokalno datoteko igre oziroma raziskave? Trenutna igra Navigatorja bo ohranjena kot prejšnja igra.',
 'Delete this saved game, including its Notes and history? Export it first if needed. Other games stay.':'Izbrišem to shranjeno igro z zapiski in zgodovino? Po potrebi jo najprej izvozi. Druge igre ostanejo.',
 'Delete only this development version’s saved game, machine memory and tutor profile? Production data is not touched.':'Izbrišem shranjeno igro, strojni spomin in učni profil te razvojne različice? Podatki stabilne različice ostanejo.',
 'Storage unavailable':'Shramba ni na voljo','Storage could not be read':'Shrambe ni bilo mogoče prebrati','Storage size limit':'Omejitev velikosti shrambe','Storage readback mismatch':'Preverjanje zapisa v shrambo ni uspelo','Import superseded by another action':'Uvoz je prekinilo drugo dejanje','Previous game could not be saved':'Prejšnje igre ni bilo mogoče shraniti','Current game could not be archived':'Trenutne igre ni bilo mogoče arhivirati',
 'Stored CURRENT game needs recovery. Its saved data was kept.':'Shranjena igra CURRENT potrebuje obnovitev. Njeni podatki so ohranjeni.',
 'Pick a difficulty — the AI races alongside you.':'Izberi težavnost — AI rešuje skupaj s teboj.',
 'Human trace and consent deleted locally':'Sled potez in soglasje sta izbrisana na tej napravi.'
 });
 const unitSL=s=>s.replace(/row (\d+)/g,'vrstica $1').replace(/column (\d+)/g,'stolpec $1').replace(/box (\d+)/g,'kvadrat $1');
 Object.assign(SL, {
  "← BD Lab": "← BD Lab",
  "Stable game ↗": "Stabilna igra ↗",
  "Picker Size": "Velikost izbirnika",
  "Extra Large": "Zelo velika",
  "Picker choices apply to this device and edition.": "Nastavitve izbirnika veljajo za to napravo in različico.",
  "Auto grays direct conflicts on Easy only. Your Notes stay cyan; gray digits can still be entered. Large layouts shrink only when space requires it.": "Samodejna pomoč osivi neposredna nasprotja samo pri lahki težavnosti. Tvoji zapiski ostanejo turkizni; tudi sive števke lahko vneseš. Večji izbirnik se pomanjša le, kadar primanjkuje prostora.",
  "How to play": "Kako igrati",
  "Quick guide": "Kratka navodila",
  "How to Play · Proof Edition Preview": "Kako igrati · Različica z logičnimi dokazi",
  "Select": "Izberi",
  "Place": "Vnesi",
  "Hold and slide": "Drži in premakni",
  "Notes mode": "Način zapiskov",
  "Difficulty:": "Težavnost:",
  "AI Strategies:": "Strategije AI:",
  "Played:": "Odigrano:",
  "Hints:": "Namigi:",
  "Best easy:": "Najboljša lahka:",
  "Best evil:": "Najboljša zelo težka:",
  "a cell by clicking or tapping. Highlighted cells share a row, column, or box with your selection.": "celico s klikom ali dotikom. Označene celice so v isti vrstici, stolpcu ali kvadratu kot izbrana celica.",
  "a number using the numpad below the grid, or press 1–9 on your keyboard. Click the same number again to clear it. Arrow keys move the selection.": "številko z gumbi ali tipkami 1–9. Ponovni klik iste številke jo izbriše. S puščicami premikaš izbrano celico.",
  "— hold the left mouse button on an empty cell for about 300 ms, deliberately drag to a number, then release to enter it. No slide means no entry. Release in a gap, outside the picker or press Escape to cancel. Hold a filled cell to inspect values and Notes in the central magnifier; release to close. Open Settings for At cell (default) or Keep context visible (protects the whole row and column), and Normal/Large/Extra Large sizing. Notes are cyan; Candidate Assist Auto grays direct row/column/box conflicts on Easy only. On/Off overrides persist; gray digits remain selectable. Use Numbers if space is insufficient.": "— prazno celico drži približno 300 ms, namerno premakni do števke in spusti. Brez premika ni vnosa. Spust v vrzeli, zunaj izbirnika ali Escape prekliče vnos. Polno celico drži za ogled vrednosti in zapiskov v povečevalniku; spust ga zapre. V nastavitvah izberi Ob celici (privzeto) ali Ohrani pogled na okolico ter običajno, veliko ali zelo veliko velikost. Zapiski so turkizni. Samodejna pomoč osivi neposredna nasprotja samo pri lahki težavnosti. Vklop in izklop sta shranjena; sive števke ostanejo izbirne. Če je prostora premalo, uporabi gumbe številk.",
  "— toggle with the Notes button or press": "— preklopi z gumbom Zapiski ali pritisni",
  ". Numbers become small pencil marks — candidates you're considering.": ". Številke postanejo majhni zapiski — kandidati, o katerih razmišljaš.",
  "with the button or": "z gumbom ali",
  ". Erase with button or": ". Izbriši z gumbom ali",
  "💡 Hint": "💡 Namig",
  "— checks visible contradictions and explains a checked continuation. Deductions from your entries are conditional. Check correctness is a separate, explicit answer comparison. Hints never place a number.": "— preveri vidna nasprotja in pojasni preverjen naslednji korak. Sklepi iz tvojih vnosov so pogojni. Preveri pravilnost je ločena, izrecna primerjava z rešitvijo. Namigi nikoli ne vnesejo številke.",
  "— select a strategy, watch the solving process animated. Green = naked single. Blue = hidden single. Violet = pointing pair. Orange = guess. Red = backtrack. Step through one move at a time.": "— izberi strategijo in spremljaj prikaz reševanja. Zeleno = edini kandidat. Modro = skriti edini kandidat. Vijolično = usmerjanje. Oranžno = ugibanje. Rdeče = vračanje. Napreduješ lahko po eni potezi.",
  "— runs all 5 strategies on the current puzzle and shows a comparison table with steps, backtracks, and sensor readings.": "— izvede vseh pet strategij na trenutni uganki in pokaže primerjavo korakov, vračanj in meritev.",
  "New labels use a deterministic checked technique profile, with completed uniqueness verification. They are evaluator profiles, not universal human difficulty measurements. A limited or unfulfilled request preserves the current game.": "Nove oznake uporabljajo deterministično preverjen profil tehnik in dokončano preverjanje enoličnosti. To so profili ocenjevalnika, ne univerzalne meritve človekove težavnosti. Omejena ali neizpolnjena zahteva ohrani trenutno igro.",
  "a cell by clicking/tapping.": "celico s klikom ali dotikom.",
  "with numpad or": "z gumbi številk ali",
  "— hold the left mouse button on an empty cell for about 300 ms, drag to a number and release. Release outside or press Escape to cancel. Hold a filled cell for the central magnifier, then drag across values and Notes; release to close. Use Numbers if there is no clear space.": "— prazno celico drži približno 300 ms, premakni do številke in spusti. Spust zunaj ali Escape prekliče vnos. Držanje polne celice odpre povečevalnik; premikaj se čez vrednosti in zapiske, nato spusti. Če je prostora premalo, uporabi gumbe številk.",
  "— press": "— pritisni",
  "— Nudge points to the area, Explain names the verified mechanism, Reveal shows the exact placement/elimination. The coach supports P0–P3 logic and keeps its own candidate state separate from pencil notes.": "— Usmeri pokaže območje, Pojasni opiše preverjen mehanizem, Razkrij pa pokaže točen vnos ali izločitev. Učitelj podpira logiko P0–P3 in vodi lastno stanje kandidatov ločeno od tvojih zapiskov.",
  "— every placed value is checked from the pre-move state. Correct-but-unexplained remains": "— vsak vnos se preveri iz stanja pred potezo. Pravilna, a nepojasnjena poteza ostane",
  "; a found proof is labelled explicitly.": "; najdeni dokaz je izrecno označen.",
  "Random (blind), MRV (fewest candidates), Naked (naked singles + MRV), Full (naked + hidden + MRV), Human (+ pointing pairs).": "Naključno (slepo), MRV (najmanj kandidatov), Goli (edini kandidati + MRV), Celovito (goli + skriti + MRV), Človeško (dodano usmerjanje).",
  "— run all 5 strategies and compare sensors.": "— izvedi vseh pet strategij in primerjaj meritve.",
  "Easy: 36–42 givens · Medium: 28–35 · Hard: 24–27 · Evil: 20–23": "Lahka: 36–42 začetnih številk · Srednja: 28–35 · Težka: 24–27 · Zelo težka: 20–23",
  "Your moves will be reviewed from their pre-position. A found explanation is not a claim about what you thought.": "Poteze bodo pregledane iz stanja pred vnosom. Najdena razlaga ne pove, kako si dejansko razmišljal.",
  "· source identity is bound in the release manifest.": "· izvor je vezan na manifest izdaje.",
  "50 ms export bins · touch|pointer|key · no device ID · no UI snapshots": "50 ms časovni intervali pri izvozu · dotik|kazalec|tipka · brez ID naprave · brez posnetkov vmesnika",
  "◎ Navigator hint": "◎ Namig Navigatorja",
  "Strategy Comparison": "Primerjava strategij",
  "Real/OFF/SHAM are experimental selectors over the same verified rules. Machine learning ≠ measured human improvement. Unknown reasoning stays unknown. Game and review auto-save on this device. Machine history and tutor outcomes persist only when enabled. No external API, no background network.": "Real/OFF/SHAM so poskusni izbirniki istih preverjenih pravil. Strojno učenje ni meritev človekovega napredka. Neznano sklepanje ostane neznano. Igra in pregled se samodejno shranita na tej napravi. Strojna zgodovina in učni rezultati se hranijo le ob vklopu. Brez zunanjega API ali omrežnih klicev v ozadju."
});
 const learned = new Map();
 const difficulty = s => ({easy:'Lahka',medium:'Srednja',hard:'Težka',evil:'Zelo težka',imported:'Uvožena',unrated:'Neocenjena',fixture:'Vaja'})[s.toLowerCase()] || s;
 const patterns = [
  [/^Look at (R\dC\d)\. It has a forced move\.$/,(_,c)=>'Poglej celico '+c+'. V njej je prisiljena poteza.'],
  [/^(R\dC\d) has only one candidate left\.$/,(_,c)=>'Celica '+c+' ima samo še enega kandidata.'],
  [/^Inspect (.+?); one digit has only one legal cell\.$/,(_,u)=>'Poglej: '+unitSL(u)+'; ena števka ima samo eno dovoljeno celico.'],
  [/^A hidden single is available in (.+?) at (R\dC\d)\.$/,(_,u,c)=>'V enoti '+unitSL(u)+' je v celici '+c+' skriti edini kandidat.'],
  [/^Hidden single: (R\dC\d) = (\d) in (.+?)\.$/,(_,c,d,u)=>'Skriti edini kandidat: '+c+' = '+d+' v enoti '+unitSL(u)+'.'],
  [/^A box-line interaction is available around box (\d)\.$/,(_,b)=>'Pri kvadratu '+b+' je na voljo povezava z vrstico ali stolpcem.'],
  [/^Pointing: all candidates for one digit in box (\d) lie on (row|column) (\d)\.$/,(_,b,u,n)=>'Usmerjanje iz kvadrata: vsi kandidati ene števke v kvadratu '+b+' ležijo v isti enoti ('+unitSL(u+' '+n)+').'],
  [/^A line-box interaction is available in (.+?)\.$/,(_,u)=>'V enoti '+unitSL(u)+' je na voljo povezava s kvadratom.'],
  [/^Claiming: all candidates for one digit in (.+?) fall inside box (\d)\.$/,(_,u,b)=>'Usmerjanje v kvadrat: vsi kandidati ene števke v enoti '+unitSL(u)+' so znotraj kvadrata '+b+'.'],
  [/^(Pointing|Claiming|X-Wing|XY-Wing) removes (\d) from (.+?)\.$/,(_,t,d,c)=>translate(t)+' izloči '+d+' iz '+c+'.'],
  [/^Two linked cells in (.+?) form a useful pair\.$/,(_,u)=>'Dve povezani celici v enoti '+unitSL(u)+' tvorita uporaben par.'],
  [/^Naked pair ([\d/]+) is locked in (.+?) and (.+?)\.$/,(_,d,a,b)=>'Goli par '+d+' je omejen na '+a+' in '+b+'.'],
  [/^Naked pair ([\d/]+) removes (.+?)\.$/,(_,d,c)=>'Goli par '+d+' izloči '+c+'.'],
  [/^A four-corner fish pattern is available across two (rows|columns)\.$/,(_,u)=>'V dveh '+(u==='rows'?'vrsticah':'stolpcih')+' je na voljo vzorec s štirimi oglišči.'],
  [/^X-Wing: digit (\d) is locked to (columns|rows) ([\d/]+) in (rows|columns) ([\d/]+)\.$/,(_,d,u,a,v,b)=>'X-krilo: števka '+d+' je omejena na '+(u==='columns'?'stolpca':'vrstici')+' '+a+' v '+(v==='rows'?'vrsticah':'stolpcih')+' '+b+'.'],
  [/^Three bivalue cells form a wing pattern around (R\dC\d)\.$/,(_,c)=>'Tri celice z dvema kandidatoma tvorijo vzorec kril okoli '+c+'.'],
  [/^XY-Wing: pivot (R\dC\d) links wings (R\dC\d) and (R\dC\d)\.$/,(_,p,a,b)=>'XY-krilo: osrednja celica '+p+' povezuje krili '+a+' in '+b+'.'],
  [/^(Naked single|Hidden single|Naked pair|Pointing|Claiming|X-Wing|XY-Wing) · (.*)$/,(_,t,d)=>translate(t)+' · '+translate(d)],
  [/^No P0–P3 proof step found\. Search fallback suggests (R\dC\d) = (\d); this is labelled search, not deduction\.$/,(_,c,d)=>'Dokazani korak P0–P3 ni najden. Iskanje predlaga '+c+' = '+d+'; to je rezultat iskanja, ne logični sklep.'],

  [/^Inspect (.+?)( and its crossing lines)?\. A checked (.+?) relationship is available\. No answer has been revealed\.( Conditional on your currently entered values\.)?$/,(_,u,c,t,cond)=>'Poglej: '+unitSL(u)+(c?' in presečne vrstice oziroma stolpce':'')+'. Na voljo je preverjena povezava za tehniko '+translate(t)+'. Rešitev še ni razkrita.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^In (.+?), one empty cell has only one remaining candidate\. Compare its row, column and box\.( Conditional on your currently entered values\.)?$/,(_,u,cond)=>'Poglej: '+unitSL(u)+'. Ena prazna celica ima samo enega preostalega kandidata. Primerjaj njeno vrstico, stolpec in kvadrat.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^Look at the possible positions for one digit in (.+?)\. Only one cell supports it\.( Conditional on your currently entered values\.)?$/,(_,u,cond)=>'Poglej možna mesta za eno števko v enoti '+unitSL(u)+'. Dovoljena je v samo eni celici.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^Digit (\d) is confined to (.+?) in (.+?)\. Follow the shared (line|box) to find exclusions\.( Conditional on your currently entered values\.)?$/,(_,d,c,u,line,cond)=>'Števka '+d+' je v enoti '+unitSL(u)+' omejena na '+c+'. Sledi skupni '+(line==='line'?'vrstici ali stolpcu':'enoti kvadrata')+' in poišči izločitve.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^([\d/]+) are confined to (.+?) in (.+?)\. (Other cells cannot use those digits\.|Those cells cannot use other digits\.)( Conditional on your currently entered values\.)?$/,(_,ds,c,u,why,cond)=>'Števke '+ds+' so v enoti '+unitSL(u)+' omejene na '+c+'. '+(why.startsWith('Other')?'Druge celice ne morejo vsebovati teh števk.':'Te celice ne morejo vsebovati drugih števk.')+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^Digit (\d) occupies two matching supports on (columns|rows): (.+?)\. The two crossing lines are reserved\.( Conditional on your currently entered values\.)?$/,(_,d,o,c,cond)=>'Števka '+d+' ima po dve ujemajoči se mesti v '+(o==='columns'?'stolpcih':'vrsticah')+': '+c+'. Presečni vrstici oziroma stolpca sta rezervirana.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^Pivot (\w+) links the bivalue wings (\w+) and (\w+)\. Either pivot value makes one wing contain (\d)\.( Conditional on your currently entered values\.)?$/,(_,p,a,b,d,cond)=>'Osrednja celica '+p+' povezuje krili '+a+' in '+b+', vsako z dvema kandidatoma. Pri vsaki vrednosti osrednje celice eno krilo vsebuje '+d+'.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^An exhaustive single-digit path check for (\d) excludes unsupported possibilities\. This is not a guessed completed grid\.$/,(_,d)=>'Izčrpno preverjanje poti števke '+d+' izloči možnosti brez podpore. To ni ugibanje dokončane mreže.'],
  [/^(.+?): remove (.+?)\. The player grid is not filled automatically\.( Conditional on your currently entered values\.)?$/,(_,t,c,cond)=>translate(t)+': izloči '+c+'. Številke se v igralno mrežo ne vpišejo samodejno.'+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^(Naked single|Hidden single|Pointing|Claiming|Naked subset|Hidden subset|X-Wing|XY-Wing|Digit-path support): (R\dC\d = \d\.)( Conditional on your currently entered values\.)?$/,(_,t,c,cond)=>translate(t)+': '+c+(cond?' '+SL['Conditional on your currently entered values.']:'')],
  [/^Start a new (easy|medium|hard|evil) puzzle\? The current game will be retained as previousGame\.$/,(_,d)=>'Začnem novo uganko ('+difficulty(d)+')? Trenutna igra bo ohranjena kot prejšnja igra.'],

  [/^(easy|medium|hard|evil|Imported|unrated|fixture) · (.*)$/i,(_,d,rest)=>difficulty(d)+' · '+translate(rest)],
  [/^(\d+) entered value\(s\) differ from the certified unique solution\.$/,(_,n)=>n+' vnesenih vrednosti se razlikuje od preverjene enolične rešitve.'],
  [/^Row (\d+), column (\d+), (empty|[1-9])(, given)?(, direct conflict)?$/,(_,r,c,v,g,x)=>'Vrstica '+r+', stolpec '+c+', '+(v==='empty'?'prazno':v)+(g?', začetna številka':'')+(x?', neposredno nasprotje':'')],
  [/^Number-first · (\d) selected · tap an empty cell · Escape exits$/,(_,n)=>'Najprej številka · izbrana '+n+' · izberi prazno celico · Escape prekliče'],
  [/^Number-first · choose a digit$/,()=> 'Najprej številka · izberi številko'],
  [/^Review (\d+)$/,(_,n)=>'Pregled '+n],
  [/^Up to (\d+) games · (\d+) saved · no automatic eviction\. Current and previous games migrate without clearing data\.$/,(_,n,k)=>'Do '+n+' iger · shranjenih '+k+' · brez samodejnega brisanja. Trenutne in prejšnje igre se prenesejo brez izgube podatkov.'],
  [/^(Current game · )?(\d+)\/81 filled$/,(_,c,n)=>(c?'Trenutna igra · ':'')+n+'/81 izpolnjenih'],
  [/^One shared puzzle per UTC date\. The immutable (\d+)-puzzle local catalog repeats every (\d+) days\. No account or streak\.$/,(_,n,d)=>'Ena skupna uganka na datum UTC. Lokalni katalog '+n+' ugank se ponovi vsakih '+d+' dni. Brez računa ali niza obiskov.'],
  [/^Notes: (ON|OFF)$/,(_,v)=>'Zapiski: '+(v==='ON'?'DA':'NE')],
  [/^Board .*$/,s=>s],
  [/^Step (\d+): (.*?) → (.*)$/,(_,n,t,pos)=>'Korak '+n+': '+translate(t)+' → '+pos],
  [/^Import rejected: (.*)$/,(_,e)=>'Uvoz zavrnjen: '+translate(e)],
  [/^Shared puzzle rejected: (.*)$/,(_,e)=>'Deljena uganka je zavrnjena: '+translate(e)],
  [/^Not saved to disk: (.*)$/,(_,e)=>'Ni shranjeno na napravo: '+translate(e)],
  [/^AI solving \((.*?)\)\.\.\.$/,(_,s)=>'AI rešuje ('+translate(s)+') …'],
  [/^AI finished \((.*?)\) ✓$/,(_,s)=>'AI je končal ('+translate(s)+') ✓']
 ];
 function translate(text) {
  if (typeof text !== 'string') return text;
  const clean=text.trim(); if(!clean) return text;
  const suffix=' Verified elimination stored in the coach state; player grid and notes are unchanged.';
  if(clean.endsWith(suffix))return translate(clean.slice(0,-suffix.length))+' Preverjena izločitev je shranjena pri učitelju; igralna mreža in zapiski ostanejo enaki.';
  let result = SL[clean];
  if (result === undefined) for (const [pattern,fn] of patterns) { if (pattern.test(clean)) { result=clean.replace(pattern,fn); break; } }
  if (result === undefined) return text;
  return text.slice(0,text.indexOf(clean))+result+text.slice(text.indexOf(clean)+clean.length);
 }
 let language='en';try{const stored=localStorage.getItem(KEY);language=stored==='sl'||stored==='en'?stored:navigator.language?.toLowerCase().startsWith('sl')?'sl':'en';}catch(_){}
 const originals=new WeakMap(), attributes=new WeakMap();
 function source(node) {const entry=originals.get(node);return entry&&entry.output===node.nodeValue?entry.source:learned.get(node.nodeValue)||node.nodeValue;}
 function textNode(node) {
  const original=source(node), output=language==='sl'?translate(original):original;
  originals.set(node,{source:original,output});
  if(output!==original){if(learned.size>4096)learned.clear();learned.set(output,original);}
  if(node.nodeValue!==output)node.nodeValue=output;
 }
 function attr(el,key) {
  const value=el.getAttribute(key);if(!value)return;
  const records=attributes.get(el)||{},old=records[key],original=old?.output===value?old.source:learned.get(value)||value;
  const output=language==='sl'?translate(original):original;records[key]={source:original,output};attributes.set(el,records);
  if(output!==value)el.setAttribute(key,output);
 }
 SL['Correct moves stay UNKNOWN_REASONING unless this browser can find a proof from the state before the move.']='Pravilne poteze ostanejo označene kot UNKNOWN_REASONING, dokler brskalnik ne najde dokaza iz stanja pred potezo.';
 const skip='script,style,pre,code,textarea,[contenteditable],[data-no-i18n]';
 let observer,scheduled=false,disposed=false;
 function dispose(){disposed=true;observer?.disconnect();}
 function refresh() {
  if(disposed)return;
  scheduled=false;observer?.disconnect();
  try {
   document.documentElement.lang=language;
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode()))if(node.parentElement&&!node.parentElement.closest(skip)){
    const option=node.parentElement.closest('option');if(option&&!option.hasAttribute('value'))option.value=option.textContent;
    textNode(node);
   }
   for(const el of document.querySelectorAll('[aria-label],[title],[placeholder],[data-tip]'))if(!el.closest(skip))for(const key of ['aria-label','title','placeholder','data-tip'])attr(el,key);
   for(const b of document.querySelectorAll('[data-sudoku-language]'))b.setAttribute('aria-pressed',String(b.dataset.sudokuLanguage===language));
  } finally { observer?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','data-tip']}); }
 }
 function setLanguage(next,propagate=true) {
  if(!['en','sl'].includes(next))return;language=next;try{localStorage.setItem(KEY,next);}catch(_){}
  refresh();
  if(propagate){for(const frame of document.querySelectorAll('iframe'))try{frame.contentWindow?.SudokuI18n?.set(next,false);}catch(_){}
   if(parent!==window)try{parent.SudokuI18n?.set(next,false);}catch(_){}
  }
 }
 function install() {
  if(disposed||!document.body)return;
  // The shell owns one visible language selector. Standalone files own theirs.
  let embedded=false;try{embedded=parent!==window&&!!parent.document.getElementById('sudokuGame');}catch(_){}
  if(!embedded){const nav=document.createElement('div');nav.className='sudoku-language';nav.setAttribute('aria-label','Language');nav.innerHTML='<button type="button" data-sudoku-language="en" aria-label="English">EN</button><span aria-hidden="true">|</span><button type="button" data-sudoku-language="sl" aria-label="Slovenian">SL</button>';(document.querySelector('.version-nav')||document.querySelector('.header')||document.body).append(nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>setLanguage(b.dataset.sudokuLanguage));
   const style=document.createElement('style');style.textContent='.sudoku-language{position:fixed;top:52px;right:12px;z-index:2147483647;display:flex;align-items:center;gap:3px;border:1px solid #536680;border-radius:9px;background:#0b1423;color:#e2e8f4;font:12px system-ui}.sudoku-language button{min-width:35px;min-height:32px;border:0;background:transparent;color:inherit;border-radius:8px;font:700 12px system-ui;cursor:pointer}.sudoku-language button[aria-pressed=true]{color:#00e5ff;background:#173247}.sudoku-language button:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}.version-nav .sudoku-language,.header .sudoku-language{position:static;border:0;background:transparent}.version-nav .sudoku-language{border-left:1px solid #536680;border-radius:0;padding-left:3px}.version-nav .sudoku-language button{padding:2px;min-width:28px;min-height:28px}@media(max-width:520px){.sudoku-language{top:43px;right:7px}.sudoku-language button{min-width:32px;min-height:32px}}';document.head.append(style);
  }
  observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(refresh);}});
  refresh();window.addEventListener('storage',e=>{if(e.key===KEY&&['en','sl'].includes(e.newValue))setLanguage(e.newValue);});
  const nativeConfirm=window.confirm.bind(window),nativeAlert=window.alert.bind(window);
  window.confirm=text=>nativeConfirm(language==='sl'?translate(text):text);window.alert=text=>nativeAlert(language==='sl'?translate(text):text);
 }
 window.SudokuI18n={dispose,set:setLanguage,get:()=>language,translate,refresh,original:el=>[...el.childNodes].map(n=>n.nodeType===3?source(n):n.textContent).join('')};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
