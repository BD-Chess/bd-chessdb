/* Great-circle surface distances on a sphere; meters. No network access. */
(() => {
  'use strict';
  const R = 6371008.8;
  function meters(a, b) {
    for (const p of [a, b]) if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) throw new Error('Invalid geographic coordinates.');
    const rad = Math.PI / 180, lat1 = a.lat * rad, lat2 = b.lat * rad;
    const h = Math.sin((lat2-lat1)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((b.lon-a.lon)*rad/2)**2;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  function matrix(points) {
    const D = points.map(() => new Float64Array(points.length));
    for (let i=0; i<points.length; i++) for (let j=i+1; j<points.length; j++) D[i][j] = D[j][i] = meters(points[i], points[j]);
    return D;
  }
  globalThis.TripAirDistance = {meters, matrix, radius:R};
})();
