// Working data for the currently open trip only. No persistent Google-content cache.
(() => {
  'use strict';
  class TripRoadMatrix {
    constructor() { this.active = null; }
    clear() { this.active = null; }
    async prepare(points, mode, { loadRoutes, progress = () => {}, current = () => true, force = false } = {}) {
      if (!['DRIVING', 'WALKING'].includes(mode)) throw new Error('Unsupported travel mode.');
      if (points.length < 2 || points.length > 100) throw new Error('Road optimization supports 2–100 stops. Use Direct Line for larger trips.');
      if (points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180))
        throw new Error('Invalid stop coordinates.');
      const keyOf = p => JSON.stringify([p.lat, p.lon]);
      const keys = [...new Set(points.map(keyOf))].sort();
      const signature = JSON.stringify([mode, keys]);
      const check = () => { if (!current()) throw new Error('TRIP_CHANGED'); };
      check();
      let reused = false;
      if (!force && this.active?.signature === signature) reused = true;
      else {
        this.active = null;
        const n = keys.length;
        const coords = keys.map(k => { const [lat, lng] = JSON.parse(k); return {lat, lng}; });
        const distances = Array.from({length:n}, () => Array(n).fill(null));
        const durations = Array.from({length:n}, () => Array(n).fill(null));
        const { RouteMatrix } = await loadRoutes();
        if (typeof RouteMatrix?.computeRouteMatrix !== 'function') throw new Error('Google Route Matrix is unavailable in the loaded Maps library.');
        // 25 × 25 stays within the 625-element limit. Requests run sequentially.
        const blocks = Math.ceil(n / 25) ** 2;
        let done = 0;
        for (let a = 0; a < n; a += 25) for (let b = 0; b < n; b += 25) {
          check();
          progress(`Reading road distances: ${done}/${blocks} batches (${n * n} route elements).`);
          const origins = coords.slice(a, a + 25), destinations = coords.slice(b, b + 25);
          let timer;
          const { matrix } = await Promise.race([
            RouteMatrix.computeRouteMatrix({origins, destinations, travelMode:mode,
              ...(mode === 'DRIVING' ? {routingPreference:'TRAFFIC_UNAWARE'} : {}),
              fields:['distanceMeters', 'durationMillis', 'condition']}),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Road distance request timed out. Try again.')), 30000); })
          ]).finally(() => clearTimeout(timer));
          check();
          for (let i = 0; i < origins.length; i++) for (let j = 0; j < destinations.length; j++) {
            if (a+i === b+j) { distances[a+i][b+j] = durations[a+i][b+j] = 0; continue; }
            const item = matrix?.rows?.[i]?.items?.[j];
            if (item?.error || item?.condition !== 'ROUTE_EXISTS' || !Number.isFinite(item.distanceMeters) || item.distanceMeters < 0) {
              const from = points.find(p => keyOf(p) === keys[a+i]).name;
              const to = points.find(p => keyOf(p) === keys[b+j]).name;
              throw new Error(`No usable road distance: ${from} → ${to}. Stop order was not optimized; check the stops or choose Direct Line.`);
            }
            distances[a+i][b+j] = item.distanceMeters;
            durations[a+i][b+j] = Number.isFinite(item.durationMillis) && item.durationMillis >= 0 ? item.durationMillis : null;
          }
          done++;
        }
        check();
        this.active = {signature, keys, mode, distances, durations, measuredAt:new Date().toISOString()};
      }
      check();
      const record = this.active;
      const order = points.map(p => record.keys.indexOf(keyOf(p)));
      return {
        distanceMatrix:order.map(i => order.map(j => record.distances[i][j])),
        durationMatrix:order.map(i => order.map(j => record.durations[i][j])),
        mode, measuredAt:record.measuredAt, reused,
        source:'Google Routes • TRAFFIC_UNAWARE'
      };
    }
  }
  globalThis.TripRoadMatrix = TripRoadMatrix;
})();
