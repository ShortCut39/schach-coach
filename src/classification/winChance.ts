import type { EngineLine, PositionEval } from '../engine/types';

/**
 * Gewinnchance in Prozent (0..100) aus Centipawns, aus Sicht derjenigen Seite,
 * für die `cp` gilt. Formel laut Projektdokument (Abschnitt 5, wie Lichess).
 */
export function winChanceFromCp(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Gewinnchance für Weiß aus einer Engine-Linie. Matt zählt als 100 bzw. 0. */
export function whiteWinChance(line: Pick<EngineLine, 'cp' | 'mate'>): number {
  if (line.mate !== undefined) return line.mate > 0 ? 100 : 0;
  return winChanceFromCp(line.cp ?? 0);
}

/** Gewinnchance für Weiß in einer Stellung, oder `undefined`, solange keine Bewertung da ist. */
export function positionWhiteWinChance(evaluation: PositionEval | undefined): number | undefined {
  if (!evaluation) return undefined;
  if (evaluation.terminal?.kind === 'checkmate')
    return evaluation.terminal.winner === 'w' ? 100 : 0;
  if (evaluation.terminal?.kind === 'stalemate') return 50;
  const best = evaluation.lines[0];
  return best ? whiteWinChance(best) : undefined;
}
