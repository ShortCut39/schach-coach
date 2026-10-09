import type { EngineLine, PositionEval } from './types';

/**
 * Bewertung für die Anzeige, immer aus Sicht von Weiß:
 * `+0.3`, `-1.2`, `0.0`, `M2` (Weiß setzt in 2 matt), `-M3` (Schwarz setzt in 3 matt).
 */
export function formatLineEval(line: Pick<EngineLine, 'cp' | 'mate'>): string {
  if (line.mate !== undefined) return line.mate < 0 ? `-M${Math.abs(line.mate)}` : `M${line.mate}`;
  const pawns = (line.cp ?? 0) / 100;
  const text = Math.abs(pawns).toFixed(1);
  if (text === '0.0') return '0.0';
  return pawns > 0 ? `+${text}` : `-${text}`;
}

/** Bewertung einer Stellung: `#` bei Matt auf dem Brett, `0.0` bei Patt, sonst beste Linie. */
export function formatPositionEval(evaluation: PositionEval | undefined): string | undefined {
  if (!evaluation) return undefined;
  if (evaluation.terminal?.kind === 'checkmate') return '#';
  if (evaluation.terminal?.kind === 'stalemate') return '0.0';
  const best = evaluation.lines[0];
  return best ? formatLineEval(best) : undefined;
}
