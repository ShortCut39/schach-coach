import { Chess } from 'chess.js';
import type { Color } from './types';

/**
 * Wandelt eine Engine-Variante (UCI, z. B. `b3b8 d7b8 d1d8`) in SAN um.
 * Bricht beim ersten ungültigen Zug ab, statt etwas zu erfinden.
 */
export function uciLineToSan(fen: string, uciMoves: readonly string[], max = Infinity): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves.slice(0, max)) {
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
      });
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}

export type TerminalState = { kind: 'checkmate'; winner: Color } | { kind: 'stalemate' } | null;

/** Matt oder Patt auf dem Brett? Dann muss die Engine nicht rechnen. */
export function terminalState(fen: string): TerminalState {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { kind: 'stalemate' };
  return null;
}

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}
