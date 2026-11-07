import {CURATED as ORIGINAL, loadCatalogue as loadOriginal} from './catalog.mjs';
export {GROUPS, GLOSSARY} from './catalog.mjs';

// Current Codex/DNA selection; the archived DNA versions keep their own catalogue.
export const FEATURED_IDS = Object.freeze([
  'tripopti', 'mdl-dcc', 'chessbest', 'sudoku', 'ai8', 'human-middle', 'nara', 'flip4m'
]);
export const RESEARCH_ONLY_IDS = Object.freeze(['materials', '8zip']);
const selected = new Set(FEATURED_IDS);
function current(item) {
  return {...item, featured: selected.has(item.id),
    ...(item.id === 'ai8-dna' ? {url: '/ai8-dna-v3.html'} : {}),
    ...(item.id === 'mdl-dcc' ? {related: ['ai8', 'tsp', 'sudoku']} : {})};
}
export const CURATED = ORIGINAL.map(current);
export async function loadCatalogue() {
  const result = await loadOriginal();
  return {...result, items: result.items.map(current)};
}
