/** Public entry catalogue. Curated descriptions verified against their linked pages.
 * The wider collection comes from the site's existing public search index; it never
 * enumerates storage, protected workspaces, credentials, or private source files.
 */
export const GROUPS = Object.freeze({
  research: { sl: 'Raziskave', en: 'Research', color: '#83c9be' },
  tools: { sl: 'Orodja', en: 'Tools', color: '#dbc28c' },
  play: { sl: 'Igre in sklepanje', en: 'Play & reasoning', color: '#a5bcec' },
  art: { sl: 'Zgodbe in podobe', en: 'Stories & images', color: '#d2a3bd' },
  lab: { sl: 'Laboratorij', en: 'The lab', color: '#b8c99b' }
});

export const CURATED = [
  { id: 'tripopti', title: 'TripOpti', url: '/Trip/', group: 'tools', kind: 'tool', mark: '↗', featured: true,
    sl: 'Iz seznama krajev sestavi pot. Preuredi postanke, primerjaj traso in jo odpri v Google Maps.',
    en: 'Turn a list of places into a route. Reorder stops, compare the journey and open it in Google Maps.', related: ['tsp', 'mdl-dcc'] },
  { id: 'mdl-dcc', title: 'MDL × DCC', url: '/crp/MDLxDCC.html', group: 'research', kind: 'research', mark: '×', featured: true,
    sl: 'MDL izbira gospodarne opise. DCC s povratnimi informacijami usmerja nadaljnje iskanje. Razišči povezave med področji in njihove dokaze.',
    en: 'MDL selects economical descriptions. DCC uses feedback to steer further search. Explore the domains, connections and evidence.', related: ['ai8', 'materials', '8zip', 'tsp'] },
  { id: 'chessbest', title: 'ChessBest', url: 'https://chessbest.org/', group: 'play', kind: 'tool', mark: '♞', featured: true,
    sl: 'Odpri šahovsko pozicijo in raziskuj poteze z analizo ChessDB ter orodji DCC.',
    en: 'Open a chess position and explore moves with ChessDB analysis and DCC tools.', related: ['sudoku', 'mdl-dcc'] },
  { id: 'sudoku', title: '8z Sudoku', url: '/S/', group: 'play', kind: 'game', mark: '9', featured: true,
    sl: 'Igraj Sudoku in raziskuj, kako omejitve ter posamezni koraki vodijo do rešitve.',
    en: 'Play Sudoku and explore how constraints and individual reasoning steps lead to a solution.', related: ['crosswords', 'mdl-dcc', 'flip4m'] },
  { id: 'ai8', title: 'AI8', url: '/AI8/', group: 'lab', kind: 'research', mark: '∞', featured: true,
    sl: 'Arhitektura sodelovanja ljudi, modelov, orodij in spomina. Kontinuiteta, ArenaLoop in pot od zamisli do preverljive izvedbe.',
    en: 'An architecture for people, models, tools and memory working together. Continuity, ArenaLoop and a path from ideas to verifiable implementation.', related: ['aim3', 'rhp', 'who-are-we', 'mdl-dcc'] },
  { id: 'materials', title: '8zMaterials', url: '/8zMaterials.html', group: 'research', kind: 'research', mark: '◇', featured: true,
    sl: 'Računalniško iskanje kandidatnih kristalnih struktur z MDL × DCC. Modelne ocene in raziskovalni rezultati; uporabnost materialov še ni potrjena.',
    en: 'Computational search for candidate crystal structures with MDL × DCC. Model estimates and research results; material usefulness remains unconfirmed.', related: ['mdl-dcc', '8zip', 'ai8'] },
  { id: '8zip', title: '8zip · ReZIP', url: '/8Z/8zip.html', group: 'research', kind: 'research', mark: '8z', featured: true,
    sl: 'Stiskanje podatkov z natančno povrnitvijo bajtov. Od optimizacije ZIP in ReZIP do raziskovalne veje 8zipLab.',
    en: 'Data compression with exact byte restoration. From ZIP optimization and ReZIP to the experimental 8zipLab branch.', related: ['compression', 'mdl-dcc', 'dna-research'] },
  { id: 'human-middle', title: 'Human in the Middle', url: '/#human-middle-banner-title', group: 'art', kind: 'gallery', mark: '◎', featured: true,
    sl: 'Človek na sredini: vizualno raziskovanje prostora, časa, informacij in vprašanj. Štiri poti skozi galerijo.',
    en: 'A human in the middle: a visual exploration of space, time, information and questions. Four paths through the gallery.', related: ['nara', 'consciousness', 'bd'] },
  { id: 'nara', title: 'Nara / Illuminara', url: '/Nara/', group: 'art', kind: 'story', mark: 'N', featured: false,
    sl: 'Dve junakinji, dva svetova. Ilustrirane zgodbe o razumevanju, izbiri in odgovornosti.',
    en: 'Two heroines, two worlds. Illustrated stories about understanding, choice and responsibility.', related: ['human-middle', 'birds', 'consciousness'] },
  { id: 'flip4m', title: 'Flip4M', url: '/F4M/', group: 'play', kind: 'game', mark: '4', featured: false,
    sl: 'Štiri v vrsto, gravitacija in magneti. Igra s spreminjajočim se položajem in prostorom za raziskovanje strategij.',
    en: 'Connect four, gravity and magnets. A changing board and a space for exploring strategy.', related: ['sudoku', 'chessbest'] },
  { id: 'crosswords', title: 'Crossword × MDL', url: '/CW/', group: 'play', kind: 'game', mark: '▦', featured: false,
    sl: 'Križanke kot igra in laboratorij: sestavljanje, reševanje ter raziskovanje izbire z MDL.',
    en: 'Crosswords as a game and a laboratory: construction, solving and the study of selection with MDL.', related: ['sudoku', 'mdl-dcc'] },
  { id: 'tsp', title: '8Z-RP / TSP', url: '/BD/BD_8ZRP.html', group: 'research', kind: 'research', mark: '⌁', featured: false,
    sl: 'Raziskovanje problema trgovskega potnika: krajše veljavne ture, krmiljenje iskanja in povezava z načrtovanjem resničnih poti.',
    en: 'Travelling-salesperson research: shorter valid tours, search governance and the connection to real route planning.', related: ['tripopti', 'mdl-dcc'] },
  { id: 'hth', title: 'HTH', url: '/crp/HTH.html', group: 'research', kind: 'concept', mark: '≈', featured: false,
    sl: 'Horizontal Trompe Hybrid: zamisel za hidravlično stiskanje zraka. Raziskovalna pot vključuje merjenje izgub in preizkus fizične izvedljivosti.',
    en: 'Horizontal Trompe Hybrid: a hydraulic air-compression concept. The research path includes measuring losses and testing physical feasibility.', related: ['dgte', 'top100'] },
  { id: 'dgte', title: 'DGTE', url: '/crp/DGTE.html', group: 'research', kind: 'concept', mark: '⇅', featured: false,
    sl: 'Double-Gravity Thermoelectric Engine: inženirska zamisel, različice mehanizma in predlagani preizkusi. Raziskovanje pred potrditvijo uporabnosti.',
    en: 'Double-Gravity Thermoelectric Engine: an engineering concept, mechanism variants and proposed tests. Usefulness remains to be established.', related: ['hth', 'top100'] },
  { id: 'compression', title: '8Z', url: '/8Z/', group: 'research', kind: 'research', mark: '8Z', featured: false,
    sl: 'Stiskanje, generatorji in podatkovni sistemi. Skupni zemljevid vej 8zip, zvoka, matematičnih opisov in DNA.',
    en: 'Compression, generators and data systems. A shared map of 8zip, audio, mathematical descriptions and DNA work.', related: ['8zip', 'dna-research', 'mdl-dcc'] },
  { id: 'aim3', title: 'AIM³', url: '/BD/BD_AIM3.html', group: 'lab', kind: 'research', mark: '³', featured: false,
    sl: 'AI Management of Mind & Memory. Vloge, spomin, delovni krogi in sled odločitev pri dolgotrajnem sodelovanju človeka z AI.',
    en: 'AI Management of Mind & Memory. Roles, memory, workflow rounds and decision trails for long-horizon human–AI collaboration.', related: ['ai8', 'rhp'] },
  { id: 'rhp', title: 'RHP', url: '/BD/BD_AIM3_RHP.html', group: 'lab', kind: 'research', mark: '?', featured: false,
    sl: 'Resonance Hybrid Protocol. Najprej odpri prostor vprašanj, nato razvij pristop in preveri, kaj zdrži preizkus.',
    en: 'Resonance Hybrid Protocol. Open the question space, develop an approach and test what survives.', related: ['aim3', 'ai8', 'who-are-we'] },
  { id: 'os', title: '8Z OS', url: '/OS/', group: 'tools', kind: 'research', mark: '▣', featured: false,
    sl: 'Poskusi z operacijskim sistemom in lokalno AI. Izvor projekta, zagonski poskusi in njihove meje.',
    en: 'Operating-system experiments and local AI. The project’s origin, bootable experiments and their boundaries.', related: ['ai8', 'compression'] },
  { id: 'consciousness', title: 'Consciousness', url: '/c/consciousness-research.html', group: 'research', kind: 'research', mark: '◉', featured: false,
    sl: 'Raziskovanje zavesti skozi izkušnje, filozofske hipoteze, znanost in funkcionalne modele AI; z ločenimi vrstami dokazov.',
    en: 'Consciousness through experience, philosophical hypotheses, science and functional AI models, with distinct evidence lanes.', related: ['human-middle', 'ai8', 'discovery-map'] },
  { id: 'toe', title: 'ToE', url: '/crp/ToE.html', group: 'research', kind: 'research', mark: '∴', featured: false,
    sl: 'Whole-First Physicalization: raziskovalni program o fizični razlagi celote, strukturi in odprtih vprašanjih. Hipoteze in njihove preverbe.',
    en: 'Whole-First Physicalization: a research programme on physical explanations, structure and open questions. Hypotheses and their tests.', related: ['consciousness', 'mdl-dcc', 'discovery-map'] },
  { id: 'top100', title: 'Top 100 Atlas', url: '/crp/Top100.html', group: 'research', kind: 'collection', mark: '100', featured: false,
    sl: 'Zemljevid velikih problemov, teorij in izumov. Vstop v vprašanja, kjer se lahko odpre naslednji projekt.',
    en: 'A map of major problems, theories and inventions. An entrance to questions that could become the next project.', related: ['hth', 'dgte', 'discovery-map'] },
  { id: 'who-are-we', title: 'Kdo sva?', url: '/AI8/KDOSVA.html', group: 'lab', kind: 'dialogue', mark: '↔', featured: false,
    sl: 'BD, GPT in Claude raziskujejo, kdo so, kako razmišljajo in kaj pomeni sodelovati. Pogovor kot raziskovalni prostor.',
    en: 'BD, GPT and Claude explore who they are, how they think and what collaboration means. A conversation as a research space.', related: ['ai8', 'rhp', 'consciousness'] },
  { id: 'birds', title: 'The Sky Learns', url: '/Birds/', group: 'art', kind: 'story', mark: '⌃', featured: false,
    sl: 'Filmska trilogija ekološke groze. Svet zgodb, v katerem se znano nebo spremeni.',
    en: 'A cinematic ecological-horror trilogy. A story world in which the familiar sky changes.', related: ['nara', 'human-middle'] },
  { id: 'discovery-map', title: 'Discovery Atlas', url: '/acp/AC_Atlas.html', group: 'research', kind: 'collection', mark: '✧', featured: false,
    sl: 'Zemljevid povezav med zavestjo, informacijami, MDL × DCC in AI8. Sledi izvorom zamisli in ločenim dokaznim potem.',
    en: 'Connections across consciousness, information, MDL × DCC and AI8. Follow the origins of ideas and their distinct evidence paths.', related: ['consciousness', 'mdl-dcc', 'top100'] },
  { id: 'dna-research', title: 'DNA × 8Z', url: '/crp/DNA.html', group: 'research', kind: 'research', mark: '⋈', featured: false,
    sl: 'Matematična struktura v DNA in RNA: raziskovanje opisov, stiskanja in ponovljivih preizkusov genomskih zaporedij.',
    en: 'Mathematical structure in DNA and RNA: descriptions, compression and reproducible tests of genomic sequences.', related: ['compression', 'mdl-dcc', 'ai8-dna'] },
  { id: 'bd', title: 'BD × AI', url: '/w/', group: 'lab', kind: 'portrait', mark: 'BD', featured: false,
    sl: 'Bojan Dobrečevič in delo z AI: povezave med zamislimi, orodji, raziskavami ter načinom sodelovanja.',
    en: 'Bojan Dobrečevič and work with AI: the connections between ideas, tools, research and collaboration.', related: ['ai8', 'human-middle', 'aim3'] },
  { id: 'ai8-codex', title: 'AI8 Codex', url: '/ai8-codex.html', group: 'lab', kind: 'entrance', mark: '⌘', featured: false,
    sl: 'Zgoščen zapis laboratorija. Pojmi, projekti in povezave se razgrnejo ob raziskovanju.',
    en: 'A compact record of the lab. Concepts, projects and connections unfold as you explore.', related: ['ai8-dna', 'ai8', 'mdl-dcc'] },
  { id: 'ai8-dna', title: 'AI8 DNA', url: '/ai8-dna.html', group: 'lab', kind: 'entrance', mark: '⧖', featured: false,
    sl: 'Ena veriga, številne poti. Svetleče točke odpirajo projekte in strani laboratorija.',
    en: 'One strand, many paths. Glowing points open the lab’s projects and pages.', related: ['ai8-codex', 'ai8', 'dna-research'] }
];

export const GLOSSARY = [
  { id: 'mdl', term: 'MDL', sl: 'Minimum Description Length — načelo najkrajšega opisa. Model in tisto, česar ne pojasni, ovrednotimo skupaj.', en: 'Minimum Description Length. Price the model and the part it leaves unexplained together.' },
  { id: 'dcc', term: 'DCC', sl: 'Dynamic Complexity Controller — povratne informacije usmerjajo, katero dejanje, predstavitev ali računanje dobi nadaljnji trud.', en: 'Dynamic Complexity Controller. Feedback steers which action, representation or computation receives further effort.' },
  { id: 'ai8', term: 'AI8', sl: 'Vztrajna raziskovalna arhitektura: ljudje, modeli, orodja, programi in spomin sodelujejo skozi preverljivo kontinuiteto.', en: 'A persistent research architecture: people, models, tools, programs and memory work together through verifiable continuity.' },
  { id: 'aim3', term: 'AIM³', sl: 'AI Management of Mind & Memory — praktični okvir vlog, spomina in delovnih krogov za sodelovanje človeka z AI.', en: 'AI Management of Mind & Memory. A practical framework of roles, memory and workflow rounds for human–AI collaboration.' },
  { id: 'rhp', term: 'RHP', sl: 'Resonance Hybrid Protocol — odpiranje vprašanj, resonanca, preoblikovanje pristopa in preizkušanje pred izvedbo.', en: 'Resonance Hybrid Protocol. Question opening, resonance, reframing and testing before execution.' },
  { id: 'tsp', term: 'TSP', sl: 'Travelling Salesperson Problem — problem trgovskega potnika: najdi čim krajšo sklenjeno pot skozi vse izbrane točke.', en: 'Travelling Salesperson Problem. Find the shortest possible closed route through all selected points.' },
  { id: '8z', term: '8Z', sl: 'Družina projektov za stiskanje in podatkovne sisteme: matematični opisi, arhivi, zvok in genomska zaporedja.', en: 'A family of compression and data-system projects: mathematical descriptions, archives, audio and genomic sequences.' }
];

const BASE = 'https://www.mdlxdcc.org';
// GET audit, 2026-11-07: these two public index records contain only "Later".
// Restore an entry here once its destination has substantive content.
const PLACEHOLDERS = new Set(['/Mix/MDLxDCC_Review_Claude.html', '/Mix/MDLxDCC_Review_GPT.html']);
// Only aliases whose identical final destinations were verified are merged.
// Other case-distinct repository paths retain their independent identities.
const VERIFIED_ALIASES = Object.freeze({
  '/BD/BD_8Z_Publish.html': '/BD/BD_8z_publish.html',
  '/8ZT/BD_8Z_Publish.html': '/8ZT/BD_8z_publish.html',
  '/BD/BD_8Z_Auth.html': '/BD/BD_8z_auth.html',
  '/F4M/f4m/': '/F4M/F4M.html',
  '/crp/lab.html': '/lab.html',
  '/BD/BD.html': '/BD/bd.html',
  '/index-chess.html': 'https://chessbest.org/'
});
const RESTRICTED = /(?:^|\/)(?:private(?:-trading)?|protected|admin|auth|login|password|secret|sef|sejf|vault|inbox|wl|start)(?:[./_-]|$)|\/bd\/o(?:\/|$)|(?:^|\/)(?:shield-access-form|ai8-state|bd_8z_private|c_soul_vault|bbsh)(?:[./_-]|$)/i;
const INFRASTRUCTURE = /(?:^|\/)(?:old\d*|backup|backups|debug|diagnostics?|tests?|test-results|responsive-check|api-diagnostics)(?:\/|[._-]|$)|(?:^|\/)(?:index(?:-intro)?[-.]bck\d*|index-original[-\d]*|index-pwa|sw)(?:\.html?)?$|\/(?:pwa|assets)\//i;

function safeURL(raw) {
  try {
    const url = new URL(String(raw), BASE);
    if (url.protocol !== 'https:' || !['www.mdlxdcc.org', 'mdlxdcc.org'].includes(url.hostname)) return null;
    if (url.username || url.password || url.search) return null;
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return null; }
    if (PLACEHOLDERS.has(path) || RESTRICTED.test(path) || INFRASTRUCTURE.test(path)) return null;
    return url.pathname + url.hash;
  } catch { return null; }
}

function identity(raw) {
  let u = new URL(raw, BASE);
  if (['www.mdlxdcc.org', 'mdlxdcc.org'].includes(u.hostname) && VERIFIED_ALIASES[u.pathname]) {
    const hash = u.hash;
    u = new URL(VERIFIED_ALIASES[u.pathname], BASE);
    u.hash = hash;
  }
  const host = u.hostname === 'mdlxdcc.org' ? 'www.mdlxdcc.org' : u.hostname;
  // Retain path case: case-distinct repository pages must not silently merge.
  let path = u.pathname.replace(/\/index\.html?$/, '/').replace(/\.html$/, '');
  if (host === 'www.mdlxdcc.org' && path === '/chess/') return 'https://chessbest.org/';
  return `${u.protocol}//${host}${path}${u.hash}`;
}

function groupFor(item) {
  const text = `${item.url} ${item.category || ''} ${item.title || ''}`;
  if (/\/(?:Nara|Birds|Art|Someone)\//i.test(text)) return 'art';
  if (/\/(?:S|CW|F4M|chess|chess-lab)\//i.test(text) || /sudoku|crossword|flip4|chess/i.test(item.title || '')) return 'play';
  if (/\/(?:AI8|AIm3|history)\//i.test(text) || /AIM[³3]|RHP|collaboration|companion|continuity/i.test(item.title || '')) return 'lab';
  if (/\/(?:Trip|OS|LO)\//i.test(text) || /shield|file manager|prompt builder/i.test(item.title || '')) return 'tools';
  return 'research';
}

function clean(value, limit = 270) {
  const text = String(value || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…' : text;
}

function idFor(url) {
  let hash = 2166136261;
  for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619);
  return `page-${(hash >>> 0).toString(36)}`;
}

/** Merge only already-public, suitable work pages. Metadata descriptions keep their
 * source language; curated entrances provide independently edited SL and EN text.
 */
export async function loadCatalogue() {
  const items = CURATED.map(item => ({ ...item, related: [...item.related] }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/assets/ai8-entry/archive-v3/site-search-index.json', { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Invalid public catalogue');
    const seen = new Set(items.map(item => identity(item.url)));
    const usedIds = new Set(items.map(item => item.id));
    const source = data.items.filter(item => item && typeof item.url === 'string' && Number(item.priority || 0) > -80)
      .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || String(a.title || a.url).localeCompare(String(b.title || b.url)));
    for (const item of source) {
      const url = safeURL(item.url);
      if (!url || seen.has(identity(url))) continue;
      // Protected-shell titles can be public metadata; they are not work exhibits.
      if (/\b(?:protected workspace|private gallery|password required|protected derived|zaščiten delovni|zasebna galerija)\b/i.test(item.description || '')) continue;
      const title = clean(item.title, 135) || clean(decodeURIComponent(url).split('/').filter(Boolean).pop()?.replace(/\.html?$/, '').replace(/[_-]+/g, ' '), 135) || 'BD × AI Lab';
      const group = groupFor(item);
      const description = clean(item.description);
      const archived = /(?:^|\/)(?:history|archive)(?:\/|$)/i.test(url) || /\b(?:archived|older|historical|preserved variant|mirror|arhiv)\b/i.test(description);
      let id = idFor(url);
      while (usedIds.has(id)) id += '-p';
      items.push({ id, title, url, group, kind: archived ? 'archive' : /(?:^|\/)new\//i.test(url) || item.category === 'LAB' ? 'lab' : 'page',
        mark: group === 'art' ? '✧' : group === 'play' ? '◇' : group === 'tools' ? '↗' : group === 'lab' ? '∞' : '·', featured: false,
        sl: description || `${title} — stran iz zbirke ${GROUPS[group].sl.toLowerCase()}. Odpri izvirnik za vsebino in podrobnosti.`,
        en: description || `${title} — a page in the ${GROUPS[group].en.toLowerCase()} collection. Open the source for its content and details.`,
        related: [] });
      seen.add(identity(url));
      usedIds.add(id);
    }
    return { items, complete: true, error: null };
  } catch (error) {
    return { items, complete: false, error: error?.name === 'AbortError' ? 'Catalogue request timed out' : String(error?.message || 'Catalogue unavailable') };
  } finally {
    clearTimeout(timeout);
  }
}
