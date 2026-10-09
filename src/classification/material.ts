import { Chess } from 'chess.js';
import type { Color } from '../chess/types';

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Materialbilanz aus Sicht von `color` (eigenes minus gegnerisches Material, Bauerneinheiten). */
export function materialBalance(chess: Chess, color: Color): number {
  let balance = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (!square) continue;
      const value = PIECE_VALUES[square.type] ?? 0;
      balance += square.color === color ? value : -value;
    }
  }
  return balance;
}

/** Anzahl Figuren ohne Bauern und Könige (für die Spielphase). */
export function pieceCount(fen: string): number {
  const board = fen.split(' ')[0] ?? '';
  return (board.match(/[nbrqNBRQ]/g) ?? []).length;
}

function play(chess: Chess, uci: string): boolean {
  try {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opfer-Erkennung entlang der Hauptvariante.
 *
 * Gespielter Zug + Engine-Hauptvariante danach (Gegnerzüge innerhalb von `window` Halbzügen).
 * Ein Opfer liegt vor, wenn nach einem Zug des Gegners die Materialbilanz des Ziehenden
 * um mindestens `minLoss` unter dem Wert vor dem Zug liegt **und** der Ziehende das mit
 * seinem nächsten Zug nicht sofort zurückgewinnt (Bilanz bleibt mindestens `minLoss` darunter).
 * Die Antwort des Ziehenden wird auch hinter dem Fenster gelesen; fehlt sie, zählt der Verlust nur,
 * wenn die Partie dort mit Matt oder Patt endet.
 */
export function isSacrifice(
  fenBefore: string,
  playedUci: string,
  pvAfter: readonly string[],
  minLoss: number,
  window: number,
): boolean {
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  const start = materialBalance(chess, mover);
  const sequence = [playedUci, ...pvAfter];

  // Bilanz nach jedem Halbzug; `gameOver` merkt, ob die Variante mit Matt/Patt endet
  const balances: number[] = [];
  let gameOver = false;
  for (const uci of sequence) {
    if (!play(chess, uci)) break;
    balances.push(materialBalance(chess, mover));
    if (chess.isGameOver()) {
      gameOver = true;
      break;
    }
  }

  // Index 0 = nach dem gespielten Zug, ungerade Indizes = nach Gegnerzügen (nur im Fenster).
  // Die direkte Antwort darauf wird auch hinter dem Fenster gelesen, damit ein Tausch an der
  // Fenstergrenze nicht wie ein Opfer aussieht.
  for (let i = 1; i < Math.min(balances.length, window); i += 2) {
    const afterOpponent = balances[i] ?? start;
    if (afterOpponent > start - minLoss) continue;
    const afterReply = balances[i + 1];
    if (afterReply === undefined) {
      // Keine Antwort bekannt: nur ein Opfer, wenn die Partie hier endet
      if (gameOver && i === balances.length - 1) return true;
      continue;
    }
    if (afterReply <= start - minLoss) return true;
  }
  return false;
}
