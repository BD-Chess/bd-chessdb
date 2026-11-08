import {FEATURED_IDS} from './featured-catalog.mjs';
import {destinationIdentity} from './catalog.mjs';

// Editorial selection from existing, dated public announcements/features. These
// dates never infer file mtimes or an essay's original publication date.
// Keep at most eight available records in one NEW opening. The subject records
// remain the source of titles, descriptions, links and research status.
export const NEW_UPDATES = Object.freeze([
  {id:'ai8-dna',url:'/ai8-dna-v4.html',date:'2026-11-08',type:'update',source:'https://github.com/BD-Chess/bd-chessdb/pull/349',evidence:'/assets/dna-lab/digest.mjs'},
  // The commit dated Nov 6 adds the already-public essay to Start. This is a
  // feature date, explicitly not a claim about when the essay was written.
  {id:'bogastvo-obstoja',url:'/bogastvo-obstoja/',date:'2026-11-06',type:'featured',source:'https://github.com/BD-Chess/bd-chessdb/commit/b951225e2b77080a36914dd5cb6588fa6b8eb6b7',evidence:'/Start/index.html'}
].map(Object.freeze));

// Compare page destinations, including verified aliases and absolute/relative
// forms. Fragments, query strings and a final slash cannot reintroduce a Top 8
// page as NEW. Preserve path case and all underlying catalogue identities.
export function normalizedTarget(raw) {
  const url=new URL(raw,'https://www.mdlxdcc.org');
  url.hash='';url.search='';
  return destinationIdentity(url.href).replace(/\/$/,'');
}
export function newUpdateFor(item,updates=NEW_UPDATES) {
  return updates.find(update=>update.id===item.id||normalizedTarget(update.url)===normalizedTarget(item.url));
}
export function selectNewRecords(items,updates=NEW_UPDATES) {
  const ids=new Set(FEATURED_IDS);
  const targets=new Set(items.filter(item=>ids.has(item.id)).map(item=>normalizedTarget(item.url)));
  const result=[];
  for(const update of updates){
    const item=items.find(item=>item.id===update.id)||items.find(item=>normalizedTarget(item.url)===normalizedTarget(update.url));
    if(!item||ids.has(item.id)||targets.has(normalizedTarget(item.url)))continue;
    result.push(item);ids.add(item.id);targets.add(normalizedTarget(item.url));
    if(result.length===8)break;
  }
  return result;
}
