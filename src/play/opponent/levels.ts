import type { MoveLimits } from '../../engine/engine';
import type { EngineLine } from '../../engine/types';
import type { Color } from '../../chess/types';

/**
 * Stärkestufen des lokalen Gegners. Stockfish 19 kennt `UCI_LimitStrength` mit `UCI_Elo`
 * (frühestens 1320) und `Skill Level` 0–20. Unterhalb von etwa 1320 helfen nur `Skill Level`
 * und harte Tiefen- bzw. Zeitgrenzen. Die Stufen sind ungefähre Einordnungen, keine geprüften
 * Elo-Werte. Geprüft ist nur die Reihenfolge: In Partien der nativen Engine gegen sich selbst
 * (Oktober 2026) gewann die jeweils höhere Stufe die Mehrheit.
 */
export const LEVELS = ['beginner', 'easy', 'medium', 'strong', 'max'] as const;
export type Level = (typeof LEVELS)[number];

interface LevelConfig {
  /** UCI-Optionen beim Start der Partie */
  options: Record<string, string | number | boolean>;
  /** Feste Tiefe (schwache Stufen) */
  depth?: number;
  /** Höchste Bedenkzeit pro Zug in ms */
  maxMoveMs: number;
}

const FULL_STRENGTH = { UCI_LimitStrength: false, 'Skill Level': 20 };

export const LEVEL_CONFIG: Record<Level, LevelConfig> = {
  beginner: { options: { ...FULL_STRENGTH, 'Skill Level': 0 }, depth: 1, maxMoveMs: 200 },
  easy: { options: { ...FULL_STRENGTH, 'Skill Level': 1 }, depth: 2, maxMoveMs: 300 },
  medium: { options: { UCI_LimitStrength: true, UCI_Elo: 1500 }, maxMoveMs: 3_000 },
  strong: { options: { UCI_LimitStrength: true, UCI_Elo: 2000 }, maxMoveMs: 6_000 },
  max: { options: FULL_STRENGTH, maxMoveMs: 10_000 },
};

/** Bedenkzeit ohne Uhr */
const NO_CLOCK_MOVE_MS = 1_000;
const MIN_MOVE_MS = 50;

/**
 * Bedenkzeit des Gegners: Restzeit / 30 plus 80 % des Inkrements, gedeckelt durch die Stufe und
 * nie mehr als ein Drittel der Restzeit (damit er nicht auf Zeit verliert).
 */
export function moveTimeMs(level: Level, clock: { own: number; increment: number } | null): number {
  const cap = LEVEL_CONFIG[level].maxMoveMs;
  if (!clock) return Math.min(NO_CLOCK_MOVE_MS, cap);
  const planned = clock.own / 30 + 0.8 * clock.increment;
  return Math.round(Math.max(MIN_MOVE_MS, Math.min(planned, cap, clock.own / 3)));
}

export function moveLimits(level: Level, clock: { own: number; increment: number } | null) {
  const config = LEVEL_CONFIG[level];
  const limits: MoveLimits = { movetime: moveTimeMs(level, clock) };
  if (config.depth !== undefined) limits.depth = config.depth;
  return limits;
}

/** Bewertungsgrenze für die Remisannahme: höchstens so viel Vorteil (Bauerneinheiten × 100) */
export const DRAW_ACCEPT_MAX_CP = 30;
/** Tiefe der Prüfung eines Remisangebots */
export const DRAW_CHECK_DEPTH = 12;

/**
 * Nimmt der Gegner (Farbe `color`) ein Remis an? Ja, wenn seine eigene Bewertung höchstens
 * leicht positiv ist (≤ +0,30) und er kein Matt sieht. Steht er schlechter, nimmt er erst recht an.
 */
export function acceptsDrawFromEval(line: EngineLine | undefined, color: Color): boolean {
  if (!line) return true;
  const sign = color === 'w' ? 1 : -1;
  if (line.mate !== undefined) return sign * line.mate < 0;
  return sign * (line.cp ?? 0) <= DRAW_ACCEPT_MAX_CP;
}
