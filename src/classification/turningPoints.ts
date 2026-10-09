import type { Game } from '../chess/types';
import type { Category, PlyAnalysis } from './types';

export const MAX_TURNING_POINTS = 6;

const WEIGHT: Partial<Record<Category, number>> = {
  brilliant: 100,
  blunder: 50,
  miss: 50,
  great: 40,
  mistake: 20,
};

/**
 * Wendepunkte der Partie: brillante und großartige Züge sowie Patzer, Verpasstes und Fehler
 * beider Seiten. Die wichtigsten (Gewicht + Verlust an Gewinnchance) werden ausgewählt
 * und chronologisch zurückgegeben.
 */
export function turningPoints(
  game: Game,
  analyses: readonly (PlyAnalysis | undefined)[],
  max = MAX_TURNING_POINTS,
): number[] {
  return game.plies
    .flatMap((ply) => {
      const analysis = analyses[ply.index];
      const weight = analysis ? WEIGHT[analysis.category] : undefined;
      return analysis && weight !== undefined
        ? [{ index: ply.index, score: weight + analysis.winLoss }]
        : [];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((p) => p.index)
    .sort((a, b) => a - b);
}
