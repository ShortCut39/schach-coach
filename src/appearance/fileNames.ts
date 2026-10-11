import { isSoundEvent, type SoundEvent } from './soundMapping';
import type { PieceCode } from './types';

type Color = 'w' | 'b';
type Piece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

/** Name ohne Pfad und Endung, klein, ohne Akzente (ä → ae, ß → ss) */
function normalize(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '');
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function words(fileName: string): string[] {
  return normalize(fileName)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const COLOR_WORDS: [RegExp, Color][] = [
  [/^(white|weiss|weisse|weisser|weisses|light|hell)$/, 'w'],
  [/^(black|schwarz|schwarze|schwarzer|schwarzes|dark|dunkel)$/, 'b'],
];

const PIECE_WORDS: [RegExp, Piece][] = [
  [/^(king|koenig|konig|kings)$/, 'K'],
  [/^(queen|dame|queens)$/, 'Q'],
  [/^(rook|turm|tower|rooks)$/, 'R'],
  [/^(bishop|laeufer|laufer|bishops)$/, 'B'],
  [/^(knight|springer|horse|pferd|knights)$/, 'N'],
  [/^(pawn|bauer|pawns)$/, 'P'],
];

/** Wörter, die auch ohne Trennzeichen erkannt werden (z. B. `whiteking`) */
const COLOR_PARTS: [string, Color][] = [
  ['white', 'w'],
  ['weiss', 'w'],
  ['black', 'b'],
  ['schwarz', 'b'],
];
const PIECE_PARTS: [string, Piece][] = [
  ['king', 'K'],
  ['koenig', 'K'],
  ['konig', 'K'],
  ['queen', 'Q'],
  ['dame', 'Q'],
  ['rook', 'R'],
  ['turm', 'R'],
  ['bishop', 'B'],
  ['laeufer', 'B'],
  ['laufer', 'B'],
  ['knight', 'N'],
  ['springer', 'N'],
  ['pawn', 'P'],
  ['bauer', 'P'],
];

const findWord = <T>(tokens: string[], table: [RegExp, T][]) => {
  for (const token of tokens) {
    for (const [pattern, value] of table) if (pattern.test(token)) return { token, value };
  }
  return null;
};

const findPart = <T>(joined: string, table: [string, T][]) =>
  table.find(([part]) => joined.includes(part))?.[1] ?? null;

/**
 * Erkennt die Figur aus einem Dateinamen: `wK.svg`, `bq.png`, `white_king.svg`, `WhiteKing.png`,
 * `king-black.webp`, `weisser_koenig.svg`, `Schwarzer Springer.png`, `Chess_klt45.svg`
 * (Wikipedia) usw. Zwei Buchstaben gelten wie bei Lichess englisch (`wB` = weißer Läufer).
 */
export function pieceCodeFromName(fileName: string): PieceCode | null {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '');
  const short = /^([wb])([kqrbnp])$/i.exec(base);
  if (short) {
    const [, c = '', p = ''] = short;
    return `${c.toLowerCase()}${p.toUpperCase()}` as PieceCode;
  }
  const wiki = /^chess_([kqrbnp])([ld])t\d*$/i.exec(base);
  if (wiki) {
    const [, p = '', shade = ''] = wiki;
    return `${shade.toLowerCase() === 'l' ? 'w' : 'b'}${p.toUpperCase()}` as PieceCode;
  }

  const tokens = words(fileName);
  const joined = tokens.join('');
  let color: Color | null = findWord(tokens, COLOR_WORDS)?.value ?? findPart(joined, COLOR_PARTS);
  let piece: Piece | null = findWord(tokens, PIECE_WORDS)?.value ?? findPart(joined, PIECE_PARTS);
  // Einzelne Buchstaben neben einem erkannten Wort, z. B. `king_w`, `b-knight`, `white_q`
  const singles = tokens.filter((token) => token.length === 1);
  if (piece && !color) {
    const letter = singles.find((s) => s === 'w' || s === 'b' || s === 's');
    if (letter) color = letter === 'w' ? 'w' : 'b';
  }
  if (color && !piece) {
    const letter = singles.find((s) => 'kqrbnp'.includes(s));
    if (letter) piece = letter.toUpperCase() as Piece;
  }
  // Ein Wort wie `wking` oder `bpawn`
  if (!color && piece) {
    const glued = tokens.find((t) => /^[wb](king|queen|rook|bishop|knight|pawn)$/.test(t));
    if (glued) color = glued[0] as Color;
  }
  return color && piece ? `${color}${piece}` : null;
}

const SOUND_WORDS: [RegExp, SoundEvent][] = [
  [/^(move|zug|ziehen)$/, 'move'],
  [/^(capture|take|schlag|schlagen|schlagzug)$/, 'capture'],
  [/^(castle|castling|rochade)$/, 'castle'],
  [/^(check|schach)$/, 'check'],
  [/^(promote|promotion|umwandlung|umwandeln)$/, 'promotion'],
  [/^(start|gamestart|newgame|begin|beginn|partiebeginn|genericnotify)$/, 'gameStart'],
  [/^(end|gameend|gameover|ende|partieende)$/, 'gameEnd'],
  [/^(victory|win|won|sieg|gewonnen)$/, 'victory'],
  [/^(defeat|loss|lose|lost|niederlage|verloren)$/, 'defeat'],
  [/^(draw|remis|unentschieden)$/, 'draw'],
  [/^(lowtime|clock|zeitnot|zeit)$/, 'lowTime'],
];

/**
 * Erkennt das Ereignis aus einem Dateinamen: die Platznamen selbst (`move.ogg`), die Lichess-Namen
 * (`Move.ogg`, `Capture.mp3`, `GenericNotify.ogg`, `LowTime.ogg` …) und deutsche Wörter.
 */
export function soundEventFromName(fileName: string): SoundEvent | null {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '');
  if (isSoundEvent(base)) return base;
  const joined = words(fileName).join('');
  for (const [pattern, event] of SOUND_WORDS) if (pattern.test(joined)) return event;
  for (const token of words(fileName)) {
    for (const [pattern, event] of SOUND_WORDS) if (pattern.test(token)) return event;
  }
  return null;
}

/**
 * Ordnet mehrere Ton-Dateien den Plätzen zu (erste passende Datei gewinnt). Lichess nutzt
 * `GenericNotify` für Partiebeginn und -ende; ist kein eigener Ende-Ton dabei, gilt er für beides.
 */
export function assignSoundFiles<T extends { name: string }>(
  files: T[],
): Partial<Record<SoundEvent, T>> {
  const slots: Partial<Record<SoundEvent, T>> = {};
  for (const file of files) {
    const event = soundEventFromName(file.name);
    if (event && !slots[event]) slots[event] = file;
  }
  const notify = files.find((f) => /genericnotify/i.test(f.name));
  if (notify && !slots.gameEnd) slots.gameEnd = notify;
  return slots;
}
