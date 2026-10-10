import { Chess } from 'chess.js';
import { uciLineToSan } from '../chess/line';
import { formatMoveNumber, formatSan, type NotationStyle } from '../chess/notation';

/** Zugfolge mit Zugnummern, z. B. „14… Dxe5 15. Lxe5“ (höchstens `max` Halbzüge). */
export function formatLine(
  fen: string,
  uciMoves: readonly string[],
  notation: NotationStyle,
  max = 4,
): string {
  const sans = uciLineToSan(fen, uciMoves, max);
  const parts = fen.split(' ');
  let color = parts[1] === 'b' ? 'b' : 'w';
  let moveNumber = Number(parts[5]) || 1;
  return sans
    .map((san, i) => {
      const prefix =
        i === 0 || color === 'w' ? `${formatMoveNumber(moveNumber, color as 'w' | 'b')} ` : '';
      const text = `${prefix}${formatSan(san, notation)}`;
      if (color === 'b') moveNumber++;
      color = color === 'w' ? 'b' : 'w';
      return text;
    })
    .join(' ');
}

/** Deutsche Figurenbuchstaben → englische SAN (D→Q, T→R, L→B, S→N). */
const GERMAN_PIECES: Record<string, string> = { D: 'Q', T: 'R', L: 'B', S: 'N' };

/**
 * Liest einen eingetippten Zug (deutsche oder englische Kurzschrift, z. B. „Sf3“, „Nf3“, „e4“,
 * „exd5“, „e8=D“, „0-0“, oder Felder wie „e2e4“). Liefert UCI oder `null`, wenn der Zug nicht legal ist.
 */
export function parseMoveInput(fen: string, input: string): string | null {
  const text = input
    .trim()
    .replace(/[+#!?]+$/g, '')
    .replace(/0/g, 'O')
    .replace(/[DTLS]/g, (letter) => GERMAN_PIECES[letter] ?? letter);
  if (!text) return null;
  const chess = new Chess(fen);
  const coordinates = /^([a-h][1-8])-?([a-h][1-8])([qrbn])?$/i.exec(text);
  try {
    const move = coordinates
      ? chess.move({
          from: (coordinates[1] ?? '').toLowerCase(),
          to: (coordinates[2] ?? '').toLowerCase(),
          ...(coordinates[3] ? { promotion: coordinates[3].toLowerCase() } : {}),
        })
      : chess.move(text, { strict: false });
    return move.from + move.to + (move.promotion ?? '');
  } catch {
    return null;
  }
}
