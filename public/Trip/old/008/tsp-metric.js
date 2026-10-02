/* Original National TSP EUC_2D costs. Map projection coordinates are display-only. */
(() => {
  'use strict';
  function parse(text, entry) {
    if (!/^EDGE_WEIGHT_TYPE\s*:\s*EUC_2D\s*$/m.test(text.replace(/\r/g,'')) ||
        Number(/^DIMENSION\s*:\s*(\d+)/m.exec(text)?.[1]) !== entry.count)
      throw new Error('Invalid original TSP dataset.');
    const rows = text.split('NODE_COORD_SECTION')[1]?.split(/\r?\n/).map(s=>s.trim()).filter(s=>s && s !== 'EOF');
    if (!rows || rows.length !== entry.count) throw new Error('Invalid original TSP dataset.');
    const seen = new Set();
    return rows.map(row => {
      const v = row.split(/\s+/).map(Number);
      if (v.length !== 3 || !Number.isInteger(v[0]) || seen.has(v[0]) || !v.every(Number.isFinite))
        throw new Error('Invalid original TSP dataset.');
      seen.add(v[0]);
      return {tspNodeId:v[0], x:v[1], y:v[2]};
    });
  }
  function authenticate(points, original, entry) {
    const nodes = new Map(original.map(p=>[p.tspNodeId,p])), seen = new Set();
    return points.map(p => {
      const match = new RegExp('^' + entry.id + ' #(\\d+)$').exec(p.name);
      const node = match && nodes.get(Number(match[1]));
      if (!node || seen.has(node.tspNodeId) || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
          Math.abs(p.lat - entry.latitudeSign*node.x*entry.scale) > 1e-10 ||
          Math.abs(p.lon - entry.longitudeSign*node.y*entry.scale) > 1e-10)
        throw new Error('TSP stops were changed. Reload the collection or turn off Planar distances (TSP).');
      seen.add(node.tspNodeId);
      return {...p, ...node, tspId:entry.id};
    });
  }
  function edge(a,b) { return Math.floor(Math.hypot(a.x-b.x,a.y-b.y)+0.5); }
  function matrix(points) {
    if (points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) throw new Error('Original TSP coordinates are required.');
    const D = points.map(()=>new Float64Array(points.length));
    for (let i=0;i<points.length;i++) for (let j=i+1;j<points.length;j++) D[i][j]=D[j][i]=edge(points[i],points[j]);
    return D;
  }
  function length(points, roundTrip) {
    let total=0;
    for (let i=1;i<points.length;i++) total+=edge(points[i-1],points[i]);
    if (roundTrip && points.length>1) total+=edge(points.at(-1),points[0]);
    return total;
  }
  // Recheck the returned Hamiltonian cycle against the authenticated input, not its label or reported cost alone.
  function assess(points, input, reference, roundTrip, reportedCost) {
    if (!roundTrip || !reference || reference.metric !== 'EUC_2D' || reference.status !== 'proven' || input.length !== reference.count || points.length !== input.length) return null;
    const expected = new Map(input.map(p=>[p.tspNodeId,p])), seen=new Set();
    if (expected.size !== input.length) return null;
    for (const p of points) {
      const q=expected.get(p.tspNodeId);
      if (!q || seen.has(p.tspNodeId) || p.tspId!==reference.id || p.x!==q.x || p.y!==q.y || p.lat!==q.lat || p.lon!==q.lon) return null;
      seen.add(p.tspNodeId);
    }
    const cost=length(points,true);
    if (!Number.isSafeInteger(cost) || cost!==reportedCost || cost<reference.optimum) return null;
    return {cost, optimum:reference.optimum, gap:cost-reference.optimum, gapPercent:100*(cost-reference.optimum)/reference.optimum, reached:cost===reference.optimum};
  }
  globalThis.TripTspMetric={parse,authenticate,edge,matrix,length,assess};
})();
