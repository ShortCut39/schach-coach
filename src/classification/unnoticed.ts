import type { Game } from '../chess/types';
import type { PlyAnalysis } from './types';

/** So viele eigene Folgezüge werden geprüft */
export const UNNOTICED_WINDOW = 2;
/** Ab diesem Verlust gilt ein Folgezug als „nicht darauf aufgebaut“ */
export const UNNOTICED_LOSS = 5;

/**
 * „Unbemerkt gut gespielt“: Ein Großartig- oder Brillant-Zug, nach dem derselbe Spieler
 * innerhalb seiner nächsten zwei Züge einen Zug mit Verlust ≥ 5 spielt.
 * Ergebnis: Indizes der guten Züge, die markiert werden.
 */
export function unnoticedGoodMoves(
  game: Game,
  analyses: readonly (PlyAnalysis | undefined)[],
): Set<number> {
  const marked = new Set<number>();
  for (const ply of game.plies) {
    const category = analyses[ply.index]?.category;
    if (category !== 'great' && category !== 'brilliant') continue;
    const following = game.plies
      .filter((p) => p.color === ply.color && p.index > ply.index)
      .slice(0, UNNOTICED_WINDOW);
    if (following.some((p) => (analyses[p.index]?.winLoss ?? 0) >= UNNOTICED_LOSS))
      marked.add(ply.index);
  }
  return marked;
}
