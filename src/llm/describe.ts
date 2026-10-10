import { Chess, type Move, type Square } from 'chess.js';
import { endangeredPieces } from '../chess/danger';
import type { Color } from '../chess/types';

/**
 * Beschreibt Züge und Gefahren auf dem Brett in Worten – berechnet mit chess.js, nicht vom LLM.
 * Kleine Modelle können FEN und SAN-Kürzel kaum „lesen“; mit diesen Sätzen können sie konkret
 * erklären, ohne selbst Schach zu rechnen. Die Texte gehen nur an das LLM (Sprache: Deutsch).
 */

const PIECE_NAMES: Record<string, string> = {
  p: 'Bauer',
  n: 'Springer',
  b: 'Läufer',
  r: 'Turm',
  q: 'Dame',
  k: 'König',
};
const COLOR_NAMES: Record<Color, string> = { w: 'Weiß', b: 'Schwarz' };

function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
    });
  } catch {
    return null;
  }
}

/** z. B. „Springer f3 schlägt Dame h4“, „Dame d8 zieht nach h4, Schach“, „kurze Rochade“ */
export function describeMove(move: Move): string {
  let text: string;
  if (move.isKingsideCastle()) text = 'kurze Rochade';
  else if (move.isQueensideCastle()) text = 'lange Rochade';
  else {
    const piece = `${PIECE_NAMES[move.piece]} ${move.from}`;
    text = move.captured
      ? `${piece} schlägt ${PIECE_NAMES[move.captured]} ${move.to}${move.isEnPassant() ? ' (en passant)' : ''}`
      : `${piece} zieht nach ${move.to}`;
    if (move.promotion) text += ` und wird zur ${PIECE_NAMES[move.promotion]}`;
  }
  if (move.san.includes('#')) text += ', Schachmatt';
  else if (move.san.includes('+')) text += ', Schach';
  return text;
}

/** Variante in Worten: „Weiß: Springer f3 schlägt Dame h4“ … */
export function describeLine(fen: string, uciMoves: readonly string[]): string[] {
  const chess = new Chess(fen);
  const result: string[] = [];
  for (const uci of uciMoves) {
    const color = chess.turn();
    const move = playUci(chess, uci);
    if (!move) break;
    result.push(`${COLOR_NAMES[color]}: ${describeMove(move)}`);
  }
  return result;
}

/** Ein einzelner Zug in Worten (ohne Farbe), z. B. für den Bestzug. */
export function describeUci(fen: string, uci: string): string | null {
  const move = playUci(new Chess(fen), uci);
  return move ? describeMove(move) : null;
}

function pieceList(chess: Chess, squares: Square[]): string {
  return squares
    .map((sq) => {
      const piece = chess.get(sq);
      return piece ? `${PIECE_NAMES[piece.type]} ${sq}` : sq;
    })
    .join(', ');
}

/**
 * Figuren (ohne Bauern und König) von `color`, die in Gefahr sind, als Sätze für das LLM.
 * Beispiel: „Dame h4 (angegriffen von Springer f3, nicht gedeckt)“
 */
export function piecesInDanger(fen: string, color: Color): string[] {
  const chess = new Chess(fen);
  return endangeredPieces(fen, color).map(({ square, type, attackers, defenders }) => {
    const defended =
      defenders.length === 0 ? 'nicht gedeckt' : `gedeckt von ${pieceList(chess, defenders)}`;
    return `${PIECE_NAMES[type]} ${square} (angegriffen von ${pieceList(chess, attackers)}, ${defended})`;
  });
}
