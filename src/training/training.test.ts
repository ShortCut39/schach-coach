import type { GameStats, MotifExample } from '../classification/gameStats';
import { buildSession, collectPuzzles, overview, type PuzzleGameInput } from './puzzles';
import { isDue, nextState } from './srs';

const now = new Date('2026-10-10T12:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('Wiederholung (Leitner)', () => {
  it('schiebt richtige Antworten ein Fach weiter und plant sie später ein', () => {
    const first = nextState(undefined, 'correct', now);
    expect(first).toMatchObject({ box: 1, due: days(1), attempts: 1, correct: 1 });
    const second = nextState(first, 'correct', now);
    expect(second).toMatchObject({ box: 2, due: days(3) });
    let state = second;
    for (let i = 0; i < 5; i++) state = nextState(state, 'correct', now);
    expect(state.box).toBe(5);
    expect(state.due).toBe(days(30));
  });

  it('setzt falsche Antworten zurück und macht sie sofort wieder fällig', () => {
    const learned = { box: 4, due: days(-1), attempts: 4, correct: 4 };
    const wrong = nextState(learned, 'wrong', now);
    expect(wrong).toMatchObject({ box: 0, attempts: 5, correct: 4 });
    expect(isDue(wrong, now)).toBe(true);
  });

  it('lässt das Fach bei Lösung mit Hilfe stehen (mindestens Fach 1)', () => {
    expect(nextState(undefined, 'correctWithHelp', now)).toMatchObject({ box: 1, due: days(1) });
    expect(
      nextState(
        { box: 3, due: now.toISOString(), attempts: 3, correct: 3 },
        'correctWithHelp',
        now,
      ),
    ).toMatchObject({
      box: 3,
      due: days(7),
    });
  });
});

function motif(
  ply: number,
  category: MotifExample['category'],
  motifName: MotifExample['motif'] = 'hangingPiece',
  winLoss = 20,
): MotifExample {
  return {
    motif: motifName,
    ply,
    moveNumber: 5,
    color: 'w',
    san: 'Qh5',
    category,
    phase: 'opening',
    winLoss,
  };
}
function game(id: string, sortKey: string, motifs: MotifExample[]): PuzzleGameInput {
  const stats: GameStats = {
    version: 1,
    motifs,
    errorsByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    movesByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    accuracyByPhase: { opening: null, middlegame: null, endgame: null },
    bookPlies: 0,
  };
  return { id, title: `Partie ${id}`, sortKey, stats };
}

describe('Aufgaben', () => {
  const games = [
    game('a', '2026-10-01', [
      motif(8, 'blunder'),
      motif(12, 'inaccuracy'),
      motif(20, 'miss', 'missedCapture'),
    ]),
    game('b', '2026-10-05', [
      motif(6, 'mistake', 'threatIgnored', 12),
      motif(10, 'blunder', 'hangingPiece', 40),
    ]),
  ];

  it('wählt die Fehlerarten laut Einstellungen und filtert nach Motiv', () => {
    const all = collectPuzzles(games, { blunders: true, missed: true, inaccuracies: false });
    expect(all.map((p) => p.id)).toEqual(['a:8', 'a:20', 'b:6', 'b:10']);
    expect(
      collectPuzzles(games, { blunders: false, missed: false, inaccuracies: true }).map(
        (p) => p.id,
      ),
    ).toEqual(['a:12']);
    expect(
      collectPuzzles(
        games,
        { blunders: true, missed: true, inaccuracies: true },
        'hangingPiece',
      ).map((p) => p.id),
    ).toEqual(['a:8', 'a:12', 'b:10']);
  });

  it('stellt Sitzungen zusammen: erst fällige Wiederholungen, dann neue (neueste, schwerste zuerst)', () => {
    const puzzles = collectPuzzles(games, { blunders: true, missed: true, inaccuracies: false });
    const states = {
      'a:8': { box: 1, due: days(-2), attempts: 1, correct: 1 },
      'a:20': { box: 2, due: days(2), attempts: 2, correct: 2 },
    };
    expect(buildSession(puzzles, states, now).map((p) => p.id)).toEqual(['a:8', 'b:10', 'b:6']);
    expect(overview(puzzles, states, now)).toEqual({
      total: 4,
      dueReviews: 1,
      fresh: 2,
      learned: 0,
    });
  });
});
