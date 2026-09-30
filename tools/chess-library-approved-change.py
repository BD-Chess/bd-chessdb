"""One-shot, hash-guarded implementation of BD's APP library request.
Removed with its branch-only build workflow before the production PR.
"""
from pathlib import Path
import base64, hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'public/chess/app/js/8zc-new-ui.js': '875a136c79af5145619adf786ffb2937a8dc2d1c61ce88e125b014e4242646bb',
    'public/chess/app/js/app-mobile.js': 'd24fe6e54263ebaaa904cb7ad21156515c01ba9bb9fbf6b3296ca0487991324d',
    'public/chess/app/css/app-mobile.css': 'd8443c5a1f2d89db74fe2cc92cafd03f376073f3a2bd2799649f2aea28ce7ce3',
    'tools/chess-app-browser-review.py': '75f9a8aa8cf390cecab04642e2a95026f406dc99250772edfd6196933b44a70b',
}
sha = lambda b: hashlib.sha256(b).hexdigest()
for name, digest in EXPECTED.items():
    assert sha((ROOT / name).read_bytes()) == digest, 'Source conflict: ' + name

def replace_once(text, old, new):
    assert text.count(old) == 1, 'Unexpected anchor: ' + old[:90]
    return text.replace(old, new)

app = ROOT / 'public/chess/app'
p = app / 'js/8zc-new-ui.js'
s = p.read_text()
s = replace_once(s, "searchLabel.textContent = 'Search players, openings, events or years';", "searchLabel.textContent = 'Players, openings, events or years';")
s = replace_once(s, "terms.every(term => entry.search.includes(term))", "terms.every(term => (entry.search + ' ' + normalize(window.ChessAppI18n?.translate(entry.title) || '') + ' ' + normalize(window.ChessAppI18n?.translate(entry.detail) || '')).includes(term))")
s = replace_once(s, "      category.addEventListener('change', render);", "      category.addEventListener('change', () => { panel.scrollTop = 0; render(); });\n      window.addEventListener('chess-app-language', () => { if (search.value) render(); });")
p.write_text(s)

translations = {
    'Players, openings, events or years': 'Igralci, otvoritve, dogodki ali leta',
    'Find your next game': 'Poišči naslednjo partijo',
    'Try Carlsen, Sicilian, 2024…': 'Npr. Carlsen, sicilijanska, 2024…',
    'Collection': 'Zbirka', 'All collections': 'Vse zbirke', 'Matching games': 'Ustrezne partije', 'Games': 'Partije',
    'Use position in Sim / tournament': 'Uporabi položaj v simulaciji / turnirju',
    'Loading Top Picks…': 'Nalagam izbrane partije…', 'Loading game collections…': 'Nalagam zbirke partij…',
    'No games match. Try another player, year or collection.': 'Ni ustreznih partij. Poskusi drugega igralca, leto ali zbirko.',
    'No collections loaded. Use Load PGN to open a game from your device.': 'Ni naloženih zbirk. Z možnostjo Naloži PGN odpri partijo iz svoje naprave.',
    'ChessBest Top Picks': 'ChessBest izbor partij', 'Openings - Top Lines': 'Otvoritve – glavne linije',
    'Book - DCC (flat)': 'Otvoritvena knjiga – DCC (brez variant)',
    'Book - Raw (flat)': 'Otvoritvena knjiga – surove ocene (brez variant)',
    'Book - EndEval (flat)': 'Otvoritvena knjiga – EndEval (brez variant)',
    'TCEC SuFi & other engine games': 'TCEC SuFi in druge računalniške partije',
    'TCEC S27 (2022) White Wins': 'TCEC S27 (2022) – zmage belega',
    'TCEC S27 (2022) Black Wins': 'TCEC S27 (2022) – zmage črnega',
    'Various Games': 'Različne partije', 'Simulation game': 'Simulacijska partija',
    'Simulation archive': 'Arhiv simulacij', 'completed': 'končano', 'running': 'poteka', 'paused': 'prekinjeno', 'pending': 'čaka', 'aborted': 'ustavljeno',
    'Gukesh–Carlsen: the hidden cost of 44...f6': 'Gukesh–Carlsen: skrita cena poteze 44...f6',
    'A subtle rook move keeps a large advantage; the natural pawn push lets much of it slip away.': 'Prefinjena poteza trdnjave ohrani veliko prednost; naravni pomik kmeta večino te prednosti zapravi.',
    'Carlsen–Aronian: the quiet cost of 50...g6': 'Carlsen–Aronian: neopazna cena poteze 50...g6',
    'A pawn move opens the route for White’s g-pawn; shallow analysis sees only part of the change.': 'Poteza kmeta odpre pot belemu g-kmetu; plitva analiza zazna le del spremembe.',
    'Leko–Kramnik: the delayed cost of 32.Rad7': 'Leko–Kramnik: poznejše posledice poteze 32.Rad7',
    '32.Rad7 removes the Ra6 counterattack; Lite at depth 21 sees little of the danger.': '32.Rad7 onemogoči protinapad z Ra6; Lite pri globini 21 zazna le malo nevarnosti.',
    'Kasparov–Svidler: the rook check after 47...Kd6': 'Kasparov–Svidler: šah s trdnjavo po 47...Kd6',
    'The active king move permits 48.Rd3+; Lite sees little difference through depth 21.': 'Aktivna poteza kralja dopušča 48.Rd3+; Lite do globine 21 zazna le majhno razliko.',
    'Carlsen–Firouzja: 37...Nf8 and the dangerous c-pawn': 'Carlsen–Firouzja: 37...Nf8 in nevarni c-kmet',
    'A quiet retreat looks similar at Lite depth 15, but the rook’s entry and c-pawn grow more serious at higher depth.': 'Miren umik je pri globini 15 za Lite videti podoben, pri večji globini pa vdor trdnjave in c-kmet postaneta resnejša grožnja.',
    'TCEC S27 Superfinal: the cost of 49.Rba1': 'TCEC S27 superfinale: cena poteze 49.Rba1',
    'Two dangerous passed pawns make the choice between 49.Rf2 and 49.Rba1 decisive for White’s defense.': 'Zaradi dveh nevarnih prostih kmetov je izbira med 49.Rf2 in 49.Rba1 odločilna za obrambo belega.',
    'TCEC Cup 14 Final: 47...Qb8 and the missed c-pawn push': 'TCEC Cup 14 finale: 47...Qb8 in zamujeni pomik c-kmeta',
    '47...c3 keeps active counterplay; the played queen move allows White to press in a complex endgame.': '47...c3 ohrani aktivno protiigro; odigrana poteza dame belemu omogoči pritisk v zapleteni končnici.',
    'White POV': 'Z vidika belega', 'heuristic choice': 'hevristična izbira', 'CDB lines': 'CDB linije', 'choice': 'izbira', 'raw retained': 'ohranjena osnovna izbira',
}
p = app / 'js/app-mobile.js'; s = p.read_text()
addition = '  // Library interface and curated display copy only; original PGNs stay unchanged.\n  for (const [en, sl] of Object.entries(' + json.dumps(translations, ensure_ascii=False, indent=4) + ')) TO_SL.set(en, sl);\n'
s = replace_once(s, '  const TO_EN = new Map(Object.entries({', addition + '  const TO_EN = new Map(Object.entries({')
insert = r'''      // Library counters/statuses change after filtering and late collection loads.
      m = clean.match(/^(\d[\d,.]*) of (\d[\d,.]*) games$/);
      if (!translated && m) translated = `${m[1]} od ${m[2]} partij`;
      m = clean.match(/^(\d[\d,.]*) games$/);
      if (!translated && m) translated = `Skupaj partij: ${m[1]}`;
      m = clean.match(/^(\d[\d,.]*) games? found\. Select a game to load it\.$/);
      if (!translated && m) translated = `Najdenih partij: ${m[1]}. Izberi partijo za nalaganje.`;
      m = clean.match(/^Showing 60 of (\d[\d,.]*) matches\. Refine your search to see more\.$/);
      if (!translated && m) translated = `Prikazanih je 60 od ${m[1]} zadetkov. Za preostale zoži iskanje.`;
      m = clean.match(/^depth (\d+)$/);
      if (!translated && m) translated = `globina ${m[1]}`;
      if (!translated && clean.includes(' · ')) {
        const composed = clean.split(' · ').map(part => TO_SL.get(part) ||
          part.replace(/^CDB evaluated candidates$/, 'Kandidati, ocenjeni s CDB')
            .replace(/^SF local depth (\d+)$/, 'Lokalna globina SF $1')
            .replace(/^(\d+) moves$/, '$1 potez')).join(' · ');
        if (composed !== clean) translated = composed;
      }
'''
anchor = "      if (!translated && clean.startsWith('Offline files ready ·'))"
s = replace_once(s, anchor, insert + anchor)
s = replace_once(s, '  function translateNode(node, dynamic = false) {', '  root.ChessAppI18n = Object.freeze({ translate: translateText });\n  function translateNode(node, dynamic = false) {')
s = replace_once(s, '    if (!node || node.nodeType !== 3 || !node.nodeValue?.trim()) return;', "    if (!node || node.nodeType !== 3 || !node.nodeValue?.trim() || node.parentElement?.closest('.library-native-selects')) return;")
s = replace_once(s, "    if (!el || /^(SCRIPT|STYLE)$/i.test(el.tagName || '')) return;", "    if (!el || /^(SCRIPT|STYLE)$/i.test(el.tagName || '') || el.closest?.('.library-native-selects')) return;")
s = replace_once(s, '    try {\n      translateElement(doc.body);', "    try {\n      root.dispatchEvent(new CustomEvent('chess-app-language', { detail: { language: lang } }));\n      translateElement(doc.body);")
p.write_text(s)

p = app / 'css/app-mobile.css'
s = p.read_text() + '''
/* One APP library scroll surface: filters, results and footer share the drawer.
 * Keep the existing sticky heading/close action reachable while browsing. */
body.app-mobile #controls > #popularGamesPanel.open {
  display: block; overflow-y: auto; overflow-x: hidden;
  --library-scroll-thumb: #74917b;
  scrollbar-width: thin;
  scrollbar-color: var(--library-scroll-thumb) var(--ui-inset);
  scrollbar-gutter: stable;
}
body.app-mobile.light-theme #controls > #popularGamesPanel.open { --library-scroll-thumb: #52745d; }
body.app-mobile #popularGamesPanel .library-result-list {
  flex: 0 0 auto; height: auto; max-height: none; overflow: visible;
}
body.app-mobile #popularGamesPanel::-webkit-scrollbar { width: 8px; height: 8px; }
body.app-mobile #popularGamesPanel::-webkit-scrollbar-track,
body.app-mobile #popularGamesPanel::-webkit-scrollbar-corner { background: var(--ui-inset); }
body.app-mobile #popularGamesPanel::-webkit-scrollbar-thumb {
  background: var(--library-scroll-thumb); border: 2px solid var(--ui-inset); border-radius: 8px;
}
body.app-mobile #popularGamesPanel::-webkit-scrollbar-thumb:hover { background: #91ae99; }
body.app-mobile #popularGamesPanel::-webkit-scrollbar-button { display: none; }
@media (forced-colors: active) {
  body.app-mobile #controls > #popularGamesPanel.open { scrollbar-color: auto; }
}
'''
p.write_text(s)

p = ROOT / 'tools/chess-app-browser-review.py'; s = p.read_text()
block = '''            # Full library scrolling and EN/SL copy, including dynamic results.
            inner.wait_for_function("document.querySelectorAll('.library-result').length === 7",timeout=15000)
            inner.locator('#appGames').click()
            library=inner.locator('#popularGamesPanel')
            for language in ['sl','en','sl','en']:
                inner.locator('[data-app-lang="'+language+'"]').click();page.wait_for_timeout(100)
                expected='Igralci, otvoritve, dogodki ali leta' if language=='sl' else 'Players, openings, events or years'
                record('library search label '+language,library.locator('label[for="gameLibrarySearch"]').inner_text()==expected)
                record('library placeholder '+language,inner.locator('#gameLibrarySearch').get_attribute('placeholder')==('Npr. Carlsen, sicilijanska, 2024…' if language=='sl' else 'Try Carlsen, Sicilian, 2024…'))
                record('library curated copy '+language,('skrita cena' if language=='sl' else 'hidden cost') in library.locator('.library-result').first.inner_text())
                record('library status '+language,('Najdenih partij: 7.' if language=='sl' else '7 games found.') in library.locator('.library-status').inner_text())
            for light in [False,True]:
                inner.evaluate('(light)=>document.body.classList.toggle("light-theme",light)',light)
                geometry=library.evaluate("e=>{const list=e.querySelector('.library-result-list'),s=getComputedStyle(e);return {overflow:s.overflowY,display:s.display,color:s.scrollbarColor,listOverflow:getComputedStyle(list).overflowY,scrollable:e.scrollHeight>e.clientHeight};}")
                record('one green library scroll surface '+str(light),geometry['overflow']=='auto' and geometry['display']=='block' and geometry['listOverflow']=='visible' and geometry['scrollable'] and ('rgb(82, 116, 93)' if light else 'rgb(116, 145, 123)') in geometry['color'],geometry)
            inner.evaluate('document.body.classList.remove("light-theme")')
            before_y=inner.locator('#gameLibrarySearch').bounding_box()['y']
            library.evaluate('e=>e.scrollTop=180');page.wait_for_timeout(100)
            record('library filters scroll with results',inner.locator('#gameLibrarySearch').bounding_box()['y']<before_y-100 and library.locator('.library-result-list').evaluate('e=>e.scrollTop')==0)
            inner.locator('#btnUseTournamentOpening').scroll_into_view_if_needed()
            record('library footer reachable',inner.locator('#btnUseTournamentOpening').evaluate("e=>{const p=e.closest('#popularGamesPanel').getBoundingClientRect(),r=e.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom+1;}"))
            record('sticky burgundy X reachable',inner.locator('#btnCloseGames').is_visible())
            library.evaluate('e=>e.scrollTop=0')
            inner.locator('[data-app-lang="sl"]').click()
            inner.locator('#gameLibrarySearch').fill('skrita');page.wait_for_timeout(150)
            record('localized library search',library.locator('.library-result').count()==1 and 'Najdenih partij: 1.' in library.locator('.library-status').inner_text())
            inner.locator('#gameLibrarySearch').fill('zzzz-no-game');page.wait_for_timeout(100)
            record('localized no-result state',library.locator('.library-result').count()==0 and library.locator('.library-status').inner_text().startswith('Ni ustreznih partij.'))
            inner.locator('#gameLibrarySearch').fill('');inner.locator('#popularGamesSelect').select_option('all');page.wait_for_timeout(150)
            record('localized capped results',library.locator('.library-result').count()==60 and library.locator('.library-status').inner_text().startswith('Prikazanih je 60 od'))
            inner.locator('#popularGamesSelect').select_option('0');page.wait_for_timeout(100)
            page.locator('.phone-frame').screenshot(path=str(out/'library-sl.png'))
            inner.locator('[data-app-lang="en"]').click();page.wait_for_timeout(100)
            record('library restores EN after filtered SL',library.locator('.library-status').inner_text().startswith('7 games found.') and 'hidden cost' in library.locator('.library-result').first.inner_text())
            page.locator('.phone-frame').screenshot(path=str(out/'library-en.png'))
'''
s = replace_once(s, "            inner.locator('#appGames').click()\n            inner.locator('#btnCloseGames').click()", block + "            inner.locator('#btnCloseGames').click()")
p.write_text(s)

# Rebuild this APP's content-addressed cache only; no other channel is written.
p = app / 'release.json'; release = json.loads(p.read_text())
release['assets_sha256'] = {name: sha((app/name).read_bytes()) for name in sorted(release['assets_sha256'])}
release['version'] = 'app-' + sha((json.dumps(release['assets_sha256'], indent=2)+'\n').encode())[:16]
s = (app/'sw.js').read_text()
s, count = re.subn(r'const RELEASE = "[^"]+";', 'const RELEASE = "'+release['version']+'";', s)
assert count == 1
for name, digest in release['assets_sha256'].items():
    integrity = base64.b64encode(bytes.fromhex(digest)).decode()
    s, count = re.subn(r'  "'+re.escape(name)+r'": "sha256-[^"]+"', '  "'+name+'": "sha256-'+integrity+'"', s)
    assert count == 1, name
(app/'sw.js').write_text(s)
release['worker_sha256'] = sha(s.encode())
p.write_text(json.dumps(release, indent=2)+'\n')
print('APP release:', release['version'])
print('Changed runtime hashes:', json.dumps({name: release['assets_sha256'][name] for name in ['js/8zc-new-ui.js','js/app-mobile.js','css/app-mobile.css']}))
