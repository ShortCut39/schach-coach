import { Chess, DEFAULT_POSITION, type Move } from 'chess.js';
import type { ChessError, Color, Game, GameResult, ParseResult, PlyBase } from './types';

const HEADER_LINE = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;
const RESULTS = new Set<string>(['1-0', '0-1', '1/2-1/2', '*']);

function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/**
 * Zerlegt einen Text mit beliebig vielen Partien in einzelne PGN-Blöcke.
 * Eine neue Partie beginnt, sobald nach Zugtext wieder eine Header-Zeile kommt.
 * Header-Zeilen innerhalb von `{…}`-Kommentaren werden ignoriert.
 */
export function splitPgn(text: string): string[] {
  const games: string[][] = [];
  let current: string[] = [];
  let seenMoves = false;
  let inComment = false;

  for (const line of normalizeText(text).split('\n')) {
    const isHeader = !inComment && HEADER_LINE.test(line);
    if (isHeader && seenMoves) {
      games.push(current);
      current = [];
      seenMoves = false;
    }
    current.push(line);
    if (!isHeader && line.trim() !== '') {
      seenMoves = true;
      for (const ch of line) {
        if (!inComment && ch === ';') break; // Rest der Zeile ist Kommentar
        if (ch === '{') inComment = true;
        else if (ch === '}') inComment = false;
      }
    }
  }
  games.push(current);

  return games.map((lines) => lines.join('\n').trim()).filter((chunk) => chunk !== '');
}

/** Liest die Header einer einzelnen Partie, unverändert. */
export function readHeaders(chunk: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of normalizeText(chunk).split('\n')) {
    const match = HEADER_LINE.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      headers[match[1]] = match[2].replace(/\\(["\\])/g, '$1');
    }
  }
  return headers;
}

/** Liefert einen Header-Wert oder `undefined`, wenn er fehlt oder unbekannt ist (`?`, `????.??.??`). */
export function headerValue(headers: Record<string, string>, key: string): string | undefined {
  const value = headers[key]?.trim();
  if (!value || /^[?.\s-]*$/.test(value)) return undefined;
  return value;
}

/**
 * Zerlegt den Zugtext in SAN-Tokens. Entfernt Header, Kommentare, Varianten,
 * NAGs (`$1`), Zugnummern, Bewertungszeichen (`!?`) und das Ergebnis.
 */
export function movetextTokens(chunk: string): string[] {
  const body = normalizeText(chunk)
    .split('\n')
    .filter((line) => !HEADER_LINE.test(line))
    .join('\n');

  let text = '';
  let variationDepth = 0;
  let inBrace = false;
  let inLineComment = false;
  for (const ch of body) {
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBrace) {
      if (ch === '}') inBrace = false;
      continue;
    }
    if (ch === '{') inBrace = true;
    else if (ch === ';') inLineComment = true;
    else if (ch === '(') variationDepth++;
    else if (ch === ')') variationDepth = Math.max(0, variationDepth - 1);
    else if (variationDepth === 0) {
      text += ch;
      continue;
    }
    text += ' ';
  }

  return text
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.+/, '').replace(/[!?]+$/, ''))
    .filter((token) => token !== '' && !RESULTS.has(token) && !/^\$\d+$/.test(token));
}

function startFenOf(headers: Record<string, string>): string {
  return headerValue(headers, 'FEN') ?? DEFAULT_POSITION;
}

/** Spielt die Tokens nach und findet den ersten unmöglichen Zug. */
function locateError(chunk: string, startFen: string): ChessError {
  let chess: Chess;
  try {
    chess = new Chess(startFen);
  } catch {
    return { code: 'syntax' };
  }
  for (const token of movetextTokens(chunk)) {
    const color: Color = chess.turn();
    const moveNumber = chess.moveNumber();
    try {
      chess.move(token, { strict: false });
    } catch {
      return { code: 'illegalMove', moveNumber, color, san: token };
    }
  }
  return { code: 'syntax' };
}

function resultOf(headers: Record<string, string>): GameResult {
  const value = headers.Result?.trim();
  return value !== undefined && RESULTS.has(value) ? (value as GameResult) : '*';
}

/** Halbzüge aus der Zugfolge von chess.js (`history({ verbose: true })`). */
export function pliesFromHistory(history: readonly Move[]): PlyBase[] {
  return history.map((move, index) => plyFromMove(move, index));
}

/** Ein Halbzug aus einem Zug von chess.js; `index` = Position in der Partie (0-basiert). */
export function plyFromMove(move: Move, index: number): PlyBase {
  return {
    index,
    moveNumber: Number(move.before.split(' ')[5] ?? '1'),
    color: move.color,
    san: move.san,
    uci: move.lan,
    from: move.from,
    to: move.to,
    fenBefore: move.before,
    fenAfter: move.after,
    flags: {
      check: move.san.includes('+') || move.san.includes('#'),
      mate: move.san.includes('#'),
      capture: move.isCapture(),
      castle: move.isKingsideCastle() || move.isQueensideCastle(),
      promotion: move.isPromotion(),
      enPassant: move.isEnPassant(),
    },
  };
}

/** Liest genau eine Partie vollständig ein (alle Züge werden auf Legalität geprüft). */
export function parsePgnGame(chunk: string): ParseResult<Game> {
  if (chunk.trim() === '') return { ok: false, error: { code: 'empty' } };

  const headers = readHeaders(chunk);
  const chess = new Chess();
  try {
    chess.loadPgn(normalizeText(chunk));
  } catch {
    return { ok: false, error: locateError(chunk, startFenOf(headers)) };
  }

  const history = chess.history({ verbose: true });
  if (history.length === 0) return { ok: false, error: { code: 'noMoves' } };

  const plies = pliesFromHistory(history);

  const startFen = history[0]?.before ?? startFenOf(headers);
  return {
    ok: true,
    value: { kind: 'game', headers, startFen, plies, result: resultOf(headers), pgn: chunk.trim() },
  };
}

export interface GameSummary {
  /** Position im Text (0-basiert), passend zu `splitPgn` */
  index: number;
  pgn: string;
  headers: Record<string, string>;
  /** Anzahl Halbzüge laut Zugtext (ohne Legalitätsprüfung, für Listen) */
  plyCount: number;
  result: GameResult;
}

/** Schnelle Übersicht über alle Partien eines Textes, ohne die Züge zu prüfen. */
export function summarizePgn(text: string): GameSummary[] {
  return splitPgn(text).map((pgn, index) => {
    const headers = readHeaders(pgn);
    return { index, pgn, headers, plyCount: movetextTokens(pgn).length, result: resultOf(headers) };
  });
}

/** Anzahl voller Züge (Weiß + Schwarz = 1 Zug), wie sie Schachspieler zählen. */
export function fullMoveCount(game: Game): number {
  const last = game.plies.at(-1);
  const first = game.plies[0];
  if (!last || !first) return 0;
  return last.moveNumber - first.moveNumber + 1;
}

/**
 * PGN-Datum (`YYYY.MM.DD`, unbekannte Teile als `??`) für die Anzeige im Format von `locale`:
 * vollständig → `09.10.2026` (de-DE) bzw. `09/10/2026` (en-GB), nur Jahr bekannt → `1858`,
 * sonst `undefined`.
 */
export function formatPgnDate(value: string | undefined, locale = 'de-DE'): string | undefined {
  const match = /^(\d{4}|\?{4})\.(\d{2}|\?{2})\.(\d{2}|\?{2})$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const [, year, month, day] = match;
  if (!year || year.includes('?')) return undefined;
  if (!month || month.includes('?') || !day || day.includes('?')) return year;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toLocaleDateString(
    locale,
    { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}
