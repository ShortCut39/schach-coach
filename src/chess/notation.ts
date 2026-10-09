/**
 * Anzeige-Formatter für SAN. Intern wird immer englische SAN gespeichert;
 * nur die Anzeige wird übersetzt.
 *
 * Deutsch: K (König), D (Dame), T (Turm), L (Läufer), S (Springer),
 * Bauern ohne Buchstabe, Rochade bleibt `O-O` / `O-O-O`.
 */

export type NotationStyle = 'de' | 'en';

const GERMAN_PIECES: Record<string, string> = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };

/**
 * In SAN sind Figurenbuchstaben immer groß (K, Q, R, B, N), Linien immer klein (a–h).
 * Deshalb kann jeder Großbuchstabe außer O (Rochade) direkt ersetzt werden –
 * auch die Umwandlungsfigur (`e8=Q` → `e8=D`). `bxc3` bleibt unverändert.
 */
export function formatSan(san: string, style: NotationStyle): string {
  if (style === 'en') return san;
  return san.replace(/[KQRBN]/g, (piece) => GERMAN_PIECES[piece] ?? piece);
}

/** Zugnummer für die Anzeige: `16.` für Weiß, `16…` für Schwarz. */
export function formatMoveNumber(moveNumber: number, color: 'w' | 'b'): string {
  return color === 'w' ? `${moveNumber}.` : `${moveNumber}…`;
}
