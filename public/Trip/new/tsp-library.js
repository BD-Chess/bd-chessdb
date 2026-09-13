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
      '# Maps adaptation: great-circle kilometres, not the original EUC_2D score.', ...rows].join('\n');
  }
  async function read(id) {
    const entry = get(id);
    if (!entry) throw new Error('Unknown TSP dataset.');
    const response = await fetch(`tsp/${entry.id}.json?v=20260913-demo-load1`);
    if (!response.ok) throw new Error('TSP download failed. Your current trip is unchanged.');
    return {entry, text:toEditor(entry, await response.json())};
  }
  window.TripTspLibrary = {get, label, read, toEditor};
})();
