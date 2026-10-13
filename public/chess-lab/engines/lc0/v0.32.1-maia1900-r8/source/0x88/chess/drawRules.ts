import { type BoardState, boardToFen } from './board.ts';
import { Chess } from '../../../chess.mjs';

export type AutomaticDrawReason = 'threefold' | 'fiftyMove' | 'insufficientMaterial';

export function repetitionKeyFromFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  // FIDE repetition identity includes EP only when a legal EP capture exists.
  // Keep the original EP on encoder boards so bare-FEN synthetic history
  // continues to reconstruct the last double push correctly.
  if (parts[3] !== '-' && !new Chess(fen).moves({verbose:true}).some(m => m.flags.includes('e'))) parts[3] = '-';
  return parts.slice(0, 4).join(' ');
}

export function repetitionKey(board: BoardState): string {
  return repetitionKeyFromFen(boardToFen(board));
}

export function repetitionCount(board: BoardState, historyFens: string[] = []): number {
  const key = repetitionKey(board);
  let count = 1;
  for (const fen of historyFens) {
    if (repetitionKeyFromFen(fen) === key) count += 1;
  }
  return count;
}

export function insufficientMaterial(board: BoardState): boolean {
  const bishops: boolean[] = [];
  let whiteMinors = 0;
  let blackMinors = 0;
  let whiteKnights = 0;
  let blackKnights = 0;
  for (let sq = 0; sq < board.squares.length; sq++) {
    const piece = board.squares[sq];
    if (!piece) continue;
    const color = piece[0];
    const role = piece[1];
    if (role === 'p' || role === 'r' || role === 'q') return false;
    if (role === 'n') {
      if (color === 'w') {
        whiteMinors++;
        whiteKnights++;
      } else {
        blackMinors++;
        blackKnights++;
      }
    } else if (role === 'b') {
      if (color === 'w') whiteMinors++;
      else blackMinors++;
      bishops.push(((sq % 8) + Math.floor(sq / 8)) % 2 === 0);
    }
  }
  if (whiteMinors === 0 && blackMinors === 0) return true;
  if (whiteMinors === 1 && blackMinors === 0) return true;
  if (whiteMinors === 0 && blackMinors === 1) return true;
  if (whiteKnights === 0 && blackKnights === 0 && bishops.length >= 2 && bishops.every((color) => color === bishops[0])) return true;
  return false;
}

export function automaticDrawReason(board: BoardState, historyFens: string[] = []): AutomaticDrawReason | null {
  if (board.halfmove >= 100) return 'fiftyMove';
  if (repetitionCount(board, historyFens) >= 3) return 'threefold';
  if (insufficientMaterial(board)) return 'insufficientMaterial';
  return null;
}
