import type { Color, Game } from '../chess/types';
import { ERROR_CATEGORIES, type Category, type PlyAnalysis } from '../classification/types';

/** Erklärungsumfang (Import und Einstellungen) */
export type ExplainScope = 'errorsAndMyGood' | 'errorsOnly' | 'all';

/** „Meine guten Züge“: was man leicht übersieht – nicht jede Theorie oder jeden gewöhnlichen Zug. */
const MY_GOOD: ReadonlySet<Category> = new Set(['brilliant', 'great', 'best']);

/** Batches von etwa 6–8 Zügen (Projektdokument) */
export const BATCH_SIZE = 7;

/**
 * Welche Halbzüge werden erklärt?
 * - errorsAndMyGood: Fehler beider Seiten + eigene Brillant/Großartig/Beste-Züge
 * - errorsOnly: Fehler beider Seiten
 * - all: alle Züge außer Theorie
 * Fehler = Ungenauigkeit, Fehler, Patzer, Verpasst.
 */
export function selectPlies(
  game: Game,
  analyses: readonly (PlyAnalysis | undefined)[],
  userColor: Color,
  scope: ExplainScope,
): number[] {
  return game.plies
    .filter((ply) => {
      const analysis = analyses[ply.index];
      if (!analysis || analysis.category === 'book') return false;
      if (scope === 'all') return true;
      if (ERROR_CATEGORIES.has(analysis.category)) return true;
      return (
        scope === 'errorsAndMyGood' && ply.color === userColor && MY_GOOD.has(analysis.category)
      );
    })
    .map((ply) => ply.index);
}

export function chunk<T>(items: readonly T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
