import type { Color } from '../chess/types';
import { PHASES, type Phase } from './accuracy';
import type { GameStats, MotifExample } from './gameStats';
import { MOTIFS, type Motif } from './motifs';

/** Ab so vielen analysierten Partien werden Muster angezeigt. */
export const MIN_PATTERN_GAMES = 3;
/** Für den Trend: die letzten N Partien gegen die davor */
export const TREND_WINDOW = 5;

/** Was die Auswertung pro Partie braucht (aus den Bibliotheks-Metadaten). */
export interface PatternGame {
  id: string;
  title: string;
  /** Sortierschlüssel für die Zeitachse (ISO-Datum oder Speicherzeitpunkt) */
  sortKey: string;
  userColor: Color;
  outcome: 'win' | 'loss' | 'draw' | 'open';
  accuracy: number | null;
  opening: { name: string; eco: string } | null;
  stats: GameStats;
}

export interface MotifSummary {
  motif: Motif;
  count: number;
  /** Anteil an allen eigenen Fehlern, 0..1 */
  share: number;
  /** Gravierendste zuerst */
  examples: (MotifExample & { gameId: string; title: string })[];
}

export interface OpeningSummary {
  key: string;
  name: string;
  eco: string;
  color: Color;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  accuracy: number | null;
  /** Durchschnittliche Theorie-Länge in vollen Zügen */
  bookMoves: number;
}

export interface PatternReport {
  games: number;
  totalErrors: number;
  motifs: MotifSummary[];
  phases: Record<Phase, { accuracy: number | null; errorsPer10: number | null; moves: number }>;
  timeline: { gameId: string; title: string; sortKey: string; accuracy: number }[];
  trend: { recent: number | null; earlier: number | null };
  openings: OpeningSummary[];
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function buildPatternReport(games: readonly PatternGame[]): PatternReport {
  const examples = games.flatMap((g) =>
    g.stats.motifs.map((m) => ({ ...m, gameId: g.id, title: g.title })),
  );
  const totalErrors = examples.length;
  const motifs = MOTIFS.map((motif) => {
    const list = examples.filter((e) => e.motif === motif).sort((a, b) => b.winLoss - a.winLoss);
    return {
      motif,
      count: list.length,
      share: totalErrors ? list.length / totalErrors : 0,
      examples: list,
    };
  })
    .filter((m) => m.count > 0)
    // „Sonstiges“ immer zuletzt, sonst nach Häufigkeit
    .sort((a, b) => Number(a.motif === 'other') - Number(b.motif === 'other') || b.count - a.count);

  const phases = Object.fromEntries(
    PHASES.map((phase) => {
      const moves = games.reduce((sum, g) => sum + g.stats.movesByPhase[phase], 0);
      const errors = games.reduce((sum, g) => sum + g.stats.errorsByPhase[phase], 0);
      const accuracy = average(
        games.flatMap((g) =>
          g.stats.accuracyByPhase[phase] === null ? [] : [g.stats.accuracyByPhase[phase] as number],
        ),
      );
      return [phase, { accuracy, errorsPer10: moves ? (errors / moves) * 10 : null, moves }];
    }),
  ) as PatternReport['phases'];

  const timeline = games
    .flatMap((g) =>
      g.accuracy === null
        ? []
        : [{ gameId: g.id, title: g.title, sortKey: g.sortKey, accuracy: g.accuracy }],
    )
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const recent = timeline.slice(-TREND_WINDOW).map((t) => t.accuracy);
  const earlier = timeline.slice(0, -TREND_WINDOW).map((t) => t.accuracy);

  const openingMap = new Map<
    string,
    { opening: { name: string; eco: string }; color: Color; list: PatternGame[] }
  >();
  for (const game of games) {
    if (!game.opening) continue;
    const key = `${game.userColor}|${game.opening.eco}|${game.opening.name}`;
    const group = openingMap.get(key) ?? { opening: game.opening, color: game.userColor, list: [] };
    group.list.push(game);
    openingMap.set(key, group);
  }
  const openings = [...openingMap.entries()]
    .map(([key, { opening, color, list }]) => {
      return {
        key,
        name: opening.name,
        eco: opening.eco,
        color,
        games: list.length,
        wins: list.filter((g) => g.outcome === 'win').length,
        draws: list.filter((g) => g.outcome === 'draw').length,
        losses: list.filter((g) => g.outcome === 'loss').length,
        accuracy: average(list.flatMap((g) => (g.accuracy === null ? [] : [g.accuracy]))),
        bookMoves: Math.round(((average(list.map((g) => g.stats.bookPlies)) ?? 0) / 2) * 10) / 10,
      };
    })
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

  return {
    games: games.length,
    totalErrors,
    motifs,
    phases,
    timeline,
    trend: { recent: average(recent), earlier: average(earlier) },
    openings,
  };
}
