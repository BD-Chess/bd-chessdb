// BD's additional DNA highlights. Map existing entries in place; never sort them.
export const DNA_TOP_PAGES = Object.freeze([
  {url: '/crp/ToE.html', label: 'ToE'},
  {url: '/crp/AI8_Architecture.html', label: 'AI8 Architecture'},
  {url: '/BD/BD_AIM3.html', label: 'AIM³'},
  {url: '/BD/BD_AIM3_RHP.html', label: 'RHP'},
  {url: '/crp/AC-WFP.html', label: 'AC-WFP'},
  {url: '/BD/BD_CCH_Consciousness_Field.html', label: 'CFH'},
  {url: '/crp/DGTE.html', label: 'DGTE'},
  {url: '/crp/HTH.html', label: 'HTH'},
  {url: '/BD/BD_8ZRP.html', label: '8Z-RP / TSP'},
  {url: '/crp/SORA.html', label: 'SORA'},
  {url: '/AI8/live/', label: 'AI8 Live'}
]);
const labels = new Map(DNA_TOP_PAGES.map(page => [page.url, page.label]));
const isLive = item => /^\/ai8\/live\/(?:index\.html)?$/i.test(item.url);

export function decorateDNA(entries, {includeLive = false} = {}) {
  const result = entries.map(item => {
    const label = labels.get(item.url) || (isLive(item) ? 'AI8 Live' : null);
    return label ? {...item, dnaTop: true, dnaLabel: label} : item;
  });
  // Live was absent from the old catalogue. Append it after that catalogue settles.
  if (includeLive && !entries.some(isLive)) result.push({
    id: 'ai8-live', title: 'AI8 Live', url: '/AI8/live/', group: 'lab', kind: 'page',
    mark: 'AL', featured: false, dnaTop: true, dnaLabel: 'AI8 Live',
    sl: 'Sprotni povzetki dela CLI sej, ki sodelujejo pri MDL×DCC.',
    en: 'Live work summaries from the CLI sessions collaborating on MDL×DCC.',
    related: ['ai8', 'aim3']
  });
  return result;
}
