// Uradna profila za LKH-3.0.14 v iPad primerjalniku `/8zTSP/`:
// 1. `default` — privzeti profil LKH-3.0.14 (ALPHA 1-tree kandidati, privzeti parametri)
// 2. `competition` — tekmovalni finski profil iz `/home/bd/Work/8ztsp-finland-lkh-20261122/run.py`

export const LKH_PROFILES = {
  default: {
    id: 'lkh_default',
    labelSl: 'LKH-3.0.14 (privzeti profil)',
    labelEn: 'LKH-3.0.14 (default profile)',
    baseParameters: [],
  },
  competition: {
    id: 'lkh_competition',
    labelSl: 'LKH-3.0.14 (tekmovalni finski profil — Delaunay + Quadrant)',
    labelEn: 'LKH-3.0.14 (competition Finland profile — Delaunay + Quadrant)',
    baseParameters: [
      ['CANDIDATE_SET_TYPE', 'DELAUNAY PURE'],
      ['MAX_CANDIDATES', '5'],
      ['EXTRA_CANDIDATES', '4'],
      ['EXTRA_CANDIDATE_SET_TYPE', 'QUADRANT'],
      ['INITIAL_PERIOD', '100'],
      ['INITIAL_TOUR_ALGORITHM', 'GREEDY'],
      ['MAX_SWAPS', '1000'],
    ],
  },
};

export function buildLkhParText({
  profile = 'default',
  problemFile = '/problem.tsp',
  outputTourFile = '/tour-$.tour',
  seed = 1,
  totalTimeLimitSeconds = 60,
  timeLimitSeconds = null,
  runs = null,
  maxTrials = null,
  optimum = null,
  traceLevel = 1,
  extraParameters = [],
}) {
  const prof = LKH_PROFILES[profile];
  if (!prof) {
    throw new Error(`Unknown LKH profile: ${profile} (expected 'default' or 'competition')`);
  }
  const rows = [
    ['PROBLEM_FILE', problemFile],
    ['OUTPUT_TOUR_FILE', outputTourFile],
    ...prof.baseParameters,
    ['SEED', String(seed >>> 0)],
    ['TOTAL_TIME_LIMIT', String(Math.max(0.1, Number(totalTimeLimitSeconds)))],
    ['TIME_LIMIT', String(Math.max(0.1, Number(timeLimitSeconds ?? totalTimeLimitSeconds)))],
    ['TRACE_LEVEL', String(traceLevel)],
  ];
  if (runs != null) rows.push(['RUNS', String(runs)]);
  if (maxTrials != null) rows.push(['MAX_TRIALS', String(maxTrials)]);
  if (optimum != null) rows.push(['OPTIMUM', String(optimum)]);
  for (const [k, v] of extraParameters) {
    rows.push([k, String(v)]);
  }
  const parText = rows.map(([k, v]) => `${k} = ${v}\n`).join('');
  return {
    profileId: prof.id,
    parameters: Object.fromEntries(rows),
    parameterRows: rows,
    parText,
  };
}
