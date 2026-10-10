import { Chess, type Square } from 'chess.js';

export interface CheckSquare {
  /** Feld des Königs, der im Schach steht, z. B. `e1` */
  square: string;
  mate: boolean;
}

/**
 * Steht der König der Seite am Zug im Schach? Liefert sein Feld (und ob es Matt ist), sonst `null`.
 * Auch bei ungültiger FEN `null`.
 */
export function getCheckSquare(fen: string): CheckSquare | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  const square = chess.findPiece({ type: 'k', color: turn })[0] as Square | undefined;
  return square ? { square, mate: chess.isCheckmate() } : null;
}
