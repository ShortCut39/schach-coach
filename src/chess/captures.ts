import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { materialBalance } from '../classification/material';
import type { Color, PlyBase } from './types';

/** Geschlagene Figuren, die eine Seite erbeutet hat (ohne König), in der Reihenfolge wie bei Lichess */
export type CapturedType = Exclude<PieceSymbol, 'k'>;

const ORDER: readonly CapturedType[] = ['p', 'n', 'b', 'r', 'q'];

/**
 * Welche Figuren jede Seite geschlagen hat, nur aus den Zügen (chess.js, keine Engine):
 * `w` = von Weiß geschlagene schwarze Figuren. Die geschlagene Figur steht in der Stellung vor dem
 * Zug auf dem Zielfeld, bei en passant ist es ein Bauer. Eine umgewandelte und dann geschlagene
 * Figur zählt als das, was sie zu dem Zeitpunkt war (z. B. Dame).
 */
export function capturedPieces(plies: readonly PlyBase[]): Record<Color, CapturedType[]> {
  const result: Record<Color, CapturedType[]> = { w: [], b: [] };
  for (const ply of plies) {
    if (!ply.flags.capture) continue;
    let type: PieceSymbol | undefined = 'p';
    if (!ply.flags.enPassant) {
      try {
        type = new Chess(ply.fenBefore).get(ply.to as Square)?.type;
      } catch {
        type = undefined;
      }
    }
    if (type && type !== 'k') result[ply.color].push(type);
  }
  for (const color of ['w', 'b'] as const) {
    result[color].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }
  return result;
}

/** Materialvorteil von Weiß in Bauerneinheiten (positiv: Weiß vorn, negativ: Schwarz vorn) */
export function whiteMaterialAdvantage(fen: string): number {
  try {
    return materialBalance(new Chess(fen), 'w');
  } catch {
    return 0;
  }
}
