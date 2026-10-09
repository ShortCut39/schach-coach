import { detectInput, type InputKind } from '../../chess/detect';
import { parseFen } from '../../chess/fen';
import { parsePgnGame, summarizePgn, type GameSummary } from '../../chess/pgn';
import type { Game, ParseResult, Position } from '../../chess/types';

export type InputTab = 'pgn' | 'fen';

export type ImportEvaluation =
  | { kind: 'empty' }
  /** Text passt nicht zum gewählten Tab (z. B. FEN im PGN-Tab) */
  | { kind: 'wrongTab'; detected: Exclude<InputKind, 'empty'> }
  | { kind: 'pgn'; games: GameSummary[]; selected: number; result: ParseResult<Game> }
  | { kind: 'fen'; result: ParseResult<Position> };

/** Prüft die Eingabe live. Bei mehreren Partien wird nur die gewählte vollständig geprüft. */
export function evaluateImport(tab: InputTab, text: string, selected: number): ImportEvaluation {
  const detected = detectInput(text);
  if (detected === 'empty') return { kind: 'empty' };
  if (detected !== tab) return { kind: 'wrongTab', detected };

  if (tab === 'fen') return { kind: 'fen', result: parseFen(text) };

  const games = summarizePgn(text);
  const index = Math.min(Math.max(selected, 0), games.length - 1);
  const chosen = games[index];
  const result: ParseResult<Game> = chosen
    ? parsePgnGame(chosen.pgn)
    : { ok: false, error: { code: 'empty' } };
  return { kind: 'pgn', games, selected: index, result };
}

/** Das ladbare Ergebnis, falls die Eingabe gültig ist. */
export function loadableSource(evaluation: ImportEvaluation): Game | Position | undefined {
  if (evaluation.kind !== 'pgn' && evaluation.kind !== 'fen') return undefined;
  return evaluation.result.ok ? evaluation.result.value : undefined;
}
