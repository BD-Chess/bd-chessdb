/* Maps adapter for the nine supplied National TSP datasets, not arbitrary EUC_2D. */
(() => {
  'use strict';
  const catalog = window.TRIP_TSP_CATALOG || [];
  const get = id => catalog.find(item => item.id === id);
  function label(entry, lang = window.MDLxDCCLocale?.current() || 'en') {
    const sl = lang === 'sl';
    return `${sl ? entry.sl : entry.name} · ${entry.count.toLocaleString(sl ? 'sl-SI' : 'en-US')} ${sl ? 'točk' : 'points'} · ${entry.id}`;
  }
  function toEditor(entry, data) {
    if (data?.id !== entry.id || !Array.isArray(data.points) || data.points.length !== entry.count)
      throw new Error('TSP data is incomplete. Your current trip is unchanged.');
    const seen = new Set();
    const rows = data.points.map((p, index) => {
      if (!Array.isArray(p) || p.length !== 3 || !Number.isInteger(p[0]) || seen.has(p[0]) ||
          !Number.isFinite(p[1]) || !Number.isFinite(p[2]) || Math.abs(p[1]) > 90 || Math.abs(p[2]) > 180)
        throw new Error('TSP coordinates are invalid. Your current trip is unchanged.');
      seen.add(p[0]);
      // A unique node label prevents normalization from removing coincident points.
      return `${entry.id} #${p[0]} | ${p[1]}, ${p[2]}${index === 0 ? ' START' : ''}`;
    });
    return [`# TSP source: ${entry.id}`, `# ${entry.name} · ${entry.count} nodes`,
      '# Maps coordinates for display; Planar TSP uses original EUC_2D units, not kilometres.', ...rows].join('\n');
  }
  async function read(id) {
    const entry = get(id);
    if (!entry) throw new Error('Unknown TSP dataset.');
    const response = await fetch(`tsp/${entry.id}.json?v=20260913-demo-load2`);
    if (!response.ok) throw new Error('TSP download failed. Your current trip is unchanged.');
    return {entry, text:toEditor(entry, await response.json())};
  }
  const originals = new Map();
  async function original(id) {
    const entry = get(id);
    if (!entry) throw new Error('Select a TSP collection to use Planar distances (TSP).');
    if (!originals.has(id)) originals.set(id, (async () => {
      const [raw, refs] = await Promise.all([fetch(`tsp/${id}.tsp`), fetch('tsp-optima.json?v=20260913-tsp1')]);
      if (!raw.ok || !refs.ok) throw new Error('TSP reference download failed. Please try again.');
      const bytes = await raw.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), v=>v.toString(16).padStart(2,'0')).join('');
      if (hash !== entry.originalSha256) throw new Error('Original TSP checksum does not match.');
      const original = TripTspMetric.parse(new TextDecoder().decode(bytes),entry);
      const reference = (await refs.json()).datasets.find(r=>r.id===id);
      if (!reference || reference.originalSha256!==hash || reference.count!==entry.count || reference.metric!=='EUC_2D' || reference.status!=='proven' || !Number.isSafeInteger(reference.optimum) || reference.optimum<=0)
        throw new Error('TSP reference does not match this dataset.');
      return {entry, original, reference};
    })().catch(error=>{originals.delete(id);throw error;}));
    return originals.get(id);
  }
  async function prepare(id, points) {
    const data = await original(id);
    return {...data, points:TripTspMetric.authenticate(points,data.original,data.entry)};
  }
  window.TripTspLibrary = {get, label, read, toEditor, original, prepare};
})();
