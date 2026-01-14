'use strict';

// ==========================================================================
//  CONFIGURATION & CONSTANTS
// ==========================================================================
const EARTH_RADIUS = 6371; // km

// Genetic Algorithm Settings (The "Deep" Profile)
const GA_POPULATION_SIZE = 300;
const GA_GENERATIONS = 800;
const GA_ELITISM_COUNT = 15;
const GA_MUTATION_RATE = 0.03;


// ==========================================================================
//  MESSAGE HANDLER
// ==========================================================================
self.onmessage = function(e) {
  const { type, profile, points, roundTrip } = e.data;

  if (type === 'solve') {
    if (!points || points.length < 2) return;

    // 1. Pre-calculate Distance Matrix (Optimization for Speed)
    // Instead of calculating Haversine millions of times, we do it once.
    const matrix = buildDistanceMatrix(points);

    // 2. Calculate "Base" Distance (As entered by user)
    const baseIndices = points.map((_, i) => i);
    const baseKm = calculateTotalDistance(baseIndices, matrix, roundTrip);

    // 3. Select Algorithm
    let bestIndices;
    
    if (profile === 'deep') {
      // Run Genetic Algorithm + 2-Opt Polish
      bestIndices = runGeneticAlgorithm(points, matrix, roundTrip);
    } else {
      // Run Nearest Neighbor (Standard)
      bestIndices = runNearestNeighbor(points, matrix, roundTrip);
    }

    // 4. Final Polish (2-Opt)
    // Even the GA can miss simple crossings. This smooths them out.
    bestIndices = runTwoOpt(bestIndices, matrix, roundTrip);

    // 5. Reconstruct & Return
    const finalKm = calculateTotalDistance(bestIndices, matrix, roundTrip);
    const pointsSorted = bestIndices.map(i => points[i]);

    self.postMessage({
      pointsSorted: pointsSorted,
      totalKm: finalKm,
      baseKm: baseKm
    });
  }
};


// ==========================================================================
//  GEOMETRY ENGINE (HAVERSINE)
// ==========================================================================

function toRad(value) {
  return value * Math.PI / 180;
}

function getHaversineDistance(p1, p2) {
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

function buildDistanceMatrix(points) {
  const size = points.length;
  const matrix = new Float32Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        matrix[i * size + j] = 0;
      } else {
        matrix[i * size + j] = getHaversineDistance(points[i], points[j]);
      }
    }
  }
  return { data: matrix, size: size };
}

function getDist(matrix, i, j) {
  return matrix.data[i * matrix.size + j];
}

function calculateTotalDistance(indices, matrix, roundTrip) {
  let dist = 0;
  for (let i = 0; i < indices.length - 1; i++) {
    dist += getDist(matrix, indices[i], indices[i+1]);
  }
  if (roundTrip) {
    dist += getDist(matrix, indices[indices.length - 1], indices[0]);
  }
  return dist;
}


// ==========================================================================
//  ALGORITHM 1: NEAREST NEIGHBOR (Standard/Fast)
// ==========================================================================
function runNearestNeighbor(points, matrix, roundTrip) {
  const count = points.length;
  const visited = new Set();
  const path = [0]; // Always start at first point
  visited.add(0);

  let current = 0;
  while (path.length < count) {
    let nearest = -1;
    let minDiv = Infinity;

    for (let i = 0; i < count; i++) {
      if (!visited.has(i)) {
        const d = getDist(matrix, current, i);
        if (d < minDiv) {
          minDiv = d;
          nearest = i;
        }
      }
    }
    
    if (nearest !== -1) {
      visited.add(nearest);
      path.push(nearest);
      current = nearest;
    } else {
      break; 
    }
  }
  return path;
}


// ==========================================================================
//  ALGORITHM 2: GENETIC ALGORITHM (Deep/Precise)
// ==========================================================================
function runGeneticAlgorithm(points, matrix, roundTrip) {
  const size = points.length;
  // If extremely small, just return standard
  if (size < 4) return runNearestNeighbor(points, matrix, roundTrip);

  let population = [];

  // 1. Initialization: Create random permutations
  // We keep start point fixed at index 0 for consistency
  const baseIndices = [];
  for (let i = 1; i < size; i++) baseIndices.push(i);

  for (let i = 0; i < GA_POPULATION_SIZE; i++) {
    const shuffled = shuffleArray([...baseIndices]);
    population.push([0, ...shuffled]); // Fixed start
  }

  // 2. Evolution Loop
  for (let gen = 0; gen < GA_GENERATIONS; gen++) {
    // Sort by fitness (distance)
    population.sort((a, b) => {
      return calculateTotalDistance(a, matrix, roundTrip) - calculateTotalDistance(b, matrix, roundTrip);
    });

    // Elitism: Keep best routes
    const newPop = population.slice(0, GA_ELITISM_COUNT);

    // Breeding
    while (newPop.length < GA_POPULATION_SIZE) {
      // Tournament Selection
      const p1 = tournamentSelect(population, matrix, roundTrip);
      const p2 = tournamentSelect(population, matrix, roundTrip);
      
      // Order Crossover
      let child = orderCrossover(p1, p2);

      // Mutation
      if (Math.random() < GA_MUTATION_RATE) {
        mutate(child);
      }
      newPop.push(child);
    }
    population = newPop;
  }

  // Return best individual
  population.sort((a, b) => calculateTotalDistance(a, matrix, roundTrip) - calculateTotalDistance(b, matrix, roundTrip));
  return population[0];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function tournamentSelect(pop, matrix, roundTrip) {
  const k = 4; // Tournament size
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < k; i++) {
    const ind = pop[Math.floor(Math.random() * pop.length)];
    const d = calculateTotalDistance(ind, matrix, roundTrip);
    if (d < bestDist) {
      bestDist = d;
      best = ind;
    }
  }
  return best;
}

function orderCrossover(parent1, parent2) {
  // Ordered Crossover (OX1) preserves relative order
  // Start point (0) is fixed, we operate on the rest
  const len = parent1.length;
  const startPos = Math.floor(Math.random() * (len - 1)) + 1;
  const endPos = Math.floor(Math.random() * (len - startPos)) + startPos;

  const child = new Array(len).fill(-1);
  child[0] = 0; // Fix start

  const subset = new Set();
  for (let i = startPos; i < endPos; i++) {
    child[i] = parent1[i];
    subset.add(parent1[i]);
  }

  let p2Index = 1;
  for (let i = 1; i < len; i++) {
    if (i >= startPos && i < endPos) continue;

    while (subset.has(parent2[p2Index]) || parent2[p2Index] === 0) {
      p2Index++;
    }
    child[i] = parent2[p2Index];
    p2Index++;
  }
  return child;
}

function mutate(individual) {
  // Swap Mutation (excluding start point)
  const len = individual.length;
  const i = Math.floor(Math.random() * (len - 1)) + 1;
  const j = Math.floor(Math.random() * (len - 1)) + 1;
  [individual[i], individual[j]] = [individual[j], individual[i]];
}


// ==========================================================================
//  ALGORITHM 3: 2-OPT LOCAL SEARCH (Polishing)
// ==========================================================================
// This untangles simple knots that GA might miss.
function runTwoOpt(route, matrix, roundTrip) {
  let improved = true;
  let bestRoute = [...route];
  let bestDist = calculateTotalDistance(bestRoute, matrix, roundTrip);
  
  // Safety break to prevent infinite loops in weird edge cases
  let cycles = 0; 
  const maxCycles = 100;

  while (improved && cycles < maxCycles) {
    improved = false;
    cycles++;
    
    // Iterate all edges (excluding fixed start if not needed, but usually we opt all segments)
    // We keep index 0 fixed as start point
    for (let i = 1; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        
        // Skip non-adjacent in round trip context logic if needed, 
        // but for general path 2-opt:
        const newRoute = twoOptSwap(bestRoute, i, j);
        const newDist = calculateTotalDistance(newRoute, matrix, roundTrip);

        if (newDist < bestDist) {
          bestRoute = newRoute;
          bestDist = newDist;
          improved = true;
        }
      }
    }
  }
  return bestRoute;
}

function twoOptSwap(route, i, k) {
  // Take route[0..i-1]
  // Take route[i..k] reversed
  // Take route[k+1..end]
  const newRoute = route.slice(0, i);
  const segment = route.slice(i, k + 1).reverse();
  const end = route.slice(k + 1);
  return newRoute.concat(segment).concat(end);
}