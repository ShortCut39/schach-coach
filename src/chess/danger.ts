import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { Color } from './types';

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export interface EndangeredPiece {
  square: Square;
  type: PieceSymbol;
  attackers: Square[];
  defenders: Square[];
}

/**
 * Figuren von `color`, die in Gefahr sind: angegriffen und entweder gar nicht gedeckt oder von
 * einer billigeren Figur angegriffen. Könige zählen nie, Bauern nur auf Wunsch.
 * Reihenfolge: von Reihe 8 nach Reihe 1, innerhalb einer Reihe von a nach h.
 */
export function endangeredPieces(
  fen: string,
  color: Color,
  includePawns = false,
): EndangeredPiece[] {
  const chess = new Chess(fen);
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const result: EndangeredPiece[] = [];
  for (const row of chess.board()) {
    for (const square of row) {
      if (!square || square.color !== color || square.type === 'k') continue;
      if (square.type === 'p' && !includePawns) continue;
      const attackers = chess.attackers(square.square, enemy);
      if (attackers.length === 0) continue;
      const defenders = chess.attackers(square.square, color);
      const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUES[chess.get(sq)?.type ?? 'k']));
      if (defenders.length > 0 && cheapest >= PIECE_VALUES[square.type]) continue;
      result.push({ square: square.square, type: square.type, attackers, defenders });
    }
  }
  return result;
}

export function pieceValue(type: PieceSymbol): number {
  return PIECE_VALUES[type];
}
