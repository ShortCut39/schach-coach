import { Chess, type Move, type Square } from 'chess.js';
import { endangeredPieces } from '../chess/danger';
import type { Color } from '../chess/types';
import type { ExplanationLanguage } from './types';

/**
 * Beschreibt Züge und Gefahren auf dem Brett in Worten – berechnet mit chess.js, nicht vom LLM.
 * Kleine Modelle können FEN und SAN-Kürzel kaum „lesen“; mit diesen Sätzen können sie konkret
 * erklären, ohne selbst Schach zu rechnen. Die Texte gehen nur an das LLM, in der Sprache der
 * Erklärungen.
 */

interface Phrases {
  pieces: Record<string, string>;
  colors: Record<Color, string>;
  kingsideCastle: string;
  queensideCastle: string;
  captures: (piece: string, target: string) => string;
  movesTo: (piece: string, square: string) => string;
  promotes: (piece: string) => string;
  checkmate: string;
  check: string;
  inDanger: (piece: string, attackers: string, defended: string) => string;
  undefended: string;
  defendedBy: (pieces: string) => string;
}

const PHRASES: Record<ExplanationLanguage, Phrases> = {
  de: {
    pieces: { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' },
    colors: { w: 'Weiß', b: 'Schwarz' },
    kingsideCastle: 'kurze Rochade',
    queensideCastle: 'lange Rochade',
    captures: (piece, target) => `${piece} schlägt ${target}`,
    movesTo: (piece, square) => `${piece} zieht nach ${square}`,
    promotes: (piece) => ` und wird zur ${piece}`,
    checkmate: ', Schachmatt',
    check: ', Schach',
    inDanger: (piece, attackers, defended) =>
      `${piece} (angegriffen von ${attackers}, ${defended})`,
    undefended: 'nicht gedeckt',
    defendedBy: (pieces) => `gedeckt von ${pieces}`,
  },
  en: {
    pieces: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
    colors: { w: 'White', b: 'Black' },
    kingsideCastle: 'castles kingside',
    queensideCastle: 'castles queenside',
    captures: (piece, target) => `${piece} captures ${target}`,
    movesTo: (piece, square) => `${piece} moves to ${square}`,
    promotes: (piece) => ` and promotes to a ${piece}`,
    checkmate: ', checkmate',
    check: ', check',
    inDanger: (piece, attackers, defended) => `${piece} (attacked by ${attackers}, ${defended})`,
    undefended: 'undefended',
    defendedBy: (pieces) => `defended by ${pieces}`,
  },
};

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
export function describeMove(move: Move, language: ExplanationLanguage = 'de'): string {
  const p = PHRASES[language];
  let text: string;
  if (move.isKingsideCastle()) text = p.kingsideCastle;
  else if (move.isQueensideCastle()) text = p.queensideCastle;
  else {
    const piece = `${p.pieces[move.piece]} ${move.from}`;
    text = move.captured
      ? `${p.captures(piece, `${p.pieces[move.captured]} ${move.to}`)}${move.isEnPassant() ? ' (en passant)' : ''}`
      : p.movesTo(piece, move.to);
    if (move.promotion) text += p.promotes(p.pieces[move.promotion] ?? move.promotion);
  }
  if (move.san.includes('#')) text += p.checkmate;
  else if (move.san.includes('+')) text += p.check;
  return text;
}

/** Variante in Worten: „Weiß: Springer f3 schlägt Dame h4“ … */
export function describeLine(
  fen: string,
  uciMoves: readonly string[],
  language: ExplanationLanguage = 'de',
): string[] {
  const chess = new Chess(fen);
  const result: string[] = [];
  for (const uci of uciMoves) {
    const color = chess.turn();
    const move = playUci(chess, uci);
    if (!move) break;
    result.push(`${PHRASES[language].colors[color]}: ${describeMove(move, language)}`);
  }
  return result;
}

/** Ein einzelner Zug in Worten (ohne Farbe), z. B. für den Bestzug. */
export function describeUci(
  fen: string,
  uci: string,
  language: ExplanationLanguage = 'de',
): string | null {
  const move = playUci(new Chess(fen), uci);
  return move ? describeMove(move, language) : null;
}

function pieceList(chess: Chess, squares: Square[], language: ExplanationLanguage): string {
  return squares
    .map((sq) => {
      const piece = chess.get(sq);
      return piece ? `${PHRASES[language].pieces[piece.type]} ${sq}` : sq;
    })
    .join(', ');
}

/**
 * Figuren (ohne Bauern und König) von `color`, die in Gefahr sind, als Sätze für das LLM.
 * Beispiel: „Dame h4 (angegriffen von Springer f3, nicht gedeckt)“
 */
export function piecesInDanger(
  fen: string,
  color: Color,
  language: ExplanationLanguage = 'de',
): string[] {
  const chess = new Chess(fen);
  const p = PHRASES[language];
  return endangeredPieces(fen, color).map(({ square, type, attackers, defenders }) => {
    const defended =
      defenders.length === 0 ? p.undefended : p.defendedBy(pieceList(chess, defenders, language));
    return p.inDanger(
      `${p.pieces[type]} ${square}`,
      pieceList(chess, attackers, language),
      defended,
    );
  });
}
