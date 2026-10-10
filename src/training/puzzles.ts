import type { Color } from '../chess/types';
import type { GameStats } from '../classification/gameStats';
import type { Motif } from '../classification/motifs';
import type { Category } from '../classification/types';
import { isDue, type CardState } from './srs';

/** Welche Fehlerarten Aufgaben werden (Einstellungen → Training). */
export interface PuzzleSources {
  blunders: boolean;
  missed: boolean;
  inaccuracies: boolean;
}

/** Eine Trainingsaufgabe: die Stellung vor einem eigenen Fehler. */
export interface Puzzle {
  /** `<gameId>:<ply>` */
  id: string;
  gameId: string;
  gameTitle: string;
  ply: number;
  moveNumber: number;
  color: Color;
  /** In der Partie gespielter Zug (englische SAN) */
  playedSan: string;
  category: Category;
  motif: Motif;
  winLoss: number;
  /** Für die Reihenfolge neuer Aufgaben (neueste Partien zuerst) */
  sortKey: string;
}

export interface PuzzleGameInput {
  id: string;
  title: string;
  sortKey: string;
  stats: GameStats;
}

function categoriesFor(sources: PuzzleSources): Set<Category> {
  const result = new Set<Category>();
  if (sources.blunders) {
    result.add('mistake');
    result.add('blunder');
  }
  if (sources.missed) result.add('miss');
  if (sources.inaccuracies) result.add('inaccuracy');
  return result;
}

/** Alle Aufgaben aus den gespeicherten Fehlern, optional nur ein Motiv. */
export function collectPuzzles(
  games: readonly PuzzleGameInput[],
  sources: PuzzleSources,
  motif?: Motif,
): Puzzle[] {
  const categories = categoriesFor(sources);
  return games.flatMap((game) =>
    game.stats.motifs
      .filter((m) => categories.has(m.category) && (!motif || m.motif === motif))
      .map((m) => ({
        id: `${game.id}:${m.ply}`,
        gameId: game.id,
        gameTitle: game.title,
        ply: m.ply,
        moveNumber: m.moveNumber,
        color: m.color,
        playedSan: m.san,
        category: m.category,
        motif: m.motif,
        winLoss: m.winLoss,
        sortKey: game.sortKey,
      })),
  );
}

export interface TrainingOverview {
  total: number;
  /** Fällige Wiederholungen (schon einmal geübt) */
  dueReviews: number;
  /** Noch nie geübt */
  fresh: number;
  /** Mindestens in Fach 3 (sicher gelernt) */
  learned: number;
}

export function overview(
  puzzles: readonly Puzzle[],
  states: Record<string, CardState>,
  now: Date,
): TrainingOverview {
  return {
    total: puzzles.length,
    dueReviews: puzzles.filter((p) => states[p.id] && isDue(states[p.id], now)).length,
    fresh: puzzles.filter((p) => !states[p.id]).length,
    learned: puzzles.filter((p) => (states[p.id]?.box ?? 0) >= 3).length,
  };
}

/** Höchstens so viele Aufgaben pro Sitzung */
export const SESSION_SIZE = 12;

/**
 * Reihenfolge einer Sitzung: zuerst fällige Wiederholungen (am längsten überfällig zuerst),
 * dann neue Aufgaben (schwerste Fehler der neuesten Partien zuerst).
 */
export function buildSession(
  puzzles: readonly Puzzle[],
  states: Record<string, CardState>,
  now: Date,
  size = SESSION_SIZE,
): Puzzle[] {
  const reviews = puzzles
    .filter((p) => states[p.id] && isDue(states[p.id], now))
    .sort((a, b) => (states[a.id]?.due ?? '').localeCompare(states[b.id]?.due ?? ''));
  const fresh = puzzles
    .filter((p) => !states[p.id])
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.winLoss - a.winLoss);
  return [...reviews, ...fresh].slice(0, size);
}
