/* Offline reader for archived CDB cache using the current LAB ChessDCC core.
 * The archive is historical; all engine evaluations remain historical too.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.resolve(process.argv[2]);
const cache = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const positions = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
const base = path.join(repo, 'public/chess/new/js');
const Chess = require(path.join(base, 'chess.min.js')).Chess;
const corePath = path.join(base, '8zc-dcc-core.js');
const DCC = require(corePath);
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(corePath)).digest('hex');
const key = (prefix, fen) => prefix + ':' + fen.split(' ').slice(0, 4).join(' ');
const getPV = async fen => {
  const v = cache[key('pv', fen)];
  return v && Number.isFinite(v.score) ? { score: v.score, depth: v.depth, source: 'archived-pv',
    pv: Array.isArray(v.pv) ? v.pv.map(x => x.replace(/\0/g, '')) : [] } : null;
};
const getScore = async fen => {
  const direct = cache[key('sc', fen)];
  if (Number.isFinite(direct)) return { score: direct, source: 'archived-sc' };
  const v = cache[key('pv', fen)];
  return v && Number.isFinite(v.score) ? { score: v.score, depth: v.depth, source: 'archived-pv' } : null;
};
(async () => {
  const output = [];
  for (const item of positions) {
    try {
      const result = await DCC.analyze({ Chess, fen: item.fen, moves: item.root_moves,
        getPV, getScore, settings: { dccDepth: Number(process.env.CHESSBEST_TIE_DCC_DEPTH || 5), dccTopCandidates: 3,
          dccEvalFloor: 80, dccPolicy: 'balanced', dccNoDeadline: true,
          dccDefenseCheck: false, dccSensors: { stability: true, floor: true,
            volatility: true, trend: true, structure: false } } });
      const candidates = result.candidates.filter(x => x.data.eligible).map(x => {
        const first = x.data.samples[0];
        const sc = first && cache[key('sc', first.fen)];
        const pv = first && cache[key('pv', first.fen)];
        return ({
        move: x.move, raw_cp_mover: x.raw, dcc_rank_score: x.data.dccScore,
        stability: x.stability, floor: x.data.floor, volatility: x.data.volatility,
        trend: x.trend, adsr: x.adsr, sensor_contributions: x.data.sensorContributions,
        eval_sequence_cp_mover: x.data.evalSequence,
        samples: x.data.samples,
        child_pv_score_cp_source_pov: pv && Number.isFinite(pv.score) ? pv.score : null,
        child_queryscore_cp_source_pov: Number.isFinite(sc) ? sc : null,
        child_source_disagreement_cp: pv && Number.isFinite(pv.score) && Number.isFinite(sc) ? Math.abs(pv.score - sc) : null,
        observed_plies: x.data.observedPlies, target_plies: x.data.targetPlies,
        status: x.data.status, pv_source_depth: x.data.pvDepth
      });
      });
      output.push({ ...item, chessdcc_version: DCC.VERSION, core_sha256: sha256,
        raw_best: result.receipt.rawBest, dcc_pick: result.dcc1Move,
        dcc_reason: result.receipt.reason, dcc_status: result.receipt.status,
        provider_calls: result.receipt.calls, coverage: result.receipt.coverage,
        candidates });
    } catch (error) {
      output.push({ ...item, error: String(error).slice(0, 240) });
    }
  }
  process.stdout.write(JSON.stringify(output));
})().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
