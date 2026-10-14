export type Color = 'w' | 'b';
export type PieceRole = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Piece = `${Color}${PieceRole}`;

export interface BoardState {
  squares: (Piece | null)[]; // a1=0, h8=63
  turn: Color;
  castling: string;
  epSquare: number | null;
  halfmove: number;
  fullmove: number;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function squareIndex(name: string): number {
  if (!/^[a-h][1-8]$/.test(name)) throw new Error(`Invalid square: ${name}`);
  return name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8;
}

export function squareName(index: number): string {
  if (index < 0 || index >= 64) throw new Error(`Invalid square index: ${index}`);
  return String.fromCharCode(97 + (index % 8)) + String(Math.floor(index / 8) + 1);
}

function pieceFromFen(ch: string): Piece {
  const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
  const role = ch.toLowerCase() as PieceRole;
  if (!'pnbrqk'.includes(role)) throw new Error(`Invalid FEN piece: ${ch}`);
  return `${color}${role}`;
}

export function parseFen(fen = START_FEN): BoardState {
  const parts = fen.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 6) throw new Error(`Invalid FEN field count: ${fen}`);
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = parts;
  if (turn !== 'w' && turn !== 'b') throw new Error(`Invalid FEN turn: ${turn}`);
  if (!/^(?:-|[KQkq]{1,4})$/.test(castling) || new Set(castling === '-' ? [] : castling.split('')).size !== (castling === '-' ? 0 : castling.length)) {
    throw new Error(`Invalid FEN castling rights: ${castling}`);
  }
  if (ep !== '-' && !/^[a-h][36]$/.test(ep)) throw new Error(`Invalid FEN en-passant square: ${ep}`);
  if (!/^\d+$/.test(half) || !/^\d+$/.test(full)) throw new Error(`Invalid FEN move counters: ${half} ${full}`);
  const halfmove = Number(half);
  const fullmove = Number(full);
  if (!Number.isSafeInteger(halfmove) || !Number.isSafeInteger(fullmove) || fullmove < 1) {
    throw new Error(`Invalid FEN move counters: ${half} ${full}`);
  }

  const squares: (Piece | null)[] = Array(64).fill(null);
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new Error(`Invalid FEN placement: ${placement}`);
  for (let fenRank = 0; fenRank < 8; fenRank++) {
    let file = 0;
    for (const ch of ranks[fenRank]) {
      if (/^[1-8]$/.test(ch)) {
        file += Number(ch);
        if (file > 8) throw new Error(`Invalid FEN rank: ${ranks[fenRank]}`);
      } else {
        if (file >= 8) throw new Error(`Invalid FEN rank: ${ranks[fenRank]}`);
        squares[file++ + (7 - fenRank) * 8] = pieceFromFen(ch);
      }
    }
    if (file !== 8) throw new Error(`Invalid FEN rank: ${ranks[fenRank]}`);
  }
  return {
    squares,
    turn,
    castling,
    epSquare: ep === '-' ? null : squareIndex(ep),
    halfmove,
    fullmove,
  };
}

export function boardToFen(board: BoardState): string {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let out = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board.squares[file + rank * 8];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        out += String(empty);
        empty = 0;
      }
      const role = piece[1];
      out += piece[0] === 'w' ? role.toUpperCase() : role;
    }
    if (empty) out += String(empty);
    ranks.push(out);
  }
  return `${ranks.join('/')} ${board.turn} ${board.castling || '-'} ${board.epSquare === null ? '-' : squareName(board.epSquare)} ${board.halfmove} ${board.fullmove}`;
}

export function cloneBoard(board: BoardState): BoardState {
  return { ...board, squares: [...board.squares] };
}
