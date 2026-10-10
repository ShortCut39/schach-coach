import { Chess, type Move, type Square } from 'chess.js';

/** Ein Zug, wie er auf dem Brett eingegeben wurde (Start- und Zielfeld). */
export interface BoardMove {
  from: string;
  to: string;
  /** Bauer erreicht die letzte Reihe: Figur muss noch gewählt werden */
  needsPromotion: boolean;
}

function legalFrom(fen: string, from: string): Move[] {
  try {
    return new Chess(fen).moves({ square: from as Square, verbose: true });
  } catch {
    return [];
  }
}

/** Turmfeld, auf das man den König für diese Rochade ziehen kann (wie auf Lichess/Chess.com). */
function rookSquare(move: Move): string | null {
  if (move.isKingsideCastle()) return `h${move.from[1]}`;
  if (move.isQueensideCastle()) return `a${move.from[1]}`;
  return null;
}

/** Felder, auf die die Figur legal ziehen kann (ohne Turmfelder der Rochade). */
export function targetSquares(fen: string, from: string): string[] {
  return [...new Set(legalFrom(fen, from).map((m) => m.to))];
}

/**
 * Macht aus Start- und Zielfeld einen legalen Zug. Rochade geht auf zwei Arten: König zwei
 * Felder zur Seite ziehen oder König auf den eigenen Turm ziehen. `null`, wenn nicht legal.
 */
export function resolveBoardMove(fen: string, from: string, to: string): BoardMove | null {
  const legal = legalFrom(fen, from);
  const direct = legal.filter((m) => m.to === to);
  if (direct.length > 0) {
    return { from, to, needsPromotion: direct.some((m) => m.promotion) };
  }
  const castle = legal.find((m) => rookSquare(m) === to);
  return castle ? { from, to: castle.to, needsPromotion: false } : null;
}
