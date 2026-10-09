import type { Color, Game } from '../chess/types';
import { CATEGORIES, type Category, type PlyAnalysis } from './types';

export type CategoryCounts = Record<Category, number>;

/** Anzahl der Kategorien für eine Farbe. */
export function countCategories(
  game: Game,
  analyses: readonly (PlyAnalysis | undefined)[],
  color: Color,
): CategoryCounts {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as CategoryCounts;
  for (const ply of game.plies) {
    const analysis = analyses[ply.index];
    if (ply.color === color && analysis) counts[analysis.category]++;
  }
  return counts;
}
