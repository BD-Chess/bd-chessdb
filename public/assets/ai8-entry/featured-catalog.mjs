import {CURATED as ORIGINAL, loadCatalogue as loadOriginal} from './catalog.mjs';
export {GROUPS, GLOSSARY} from './catalog.mjs';

// Current Codex/DNA selection; the archived DNA versions keep their own catalogue.
export const FEATURED_IDS = Object.freeze([
  'tripopti', 'mdl-dcc', 'chessbest', 'sudoku', 'ai8', 'human-middle', 'nara', 'flip4m'
]);
export const RESEARCH_ONLY_IDS = Object.freeze(['materials', '8zip']);
const selected = new Set(FEATURED_IDS);
const CURRENT_DNA_URL = '/ai8-dna-v4.html';
function current(item) {
  return {...item, featured: selected.has(item.id),
    ...(item.id === 'ai8-dna' ? {url: CURRENT_DNA_URL} : {}),
    ...(item.id === 'mdl-dcc' ? {related: ['ai8', 'tsp', 'sudoku']} : {})};
}
export const CURATED = ORIGINAL.map(current);
export async function loadCatalogue() {
  const result = await loadOriginal();
  // The source loader deduplicates before this URL override. Check destinations
  // again afterward; source order keeps curated metadata and stable IDs first.
  // Only the current DNA clean route is an additional verified alias. Retain
  // case, fragments and all other paths, including separate archived versions.
  const seen = new Set();
  const items = result.items.map(current).filter(item => {
    const destination = item.url.replace(/^\/ai8-dna-v4(?=#|$)/, CURRENT_DNA_URL);
    if (seen.has(destination)) return false;
    seen.add(destination);
    return true;
  });
  return {...result, items};
}
