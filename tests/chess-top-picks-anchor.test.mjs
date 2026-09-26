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
const catalog = JSON.parse(read('../public/chess/new/Games/ChessBest_Top_Picks.catalog.json'));
const curatedByFile = new Map(catalog.collection_files.map(file => [
  file, read('../public/chess/new/' + file).trim().split(/\n\s*\n(?=\[Event)/)
]));
const fileCursors = new Map();
const curatedCases = catalog.cases.map(entry => {
  const parts = curatedByFile.get(entry.curated_file);
  assert.ok(parts, `curated file ${entry.curated_file}`);
  const next = fileCursors.get(entry.curated_file) || 0;
  fileCursors.set(entry.curated_file, next + 1);
  assert.ok(parts[next], `curated game ${entry.id}`);
  return { entry, pgn: parts[next] };
});

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

test('all seven Top Picks load in the LAB parser from both PGNs with valid full-game anchors', () => {
  assert.equal(catalog.cases.length, 7);
  assert.equal(curatedCases.length, 7);
  assert.equal(curatedByFile.size, 2);
  for (const [file, parts] of curatedByFile) {
    assert.equal(fileCursors.get(file), parts.length, `catalog covers ${file}`);
  }
  for (const { entry, pgn } of curatedCases) {
    const game = parseGame(pgn);
    const history = game.history({ verbose: true });
    const anchor = chessBestTopPickAnchor(game.header(), history, Chess);
    assert.equal(anchor, entry.anchor.ply_after - 1, entry.id);
    assert.equal(history[anchor + 1].from + history[anchor + 1].to +
      (history[anchor + 1].promotion || ''), entry.anchor.played_uci, entry.id);
    assert.equal(game.header().ChessBestAnchorFEN, entry.anchor.fen_before_move, entry.id);
    assert.ok(chessBestTopPickTitle(game.header().ChessBestTitle, ''), entry.id);
    assert.ok(history.length > entry.anchor.ply_after, `full game ${entry.id}`);
    if (entry.source.license) {
      assert.equal(game.header().ChessBestLicense, entry.source.license, entry.id);
      assert.equal(game.header().ChessBestLicenseNotice, entry.license_notice.split('/').pop(), entry.id);
    }
  }
});

test('catalog sources and evidence hashes match the shipped complete game lines', () => {
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.cases.length, curatedCases.length);
  const digest = text => createHash('sha256').update(text).digest('hex');
  const checkEvidenceHashes = (value, id) => {
    if (Array.isArray(value)) return value.forEach(item => checkEvidenceHashes(item, id));
    if (!value || typeof value !== 'object') return;
    for (const [pathField, hashField] of [
      ['source_snapshot_path', 'source_snapshot_sha256'],
      ['candidate_receipt_path', 'candidate_receipt_sha256'],
      ['receipt_path', 'receipt_sha256']
    ]) {
      if (value[pathField]) assert.equal(digest(read('../' + value[pathField])), value[hashField],
        `${id} ${pathField}`);
    }
    Object.values(value).forEach(item => checkEvidenceHashes(item, id));
  };
  for (const { entry, pgn } of curatedCases) {
    const sourceText = read('../public/chess/new/' + entry.source.path);
    assert.equal(digest(sourceText), entry.source.sha256, entry.id);
    const sourceParts = sourceText.trim().split(/\n\s*\n(?=\[Event)/);
    const original = parseGame(sourceParts[entry.source.game_index_1based - 1]);
    const chosen = parseGame(pgn);
    assert.deepEqual(chosen.history(), original.history(), entry.id);
    assert.equal(digest(chosen.history({ verbose: true }).map(move =>
      move.from + move.to + (move.promotion || '')).join(' ')), entry.source.mainline_uci_sha256, entry.id);
    const moves = chosen.history({ verbose: true });
    const position = new Chess();
    for (const move of moves.slice(0, entry.anchor.ply_after)) position.move(move.san);
    assert.equal(position.fen(), entry.anchor.fen_before_move, entry.id);
    assert.equal(chosen.header().ChessBestAnchorFEN, entry.anchor.fen_before_move, entry.id);
    const played = moves[entry.anchor.ply_after];
    assert.equal(played.from + played.to + (played.promotion || ''), entry.anchor.played_uci, entry.id);
    checkEvidenceHashes(entry.evidence, entry.id);
    if (entry.curated_source) assert.equal(digest(read('../public/chess/new/' + entry.curated_source.path)),
      entry.curated_source.sha256, entry.id);
  }
  for (const notice of catalog.license_notices) {
    assert.equal(digest(read('../public/chess/new/' + notice.path)), notice.sha256, notice.path);
  }
});

test('resume marker restores the full source game and current cursor only for matching Top Picks PGN', () => {
  const firstPick = curatedCases[0].pgn;
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
