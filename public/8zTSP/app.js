// 8zTSP in the browser: the page script of mdlxdcc.org/8zTSP/ (BD × AI Lab, 15 Nov 2026, R22b part 2).
// Based on app.js of 8zTSP-web's R3 + PWA package (d514cdd3…, its app.js sha256 c4ac2a06…), ported into the site version
// (EN/SL texts that follow the site's language, the presets Examples / Random / Your file, the time of the first optimum,
// the mode line). From R3: the examples (the national instances of the University of Waterloo's collection, Slovenia's
// 6,035 settlements with the GURS credit, the DIMACS maps generated on the device: 100k and 1M, 10M only on a desktop
// with at least 8 GB), the image-refresh menu with sampled drawing for big maps, stopping a load, the streamed export,
// the memory limits for million-city maps. From BD's wishes (R20): all reported cores by default (an iPhone 6, up to 8
// anywhere since R22b part 1), the expanded map, the stop at a known optimum (now every example with one).
// worker.js, pool-worker.js, generator-worker.js, portgen.mjs, wasm-loader.js, wasm-crypto.mjs, examples.mjs, examples/,
// pkg/ and pkg-shared/ are the package's, unchanged. The part-1 version is demo/app.r22b1.js.
// R28 (8zTSP-K, 16 Nov 2026): from 8zTSP-web R5 A1 (0ce785e) the recording of a run and its slow replay (replay-data.mjs,
// replay-player.mjs, replay-copy.mjs and replay.css are the package's; the run option is called »refinement«), from Examples
// R1b (9d4905c) the 31 examples: Slovenia first and by default, the 27 countries by size with their continents, then the
// three generated maps; Slovenia's dated line (examples.mjs gapStatus). R1c/d (33ccd10): metres for Slovenia (distance-format.mjs),
// runs up to 86,400 s and a bounded run history (run-limits.mjs). R1f-i (caea33b): 62 maps, with continents and countries
// as .tsp.gz (checked by SHA-256 before and after unpacking), maps above 300,000 cities on a desktop only, a »Hard instances«
// group, four of them fetched from the authors' repository when chosen. R1k + R1k-a (7967cee): one flat list of 64 maps
// (Slovenia first, then by city count), metre maps shown in kilometres with the reference field in km, Slovenia's best known
// tour 8,728,254 m and Concorde's bound of 16 Nov 21:09. Before: demo/app.before_r28.js; before R1k: demo/app.before_r1k.js.
import { examples, exampleLabel, defaultExampleId, gapDisplay, desktopOnly, collections, soon, defaultCollectionId } from './examples.mjs';
import { initializeWasm, loaderState, solverModule, supportsSharedThreads } from './wasm-loader.js';
import { createRecorder, serializeRecording } from './replay-data.mjs';
import { mountReplay } from './replay-player.mjs';
import { REPLAY_COPY } from './replay-copy.mjs';
import { formatDistance, referenceFieldValue, referenceFromField } from './distance-format.mjs';
import { RUN_LIMITS, validSeconds, retainRecent } from './run-limits.mjs';
const $ = id => document.getElementById(id);
const root = document.documentElement;
const canvas = $('map'), ctx = canvas.getContext('2d');
$('seconds').min = String(RUN_LIMITS.minSeconds); $('seconds').max = String(RUN_LIMITS.maxSeconds);   // R1d: up to one day
const DEFAULT_EXAMPLE = defaultExampleId;   // R28 (R1b): Slovenia
// R22b (8zTSP-web R3, for BD's iPhone): Safari may hide the number of cores, so up to 8 workers can be chosen anywhere and
// an iPhone starts with 6; elsewhere the page starts with every core the device reports.
const reportedCores = Math.max(1, Math.floor(Number(navigator.hardwareConcurrency) || 1));
const isIPhone = /iPhone/i.test(navigator.userAgent);
const cores = Math.max(reportedCores, 8);
const canShare = supportsSharedThreads();
// R3: the 10M example only on a desktop that reports at least 8 GB of memory
const desktopLarge0 = !/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) && Number(navigator.deviceMemory) >= 8;   // R3's rule, kept for the record
// R1f-i: phones and tablets (also an iPad that reports a desktop browser) never load maps above 300,000 cities
const mobileDevice = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const desktopLarge = !mobileDevice && Number(navigator.deviceMemory) >= 8;
const deviceAllows = item => item.cities === 10000000 ? desktopLarge : desktopOnly(item) ? !mobileDevice : true;
for (let n = 1; n <= cores; n++) $('workers').add(new Option(String(n), String(n)));
$('workers').value = String(isIPhone ? 6 : reportedCores);
// R53 (BD 18 Nov, K's brief R52): two selects, the collection, then its map (inside a collection from the smallest map to the
// largest, ties by id; examples.mjs holds the order); entries that are not ready yet stand in their collection, marked »(soon)« |
// »(kmalu)«, and cannot be chosen; render() writes the labels in the page's language
const SOON = 'soon:';
const soonOf = value => value?.startsWith(SOON) ? soon.find(s => s.id === value.slice(SOON.length)) : null;
const collectionOf = value => collections.find(c => c.maps.includes(value) || (value?.startsWith(SOON) && c.soon?.includes(value.slice(SOON.length))));
function fillMaps(collectionId) {
  const c = collections.find(x => x.id === collectionId) || collections[0], select = $('example');
  select.replaceChildren();
  const entries = [...c.maps.map(id => ({id, n: examples.find(e => e.id === id).cities, later: false})), ...(c.soon || []).map(id => ({id, n: soon.find(s => s.id === id).cities, later: true}))]
    .sort((a, b) => a.n - b.n || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));   // Addendum A: a »(soon)« entry stands in its size place
  for (const x of entries) {
    if (x.later) { const option = new Option(x.id, SOON + x.id); option.disabled = true; select.append(option); continue; }
    const item = examples.find(e => e.id === x.id); const option = new Option(item.id, item.id); option.disabled = !deviceAllows(item); select.append(option);
  }
  $('collection').value = c.id;
}
function showMap(value) {   // both selects on a map; a map that is in Selected 10 and in its home collection stays where it was chosen
  const holds = c => c && (c.maps.includes(value) || (value?.startsWith(SOON) && c.soon?.includes(value.slice(SOON.length))));
  const current = collections.find(x => x.id === $('collection').value);
  const c = holds(current) ? current : collectionOf(value); if (!c) return;
  if ($('collection').value !== c.id || ![...$('example').options].some(o => o.value === value)) fillMaps(c.id);
  $('example').value = value;
}
for (const c of collections) $('collection').add(new Option(c.id, c.id));
fillMaps(defaultCollectionId);
$('example').value = DEFAULT_EXAMPLE;
let text = '', coords = new Float64Array(), tour = null, pool = [], loading = null, rejectLoading = null, extent = null, view = null;   // B: view = north-up display coordinates or null
let generation = 0, best = Infinity, started = 0, timer, active = false, runRecord = null, shownElapsed = 0, rejectActive = null;
let mapName = '', inputHash = '', lastDraw = 0, preset = '', tab = 'nu', statusKey = ['wasm'], mapMeta = null;
// R1k: the reference in the map's own units (metres for unit m); the field shows kilometres for unit m; an untouched or
// restored default keeps the exact stored value, an edit replaces it
let referenceRaw = null, referenceDefault = { raw: null, text: '' };
function setReference(raw) {
  const unit = mapMeta?.unit ?? null, input = $('reference');
  referenceRaw = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
  referenceDefault = { raw: referenceRaw, text: referenceFieldValue(referenceRaw, unit) };
  input.value = referenceDefault.text; input.min = unit === 'm' ? '0.001' : '1';
}
let renderTimer = null, renderPending = false, drawCount = 0, progressDrawCount = 0, lastDrawnTourLength = null;
const progressDrawTimes = [];
// R28 (R5 A1): the recording of a run; after the run »Replay slowly« plays it in its own panel (the result, the map and the
// clock of the run stay as they are). If recording fails, only the recording stops; the search goes on.
let recorder = null, lastSolverSeconds = 0, recordingSeparate = false, recordingFailed = false;
const replayPlayer = mountReplay($('replayPanel'));
function clearReplay() { replayPlayer.clear(); $('replayPanel').hidden = true; $('replayOpen').disabled = true; recorder = null; lastSolverSeconds = 0; recordingFailed = false; }
function recordSafely(fn) { try { fn(); } catch { recorder = null; recordingFailed = true; } }
const lang = () => root.dataset.lang === 'sl' ? 'sl' : 'en';
const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang() === 'sl' ? '.' : ',');
const dec = (x, d) => { const s = x.toFixed(d); return lang() === 'sl' ? s.replace('.', ',') : s; };
const pct = x => `${dec(x, 3)}${lang() === 'sl' ? ' %' : '%'}`;
const slPlural = (n, one, two, few, many) => { const m = n % 100; return m === 1 ? one : m === 2 ? two : m === 3 || m === 4 ? few : many; };
const ofCoresSl = c => `${c} ${c === 1 ? 'jedra' : 'jeder'}`;
// more workers than reported cores (an iPhone starts with 6 where Safari may report fewer): say so instead of »6 of 4 cores«
const ofEn = (n, c) => n <= c ? `${n} of ${c} cores` : `${n} workers (the device reports ${c} ${c === 1 ? 'core' : 'cores'})`;
const odSl = (n, c) => n <= c ? `${n} od ${ofCoresSl(c)}` : `${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')} (naprava javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')})`;
// the examples' names in both languages: since R28 from examples.mjs (item.names); this list is the fallback of R22b
const NAMES = {
  qa194: ['Qatar', 'Katar'], si6035_gurs_20261115: ['Slovenia · all towns and villages', 'Slovenija · vsa mesta in vasi'], uy734: ['Uruguay', 'Urugvaj'],
  zi929: ['Zimbabwe', 'Zimbabve'], lu980: ['Luxembourg', 'Luksemburg'], rw1621: ['Rwanda', 'Ruanda'], mu1979: ['Oman', 'Oman'],
  nu3496: ['Nicaragua', 'Nikaragva'], ca4663: ['Canada', 'Kanada'], tz6117: ['Tanzania', 'Tanzanija'],
  'E100k.0': ['DIMACS E100k.0, generated', 'DIMACS E100k.0, ustvarjen'], 'E1M.0': ['DIMACS E1M.0, generated', 'DIMACS E1M.0, ustvarjen'],
  'E10M.0': ['DIMACS E10M.0, generated', 'DIMACS E10M.0, ustvarjen'],
};
const exName = item => item.names?.[lang()] || (NAMES[item.id] || [item.label, item.label])[lang() === 'sl' ? 1 : 0];
const T = {
  en: {
    wasm: 'Loading WebAssembly…', exLoading: name => `Loading ${name}…`, reading: 'Reading the map…',
    readyWin: 'Ready · large map (over 12,000 cities).',
    readyPop: 'Ready · small map (up to 12,000 cities).',
    searching: (n, sharing) => n === 1 ? 'Searching · 1 worker…' : `Searching · ${n} workers…`,
    complete: (s, opt) => 'Complete · tour checked in Rust.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Reference'} first reached after ${dec(s, 1)} s of solver time.`),
    optimumStop: s => `Optimum reached after ${dec(s, 1)} s of solver time; the search stopped.`,
    stopped: 'Stopped · the last tour shown is kept.', loadingStopped: 'Loading stopped.', soon: '(soon)',
    stoppedErr: m => `Search stopped: ${m}`, workerFail: m => `Worker failed: ${m}`,
    noSolver: m => `Unable to load the solver: ${m}`,
    unavailable: 'Unable to start the solver.',
    checksum: 'The example file does not match its checksum.',
    exFail: name => `${name} could not be loaded; try another example, random points or your own file.`,
    generating: name => `Generating ${name} on your device…`,
    genFail: 'Generating the map failed within the memory this browser allows.',
    tenM: '10M needs a desktop computer that reports at least 8 GB of memory; it is not available on this device.',
    needShare: 'The selected mode is unavailable in this browser.',
    oneWorkerLarge: 'For maps of a million cities without shared memory, choose 1 worker: each worker would hold its own copy.',
    cities: n => `${group(n)} ${n === 1 ? 'city' : 'cities'}`, sampled: ' · sampled drawing',
    range: (label, lo, hi) => `${label}: enter a number from ${group(lo)} to ${group(hi)}`,
    integers: 'Cities and seed must be whole numbers', seedInt: 'The seed must be a whole number',
    workers: n => `Choose 1 to ${n} workers`, loadFirst: 'Load a map before running', fileLimit: 'File limit: 32 MB',
    gapOpt: 'ABOVE THE OPTIMUM', gapRef: 'ABOVE THE REFERENCE', gapBound: 'ABOVE THE HK BOUND', gapEstimate: 'ABOVE THE HK ESTIMATE', gapLower: 'ABOVE THE LOWER BOUND',
    reachOpt: 'OPTIMUM FIRST REACHED', reachRef: 'REFERENCE FIRST REACHED', gapBest: 'ABOVE THE BEST KNOWN TOUR', waterlooShort: 'University of Waterloo',
    refOpt: v => `Optimum ${v} (proved)`, refBest: (v, src) => `Best known tour ${v}${src ? ` (${src})` : ''}`, refBound: (v, src) => `Lower bound ${v}${src ? ` (${src})` : ''}`,
    refHK: (v, est) => `${est ? 'Held–Karp estimate' : 'Held–Karp bound'} ${v}`, refNone: 'No reference length yet',
    count: 'Random cities', seed: 'Seed', seconds: 'Seconds', reference: 'Reference length',
    placeholder: 'for the gap and the first-reach time', canvas: 'Points and the best tour',
    modeShared: (n, c) => `Mode: ${n} workers; browser reports ${c} ${c === 1 ? 'core' : 'cores'}.`,
    modeOne: (n, c) => `Mode: 1 worker; browser reports ${c} ${c === 1 ? 'core' : 'cores'}.`,
    modeSeparate: (n, c) => `Mode: compatibility mode · ${n} workers; browser reports ${c} ${c === 1 ? 'core' : 'cores'}.`,
    modeChosen: (n, c) => `Mode: compatibility mode · ${n} workers; browser reports ${c} ${c === 1 ? 'core' : 'cores'}.`,
    modeOneNoShare: (n, c) => `Mode: 1 worker; browser reports ${c} ${c === 1 ? 'core' : 'cores'}.`,
    hintIPhone: 'iPhone: 6 workers by default; Safari may hide the number of cores. More workers than cores do not help.',
    hintCores: c => `Your browser reports ${c} ${c === 1 ? 'core' : 'cores'}. More workers than cores do not help.`,
    option: item => exampleLabel(item, 'en') + (item.cities === 10000000 ? (desktopLarge ? ' · experimental, desktop' : ' · not on this device')
      : desktopOnly(item) ? (mobileDevice ? ' · desktop only, not on this device' : ' · desktop only') : ''),
    live: 'Live · 0.15 s',
    known: (n, opt) => `${group(n)} cities, known optimal tour ${opt}`,   // R46: opt comes formatted (with m for maps in metres)
    unknown: n => `${group(n)} cities; optimal tour not known`,
    bestKnown: (n, tourLength, b) => `${group(n)} cities; best known tour ${group(tourLength)}, lower bound ${group(b)}; optimum not confirmed`,
    bestKnownOnly: (n, tourLength, by) => `${group(n)} cities; best known tour ${group(tourLength)}${by ? ` (${by})` : ''}; not proved optimal`,
    replayInvalid: 'Unable to open this recording.',
    referenceTour: (v, src, date) => `Best known tour: ${v}; ${src}, ${date}.`, referenceLowerBound: (v, src, when) => `${src} lower bound: ${v}; ${when}.`,
    secondsRange: 'Enter a duration from 0.1 to 86,400 seconds.',
    desktopRequired: 'Maps above 300,000 cities open only on a desktop computer; this one is unavailable on this device.',
    challengeBest: (n, tourLength, b) => `${group(n)} cities; best tour of the 2002 DIMACS Challenge ${group(tourLength)}, Held–Karp lower bound ${group(Math.round(b))}; optimum not known`,
    hardProof: (opt, s) => `Optimum ${group(opt)} (proved). Finding a tour and proving it optimal are different tasks: Concorde needed on average ${proofTime(s)} to PROVE this optimum. These instances are hard to prove because the lower bound lies far below the optimum.`,
    beingProved: 'Optimum being proved.',
    provedHere: (opt, s, d) => `Optimum ${opt}, proved with Concorde on our laptop in ${s.toLocaleString('en-GB', {maximumFractionDigits: 1})} s (${d}).`,   // R41 (R1k-b): the evolved maps, 17 Nov; R46: opt comes formatted (km and m for maps in metres)
    remoteSource: 'Not hosted here: loaded from the authors’ repository when chosen and checked by SHA-256.',
    remoteUnavailable: 'The authors’ repository could not be reached; try again later.',
    remoteChanged: 'The authors’ file no longer matches the checked SHA-256; it was not loaded.',
    gzipUnavailable: 'This browser cannot unpack the compressed map.',
    siGap: (percent, date, running) => `The optimum is not proved yet: our tour is at most ${percent}% above it (Concorde's lower bound${running ? ', proof running' : ''}; as of ${date})`,
    bound: (n, b, est) => `${group(n)} cities; ${est ? 'HK estimate' : 'HK bound'} ${group(Math.round(b))}`,
    waterloo: 'National TSP collection, University of Waterloo', dimacs: 'DIMACS TSP Challenge · portgen by Lyle McGeoch',
    gurs: 'Surveying and Mapping Authority of the Republic of Slovenia (GURS) · RPE settlements · retrieved 15 Nov 2026',
    siNote: 'Centres of the settlement areas, rounded to metres (D96/TM); straight-line distances, not roads.',
    estimateNote: 'HK here is a statistical estimate, not a proven lower bound.',
    largeNote: 'A large example for desktop computers; the browser may run out of memory.',
    mapData: 'Map data',
  },
  sl: {
    wasm: 'Nalagam WebAssembly…', exLoading: name => `Nalagam ${name}…`, reading: 'Berem zemljevid…',
    readyWin: 'Pripravljeno · velik zemljevid (več kot 12.000 mest).',
    readyPop: 'Pripravljeno · manjši zemljevid (do 12.000 mest).',
    searching: (n, sharing) => n === 1 ? 'Iskanje · 1 delavec…' :
      `Iskanje · ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')}…`,
    complete: (s, opt) => 'Končano · pot preverjena v Rustu.' + (s === null ? '' :
      ` ${opt ? 'Optimum' : 'Referenca'} prvič dosežen${opt ? '' : 'a'} po ${dec(s, 1)} s časa reševalnika.`),
    optimumStop: s => `Optimum dosežen po ${dec(s, 1)} s časa reševalnika; iskanje ustavljeno.`,
    stopped: 'Ustavljeno · zadnja prikazana pot ostane.', loadingStopped: 'Nalaganje ustavljeno.', soon: '(kmalu)',
    stoppedErr: m => `Iskanje se je ustavilo: ${m}`, workerFail: m => `Delavec je odpovedal: ${m}`,
    noSolver: m => `Reševalnika ni bilo mogoče naložiti: ${m}`,
    unavailable: 'Reševalnika ni mogoče zagnati.',
    checksum: 'Datoteka primera se ne ujema s kontrolno vsoto.',
    exFail: name => `${name} se ni naložil; poskusite z drugim primerom, naključnimi točkami ali s svojo datoteko.`,
    generating: name => `Ustvarjam ${name} na vaši napravi…`,
    genFail: 'Ustvarjanje zemljevida ni uspelo v pomnilniku, ki ga dovoli ta brskalnik.',
    tenM: '10M potrebuje namizni računalnik, ki javlja vsaj 8 GB pomnilnika; na tej napravi ni na voljo.',
    needShare: 'Izbrani način v tem brskalniku ni na voljo.',
    oneWorkerLarge: 'Za zemljevide z milijonom mest brez skupnega pomnilnika izberite 1 delavca: vsak delavec bi imel svojo kopijo.',
    cities: n => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}`, sampled: ' · vzorčeno risanje',
    range: (label, lo, hi) => `${label}: vnesite število od ${group(lo)} do ${group(hi)}`,
    integers: 'Število mest in seme morata biti celi števili', seedInt: 'Seme mora biti celo število',
    workers: n => `Izberite od 1 do ${n} delavcev`, loadFirst: 'Pred zagonom naložite zemljevid', fileLimit: 'Omejitev datoteke: 32 MB',
    gapOpt: 'NAD OPTIMUMOM', gapRef: 'NAD REFERENCO', gapBound: 'NAD MEJO HK', gapEstimate: 'NAD OCENO HK', gapLower: 'NAD SPODNJO MEJO',
    reachOpt: 'OPTIMUM PRVIČ DOSEŽEN', reachRef: 'REFERENCA PRVIČ DOSEŽENA', gapBest: 'NAD NAJBOLJŠO ZNANO POTJO', waterlooShort: 'Univerza Waterloo',
    refOpt: v => `Optimum ${v} (dokazan)`, refBest: (v, src) => `Najboljša znana pot ${v}${src ? ` (${src})` : ''}`, refBound: (v, src) => `Spodnja meja ${v}${src ? ` (${src})` : ''}`,
    refHK: (v, est) => `${est ? 'Ocena Held–Karp' : 'Meja Held–Karp'} ${v}`, refNone: 'Referenčne dolžine še ni',
    count: 'Naključna mesta', seed: 'Seme', seconds: 'Sekunde', reference: 'Referenčna dolžina',
    placeholder: 'za odmik in čas prvega dosega', canvas: 'Točke in najboljša pot',
    modeShared: (n, c) => `Način: ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')}; brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}.`,
    modeOne: (n, c) => `Način: 1 delavec; brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}.`,
    modeSeparate: (n, c) => `Način: združljivostni način · ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')}; brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}.`,
    modeChosen: (n, c) => `Način: združljivostni način · ${n} ${slPlural(n, 'delavec', 'delavca', 'delavci', 'delavcev')}; brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}.`,
    modeOneNoShare: (n, c) => `Način: 1 delavec; brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}.`,
    hintIPhone: 'iPhone: privzeto 6 delavcev; Safari lahko skrije število jeder. Več delavcev kot jeder ne pomaga.',
    hintCores: c => `Vaš brskalnik javlja ${c} ${slPlural(c, 'jedro', 'jedri', 'jedra', 'jeder')}. Več delavcev kot jeder ne pomaga.`,
    option: item => exampleLabel(item, 'sl') + (item.cities === 10000000 ? (desktopLarge ? ' · poskusno, namizje' : ' · ne na tej napravi')
      : desktopOnly(item) ? (mobileDevice ? ' · samo za namizni računalnik, ne na tej napravi' : ' · samo za namizni računalnik') : ''),
    live: 'V živo · 0,15 s',
    known: (n, opt) => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}, znana optimalna pot ${opt}`,
    unknown: n => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}; optimalna pot ni znana`,
    bestKnown: (n, tourLength, b) => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}; najboljša znana pot ${group(tourLength)}, spodnja meja ${group(b)}; optimum ni potrjen`,
    bestKnownOnly: (n, tourLength, by) => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}; najboljša znana pot ${group(tourLength)}${by ? ` (${by})` : ''}; optimalnost ni dokazana`,
    replayInvalid: 'Posnetka ni mogoče odpreti.',
    referenceTour: (v, src, date) => `Najboljša znana pot: ${v}; ${src}, ${date}.`,
    referenceLowerBound: (v, src, when) => `${src === 'Concorde' ? 'Concordova spodnja meja' : 'Spodnja meja (' + src + ')'}: ${v}; ${when}.`,
    secondsRange: 'Vnesi trajanje od 0,1 do 86.400 sekund.',
    desktopRequired: 'Zemljevidi z več kot 300.000 mesti se odprejo le na namiznem računalniku; na tej napravi ta ni na voljo.',
    challengeBest: (n, tourLength, b) => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}; najboljša pot izziva DIMACS 2002 ${group(tourLength)}, spodnja meja Held–Karp ${group(Math.round(b))}; optimum ni znan`,
    hardProof: (opt, s) => `Optimum ${group(opt)} (dokazan). Najti pot in dokazati, da je optimalna, sta različni nalogi: Concorde je za DOKAZ tega optimuma povprečno potreboval ${proofTime(s)}. Ti primeri so težki za dokaz, ker je spodnja meja daleč pod optimumom.`,
    beingProved: 'Optimum se še dokazuje.',
    provedHere: (opt, s, d) => `Optimum ${opt}, dokazan s Concordom na našem prenosniku v ${s.toLocaleString('sl-SI', {maximumFractionDigits: 1})} s (${d}).`,
    remoteSource: 'Ni shranjen tukaj: ob izbiri se naloži iz repozitorija avtorjev in preveri s SHA-256.',
    remoteUnavailable: 'Repozitorija avtorjev ni bilo mogoče doseči; poskusi pozneje.',
    remoteChanged: 'Datoteka avtorjev se ne ujema več s preverjenim SHA-256; ni naložena.',
    gzipUnavailable: 'Ta brskalnik ne more razpakirati stisnjenega zemljevida.',
    siGap: (percent, date, running) => `Optimum še ni dokazan: naša pot je največ ${percent} % nad njim (Concordova spodnja meja${running ? ', dokaz teče' : ''}; stanje ${date})`,
    bound: (n, b, est) => `${group(n)} ${slPlural(n, 'mesto', 'mesti', 'mesta', 'mest')}; ${est ? 'ocena HK' : 'meja HK'} ${group(Math.round(b))}`,
    waterloo: 'zbirka National TSP, Univerza Waterloo', dimacs: 'DIMACS TSP Challenge · portgen Lyla McGeocha',
    gurs: 'Geodetska uprava Republike Slovenije (GURS) · RPE Naselja · prevzem 15. 11. 2026',
    siNote: 'Središča območij naselij, zaokrožena na metre (D96/TM); zračne razdalje, ne ceste.',
    estimateNote: 'HK je tu statistična ocena, ne dokazana spodnja meja.',
    largeNote: 'Velik primer za namizne računalnike; brskalniku lahko zmanjka pomnilnika.',
    mapData: 'Podatki zemljevida',
  },
};
// R1f-i: average proof time as published by Hougardy and Zhong (2021); not measured here
function proofTime(seconds) {
  const sl = lang() === 'sl', one = v => dec(v, 1);
  const extra = seconds >= 86400 ? one(seconds / 86400) + (sl ? ' dneva' : ' days') : seconds >= 3600 ? one(seconds / 3600) + (sl ? ' ure' : ' hours') : '';
  return `${group(seconds)} s (${extra ? extra + ', ' : ''}${sl ? 'Xeon 2,2 GHz, Hougardy in Zhong 2021' : 'Xeon 2.2 GHz, Hougardy and Zhong 2021'})`;
}
const t = (key, ...args) => { const v = T[lang()][key]; return typeof v === 'function' ? v(...args) : v; };
const english = (key, ...args) => T.en[key] instanceof Function ? T.en[key](...args) : T.en[key];
class Message extends Error { constructor(key, ...args) { super(english(key, ...args)); this.key = [key, ...args]; } }
const status = (...key) => { statusKey = key; $('status').textContent = t(...key); };
const isOptimum = () => !!mapMeta?.optimum && referenceRaw === mapMeta.optimum;
const unlocked = (shared = false) => { try { return solverModule(shared); } catch { throw new Message('unavailable'); } };
function number(id, low, high) {
  const value = Number($(id).value);
  if (!Number.isFinite(value) || value < low || value > high) throw new Message('range', T[lang()][id], low, high);
  return value;
}
function modeKey() {
  const run = active && runRecord;
  const n = run ? run.workers : Number($('workers').value);
  if (n === 1) return canShare ? 'modeOne' : 'modeOneNoShare';
  if (!run) return canShare ? 'modeShared' : 'modeSeparate';
  return run.topology.startsWith('shared') ? 'modeShared' : canShare ? 'modeChosen' : 'modeSeparate';
}
function link(href, label) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label; return a; }
function credits() {   // the source line under the examples and, for Slovenia, the data credit under the map
  const credit = $('exampleCredit'), mapCredit = $('mapCredit');
  credit.replaceChildren(); mapCredit.replaceChildren();
  const item = tab === 'nu' ? examples.find(e => e.id === $('example').value) : null;
  if (!item) return;
  const parts = [item.optimum ? t('known', item.cities, item.unit === 'm' ? `${group(item.optimum)} m` : group(item.optimum))
    : item.bestKnownTour ? (!Number.isFinite(item.bound) ? t('bestKnownOnly', item.cities, item.bestKnownTour, item.bestKnownBy?.[lang()] ?? '')   // R1k: no bound (usa115475)
      : item.bestTourKind === 'challenge-2002' ? t('challengeBest', item.cities, item.bestKnownTour, item.bound) : t('bestKnown', item.cities, item.bestKnownTour, item.bound))
    : item.gapStatus ? t('cities', item.cities) : item.bound ? t('bound', item.cities, item.bound, item.boundKind === 'estimate') : t('unknown', item.cities)];
  credit.append(`${exName(item)}: ${parts[0]} · `);
  if (item.id === 'si6035_gurs_20261115') {   // Slovenia's GURS line (R1f-i: other maps with a licence take the general line below)
    credit.append(link(item.source, t('gurs')), ' · ', link(item.licenceUrl, item.licence), ` · ${t('siNote')}`);
    mapCredit.append(`${t('mapData')}: `, link(item.source, t('gurs')), ' · ', link(item.licenceUrl, item.licence));
  } else {   // R1f-i: the map's own source, its licence and further credits (e.g. Natural Earth), also under the map
    const label = item.generator ? t('dimacs') : !item.credit || item.credit === 'National TSP collection, University of Waterloo' ? t('waterloo') : item.credit;
    const links = [link(item.source, label), ...(item.licence ? [link(item.licenceUrl, item.licence)] : []), ...(item.links || []).map(x => link(x.href, x.text[lang()] || x.text.en))];
    links.forEach((a, i) => credit.append(...(i ? [' · ', a] : [a])));
    if (item.licence || item.links?.length) { mapCredit.append(`${t('mapData')}: `); links.forEach((a, i) => mapCredit.append(...(i ? [' · ', a.cloneNode(true)] : [a.cloneNode(true)]))); }
    const description = item.descriptions?.[lang()] || item.description;
    if (description) credit.append(` · ${description}`);
  }
  if (item.gapStatus && !item.optimum) {
    const g = gapDisplay(item.gapStatus, lang()), d = v => formatDistance(v, item.unit ?? null, lang());
    if (Number.isSafeInteger(item.gapStatus.tourLength) && item.gapStatus.tourLength > 0) credit.append(` · ${t('referenceTour', d(item.gapStatus.tourLength), item.gapStatus.tourSource, g.tourDate)}`);
    if (Number.isFinite(item.gapStatus.lowerBound) && item.gapStatus.lowerBound > 0) credit.append(` · ${t('referenceLowerBound', d(item.gapStatus.lowerBound), item.gapStatus.boundSource, g.boundAsOf)}`);
    credit.append(` · ${t('siGap', g.percent, g.date, g.proofRunning)}`);
  }
  if (item.proof && item.optimum) credit.append(` · ${t('hardProof', item.optimum, item.proof.averageSeconds)}`);
  if (item.provedBy && item.optimum) credit.append(` · ${t('provedHere', item.unit === 'm' ? `${formatDistance(item.optimum, 'm', lang())} (${group(item.optimum)} m)` : group(item.optimum), item.provedBy.seconds, item.provedBy.dateText?.[lang()] || '')}`);   // R46: Switzerland in km and m
  if (item.optimumStatus === 'being-proved') credit.append(` · ${t('beingProved')}`);
  if (item.remote) credit.append(` · ${t('remoteSource')}`);
  if (item.boundKind === 'estimate') credit.append(` · ${t('estimateNote')}`);
  if (item.cities >= 1000000) credit.append(` · ${t('largeNote')}`);
}
function refLine() {   // B (BD 18 Nov): the reference value beside its percentage, only what the manifest holds; the percentage's reference first
  const m = mapMeta; if (!m || tab !== 'nu') return '';
  const d = v => formatDistance(v, m.unit ?? null, lang()), sl = lang() === 'sl';
  const day = iso => { if (!iso) return ''; const [y, mo, da] = iso.split('-').map(Number); return sl ? `${da}. ${mo}. ${y}` : new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}); };
  const src = [m.credit?.includes('University of Waterloo') ? t('waterlooShort') : m.bestTourKind === 'challenge-2002' ? 'DIMACS 2002' : '', day(m.referenceDate)].filter(Boolean).join(', ');
  if (m.optimum) return t('refOpt', d(m.optimum));
  const parts = [];
  if (m.gapStatus) {
    const g = gapDisplay(m.gapStatus, lang());
    if (m.gapStatus.lowerBound) parts.push(t('refBound', d(m.gapStatus.lowerBound), [m.gapStatus.boundSource, g.boundAsOf].filter(Boolean).join(', ')));
    if (m.gapStatus.tourLength) parts.push(t('refBest', d(m.gapStatus.tourLength), [m.gapStatus.tourSource, g.tourDate].filter(Boolean).join(', ')));
  } else {
    if (m.bound) parts.push(m.boundKind === 'certified' ? t('refBound', d(m.bound), src) : t('refHK', d(Math.round(m.bound)), m.boundKind === 'estimate'));
    if (m.bestKnownTour) parts.push(t('refBest', d(m.bestKnownTour), [m.bestKnownBy?.[lang()], src].filter(Boolean).join(', ')));
  }
  return parts.length ? parts.join(' · ') : t('refNone');
}
function render() {
  $('length').textContent = Number.isFinite(best) ? formatDistance(best, mapMeta?.unit ?? null, lang()) : '—';
  const reference = runRecord?.reference || referenceRaw || 0;
  $('gap').textContent = reference > 0 && Number.isFinite(best) ? pct((best / reference - 1) * 100) : '—';
  $('gapLabel').textContent = t(isOptimum() ? 'gapOpt' : mapMeta?.bound && reference === mapMeta.bound ? (mapMeta.boundKind === 'estimate' ? 'gapEstimate' : mapMeta.boundKind === 'certified' ? 'gapLower' : 'gapBound')
    : mapMeta?.gapStatus?.lowerBound && reference === mapMeta.gapStatus.lowerBound ? 'gapLower' : mapMeta?.bestKnownTour && reference === mapMeta.bestKnownTour ? 'gapBest' : 'gapRef');
  $('refLine').textContent = refLine();
  { const lt = tab === 'nu' ? mapMeta?.laptopTime?.text?.[lang()] : ''; $('laptopLine').textContent = lt || ''; $('laptopLine').hidden = !lt; }   // Addendum C: our laptop's measured time
  $('referenceUnit').textContent = mapMeta?.unit === 'm' ? ' (km)' : '';
  { const r = referenceRaw, box = $('referenceDistance'); box.hidden = mapMeta?.unit !== 'm' || !(r > 0); box.textContent = box.hidden ? '' : formatDistance(r, 'm', lang()); }
  $('seconds').setCustomValidity(validSeconds(Number($('seconds').value)) ? '' : t('secondsRange'));
  $('reachLabel').textContent = t(isOptimum() ? 'reachOpt' : 'reachRef');
  $('reach').textContent = runRecord?.firstReach ? `${dec(runRecord.firstReach.solverSeconds, 1)} s` : '—';
  $('elapsed').textContent = `${dec(shownElapsed, 1)} s`;
  $('cityCount').textContent = coords.length ? t('cities', coords.length / 2) + (coords.length > 40000 ? t('sampled') : '') : '';
  $('reference').placeholder = t('placeholder');
  $('mode').textContent = t(modeKey(), active && runRecord ? runRecord.workers : Number($('workers').value), reportedCores);
  $('workerHint').textContent = isIPhone ? t('hintIPhone') : t('hintCores', reportedCores);
  for (const option of $('collection').options) { const c = collections.find(x => x.id === option.value); if (c) option.text = c.names[lang()]; }
  for (const option of $('example').options) { const item = examples.find(e => e.id === option.value), s = soonOf(option.value); if (item) option.text = t('option', item); else if (s) option.text = `${s.names[lang()]} ${t('soon')}`; }
  $('replayPanel').setAttribute('aria-label', REPLAY_COPY[lang()].heading);
  $('refresh').options[0].text = t('live');
  canvas.setAttribute('aria-label', t('canvas'));
  $('status').textContent = t(...statusKey);
  credits();
}
function draw(reason = 'layout') {
  clearTimeout(renderTimer); renderTimer = null; renderPending = false;
  const ratio = devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (!coords.length || !extent) return;
  const [minX, maxX, minY, maxY] = extent;
  const scale = Math.min((w - 24) / Math.max(1, maxX - minX), (h - 24) / Math.max(1, maxY - minY));
  const ox = (w - (maxX - minX) * scale) / 2, oy = (h - (maxY - minY) * scale) / 2;
  const P = view || coords, point = id => [ox + (P[id * 2] - minX) * scale, h - oy - (P[id * 2 + 1] - minY) * scale];
  if (tour?.length) {   // R3: big tours are drawn sampled (at most 50,000 edges), big maps with at most 20,000 points
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = coords.length > 20000 ? .5 : 1;
    ctx.beginPath(); for (let i = 0; i < tour.length; i += Math.max(1, Math.ceil(tour.length / 50000))) { const p = point(tour[i]); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = '#e7eef9';
  const radius = coords.length > 20000 ? .6 : coords.length > 3000 ? 1 : 1.8;
  ctx.beginPath();
  for (let i = 0; i < coords.length / 2; i += Math.max(1, Math.ceil(coords.length / 2 / 20000))) { const [x, y] = point(i); ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2); }
  ctx.fill(); lastDraw = performance.now(); drawCount++; lastDrawnTourLength = tour?.length ? runRecord?.tourLength : null;
  if (reason === 'progress') { progressDrawCount++; progressDrawTimes.push(lastDraw); if (progressDrawTimes.length > 128) progressDrawTimes.shift(); }
}
function requestProgressDraw() {   // R3: new tours are drawn at most as often as the image-refresh menu says
  renderPending = true;
  const remaining = Math.max(0, Number($('refresh').value) - (performance.now() - lastDraw));
  if (!remaining) { draw('progress'); return; }
  if (renderTimer === null) renderTimer = setTimeout(() => { renderTimer = null; if (renderPending && active) draw('progress'); }, Math.ceil(remaining));
}
$('refresh').onchange = () => {
  clearTimeout(renderTimer); renderTimer = null;
  if (runRecord && active) runRecord.renderChangesDropped += retainRecent(runRecord.renderChanges, { seconds: (performance.now() - started) / 1000, intervalMs: Number($('refresh').value) }, RUN_LIMITS.renderChanges);
  if (renderPending && active) requestProgressDraw();
};
new ResizeObserver(() => draw()).observe(canvas);
function killPool() {
  for (const worker of pool) { worker.terminate(); if (runRecord) runRecord.workersTerminated++; }
  pool = [];
}
function controls() {
  const ready = loaderState.status === 'ready';
  $('run').disabled = !ready || active || !!loading || !coords.length;
  $('stop').disabled = !active && !loading;
  ['file', 'count', 'seed', 'generate', 'seconds', 'workers', 'refinement', 'reference', 'collection', 'example', 'p-nu', 'p-rnd', 'p-file'].forEach(id => $(id).disabled = active || !ready);
  $('refresh').disabled = !ready;
  $('stopOptimum').disabled = active || !ready || !mapMeta?.optimum;
  $('download').disabled = !tour?.length;
  $('replayOpen').disabled = active || !!loading || !recorder?.data.frames.length;
}
function acceptBest(data, worker) {
  runRecord.historyReceived++;
  runRecord.historyDropped += retainRecent(runRecord.history, { worker, length: data.length, seconds: data.elapsed, steps: data.steps }, RUN_LIMITS.history);
  if (runRecord.reference && data.length <= runRecord.reference && runRecord.firstReach === null) {
    runRecord.firstReach = { worker, solverSeconds: data.elapsed, pageSeconds: (performance.now() - started) / 1000 };
  }
  if (data.length <= best) {
    const improved = data.length < best;
    best = data.length;
    if (data.tour && (improved || data.length === best)) {
      // R3: a tour of more than 200,000 cities stays a typed array on the page (the export streams it)
      tour = data.tour; runRecord.tour = tour.length <= 200000 ? Array.from(tour, x => x + 1) : null;
      runRecord.tourStorage = tour.length > 200000 ? 'typed on page; export includes tour' : 'record'; runRecord.tourLength = data.length;
      recordSafely(() => recorder?.capture(tour, data.length, data.elapsed, worker, (performance.now() - started) / 1000));
      requestProgressDraw();
    }
    render();
  }
}
function finish(...key) {
  clearInterval(timer); active = false;
  if (runRecord) { runRecord.pageSeconds = (performance.now() - started) / 1000; runRecord.status = english(...key); shownElapsed = runRecord.pageSeconds; }
  killPool(); rejectActive = null; controls(); status(...key); render(); draw('final');
  if (recorder) recordSafely(() => recorder.finish(recordingSeparate ? (performance.now() - started) / 1000 : lastSolverSeconds));
  if (runRecord) runRecord.recording = recorder?.summary() ?? { failed: recordingFailed };
  controls();
}
function displayView(c, d, scaled = true) {   // B (BD 18 Nov): latitude, longitude drawn north-up, east to the right, the east-west axis scaled by cos(mean latitude); display only
  if (!d || d.axes !== 'lat-lon') return null;
  const v = new Float64Array(c.length);
  for (let i = 0; i < c.length; i += 2) { v[i] = d.east * c[i + 1] * (scaled ? d.xScale : 1); v[i + 1] = d.north * c[i]; }
  return v;
}
async function load(value, which, metadata = null, verifiedHash = null) {
  if (active) return;
  const module = unlocked();
  clearReplay();
  loading?.terminate(); killPool(); clearTimeout(renderTimer); renderTimer = null; renderPending = false;
  const token = ++generation;
  loading = { terminate() {} };
  controls();
  try {
    const hash = verifiedHash ? null : await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    if (token !== generation) return;
    inputHash = verifiedHash || Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    if (token === generation) { loading = null; controls(); }
    throw error;
  }
  if (metadata && inputHash !== metadata.sha256) { loading = null; controls(); throw new Message('checksum'); }
  mapMeta = metadata;
  $('stopOptimum').checked = !!metadata?.optimum;
  text = value; coords = new Float64Array(); extent = null; view = null; tour = null; best = Infinity; runRecord = null; shownElapsed = 0; preset = which;
  setReference(metadata?.optimum || metadata?.bound || metadata?.gapStatus?.lowerBound || metadata?.bestKnownTour || null);   // B: a best known tour alone is the reference
  if (metadata) $('seconds').value = metadata.cities <= 20000 ? 60 : metadata.cities <= 200000 ? 120 : 600;
  if (which === 'random') $('seconds').value = 10;
  render();
  const worker = loading = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  controls(); status('reading');
  return new Promise((resolve, reject) => {
    rejectLoading = reject;
    worker.onmessage = ({ data }) => {
      if (data.token !== generation) return;
      loading = null; rejectLoading = null; worker.terminate();
      if (data.type === 'error') { status('noSolver', data.message); controls(); reject(Error(data.message)); return; }
      mapName = data.name; coords = data.coordinates; view = displayView(coords, mapMeta?.display);
      const P = view || coords; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let j = 0; j < P.length; j += 2) { x0 = Math.min(x0, P[j]); x1 = Math.max(x1, P[j]); y0 = Math.min(y0, P[j + 1]); y1 = Math.max(y1, P[j + 1]); }
      extent = [x0, x1, y0, y1];
      $('refresh').value = String(coords.length / 2 >= 1000000 ? 10000 : coords.length / 2 <= 20000 ? 150 : 1000);
      $('mapName').textContent = mapName;
      status(coords.length / 2 > 12000 ? 'readyWin' : 'readyPop');
      render(); draw(); controls(); resolve();
    };
    worker.onerror = event => { loading = null; rejectLoading = null; worker.terminate(); status('noSolver', event.message); controls(); reject(Error(event.message)); };
    worker.postMessage({ type: 'load', text, token, module });
  });
}
async function start(options = {}) {
  unlocked();
  if (active || loading || !coords.length) throw new Message('loadFirst');
  const seconds = options.seconds ?? number('seconds', RUN_LIMITS.minSeconds, RUN_LIMITS.maxSeconds);
  if (!validSeconds(seconds)) throw new Message('secondsRange');
  const seed = options.seed ?? number('seed', 0, 4294967295);
  if (!Number.isInteger(seed)) throw new Message('seedInt');
  const workers = options.workers ?? Number($('workers').value);
  if (!Number.isInteger(workers) || workers < 1 || workers > cores) throw new Message('workers', cores);
  const execution = options.topology ?? 'auto';
  if (!['auto', 'shared', 'independent'].includes(execution)) throw Error('Unknown execution mode');
  if (execution === 'shared' && workers > 1 && !canShare) throw new Message('needShare');
  const sharedThreads = workers > 1 && execution !== 'independent' && canShare;
  if (coords.length >= 2000000 && !sharedThreads && workers > 1) throw new Message('oneWorkerLarge');
  const module = unlocked(sharedThreads);
  const memory = sharedThreads ? new WebAssembly.Memory({ initial: 18, maximum: 65536, shared: true }) : undefined;
  const topology = workers === 1 ? 'single worker' : sharedThreads ? 'shared workers' : 'separate workers';
  const reference = options.reference ?? (referenceRaw || null);
  const refinement = options.refinement ?? $('refinement').checked;
  clearReplay(); recordingSeparate = workers > 1 && !sharedThreads;
  if (options.recording !== false && coords.length >= 6) recordSafely(() => {
    // B: the replay is drawn north-up like the map. The recording keeps the map only turned (scaled = false), so every recorded
    // length stays exact and the player's own check of it passes; the east-west scale goes with it as xScale, applied when drawing.
    const turned = view && displayView(coords, mapMeta?.display, false);
    recorder = createRecorder(turned || coords, { name: mapMeta ? exampleLabel(mapMeta, lang()) : mapName, inputSha256: inputHash, metric: text.match(/EDGE_WEIGHT_TYPE\s*:\s*(\w+)/)?.[1],
      unit: mapMeta?.unit ?? null, optimum: mapMeta?.optimum || null, source: mapMeta?.source || '', credit: mapMeta?.credit || '' }, { separate: recordingSeparate });
    if (turned) recorder.data.xScale = mapMeta.display.xScale;
  });
  active = true; best = Infinity; tour = null; started = performance.now(); shownElapsed = 0;
  runRecord = { schema: '8ztsp-web-run-v1', name: mapName, inputSha256: inputHash, cities: coords.length / 2, seconds, seed,
    renderIntervalMs: Number($('refresh').value), renderChanges: [], renderChangesDropped: 0,
    workers, deviceCores: reportedCores, workerLimit: cores, topology, requestedTopology: execution, poolWorkersCreated: 0, workersTerminated: 0,
    refinement, reference, unit: mapMeta?.unit ?? null, optimum: mapMeta?.optimum || null, stopAtOptimum: !!mapMeta?.optimum && (options.stopAtOptimum ?? $('stopOptimum').checked),
    optimumReached: null, example: mapMeta?.id || null, maxSteps: options.maxSteps || 0, passes: options.passes || 0,
    history: [], historyReceived: 0, historyDropped: 0, results: [], firstReach: null, tour: null, userAgent: navigator.userAgent, page: 'mdlxdcc.org/8zTSP/' };
  render();
  let shared;
  if (crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined') {
    shared = new SharedArrayBuffer(8);
    Atomics.store(new BigInt64Array(shared), 0, 9223372036854775807n);
  }
  const token = ++generation; controls(); status('searching', workers, sharedThreads);
  timer = setInterval(() => { shownElapsed = (performance.now() - started) / 1000; $('elapsed').textContent = `${dec(shownElapsed, 1)} s`; }, 100);
  return new Promise((resolve, reject) => {
    rejectActive = reject;
    let done = 0;
    const coordinators = sharedThreads ? 1 : workers;
    for (let i = 0; i < coordinators; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); pool.push(worker);
      const children = new Map();
      const fail = message => { finish('stoppedErr', message); reject(Error(message)); };
      worker.onmessage = ({ data }) => {
        if (data.token !== generation || !active) return;
        if (data.type === 'pool-status') { runRecord.poolPhase = data.stage; return; }
        if (data.type === 'pool-spawn') {
          let child;
          try { child = new Worker(new URL('./pool-worker.js', import.meta.url), { type: 'module', name: '8ztsp-compute' }); }
          catch (error) { fail(String(error)); return; }
          children.set(data.id, child); pool.push(child); runRecord.poolWorkersCreated++;
          child.onmessage = event => {
            if (data.token !== generation || !active) return;
            if (event.data?.type === 'pool-error') { fail(event.data.message); return; }
            worker.postMessage({ type: 'pool-event', id: data.id, message: event.data });
          };
          child.onerror = event => { if (data.token !== generation || !active) return; event.preventDefault(); fail(`Pool worker: ${event.message}`); };
          return;
        }
        if (data.type === 'pool-post') {
          try { const child = children.get(data.id); if (!child) throw Error('Unknown pool worker'); child.postMessage(data.message); }
          catch (error) { fail(String(error)); }
          return;
        }
        if (data.type === 'pool-terminate') { children.get(data.id)?.terminate(); return; }
        if (data.type === 'error') { fail(data.message); return; }
        lastSolverSeconds = Math.max(lastSolverSeconds, data.elapsed || 0);
        acceptBest(data, i);
        // BD's wish 3: a map with a known optimum (checksum-checked catalogue) stops when a full tour reaches it.
        if (runRecord.optimum && data.length <= runRecord.optimum && data.tour?.length === coords.length / 2) {
          runRecord.optimumReached ??= { solverSeconds: data.elapsed, pageSeconds: (performance.now() - started) / 1000 };
          if (runRecord.stopAtOptimum) {
            generation++;
            runRecord.length = runRecord.tourLength;
            finish('optimumStop', runRecord.optimumReached.solverSeconds);
            resolve(structuredClone(runRecord)); return;
          }
        }
        if (data.type === 'done') {
          runRecord.results.push({ worker: i, seed: (seed + i) >>> 0, length: data.length, elapsed: data.elapsed, steps: data.steps, poolStats: data.poolStats, probe: data.probe, wasmMemoryBytes: data.wasmMemoryBytes });
          done++;
          if (done === coordinators) {
            runRecord.length = best;
            finish('complete', runRecord.firstReach ? runRecord.firstReach.solverSeconds : null, isOptimum());
            resolve(structuredClone(runRecord));
          }
        }
      };
      worker.onerror = event => { if (token !== generation || !active) return; finish('workerFail', event.message); reject(Error(event.message)); };
      worker.postMessage({ type: 'run', token, module, memory, text, seconds, seed: (seed + i) >>> 0, refinement, shared, sharedThreads: sharedThreads ? workers : 0,
        probe: !!options.probe, maxSteps: options.maxSteps, passes: options.passes });
    }
  });
}
function generate() {
  const n = number('count', 5, 200000), seed = number('seed', 0, 4294967295);
  if (!Number.isInteger(n) || !Number.isInteger(seed)) throw new Message('integers');
  let state = seed >>> 0 || 0x12345678;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const lines = [`NAME : random-${n}-seed${seed}`, 'TYPE : TSP', `DIMENSION : ${n}`, 'EDGE_WEIGHT_TYPE : EUC_2D', 'NODE_COORD_SECTION'];
  for (let i = 0; i < n; i++) lines.push(`${i + 1} ${Math.floor(random() * 1000000)} ${Math.floor(random() * 1000000)}`);
  lines.push('EOF'); return load(lines.join('\n'), 'random');
}
const sha256Hex = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
// R1f-i: the checked text of a map. Remote maps are never hosted or cached here; hosted .tsp.gz files are checked before and
// after unpacking (a server may also unpack them on the way).
async function exampleText(item) {
  if (item.remote) {
    let response;
    try { response = await fetch(item.remoteUrl, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); } catch { throw new Message('remoteUnavailable'); }
    if (!response.ok) throw new Message('remoteUnavailable');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256Hex(bytes) !== item.sha256) throw new Message('remoteChanged');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const response = await fetch(new URL(item.path, import.meta.url));
  if (!response.ok) throw Error(String(response.status));
  if (item.compression !== 'gzip') return response.text();
  let bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (await sha256Hex(bytes) !== item.gzipSha256) throw new Message('checksum');
    if (typeof DecompressionStream !== 'function') throw new Message('gzipUnavailable');
    bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  if (await sha256Hex(bytes) !== item.sha256) throw new Message('checksum');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
let exampleRequest = 0;
async function loadExample(id = $('example').value) {
  unlocked();
  if (soonOf(id)) { if (mapMeta) showMap(mapMeta.id); return; }   // R53: a »(soon)« entry cannot be chosen and starts nothing; the loaded map stays shown
  const item = examples.find(e => e.id === id); if (!item) throw new Message('exFail', id);
  if (!deviceAllows(item)) throw new Message(item.cities === 10000000 ? 'tenM' : 'desktopRequired');
  const request = ++exampleRequest;
  showMap(id); render();
  if (item.generator) {   // R3: DIMACS portgen on the device, then the checksum of the generated file
    clearReplay(); text = ''; coords = new Float64Array(); extent = null; view = null; tour = null; runRecord = null; mapMeta = null; $('stopOptimum').checked = false; setReference(null); best = Infinity; draw();
    status('generating', item.id);
    const worker = loading = new Worker(new URL('./generator-worker.js', import.meta.url), { type: 'module' }); controls();
    const data = await new Promise((resolve, reject) => {
      rejectLoading = reject;
      worker.onmessage = ({ data }) => { worker.terminate(); loading = null; rejectLoading = null; data.error ? reject(new Message('genFail')) : resolve(data); };
      worker.onerror = () => { worker.terminate(); loading = null; rejectLoading = null; reject(new Message('genFail')); };
      worker.postMessage({ n: item.cities });
    }).finally(controls);
    if (data.sha256 !== item.sha256) throw new Message('checksum');
    await load(new TextDecoder().decode(new Uint8Array(data.buffer, 0, data.length)), item.id, item, data.sha256);
    return;
  }
  status('exLoading', exName(item));
  let value;
  try { value = await exampleText(item); }
  catch (error) {   // the map shown stays, and so does its name in the list
    if (request === exampleRequest && mapMeta && !active && !loading) { showMap(mapMeta.id); render(); }
    throw error?.key ? error : new Message('exFail', exName(item));
  }
  if (request !== exampleRequest) return;
  await load(value, item.id, item, item.compression === 'gzip' || item.remote ? item.sha256 : null);
}
const loadNu = () => loadExample(DEFAULT_EXAMPLE);
const safely = fn => async () => {
  try { await fn(); } catch (error) { if (error?.key) status(...error.key); else { statusKey = ['stoppedErr', String(error?.message || error)]; render(); } }
};
function stop() {
  if (loading && !active) {   // R3: stop a load or a generation
    generation++; loading.terminate(); loading = null; rejectLoading?.(new Message('loadingStopped')); rejectLoading = null; controls(); status('loadingStopped'); return;
  }
  const reject = rejectActive;
  generation++;
  if (tour?.length && runRecord) { best = runRecord.tourLength; runRecord.length = best; }
  finish('stopped');
  reject?.(new Message('stopped'));
}
function choose(which) {
  tab = which;
  ['panel-nu', 'panel-rnd', 'panel-file'].forEach(id => { $(id).hidden = id !== `panel-${which}`; });
  [['p-nu', 'nu'], ['p-rnd', 'rnd'], ['p-file', 'file']].forEach(([id, v]) => $(id).setAttribute('aria-pressed', String(v === tab)));
  credits();
}
$('p-nu').onclick = () => { choose('nu'); safely(() => loadExample())(); };
$('p-rnd').onclick = () => choose('rnd');
$('p-file').onclick = () => choose('file');
$('example').onchange = safely(() => loadExample($('example').value));
$('collection').onchange = safely(() => {   // R53: a new collection lists its maps and loads the smallest one this device allows
  fillMaps($('collection').value);
  const first = [...$('example').options].find(o => !o.disabled);
  return first ? loadExample(first.value) : undefined;
});
$('generate').onclick = safely(generate);
$('run').onclick = safely(() => start());
$('stop').onclick = stop;
$('file').onchange = safely(async () => {
  const file = $('file').files[0]; if (!file) return;
  if (file.size > 32 * 1024 * 1024) throw new Message('fileLimit');
  await load(await file.text(), 'file');
});
$('reference').oninput = () => {   // R1k: an edit in km becomes whole metres; the untouched default keeps the exact value
  const value = $('reference').value;
  referenceRaw = value === referenceDefault.text ? referenceDefault.raw : referenceFromField(value, mapMeta?.unit ?? null);
  render();
};
$('seconds').oninput = render;
$('workers').onchange = render;
$('download').onclick = () => {   // R3: streamed, so a tour of millions of cities fits
  const parts = [JSON.stringify({ ...runRecord, tour: undefined }).slice(0, -1) + ',"tour":['];
  for (let i = 0; i < tour.length; i += 65536) parts.push((i ? ',' : '') + Array.from(tour.subarray(i, i + 65536), x => x + 1).join(','));
  parts.push(']}');
  const url = URL.createObjectURL(new Blob(parts, { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = '8ztsp-run.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('replayOpen').onclick = () => {   // R28: play the last run's recording slowly, in its own panel below
  if (!recorder?.data.frames.length || active) return;
  try {
    $('replayPanel').hidden = false; replayPlayer.setRecording(recorder.data); $('replayPanel').focus();
    $('replayPanel').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('replayPlay').click();
  } catch { status('replayInvalid'); }
};
// BD's wish 2: the map in full screen where the browser allows it (Fullscreen API), otherwise over the whole window;
// the search and the drawing go on; Close or Escape returns.
const mapView = $('mapView'); let oldOverflow = '';
function expandedControls() {
  const expanded = mapView.classList.contains('map-window') || document.fullscreenElement === mapView;
  $('mapExpand').hidden = expanded; $('mapClose').hidden = !expanded; $('mapExpand').setAttribute('aria-pressed', String(expanded));
  requestAnimationFrame(() => draw('layout'));
}
async function closeMap() {
  if (document.fullscreenElement === mapView) await document.exitFullscreen();
  if (mapView.classList.contains('map-window')) { mapView.classList.remove('map-window'); document.body.style.overflow = oldOverflow; }
  expandedControls(); $('mapExpand').focus();
}
$('mapExpand').onclick = async () => {
  if (mapView.requestFullscreen) { try { await mapView.requestFullscreen(); expandedControls(); return; } catch { /* the window fallback below */ } }
  oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; mapView.classList.add('map-window'); expandedControls(); $('mapClose').focus();
};
$('mapClose').onclick = () => closeMap();
document.addEventListener('fullscreenchange', expandedControls);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && mapView.classList.contains('map-window')) closeMap(); });
window.MDLxDCCLocale?.subscribe(() => render());
// The same QA hook as in R1/R2/R3: it drives the same UI and worker path.
window.tsp8zLab = { load, loadExample, showMap, start, stop, loadNu, generate, cores, reportedCores, limits: RUN_LIMITS, get reference() { return referenceRaw; },
  get retentionStats() { return { history: runRecord?.history.length ?? 0, historyReceived: runRecord?.historyReceived ?? 0, historyDropped: runRecord?.historyDropped ?? 0,
    renderChanges: runRecord?.renderChanges.length ?? 0, recording: recorder?.summary() ?? null }; },
 defaultWorkers: isIPhone ? 6 : reportedCores, get canShare() { return canShare; },
  get ready() { return loaderState.status === 'ready'; }, get loaderStatus() { return loaderState.status; },
  get wasmMetrics() { return structuredClone(loaderState.metrics); },
  get renderStats() { return { intervalMs: Number($('refresh').value), drawCount, progressDrawCount, lastDrawnTourLength, progressDrawTimes: [...progressDrawTimes] }; },
  get record() { return runRecord; }, get coordinates() { return coords; }, get tourSummary() { return { cities: tour?.length || 0, bytes: tour?.byteLength || 0 }; },
  get liveWorkers() { return pool.length; }, get hasResult() { return !!tour?.length; } };   // R53 D: pwa.js does not reload over a shown result
window.tsp8zReplay = { get data() { return recorder?.data; }, get summary() { return recorder?.summary(); },
  export() { if (!recorder?.data.frames.length) throw Error('No recording yet.'); return serializeRecording(recorder.data); }, get player() { return replayPlayer; } };
choose('nu');
controls(); render();
try {
  await initializeWasm();
  controls();
  await safely(loadNu)();
} catch {
  $('status').dataset.i18n = 'solver.unavailable';
  status('unavailable'); controls();
}
