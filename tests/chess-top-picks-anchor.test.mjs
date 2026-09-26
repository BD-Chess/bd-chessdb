import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const context = { window: { addEventListener() {} } };
vm.runInNewContext(read('../public/chess/new/js/chess.min.js'), context);
vm.runInNewContext(read('../public/chess/new/js/8zc-study-core.js'), context);
vm.runInNewContext(read('../public/chess/new/js/8zc-utils.js'), context);
const { Chess, chessBestTopPickAnchor, chessBestTopPickTitle, chessBestTopPickResumeCursor } = context;
const source = read('../public/chess/new/Games/GukeshD_Selected.pgn').split(/\n\s*\n(?=\[Event)/)[0];
const curated = read('../public/chess/new/Games/ChessBest_Top_Picks.pgn');

function parseGame(pgn) {
  const study = context.window.ChessStudy.parsePGN(Chess, pgn);
  let node = study.nodes.root;
  while (node.children.length) node = study.nodes[node.children[0]];
  const projected = context.window.ChessStudy.pathPGN(Chess, study, node.id);
  const game = new Chess();
  assert.equal(game.load_pgn(projected), true);
  return game;
}

test('curated Gukesh–Carlsen anchor opens just after 44.Rf2 and retains the full main line', () => {
  const base = parseGame(source);
  const line = base.history({ verbose: true });
  assert.equal(line[86].san, 'Rf2');
  const anchored = new Chess();
  line.slice(0, 87).forEach(move => anchored.move(move.san));
  const pgn = `[ChessBestTitle "Gukesh–Carlsen: skriti preobrat po 44.Rf2"]\n` +
    `[ChessBestAnchorPly "87"]\n[ChessBestAnchorSAN "Rf2"]\n` +
    `[ChessBestAnchorFEN "${anchored.fen()}"]\n` + source;
  const imported = parseGame(pgn);
  const fullHistory = imported.history({ verbose: true });
  assert.equal(fullHistory.length, line.length);
  const index = chessBestTopPickAnchor(imported.header(), fullHistory, Chess);
  assert.equal(index, 86);
  assert.equal(imported.header().ChessBestAnchorPly, '87');
  assert.equal(imported.header().ChessBestAnchorFEN, anchored.fen());

  // This is the existing jumpTo navigation contract: replay through index 86,
  // while the stored full history remains available for forward navigation.
  const position = new Chess();
  fullHistory.forEach((move, i) => { if (i <= index) position.move(move.san); });
  assert.equal(position.fen(), anchored.fen());
  assert.equal(position.turn(), 'b');
  assert.equal(fullHistory[index + 1].san, 'f6');
});

test('missing or corrupted anchor falls back to normal game load; ordinary games are unaffected', () => {
  const game = parseGame(source);
  const history = game.history({ verbose: true });
  const fen = new Chess().fen();
  assert.equal(chessBestTopPickAnchor(game.header(), history, Chess), null);
  for (const tag of ['0', '-1', '87.5', '999999', 'Infinity', '9007199254740993', ' 87']) {
    assert.equal(chessBestTopPickAnchor({ ChessBestAnchorPly: tag }, history, Chess), null);
  }
  assert.equal(chessBestTopPickAnchor({ ChessBestAnchorPly: '87', ChessBestAnchorSAN: 'f6' }, history, Chess), null);
  assert.equal(chessBestTopPickAnchor({ ChessBestAnchorPly: '87', ChessBestAnchorFEN: fen }, history, Chess), null);
  assert.equal(game.history().length, history.length);
  assert.equal(chessBestTopPickTitle('  <b>Gukesh\nvs  Carlsen</b>  ', 'Fallback'), 'Gukesh vs Carlsen');
  assert.equal(chessBestTopPickTitle(' \n ', 'Fallback'), 'Fallback');
});

test('all shipped Top Picks load in the actual LAB parser, retain full games and valid anchors', () => {
  const parts = curated.trim().split(/\n\s*\n(?=\[Event)/);
  const cases = [
    { title: /Gukesh.*Carlsen/, anchor: 86, preceding: 'Rf2', played: 'f6', plies: 123 },
    { title: /Carlsen.*Aronian/, anchor: 98, preceding: 'fxg5', played: 'g6', plies: 117 },
    { title: /Leko.*Kramnik/, anchor: 61, preceding: 'Qg6', played: 'Rad7', plies: 72 },
  ];
  assert.equal(parts.length, cases.length);
  for (const [i, pgn] of parts.entries()) {
    const game = parseGame(pgn);
    const history = game.history({ verbose: true });
    const chosen = cases[i];
    const anchor = chessBestTopPickAnchor(game.header(), history, Chess);
    assert.equal(history.length, chosen.plies, `full game ${i + 1}`);
    assert.equal(anchor, chosen.anchor, `anchor ${i + 1}`);
    assert.equal(history[anchor].san, chosen.preceding);
    assert.equal(history[anchor + 1].san, chosen.played);
    assert.match(chessBestTopPickTitle(game.header().ChessBestTitle, ''), chosen.title);
  }
});

test('catalog sources and evidence hashes match the shipped complete game lines', () => {
  const catalog = JSON.parse(read('../public/chess/new/Games/ChessBest_Top_Picks.catalog.json'));
  const parts = curated.trim().split(/\n\s*\n(?=\[Event)/);
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.cases.length, parts.length);
  const digest = text => createHash('sha256').update(text).digest('hex');
  for (const [i, entry] of catalog.cases.entries()) {
    const sourceText = read('../public/chess/new/' + entry.source.path);
    assert.equal(digest(sourceText), entry.source.sha256, entry.id);
    const sourceParts = sourceText.trim().split(/\n\s*\n(?=\[Event)/);
    const original = parseGame(sourceParts[entry.source.game_index_1based - 1]);
    const chosen = parseGame(parts[i]);
    assert.deepEqual(chosen.history(), original.history(), entry.id);
    const moves = chosen.history({ verbose: true });
    const position = new Chess();
    for (const move of moves.slice(0, entry.anchor.ply_after)) position.move(move.san);
    assert.equal(position.fen(), entry.anchor.fen_before_move, entry.id);
    assert.equal(chosen.header().ChessBestAnchorFEN, entry.anchor.fen_before_move, entry.id);
    const played = moves[entry.anchor.ply_after];
    assert.equal(played.from + played.to + (played.promotion || ''), entry.anchor.played_uci, entry.id);
    for (const evidence of Object.values(entry.evidence)) {
      if (!evidence.source_snapshot_path) continue;
      assert.equal(digest(read('../' + evidence.source_snapshot_path)), evidence.source_snapshot_sha256,
        entry.id + ' evidence');
    }
  }
});

test('resume marker restores the full source game and current cursor only for matching Top Picks PGN', () => {
  const firstPick = curated.trim().split(/\n\s*\n(?=\[Event)/)[0];
  const game = parseGame(firstPick);
  const history = game.history({ verbose: true });
  const marker = { cursor: 87, totalPlies: history.length, pgnLength: firstPick.length,
    source: game.header().ChessBestSource };
  assert.equal(chessBestTopPickResumeCursor(marker, firstPick, game.header(), history, Chess), 87);
  assert.equal(chessBestTopPickResumeCursor({ ...marker, cursor: 122 }, firstPick, game.header(), history, Chess), 122);
  for (const stale of [{ ...marker, cursor: 124 }, { ...marker, pgnLength: 2 },
    { ...marker, source: 'another game' }, { ...marker, totalPlies: 87 }]) {
    assert.equal(chessBestTopPickResumeCursor(stale, firstPick, game.header(), history, Chess), null);
  }
  assert.equal(chessBestTopPickResumeCursor(marker, firstPick, parseGame(source).header(), history, Chess), null);
});
