/* Shared exhaustive-order engine and display helpers. No network or persistent storage. */
(() => {
  'use strict';
  const MAX_STOPS = 20;
  function orders(n) {
    if (!Number.isInteger(n) || n < 2 || n > 1000) return null;
    let total = 1n;
    for (let i = 2; i < n; i++) total *= BigInt(i);
    return total;
  }
  function duration(seconds) {
    if (!Number.isFinite(seconds)) return 'too large to estimate';
    if (seconds <= 0) return '< timer resolution';
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
    const hundredths = BigInt(checked) * 10000n / BigInt(total);
    const p = Number(checked) / Number(total) * 100;
    return hundredths < 1n ? p.toExponential(2) + '%' : (Number(hundredths) / 100).toFixed(2) + '%';
  }
  function create(D, startIdx, roundTrip, checkpoint = null) {
    const n = D?.length;
    if (!Number.isInteger(n) || n < 2 || n > MAX_STOPS)
      throw new Error('Brute Force supports 2–20 stops including START.');
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
    const largeCount = orders(n) > BigInt(Number.MAX_SAFE_INTEGER);
    const total = largeCount ? orders(n) : Number(orders(n));
    const baseLength = length();
    let bestLength = baseLength, bestRoute = route.slice(), checked = largeCount ? 0n : 0, done = false;
    const signature = JSON.stringify([startIdx, !!roundTrip, D]);
    if (checkpoint) {
      const storedCount = largeCount && checkpoint.version === 2 && typeof checkpoint.checked === 'string' && /^\d+$/.test(checkpoint.checked)
        ? BigInt(checkpoint.checked) : checkpoint.checked;
      const validRoute = a => Array.isArray(a) && a.length === n && a[0] === startIdx &&
        new Set(a).size === n && a.every(i => Number.isInteger(i) && i >= 0 && i < n);
      if (checkpoint.version !== (largeCount ? 2 : 1) || checkpoint.signature !== signature ||
          !validRoute(checkpoint.cursor) || !validRoute(checkpoint.route) ||
          (largeCount ? typeof storedCount !== 'bigint' : !Number.isSafeInteger(storedCount)) || storedCount < 0 || storedCount > total ||
          checkpoint.done !== (storedCount === total)) throw new Error('Incompatible Brute Force checkpoint.');
      // The lexicographic cursor must be exactly the first unchecked order.
      let rank = 0n;
      for (let i = 1; i < n; i++) {
        let smaller = 0, factorial = 1n;
        for (let j = i + 1; j < n; j++) if (checkpoint.cursor[j] < checkpoint.cursor[i]) smaller++;
        for (let j = 2; j < n - i; j++) factorial *= BigInt(j);
        rank += BigInt(smaller) * factorial;
      }
      if (rank !== (checkpoint.done ? BigInt(total) - 1n : BigInt(storedCount))) throw new Error('Invalid Brute Force cursor.');
      route.splice(0, n, ...checkpoint.route);
      bestLength = length(); bestRoute = route.slice();
      if (bestLength !== checkpoint.bestLength) throw new Error('Invalid Brute Force best route.');
      route.splice(0, n, ...checkpoint.cursor);
      checked = storedCount; done = checkpoint.done;
    }
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
        let processed = 0;
        for (let k = 0; k < limit && !done; k++) {
          const value = length();
          if (value < bestLength) { bestLength = value; bestRoute = route.slice(); }
          processed++;
          done = !next();
        }
        // BigInt once per batch, never inside the permutation hot loop.
        checked += largeCount ? BigInt(processed) : processed;
        return done;
      },
      snapshot() { return {checked, total, done, bestLength, baseLength, route:bestRoute.slice()}; },
      checkpoint() { return {version:largeCount ? 2 : 1, signature, cursor:route.slice(), ...this.snapshot(),
        checked:largeCount ? checked.toString() : checked, total:largeCount ? total.toString() : total}; }
    };
  }
  globalThis.TripBruteForce = {MAX_STOPS, orders, duration, percent, create};
})();
