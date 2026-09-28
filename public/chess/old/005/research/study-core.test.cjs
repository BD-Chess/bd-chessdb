const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const C = require('../js/8zc-study-core.js');

function normalized(study) {
  function branch(id) {
    const n = study.nodes[id]; return { move: n.move, san: n.san, fen: n.fen, comments: n.comments,
      startingComments: n.startingComments, nags: n.nags, name: n.name, result: n.result,
      children: n.children.map(branch) };
  }
  return { rootFen: study.rootFen, title: study.title, result: study.result, headers: { ...study.headers }, tree: branch('root') };
}
test('nested RAV, semicolon/brace comments, NAGs and result survive PGN export-import', () => {
  const source = '[Event "A \\"quoted\\" study"]\n[Result "1/2-1/2"]\n\n{Root idea} 1. e4! {King pawn} ( {Alternative} 1. d4 d5 (1... Nf6 $5 {Indian}) 2. c4 ) e5 2. Nf3 ; develop\n Nc6 1/2-1/2';
  const original = C.parsePGN(Chess, source), first = original.nodes.root.children[0];
  C.annotate(original, first, { name: 'King side / "focus" [A]' });
  const exported = C.toPGN(Chess, original), round = C.parsePGN(Chess, exported);
  assert.deepEqual(normalized(round), normalized(original));
  assert.match(exported, /\(.*d4/); assert.equal(round.nodes[first].nags[0], 1);
});
test('black-to-move FEN with fullmove 23 and an underpromotion preserves legality and numbering', () => {
  const fen = '7k/8/8/8/8/8/p7/7K b - - 0 23';
  const source = '[Event "Black root"]\n[SetUp "1"]\n[FEN "' + fen + '"]\n[Result "*"]\n\n23... a1=N (23... a1=Q+) 24. Kh2 *';
  const study = C.parsePGN(Chess, source), round = C.parsePGN(Chess, C.toPGN(Chess, study));
  assert.deepEqual(normalized(round), normalized(study));
  assert.equal(study.nodes[study.nodes.root.children[0]].move, 'a2a1n');
  assert.match(C.toPGN(Chess, study), /23\.\.\. a1=N/);
});
test('manual navigation back then alternative line retains original continuation and comments', () => {
  const s = C.parsePGN(Chess, '1. e4 {saved} e5 2. Nf3 Nc6 *');
  const mainline = C.addLine(Chess, s, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  const branch = C.addLine(Chess, s, ['e2e4', 'c7c5', 'g1f3']);
  assert.notEqual(mainline, branch); assert.equal(Object.keys(s.nodes).length, 7);
  const e4 = s.nodes[s.nodes.root.children[0]]; assert.deepEqual(e4.comments, ['saved']);
  assert.deepEqual(e4.children.map(id => s.nodes[id].move), ['e7e5', 'c7c5']);
  C.addLine(Chess, s, ['e2e4']); assert.equal(e4.children.length, 2);
  assert.equal(C.path(s, mainline).map(n => n.san).join(' '), 'e4 e5 Nf3 Nc6');
  const line = new Chess(); assert.equal(line.load_pgn(C.pathPGN(Chess, s, branch)), true); assert.equal(line.fen(), s.nodes[branch].fen);
});
test('invalid appended line is transactional and cannot leave partial branch data', () => {
  const s = C.create(Chess), before = JSON.stringify(s);
  assert.throws(() => C.addLine(Chess, s, ['e4', 'e5', 'Kh5']), /Illegal/);
  assert.equal(JSON.stringify(s), before);
});
test('projecting a library game or variation retains player identity without claiming the original result', () => {
  const library = require('node:fs').readFileSync(require('node:path').join(__dirname, '../Games/Various_Games.pgn'), 'utf8');
  const study = C.parsePGN(Chess, library.split(/\n\s*(?=\[Event )/)[0]);
  let last = study.nodes.root;
  while (last.children.length) last = study.nodes[last.children[0]];
  const branch = C.addLine(Chess, study, ['d2d4', 'd7d5']);
  for (const id of ['root', study.nodes.root.children[0], last.id, branch]) {
    const game = new Chess();
    assert.equal(game.load_pgn(C.pathPGN(Chess, study, id)), true);
    assert.equal(game.header().White, 'Dommaraju Gukesh');
    assert.equal(game.header().Black, 'Magnus Carlsen');
    assert.equal(game.header().Date, '2023.08.17');
    assert.equal(game.header().Event, 'FIDE World Cup');
    assert.equal(game.header().Result, '*');
    assert.equal(game.fen(), study.nodes[id].fen);
  }
  assert.equal(study.headers.Result, '1-0', 'the source game remains intact');
});
test('PGN import rejects illegal branches, unmatched nesting, multiple games and invalid NAGs', () => {
  for (const text of ['1. e4 (1. e5) *', '1. e4 (1. d4 *', '1. e4 ) *', '1. e4 () *', '1. e4 {unterminated', '1. e4 $999 *', '1. e4 * 1. d4 *', '1. e4 *\n[Event "second"]\n*'])
    assert.throws(() => C.parsePGN(Chess, text), undefined, text);
});
test('PGN tokens may be adjacent and long original Event tags remain intact', () => {
  const event = 'Analytical event '.repeat(20);
  const study = C.parsePGN(Chess, '[Event "' + event + '"]\n\n1.e4$1{idea}(1.d4$5)d5*');
  assert.deepEqual(study.nodes[study.nodes.root.children[0]].nags, [1]);
  assert.equal(C.parsePGN(Chess, C.toPGN(Chess, study)).headers.Event, event);
});
test('JSON validates every legal FEN and link instead of trusting stored node fields', () => {
  const study = C.parsePGN(Chess, '1. e4 (1. d4) e5 *');
  const round = C.importJSON(Chess, JSON.stringify(study)); assert.deepEqual(normalized(round), normalized(study));
  const badPosition = JSON.parse(JSON.stringify(study)); badPosition.nodes.n1.fen = C.START_FEN;
  assert.throws(() => C.validate(Chess, badPosition), /position/);
  const cycle = JSON.parse(JSON.stringify(study)); cycle.nodes.n1.children.push('root');
  assert.throws(() => C.validate(Chess, cycle), /link/);
  const orphan = JSON.parse(JSON.stringify(study)); orphan.nodes.extra = { ...orphan.nodes.n1, id: 'extra' };
  assert.throws(() => C.validate(Chess, orphan), /Unreachable/);
  assert.throws(() => C.importJSON(Chess, '{broken'), /Invalid JSON/);
});
test('preview validates both colours independently, without touching the source game', () => {
  const main = new Chess(); main.move('e4'); const initial = main.fen();
  const p = C.preview(Chess, initial, ['e7e5', 'g1f3', 'b8c6']);
  assert.deepEqual(p.map(x => x.san), ['Start', 'e5', 'Nf3', 'Nc6']); assert.equal(main.fen(), initial);
  assert.throws(() => C.preview(Chess, initial, ['e2e4']), /illegal/);
});
test('A/B snapshots require identical origin FEN and remain frozen after live changes', () => {
  const fen = C.START_FEN, live = { receipt: { fen, version: 'x' }, candidates: [{ move: 'e2e4', raw: 0 }] };
  const item = C.snapshot(fen, live); let ab = C.pin({ question: 'Can Black equalize?' }, 'A', item);
  live.candidates[0].raw = 50; assert.equal(ab.A.analysis.candidates[0].raw, 0);
  ab = C.pin(ab, 'B', C.snapshot(fen, live)); assert.equal(ab.B.analysis.candidates[0].raw, 50);
  const other = new Chess(); other.move('d4');
  assert.throws(() => C.pin(ab, 'B', C.snapshot(other.fen(), { receipt: { fen: other.fen() } })), /same origin/);
  assert.throws(() => C.snapshot(other.fen(), live), /exact position/);
});
test('PGN text containing HTML and special tag keys stays literal data', () => {
  const text = '[Event "<img src=x onerror=alert(1)>"]\n[__proto__ "safe"]\n\n1. e4 {<script>alert(1)</script>} *';
  const s = C.parsePGN(Chess, text), round = C.parsePGN(Chess, C.toPGN(Chess, s));
  assert.equal(round.headers.__proto__, 'safe'); assert.equal({}.safe, undefined);
  assert.equal(round.nodes[round.nodes.root.children[0]].comments[0], '<script>alert(1)</script>');
});
