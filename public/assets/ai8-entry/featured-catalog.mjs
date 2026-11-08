import {CURATED as ORIGINAL, loadCatalogue as loadOriginal,destinationIdentity} from './catalog.mjs';
export {GROUPS, GLOSSARY} from './catalog.mjs';

// Current Codex/DNA selection; the archived DNA versions keep their own catalogue.
export const FEATURED_IDS = Object.freeze([
  'tripopti', 'mdl-dcc', 'chessbest', 'sudoku', 'ai8', 'human-middle', 'nara', 'flip4m'
]);
export const RESEARCH_ONLY_IDS = Object.freeze(['materials', '8zip']);
const selected = new Set(FEATURED_IDS);
const CURRENT_DNA_URL = '/ai8-dna-v4.html';
// One canonical shared record for the existing public essay linked from Start.
// Its public destination and authored description are retained; no publication
// date is inferred from the date Start first featured it.
const ADDITIONS = [{
  id:'bogastvo-obstoja',title:'Bogastvo obstoja',url:'/bogastvo-obstoja/',group:'research',kind:'essay',mark:'BO',featured:false,
  sl:'Avtorski esej o omejenosti, zavesti, življenju, relativnem izkustvu, svobodi in skrbi.',
  en:'An essay on finitude, consciousness, life, relative experience, freedom and care.',
  related:['consciousness','human-middle']
}];
function current(item) {
  return {...item, featured: selected.has(item.id),
    ...(item.id === 'ai8-dna' ? {url: CURRENT_DNA_URL} : {}),
    ...(item.id === 'mdl-dcc' ? {related: ['ai8', 'tsp', 'sudoku']} : {})};
}
export const CURATED = [...ORIGINAL,...ADDITIONS].map(current);
export async function loadCatalogue() {
  const result = await loadOriginal();
  // The source loader deduplicates before this URL override. Check destinations
  // again afterward; source order keeps curated metadata and stable IDs first.
  // Only the current DNA clean route is an additional verified alias. Retain
  // case, fragments and all other paths, including separate archived versions.
  const seen = new Set();
  const items = [...CURATED,...result.items.map(current)].filter(item => {
    const destination = destinationIdentity(item.url.replace(/^\/ai8-dna-v4(?=#|$)/, CURRENT_DNA_URL));
    if (seen.has(destination)) return false;
    seen.add(destination);
    return true;
  });
  return {...result, items};
}
