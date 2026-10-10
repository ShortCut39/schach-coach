import { DEFAULT_POSITION } from 'chess.js';
import type { Color, GameResult } from '../chess/types';
import { pgnTimeControl } from './rules/timeControl';
import type { GameViewState } from './session/types';

/** Angaben für die PGN-Kopfzeilen, die nicht im Partiestand stehen */
export interface PgnInfo {
  event: string;
  /** Lichess: `https://lichess.org/<gameId>`; lokal ein Hinweis auf die App */
  site: string;
  /** Namen wie im PGN (lokal z. B. „Du“ und „Stockfish (Stufe Mittel)“) */
  names: Record<Color, string>;
  /** Lichess-Wertungen */
  ratings?: Partial<Record<Color, number>>;
}

/** `2026.10.11` aus einem Datum (Ortszeit) */
export function pgnDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Lichess-ähnliche Angabe, wie die Partie endete */
function termination(view: GameViewState): string | undefined {
  switch (view.outcome?.reason) {
    case undefined:
      return undefined;
    case 'timeout':
    case 'timeoutVsInsufficient':
      return 'Time forfeit';
    case 'opponentLeft':
      return 'Abandoned';
    default:
      return 'Normal';
  }
}

/** Zugtext mit Zugnummern, umbrochen nach höchstens 80 Zeichen */
function movetext(view: GameViewState, result: GameResult): string {
  const tokens: string[] = [];
  view.plies.forEach((ply, index) => {
    if (ply.color === 'w') tokens.push(`${ply.moveNumber}.`);
    else if (index === 0) tokens.push(`${ply.moveNumber}...`);
    tokens.push(ply.san);
  });
  tokens.push(result);
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (line && line.length + 1 + token.length > 80) {
      lines.push(line);
      line = token;
    } else {
      line = line ? `${line} ${token}` : token;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * PGN der gespielten Partie: Event, Site, Datum, Spieler, Ergebnis, Wertungen, Zeitkontrolle,
 * Partieende und – bei anderer Startstellung – SetUp/FEN. Zugtext in englischer SAN.
 */
export function buildPgn(view: GameViewState, info: PgnInfo): string {
  const result: GameResult = view.outcome?.result ?? '*';
  const headers: [string, string][] = [
    ['Event', info.event],
    ['Site', info.site],
    ['Date', pgnDate(view.startedAt)],
    ['Round', '-'],
    ['White', info.names.w],
    ['Black', info.names.b],
    ['Result', result],
  ];
  if (info.ratings?.w !== undefined) headers.push(['WhiteElo', String(info.ratings.w)]);
  if (info.ratings?.b !== undefined) headers.push(['BlackElo', String(info.ratings.b)]);
  headers.push(['TimeControl', pgnTimeControl(view.timeControl)]);
  const end = termination(view);
  if (end) headers.push(['Termination', end]);
  if (view.startFen !== DEFAULT_POSITION) {
    headers.push(['SetUp', '1'], ['FEN', view.startFen]);
  }
  const head = headers.map(([key, value]) => `[${key} "${escapeHeader(value)}"]`).join('\n');
  return `${head}\n\n${movetext(view, result)}\n`;
}
