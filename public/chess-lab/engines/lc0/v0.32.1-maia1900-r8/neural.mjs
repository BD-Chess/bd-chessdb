// SPDX-License-Identifier: GPL-3.0-or-later
// ChessBest LCZero neural bridge. Model: CSSLab Maia 1900, native Lc0 export.
import { encodeLc0Classical112 } from './encoder.mjs';
import { LC0_POLICY_MOVES } from './policy-map.mjs';
const policyIndex = new Map(LC0_POLICY_MOVES.map((move, i) => [move, i]));
export const POLICY_TEMPERATURE = 1.359; // native Lc0 0.32.1 default
export const MODEL_SHA256 = 'f919daccde64b19645e143cbd3718d3d650516a16b1f458293e20bc77aff4b11';
export function legalPolicyIndex(move, black) {
  let from = move.from, to = move.to;
  // Lc0's internal castling move is king-takes-rook. A queen move e1g1
  // must stay e1g1, so use move flags, never UCI text alone.
  if (move.flags.includes('k')) to = to[0] === 'g' ? 'h' + to[1] : to;
  if (move.flags.includes('q')) to = to[0] === 'c' ? 'a' + to[1] : to;
  if (black) { from = from[0] + (9 - Number(from[1])); to = to[0] + (9 - Number(to[1])); }
  const promotion = move.promotion && move.promotion !== 'n' ? move.promotion : '';
  const index = policyIndex.get(from + to + promotion);
  if (index === undefined) throw new Error('No LCZero policy slot for legal move ' + move.from + move.to + (move.promotion || ''));
  return index;
}
export function decodeEvaluation(outputs, moves, black) {
  const logits = outputs['/output/policy'].data;
  const wdl = Array.from(outputs['/output/wdl'].data);
  if (logits.length !== 1858 || wdl.length !== 3 || wdl.some(v => !Number.isFinite(v))) throw new Error('Invalid LCZero neural output');
  const mapped = moves.map(move => ({ move, uci: move.from + move.to + (move.promotion || ''), index: legalPolicyIndex(move, black) }));
  const max = Math.max(...mapped.map(m => logits[m.index] / POLICY_TEMPERATURE));
  const exps = mapped.map(m => Math.exp(logits[m.index] / POLICY_TEMPERATURE - max));
  const sum = exps.reduce((a,b) => a+b,0);
  const priors = mapped.map((m,i) => ({ ...m, prior: exps[i] / sum, logit: logits[m.index] }));
  return { q: wdl[0] - wdl[2], wdl, priors };
}
export async function infer(ort, session, chess, history) {
  const fen = chess.fen({forceEnpassantSquare:true});
  const input = history?.length ? {positions: history} : fen;
  const encoded = encodeLc0Classical112(input);
  const outputs = await session.run({'/input/planes': new ort.Tensor('float32', encoded.planes, [1,112,8,8])});
  try { return decodeEvaluation(outputs, chess.moves({verbose:true}), chess.turn() === 'b'); }
  finally { for (const tensor of Object.values(outputs)) tensor.dispose?.(); }
}
