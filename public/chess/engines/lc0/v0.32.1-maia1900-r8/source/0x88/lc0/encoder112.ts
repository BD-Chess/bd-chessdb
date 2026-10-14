import { type BoardState, type Color, type PieceRole, parseFen, START_FEN } from '../chess/board.ts';
import { repetitionKey } from '../chess/drawRules.ts';

export const LC0_CLASSICAL_112_PLANES = 112;
export const LC0_HISTORY_PLANES = 8;
export const LC0_PLANES_PER_HISTORY = 13;
export const LC0_AUX_PLANE_BASE = LC0_HISTORY_PLANES * LC0_PLANES_PER_HISTORY;
export const LC0_BOARD_SQUARES = 64;

export type Lc0HistoryFill = 'no' | 'fen_only';
export type Lc0HistoryPosition = BoardState | string;

export interface Lc0PositionHistoryInput {
  positions: readonly Lc0HistoryPosition[];
}

export type Lc0EncoderInput = BoardState | string | Lc0PositionHistoryInput;

export interface Lc0EncodedPlanes112 {
  planes: Float32Array;
  shape: readonly [1, 112, 8, 8];
  masks: bigint[];
  values: number[];
}

const ALL_SQUARES_MASK = (1n << 64n) - 1n;
const ROLE_TO_OFFSET: Record<PieceRole, number> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const START_BOARD = parseFen(START_FEN);

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function rankOf(square: number): number {
  return Math.floor(square / 8);
}

function fileOf(square: number): number {
  return square % 8;
}

function square(file: number, rank: number): number {
  return file + rank * 8;
}

function mirrorRanks(squareIndex: number): number {
  return square(fileOf(squareIndex), 7 - rankOf(squareIndex));
}

function perspectiveSquare(squareIndex: number, turn: Color): number {
  // LC0 classical inputs are side-to-move relative. For black to move,
  // ChessBoard::Mirror() swaps sides and flips ranks, so black's back rank is
  // encoded on rank 1 just like white's back rank in white-to-move positions.
  return turn === 'w' ? squareIndex : mirrorRanks(squareIndex);
}

function setAll(masks: bigint[], values: number[], plane: number, value = 1): void {
  masks[plane] = ALL_SQUARES_MASK;
  values[plane] = value;
}

function setPiecePlanes(board: BoardState, masks: bigint[], historySlot: number, perspectiveTurn: Color): void {
  const base = historySlot * LC0_PLANES_PER_HISTORY;
  for (let source = 0; source < 64; source++) {
    const piece = board.squares[source];
    if (!piece) continue;
    const color = piece[0] as Color;
    const role = piece[1] as PieceRole;
    const sideOffset = color === perspectiveTurn ? 0 : 6;
    const plane = base + sideOffset + ROLE_TO_OFFSET[role];
    const target = perspectiveSquare(source, perspectiveTurn);
    masks[plane] |= 1n << BigInt(target);
  }
}

function isExactStartPosition(board: BoardState): boolean {
  return (
    board.turn === START_BOARD.turn &&
    board.castling === START_BOARD.castling &&
    board.epSquare === START_BOARD.epSquare &&
    board.halfmove === START_BOARD.halfmove &&
    board.fullmove === START_BOARD.fullmove &&
    board.squares.every((piece, i) => piece === START_BOARD.squares[i])
  );
}

function boardBeforeEpDoublePush(board: BoardState): BoardState {
  if (board.epSquare === null) return board;
  const movedColor = opposite(board.turn);
  const epFile = fileOf(board.epSquare);
  const epRank = rankOf(board.epSquare);
  const currentRank = movedColor === 'w' ? epRank + 1 : epRank - 1;
  const previousRank = movedColor === 'w' ? epRank - 1 : epRank + 1;
  const current = square(epFile, currentRank);
  const previous = square(epFile, previousRank);
  if (current < 0 || current >= 64 || previous < 0 || previous >= 64) return board;
  const expected = `${movedColor}p` as const;
  if (board.squares[current] !== expected) return board;
  return {
    ...board,
    squares: board.squares.map((piece, i) => {
      if (i === current) return null;
      if (i === previous) return expected;
      return piece;
    }),
    epSquare: null,
  };
}

function setClassicalAuxPlanes(board: BoardState, masks: bigint[], values: number[]): void {
  const us = board.turn;
  const them = opposite(us);
  const rights = board.castling === '-' ? '' : board.castling;
  const queenSide = us === 'w' ? 'Q' : 'q';
  const kingSide = us === 'w' ? 'K' : 'k';
  const theirQueenSide = them === 'w' ? 'Q' : 'q';
  const theirKingSide = them === 'w' ? 'K' : 'k';

  if (rights.includes(queenSide)) setAll(masks, values, LC0_AUX_PLANE_BASE + 0);
  if (rights.includes(kingSide)) setAll(masks, values, LC0_AUX_PLANE_BASE + 1);
  if (rights.includes(theirQueenSide)) setAll(masks, values, LC0_AUX_PLANE_BASE + 2);
  if (rights.includes(theirKingSide)) setAll(masks, values, LC0_AUX_PLANE_BASE + 3);
  if (board.turn === 'b') setAll(masks, values, LC0_AUX_PLANE_BASE + 4);
  setAll(masks, values, LC0_AUX_PLANE_BASE + 5, board.halfmove);
  // Plane 110 (kAuxPlaneBase + 6) is the retired move-count plane and stays zero.
  setAll(masks, values, LC0_AUX_PLANE_BASE + 7);
}

function parseHistoryInput(input: Lc0EncoderInput): { board: BoardState; historyBoards: BoardState[]; explicitHistory: boolean } {
  if (typeof input === 'object' && input !== null && 'positions' in input) {
    if (input.positions.length === 0) throw new Error('LC0 history input requires at least one position');
    const chronological = input.positions.map((position) => (typeof position === 'string' ? parseFen(position) : position));
    const preparedExplicit =
      'prepared' in input ? (input as Lc0PositionHistoryInput & { prepared?: { explicitHistory?: boolean } }).prepared?.explicitHistory : undefined;
    return { board: chronological[chronological.length - 1], historyBoards: [...chronological].reverse(), explicitHistory: preparedExplicit ?? true };
  }
  const board = typeof input === 'string' ? parseFen(input) : input;
  return { board, historyBoards: [board], explicitHistory: false };
}

export function encodeLc0Classical112(boardOrFen: Lc0EncoderInput, options?: { historyFill?: Lc0HistoryFill }): Lc0EncodedPlanes112 {
  const { board, historyBoards, explicitHistory } = parseHistoryInput(boardOrFen);
  const historyFill = options?.historyFill ?? 'fen_only';
  const masks = Array<bigint>(LC0_CLASSICAL_112_PLANES).fill(0n);
  const values = Array<number>(LC0_CLASSICAL_112_PLANES).fill(1);

  const historyKeys = explicitHistory ? historyBoards.map(repetitionKey) : [];
  // Lc0 0.32.1 encoder.cc fills beyond the oldest known position too, unless
  // that oldest position is the initial board. Do not count synthetic repeats.
  const oldest = historyBoards[historyBoards.length - 1];
  if (historyFill === 'fen_only' && !isExactStartPosition(oldest)) {
    const syntheticHistoryBoard = boardBeforeEpDoublePush(oldest);
    while (historyBoards.length < LC0_HISTORY_PLANES) historyBoards.push(syntheticHistoryBoard);
  }

  for (let i = 0; i < Math.min(historyBoards.length, LC0_HISTORY_PLANES); i++) {
    setPiecePlanes(historyBoards[i], masks, i, board.turn);
    if (explicitHistory && historyKeys.slice(i + 1).includes(historyKeys[i])) masks[i * LC0_PLANES_PER_HISTORY + 12] = ALL_SQUARES_MASK;
  }
  setClassicalAuxPlanes(board, masks, values);

  const planes = new Float32Array(LC0_CLASSICAL_112_PLANES * LC0_BOARD_SQUARES);
  for (let plane = 0; plane < LC0_CLASSICAL_112_PLANES; plane++) {
    const mask = masks[plane];
    if (mask === 0n) continue;
    const value = values[plane];
    const offset = plane * LC0_BOARD_SQUARES;
    for (let sq = 0; sq < 64; sq++) {
      if ((mask & (1n << BigInt(sq))) !== 0n) planes[offset + sq] = value;
    }
  }
  return { planes, shape: [1, 112, 8, 8], masks, values };
}
