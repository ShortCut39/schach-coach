import type { GameStats, MotifExample } from './gameStats';
import type { Motif } from './motifs';
import { buildPatternReport, type PatternGame } from './patterns';

function example(motif: Motif, ply: number, winLoss: number): MotifExample {
  return {
    motif,
    ply,
    moveNumber: Math.floor(ply / 2) + 1,
    color: 'w',
    san: 'Qh5',
    category: 'blunder',
    phase: 'opening',
    winLoss,
  };
}
function stats(motifs: MotifExample[], partial: Partial<GameStats> = {}): GameStats {
  return {
    version: 1,
    motifs,
    errorsByPhase: { opening: motifs.length, middlegame: 0, endgame: 0 },
    movesByPhase: { opening: 10, middlegame: 10, endgame: 0 },
    accuracyByPhase: { opening: 70, middlegame: 85, endgame: null },
    bookPlies: 4,
    ...partial,
  };
}
function game(id: string, sortKey: string, partial: Partial<PatternGame> = {}): PatternGame {
  return {
    id,
    title: `Partie ${id}`,
    sortKey,
    userColor: 'w',
    outcome: 'win',
    accuracy: 80,
    opening: { name: 'Italian Game', eco: 'C50' },
    stats: stats([]),
    ...partial,
  };
}

describe('buildPatternReport', () => {
  const games = [
    game('a', '2026-10-01', {
      accuracy: 60,
      outcome: 'loss',
      stats: stats([example('hangingPiece', 9, 30), example('other', 13, 8)]),
    }),
    game('b', '2026-10-03', {
      accuracy: 70,
      stats: stats([example('hangingPiece', 11, 45), example('missedCapture', 15, 12)]),
    }),
    game('c', '2026-10-02', {
      accuracy: 90,
      userColor: 'b',
      opening: { name: 'Sicilian Defense', eco: 'B20' },
      stats: stats([example('hangingPiece', 7, 20)]),
    }),
  ];
  const report = buildPatternReport(games);

  it('zählt Motive, sortiert nach Häufigkeit, „Sonstiges“ zuletzt, Beispiele nach Schwere', () => {
    expect(report.totalErrors).toBe(5);
    expect(report.motifs.map((m) => [m.motif, m.count])).toEqual([
      ['hangingPiece', 3],
      ['missedCapture', 1],
      ['other', 1],
    ]);
    expect(report.motifs[0]?.share).toBeCloseTo(0.6);
    expect(report.motifs[0]?.examples.map((e) => e.gameId)).toEqual(['b', 'a', 'c']);
  });

  it('rechnet Phasen: Genauigkeit und Fehler pro 10 eigene Züge', () => {
    expect(report.phases.opening.accuracy).toBe(70);
    expect(report.phases.opening.errorsPer10).toBeCloseTo(5 / 3);
    expect(report.phases.opening.moves).toBe(30);
    expect(report.phases.endgame).toEqual({ accuracy: null, errorsPer10: null, moves: 0 });
  });

  it('ordnet die Zeitachse chronologisch', () => {
    expect(report.timeline.map((t) => t.gameId)).toEqual(['a', 'c', 'b']);
    expect(report.trend.recent).toBeCloseTo((60 + 90 + 70) / 3);
    expect(report.trend.earlier).toBeNull();
  });

  it('fasst Eröffnungen getrennt nach Farbe zusammen', () => {
    expect(report.openings).toEqual([
      expect.objectContaining({
        name: 'Italian Game',
        color: 'w',
        games: 2,
        wins: 1,
        losses: 1,
        accuracy: 65,
        bookMoves: 2,
      }),
      expect.objectContaining({ name: 'Sicilian Defense', color: 'b', games: 1 }),
    ]);
  });
});
