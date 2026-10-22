// Searches only already verified, server-private catalog bytes. No URLs or filesystem reads.
const norm = v => String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const escape = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stop = new Set('prosim pokazi poisci ponudba ponudbe ponudbo storitev storitve naziv sifra sifro cenik cena cene katera kateri katere in za ter mi plm b2b tip produkta kategorija najdi'.split(' '));
export function catalogExtracts(files, question, { requested = false } = {}) {
  if (!files['references/PLM_B2B_INDEX.json']) return [];
  const index = JSON.parse(files['references/PLM_B2B_INDEX.json']);
  const q = norm(question);
  const exact = index.offers.filter(o => o.code.length >= 3 && new RegExp(`(^|[^a-z0-9_.-])${escape(norm(o.code))}(?=$|[^a-z0-9_.-])`).test(q));
  if (!requested && !exact.length) return [];
  const terms = [...new Set(q.match(/[a-z0-9]+/g) || [])].filter(x => x.length > 2 && !stop.has(x));
  const ranked = exact.length ? exact.map(offer => ({ offer, score: 1000 })) : index.offers.map(offer => {
    const title = norm(offer.name); const titleWords = new Set(title.match(/[a-z0-9]+/g) || []);
    const score = terms.reduce((s,t) => s + (titleWords.has(t) ? 3 : t.length >= 5 && title.includes(t) ? 1 : 0), 0);
    return { offer, score };
  }).filter(x => x.score >= 3).sort((a,b) => b.score-a.score || a.offer.code.localeCompare(b.offer.code));
  const selected = ranked.slice(0, exact.length ? 8 : 5);
  const results = selected.map(({ offer }) => {
    const data = JSON.parse(files[offer.shard]);
    const rows = data.rows.filter(r => r.values[data.columns.indexOf('KODA_PONUDBE')] === offer.code);
    return { path: offer.shard, kind: 'dated_catalog_extract_not_live_price', locator: { file: data.source, sheet: data.sheet, code: offer.code, rows: rows.map(r=>r.row) },
      text: JSON.stringify({ source: data.source, sheet: data.sheet, snapshot: data.snapshot, offer: { code: offer.code, name: offer.name }, columns: data.columns, rows,
        exactCodeMatch: exact.length > 0, candidateOnly: exact.length === 0, matchingOffers: ranked.length,
        notShownOffers: Math.max(0,ranked.length-selected.length),
        limits: ['All price rows for this code are retained; do not sum alternative price lists.', 'No B2B offering relationships supplied.', 'An export is not current CPQ availability or confirmed VAT treatment.'] }) };
  });
  if (requested && !results.length) results.push({ path: 'references/PLM_B2B_INDEX.json', kind: 'catalog_lookup_no_match',
    text: JSON.stringify({ snapshot:index.date, offers:index.offers_count, lookup:'NO_MATCH_OR_NO_IDENTIFIER',
      instruction:'Ask for the offer code or distinctive name; do not invent a code, price or relationship.' }) });
  return results;
}
