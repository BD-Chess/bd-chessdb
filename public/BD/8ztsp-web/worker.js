import init, { Problem } from './pkg/tsp8z_web.js';
let problem;
let shared;
let lastSent = -Infinity;
let token;
self.tsp8zProgress = (length, elapsed, steps, tour) => {
  if (shared) {
    const value = BigInt(length);
    let previous = Atomics.load(shared, 0);
    while (value < previous) {
      const actual = Atomics.compareExchange(shared, 0, previous, value);
      if (actual === previous) break;
      previous = actual;
    }
  }
  // Record every improvement's time, copy/draw the tour at most five times a second.
  const draw = performance.now() - lastSent >= 200;
  if (draw) lastSent = performance.now();
  const path = draw ? tour.slice() : null;
  self.postMessage({ type: 'best', token, length, elapsed, steps, tour: path }, path ? [path.buffer] : []);
};
self.onmessage = async ({ data }) => {
  token = data.token;
  try {
    await init();
    if (data.type === 'load') {
      problem?.free();
      problem = new Problem(data.text);
      const coordinates = problem.coordinates();
      self.postMessage({ type: 'ready', token, name: problem.name(), coordinates }, [coordinates.buffer]);
    } else if (data.type === 'run') {
      shared = data.shared ? new BigInt64Array(data.shared) : null;
      if (!problem) problem = new Problem(data.text);
      const started = performance.now();
      const result = problem.solve(data.seconds, data.seed, data.maxSteps || 0, data.passes || 0, data.tep);
      const tour = result.tour();
      self.postMessage({ type: 'done', token, length: result.length,
        elapsed: result.elapsed, wall: (performance.now() - started) / 1000, steps: result.steps, tour }, [tour.buffer]);
      result.free();
    }
  } catch (error) {
    self.postMessage({ type: 'error', token, message: String(error) });
  }
};
