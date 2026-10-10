import { Chess, type Square } from 'chess.js';
import type { Color, GameResult } from '../../chess/types';

/** Warum eine Partie zu Ende ist. Die Oberfläche übersetzt die Codes. */
export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficientMaterial'
  | 'threefoldRepetition'
  | 'fiftyMoves'
  /** Zeit abgelaufen, der Gegner kann gewinnen */
  | 'timeout'
  /** Zeit abgelaufen, der Gegner hat aber kein Mattmaterial → Remis */
  | 'timeoutVsInsufficient'
  | 'resign'
  | 'agreement'
  /** Partie vor dem ersten Zug abgebrochen (zählt nicht) */
  | 'aborted'
  /** Lichess: Gegner hat die Partie verlassen, Sieg bzw. Remis beansprucht */
  | 'opponentLeft'
  /** Lichess: Partie wurde nicht begonnen */
  | 'noStart'
  /** Lichess: von der Fair-Play-Prüfung beendet */
  | 'cheat'
  | 'unknown';

export interface GameOutcome {
  result: GameResult;
  winner: Color | null;
  reason: EndReason;
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function winOutcome(winner: Color, reason: EndReason): GameOutcome {
  return { result: winner === 'w' ? '1-0' : '0-1', winner, reason };
}

export function drawOutcome(reason: EndReason): GameOutcome {
  return { result: '1/2-1/2', winner: null, reason };
}

/**
 * Ende laut Brett (chess.js): Matt, Patt, zu wenig Material, dreifache Wiederholung, 50-Züge-Regel.
 * Für die Wiederholung braucht `chess` die ganze Zugfolge (nicht nur die FEN).
 */
export function boardOutcome(chess: Chess): GameOutcome | null {
  if (chess.isCheckmate()) return winOutcome(opposite(chess.turn()), 'checkmate');
  if (chess.isStalemate()) return drawOutcome('stalemate');
  if (chess.isInsufficientMaterial()) return drawOutcome('insufficientMaterial');
  if (chess.isThreefoldRepetition()) return drawOutcome('threefoldRepetition');
  if (chess.isDrawByFiftyMoves()) return drawOutcome('fiftyMoves');
  return null;
}

/**
 * Hat `color` theoretisch noch Mattmaterial? Vereinfachte Regel: Nur König oder König mit genau
 * einem Läufer oder Springer (ohne Bauern) reicht nicht.
 */
export function hasMatingMaterial(fen: string, color: Color): boolean {
  const chess = new Chess(fen);
  const pieces = chess
    .board()
    .flat()
    .filter((square): square is NonNullable<typeof square> => square?.color === color)
    .map((square) => square.type)
    .filter((type) => type !== 'k');
  if (pieces.length === 0) return false;
  if (pieces.length === 1 && (pieces[0] === 'b' || pieces[0] === 'n')) return false;
  return true;
}

/** Zeit von `flagged` ist abgelaufen: verloren, außer der Gegner hat kein Mattmaterial. */
export function timeoutOutcome(fen: string, flagged: Color): GameOutcome {
  const other = opposite(flagged);
  return hasMatingMaterial(fen, other)
    ? winOutcome(other, 'timeout')
    : drawOutcome('timeoutVsInsufficient');
}

/** Baut eine Partie aus Startstellung und UCI-Zügen auf; `null` bei einem ungültigen Zug. */
export function replay(startFen: string, uciMoves: readonly string[]): Chess | null {
  const chess = new Chess(startFen);
  for (const uci of uciMoves) {
    if (!applyUci(chess, uci)) return null;
  }
  return chess;
}

/**
 * Führt einen UCI-Zug aus (`e2e4`, `e7e8q`). Rochade auch als König-auf-Turm (`e1h1`), so liefert
 * Lichess sie teilweise. Gibt `false` zurück, wenn der Zug nicht legal ist.
 */
export function applyUci(chess: Chess, uci: string): boolean {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  const legal = chess.moves({ square: from as Square, verbose: true });
  let move = legal.find((m) => m.to === to && (m.promotion ?? undefined) === promotion);
  if (!move && !promotion) {
    // König auf eigenen Turm = Rochade
    const rookFile = to[0];
    move = legal.find(
      (m) =>
        (m.isKingsideCastle() && rookFile === 'h' && to[1] === from[1]) ||
        (m.isQueensideCastle() && rookFile === 'a' && to[1] === from[1]),
    );
  }
  if (!move) return false;
  chess.move(move);
  return true;
}
