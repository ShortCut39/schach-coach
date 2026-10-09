import type { Color, Game } from '../chess/types';
import { pieceCount } from './material';
import type { PlyAnalysis } from './types';

/** Genauigkeit eines Zugs aus dem Verlust an Gewinnchance (Formel laut Projektdokument). */
export function moveAccuracy(winLoss: number): number {
  const value = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669;
  return Math.min(100, Math.max(0, value));
}

export type Phase = 'opening' | 'middlegame' | 'endgame';
export const PHASES: readonly Phase[] = ['opening', 'middlegame', 'endgame'];

/**
 * Grenzen der Spielphasen (angelehnt an den „Divider“ von Lichess, vereinfacht):
 * - Endspiel: höchstens 6 Figuren (ohne Bauern und Könige) auf dem Brett, vor dem Zug.
 * - Eröffnung: Züge 1 bis 10, sofern noch kein Endspiel.
 * - Mittelspiel: alles dazwischen.
 */
export const ENDGAME_MAX_PIECES = 6;
export const OPENING_LAST_MOVE = 10;

export function phaseOf(fenBefore: string, moveNumber: number): Phase {
  if (pieceCount(fenBefore) <= ENDGAME_MAX_PIECES) return 'endgame';
  if (moveNumber <= OPENING_LAST_MOVE) return 'opening';
  return 'middlegame';
}

export interface AccuracySummary {
  /** Durchschnitt über alle bewerteten Züge, `undefined` ohne Züge */
  overall: number | undefined;
  byPhase: Record<Phase, number | undefined>;
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

/** Genauigkeit eines Spielers: Durchschnitt seiner Züge, gesamt und je Phase. */
export function playerAccuracy(
  game: Game,
  analyses: readonly (PlyAnalysis | undefined)[],
  color: Color,
): AccuracySummary {
  const all: number[] = [];
  const byPhase: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  for (const ply of game.plies) {
    const analysis = analyses[ply.index];
    if (ply.color !== color || !analysis) continue;
    all.push(analysis.accuracy);
    byPhase[phaseOf(ply.fenBefore, ply.moveNumber)].push(analysis.accuracy);
  }
  return {
    overall: average(all),
    byPhase: {
      opening: average(byPhase.opening),
      middlegame: average(byPhase.middlegame),
      endgame: average(byPhase.endgame),
    },
  };
}
