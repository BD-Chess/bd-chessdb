// The model identifies evidence; only the server chooses the card and score.
export const assessmentRule = 'achieved: unique exact key_ideas; path: historical|own; why: 1..200 characters. A: round(10*d/n)/2; stars: achieved ideas not covered by opened hints. B: 5/5, +1 per grounded evident advantage; needs_test never scores. No free card/stars/bonus.';
// R7 key ids (e.g. s14.k2) and exact milestone text name the same key_idea.
export function ideaEntries(challenge) {
  const ids = new Map((challenge?.key?.key_ideas || []).map(x => [x?.text, x?.id]));
  return (challenge?.key_ideas || []).map(text => ({ id: typeof ids.get(text) === 'string' ? ids.get(text) : null, text }));
}
export function resolveIdea(challenge, value) {
  if (typeof value !== 'string') return null;
  return ideaEntries(challenge).find(x => x.text === value || (x.id && x.id === value.trim())) || null;
}
export const ideaIDs = (challenge, texts) => texts.map(text => resolveIdea(challenge, text)?.id).filter(Boolean);
export function invalidAssessment(challenge, field) {
  return Object.assign(Error('INVALID_ASSESSMENT'), { details: {
    field, allowed: { path: ['historical', 'own'], achieved: challenge.key_ideas || [], achieved_ids: ideaIDs(challenge, challenge.key_ideas || []),
      advantage_kind: ['evident', 'needs_test'], why_maxLength: 200 }, rule: assessmentRule,
    next: 'assess_challenge', missing: [field]
  } });
}
export function deriveAssessment(game, challenge, opened, args, previous) {
  const ideas = challenge.key_ideas || [], fail = field => { throw invalidAssessment(challenge, field); };
  if (!['historical','own'].includes(args.path)) fail('path');
  if (!Array.isArray(args.achieved) || args.achieved.some(x => !ideas.includes(x)) || new Set(args.achieved).size !== args.achieved.length) fail('achieved');
  if (Object.keys(args).some(k => !['step','achieved','path','why','advantages'].includes(k))) fail('arguments');
  if (!Array.isArray(args.advantages ?? []) || (args.advantages || []).length > 10 || (args.advantages || []).some(a => !a || !['evident','needs_test'].includes(a.kind) || typeof a.text !== 'string' || !a.text.trim() || a.text.length > 120)) fail('advantages');
  const achieved = [...new Set([...(previous?.achieved || []).filter(x => ideas.includes(x)), ...args.achieved])];
  const hints = game.steps.filter(s => s.kind === 'hint' && s.for === challenge.id && opened.has(s.id));
  // Missing/malformed coverage conservatively covers every milestone.
  const covered = new Set(hints.flatMap(h => hintCoverage(challenge, h)));
  const independent = [...new Set([...(previous?.independent || []).filter(x => achieved.includes(x)), ...achieved.filter(x => !covered.has(x))])];
  const d = achieved.length, n = Math.max(1, ideas.length), stars = independent.length;
  const source = game.steps.filter(s => opened.has(s.id)).map(s => s.text || s.for_agent || '').concat(ideas).join('\n');
  const advantages = (args.advantages || []).map(a => ({ text:a.text.trim(), kind:a.kind === 'evident' && source.includes(a.text.trim()) ? 'evident' : 'needs_test' }));
  const unique = [...new Map(advantages.map(a => [a.text,a])).values()];
  const bonus = args.path === 'own' ? unique.filter(a => a.kind === 'evident').length : 0;
  const card = args.path === 'own' ? 'B' : d ? 'A' : 'none';
  const score = card === 'B' ? 5 + bonus : card === 'A' ? Math.round(10*d/n)/2 : null;
  let line = card === 'B' ? 'Kartica B · tvoja pot · drugače, a deluje · 5/5'
    : card === 'A' ? `Kartica A · zgodovinska pot · mejniki ${d}/${n} ${'✦'.repeat(stars)} · ${String(score).replace('.',',')}/5${d < n ? ' (delno)' : ''}`
      : 'Ta korak še ni zadet · delni uvid';
  if (card === 'B') for (const a of unique) line += a.kind === 'evident' ? ` · +1 boljše od zgodovine: ${a.text}` : ' · +? odprto: odklene ga preizkus (meritev, klop, prototip)';
  line += ` — ${args.why.replace(/\s+/g,' ').trim()}${hints.length ? ` (z namigom ${hints.map(h => h.tier || h.id).join(', ')})` : ''}`;
  const value = {card,line,achieved,independent,score,stars,path:args.path};
  // Earlier successful learning never loses points on another hypothesis.
  return previous && typeof previous.score === 'number' && (score === null || previous.score > score) ? previous : value;
}

// R7 stores coverage as stable idea IDs in challenge.key.hints. Legacy games
// may have direct text coverage on a hint; malformed/missing data covers all.
export function hintCoverage(challenge, hint) {
  const ideas = challenge.key_ideas || [];
  if (Array.isArray(hint.covers)) return hint.covers.every(x => ideas.includes(x)) ? hint.covers : ideas;
  const annotation = challenge.key?.hints?.find(x => x.step_id === hint.id);
  const byID = new Map((challenge.key?.key_ideas || []).map(x => [x.id, x.text]));
  if (!Array.isArray(annotation?.covers)) return ideas;
  const values = annotation.covers.map(id => byID.get(id));
  return values.every(x => ideas.includes(x)) ? values : ideas;
}
