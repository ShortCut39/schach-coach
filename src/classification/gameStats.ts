import type { Color, Game } from '../chess/types';
import type { PositionEval } from '../engine/types';
import { PHASES, phaseOf, playerAccuracy, type Phase } from './accuracy';
import { detectMotif, type Motif } from './motifs';
import type { GameAnalysis } from './gameAnalysis';
import { ERROR_CATEGORIES, type Category } from './types';

/** Ein eigener Fehler mit Motiv (Beispiel für die Muster-Seite). */
export interface MotifExample {
  motif: Motif;
  ply: number;
  moveNumber: number;
  color: Color;
  /** Englische SAN; die Anzeige formatiert nach Einstellung */
  san: string;
  category: Category;
  phase: Phase;
  winLoss: number;
}

/** Kennzahlen einer Partie aus Sicht des Nutzers (werden mit dem Bibliothekseintrag gespeichert). */
export interface GameStats {
  version: 1;
  motifs: MotifExample[];
  errorsByPhase: Record<Phase, number>;
  movesByPhase: Record<Phase, number>;
  accuracyByPhase: Record<Phase, number | null>;
  bookPlies: number;
}

export function computeGameStats(
  game: Game,
  evals: readonly (PositionEval | undefined)[],
  analysis: GameAnalysis,
  userColor: Color,
): GameStats {
  const motifs: MotifExample[] = [];
  const errorsByPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };
  const movesByPhase: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };

  for (const ply of game.plies) {
    if (ply.color !== userColor) continue;
    const result = analysis.plies[ply.index];
    const before = evals[ply.index];
    const after = evals[ply.index + 1];
    if (!result) continue;
    const phase = phaseOf(ply.fenBefore, ply.moveNumber);
    movesByPhase[phase]++;
    if (!ERROR_CATEGORIES.has(result.category) || !before || !after) continue;
    errorsByPhase[phase]++;
    motifs.push({
      motif: detectMotif(ply, result, before, after),
      ply: ply.index,
      moveNumber: ply.moveNumber,
      color: ply.color,
      san: ply.san,
      category: result.category,
      phase,
      winLoss: Math.round(result.winLoss * 10) / 10,
    });
  }

  const accuracy = playerAccuracy(game, analysis.plies, userColor);
  const accuracyByPhase = Object.fromEntries(
    PHASES.map((p) => [p, accuracy.byPhase[p] ?? null]),
  ) as Record<Phase, number | null>;
  return {
    version: 1,
    motifs,
    errorsByPhase,
    movesByPhase,
    accuracyByPhase,
    bookPlies: analysis.opening?.bookPlies ?? 0,
  };
}
