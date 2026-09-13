/* Shared exhaustive-order engine and display helpers. No network or persistent storage. */
(() => {
  'use strict';
  const MAX_STOPS = 15;
  function orders(n) {
    if (!Number.isInteger(n) || n < 2 || n > 1000) return null;
    let total = 1n;
    for (let i = 2; i < n; i++) total *= BigInt(i);
    return total;
  }
  function duration(seconds) {
    if (!Number.isFinite(seconds)) return 'too large to estimate';
    if (seconds <= 0) return '0 s';
    if (seconds < 1) return (seconds * 1000).toFixed(2) + ' ms';
    if (seconds < 60) return seconds.toFixed(1) + ' s';
    if (seconds < 3600) return (seconds / 60).toFixed(1) + ' min';
    if (seconds < 86400) return (seconds / 3600).toFixed(1) + ' hours';
    if (seconds < 31557600) return (seconds / 86400).toFixed(1) + ' days';
    const years = seconds / 31557600;
    if (years < 1e6) return years.toLocaleString('en-US', {maximumFractionDigits:1}) + ' years';
    const [mantissa, exponent] = years.toExponential(2).split('e+');
    return `${mantissa} × 10^${exponent} years`;
  }
  function percent(checked, total) {
    if (checked === total && total > 0) return '100.00%';
    if (!checked || !total) return '0.00%';
    const p = checked / total * 100;
    return p < 0.01 ? p.toExponential(2) + '%' : (Math.floor(p * 100) / 100).toFixed(2) + '%';
  }
  function create(D, startIdx, roundTrip) {
    const n = D?.length;
    if (!Number.isInteger(n) || n < 2 || n > MAX_STOPS)
      throw new Error('Brute Force supports 2–15 stops including START.');
    if (D.some(row => !row || row.length !== n || Array.from(row).some(v => !Number.isFinite(v) || v < 0)))
      throw new Error('Brute Force requires a complete distance table.');
    if (!Number.isInteger(startIdx) || startIdx < 0 || startIdx >= n)
      throw new Error('Invalid START.');
    const route = [startIdx, ...Array.from({length:n}, (_,i) => i).filter(i => i !== startIdx)];
    function length() {
      let sum = 0;
      for (let i = 1; i < n; i++) sum += D[route[i-1]][route[i]];
      return sum + (roundTrip ? D[route[n-1]][route[0]] : 0);
    }
    const total = Number(orders(n)); // 14! < Number.MAX_SAFE_INTEGER; all live counts are exact.
    const baseLength = length();
    let bestLength = baseLength, bestRoute = route.slice(), checked = 0, done = false;
    function next() {
      let i = n - 2;
      while (i >= 1 && route[i] >= route[i+1]) i--;
      if (i < 1) return false;
      let j = n - 1;
      while (route[j] <= route[i]) j--;
      [route[i], route[j]] = [route[j], route[i]];
      for (let l = i+1, r = n-1; l < r; l++, r--) [route[l], route[r]] = [route[r], route[l]];
      return true;
    }
    return {
      step(limit = 2048) {
        // Evaluate every permutation exactly once: no pruning or hidden heuristic.
        for (let k = 0; k < limit && !done; k++) {
          const value = length();
          if (value < bestLength) { bestLength = value; bestRoute = route.slice(); }
          checked++;
          done = !next();
        }
        return done;
      },
      snapshot() { return {checked, total, done, bestLength, baseLength, route:bestRoute.slice()}; }
    };
  }
  globalThis.TripBruteForce = {MAX_STOPS, orders, duration, percent, create};
})();
