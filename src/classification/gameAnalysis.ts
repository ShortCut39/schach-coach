import type { Game } from '../chess/types';
import type { PositionEval } from '../engine/types';
import { classifyGame } from './classify';
import { openingInfo, type OpeningBook, type OpeningInfo } from './openingBook';
import { DEFAULT_CLASSIFICATION, type ClassificationConfig, type PlyAnalysis } from './types';
import { unnoticedGoodMoves } from './unnoticed';

export interface GameAnalysis {
  /** Ergebnis je Halbzug (Index = Halbzug), `undefined` solange Bewertungen fehlen */
  plies: (PlyAnalysis | undefined)[];
  opening: OpeningInfo | undefined;
  /** Großartig/Brillant-Züge, auf die nicht aufgebaut wurde */
  unnoticed: Set<number>;
}

/** Kategorien, Eröffnung und „Unbemerkt gut gespielt“ für eine Partie. */
export function computeGameAnalysis(
  game: Game,
  evals: readonly (PositionEval | undefined)[],
  book: OpeningBook,
  thresholds: Pick<ClassificationConfig, 'inaccuracy' | 'mistake' | 'blunder'>,
): GameAnalysis {
  const opening = openingInfo(game, book);
  const plies = classifyGame(game, evals, opening?.bookPlies ?? 0, {
    ...DEFAULT_CLASSIFICATION,
    ...thresholds,
  });
  return { plies, opening, unnoticed: unnoticedGoodMoves(game, plies) };
}
