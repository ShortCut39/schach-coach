import type { PlyBase } from '../chess/types';
import type { EngineLine, PositionEval } from '../engine/types';
import { classifyPly } from './classify';
import { DEFAULT_CLASSIFICATION as config, type PlyAnalysis } from './types';
import { winChanceFromCp } from './winChance';

/** Feste Testsituationen mit konstruierten Bewertungen (keine echten Engine-Daten). */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BEFORE_QB8 = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';
const AFTER_QB8 = '1Q2kb1r/p2n1ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 b k - 1 16';

function ply(partial: Partial<PlyBase> & Pick<PlyBase, 'uci'>): PlyBase {
  return {
    index: 0,
    moveNumber: 1,
    color: 'w',
    san: '?',
    from: partial.uci.slice(0, 2),
    to: partial.uci.slice(2, 4),
    fenBefore: START,
    fenAfter: START,
    flags: {
      check: false,
      mate: false,
      capture: false,
      castle: false,
      promotion: false,
      enPassant: false,
    },
    ...partial,
  };
}

function line(multipv: number, score: { cp: number } | { mate: number }, pv: string[]): EngineLine {
  return { multipv, depth: 20, pv, ...score };
}

function evalOf(fen: string, ...lines: EngineLine[]): PositionEval {
  return { fen, depth: 20, multipv: 3, lines };
}

/** cp-Wert, bei dem Weiß die gewünschte Gewinnchance hat */
function cpFor(win: number): number {
  return Math.log(100 / win - 1) / -0.00368208;
}

const e4 = ply({ uci: 'e2e4' });
function classify(
  before: PositionEval,
  after: PositionEval,
  p: PlyBase = e4,
  previous?: PlyAnalysis,
  inBook = false,
) {
  return classifyPly(p, before, after, previous, inBook, config);
}

describe('classifyPly – Grundkategorien nach Verlust an Gewinnchance', () => {
  const before = evalOf(START, line(1, { cp: 30 }, ['d2d4']), line(2, { cp: 25 }, ['e2e4']));
  const winBefore = winChanceFromCp(30);
  const afterWithLoss = (loss: number) =>
    evalOf(START, line(1, { cp: cpFor(winBefore - loss) }, ['e7e5']));

  it.each([
    [1.5, 'excellent'],
    [2, 'excellent'],
    [4.9, 'good'],
    [5, 'inaccuracy'],
    [9.9, 'inaccuracy'],
    [10, 'mistake'],
    [19.9, 'mistake'],
    [20, 'blunder'],
    [45, 'blunder'],
  ])('Verlust %f → %s', (loss, expected) => {
    const result = classify(before, afterWithLoss(loss));
    expect(result?.category).toBe(expected);
    expect(result?.winLoss).toBeCloseTo(loss, 6);
  });

  it('Bester Zug = Engine-Zug 1', () => {
    const result = classify(before, afterWithLoss(0.5), ply({ uci: 'd2d4' }));
    expect(result?.category).toBe('best');
    expect(result?.bestMove).toBe('d2d4');
  });

  it('Theorie geht vor allem anderen', () => {
    expect(classify(before, afterWithLoss(15), e4, undefined, true)?.category).toBe('book');
  });

  it('rechnet für Schwarz aus Schwarz-Sicht', () => {
    const blackPly = ply({ uci: 'e7e5', color: 'b' });
    const b = evalOf(START, line(1, { cp: 30 }, ['c7c5'])); // Weiß +0.3 → Schwarz ≈ 47
    const a = evalOf(START, line(1, { cp: 250 }, ['g1f3'])); // Weiß +2.5 → Schwarz deutlich schlechter
    const result = classify(b, a, blackPly);
    expect(result?.winBefore).toBeCloseTo(100 - winChanceFromCp(30), 6);
    expect(result?.category).toBe('mistake');
  });

  it('Genauigkeit sinkt mit dem Verlust', () => {
    const good = classify(before, afterWithLoss(0))?.accuracy ?? 0;
    const bad = classify(before, afterWithLoss(30))?.accuracy ?? 100;
    expect(good).toBeCloseTo(100, 0);
    expect(bad).toBeLessThan(30);
  });
});

describe('classifyPly – Großartig', () => {
  it('einziger guter Zug in offener Stellung', () => {
    const before = evalOf(START, line(1, { cp: 50 }, ['e2e4']), line(2, { cp: -150 }, ['d2d4']));
    const after = evalOf(START, line(1, { cp: 45 }, ['e7e5']));
    expect(classify(before, after)?.category).toBe('great');
  });

  it('nicht, wenn die Stellung schon entschieden ist', () => {
    const before = evalOf(START, line(1, { cp: 900 }, ['e2e4']), line(2, { cp: 500 }, ['d2d4']));
    const after = evalOf(START, line(1, { cp: 890 }, ['e7e5']));
    expect(classify(before, after)?.category).toBe('best');
  });

  it('nicht, wenn der gespielte Zug selbst nur eine schlechtere Linie ist', () => {
    const before = evalOf(
      START,
      line(1, { cp: 60 }, ['d2d4']),
      line(2, { cp: -200 }, ['g1f3']),
      line(3, { cp: 58 }, ['e2e4']),
    );
    const after = evalOf(START, line(1, { cp: 55 }, ['e7e5']));
    // e4 ist fast so gut wie d4 (Ausgezeichnet), aber nicht deutlich besser als die Alternative d4
    expect(classify(before, after)?.category).toBe('excellent');
  });

  it('nicht ohne zweite Linie (nur ein legaler Zug)', () => {
    const before = evalOf(START, line(1, { cp: 50 }, ['e2e4']));
    const after = evalOf(START, line(1, { cp: 50 }, ['e7e5']));
    expect(classify(before, after)?.category).toBe('best');
  });
});

describe('classifyPly – Verpasst', () => {
  const opponentBlunder: PlyAnalysis = {
    category: 'blunder',
    winBefore: 50,
    winAfter: 15,
    winLoss: 35,
    accuracy: 20,
    isSacrifice: false,
    bestMove: undefined,
  };
  const before = evalOf(START, line(1, { cp: 700 }, ['d2d4']), line(2, { cp: 200 }, ['g1f3']));
  const after = evalOf(START, line(1, { cp: 100 }, ['e7e5']));

  it('Gegner patzt, du nutzt es nicht', () => {
    expect(classify(before, after, e4, opponentBlunder)?.category).toBe('miss');
  });

  it('ohne vorherigen Patzer ist es ein normaler Fehler', () => {
    expect(classify(before, after, e4)?.category).toBe('blunder');
  });
});

describe('classifyPly – Brillant', () => {
  const qb8 = ply({ uci: 'b3b8', fenBefore: BEFORE_QB8, fenAfter: AFTER_QB8, moveNumber: 16 });
  const afterQb8 = evalOf(AFTER_QB8, line(1, { mate: 1 }, ['d7b8', 'd1d8']));

  it('16. Db8+: Damenopfer mit Matt, obwohl Weiß schon gewinnt (Ausnahme der Heuristik)', () => {
    const before = evalOf(
      BEFORE_QB8,
      line(1, { mate: 2 }, ['b3b8', 'd7b8', 'd1d8']),
      line(2, { cp: 460 }, ['b3c3']),
    );
    const result = classify(before, afterQb8, qb8);
    expect(result?.isSacrifice).toBe(true);
    expect(result?.category).toBe('brilliant');
  });

  it('kein Brillant, wenn auch der zweitbeste Zug matt setzt', () => {
    const before = evalOf(
      BEFORE_QB8,
      line(1, { mate: 2 }, ['b3b8', 'd7b8', 'd1d8']),
      line(2, { mate: 3 }, ['b3c3']),
    );
    expect(classify(before, afterQb8, qb8)?.category).toBe('best');
  });

  it('Opfer in offener Stellung ohne Matt ist brillant', () => {
    const before = evalOf(
      BEFORE_QB8,
      line(1, { cp: 150 }, ['b3b8']),
      line(2, { cp: 100 }, ['b3c3']),
    );
    const after = evalOf(AFTER_QB8, line(1, { cp: 140 }, ['d7b8', 'd1d8']));
    expect(classify(before, after, qb8)?.category).toBe('brilliant');
  });

  it('Opfer, nach dem man schlechter steht, ist nicht brillant', () => {
    const before = evalOf(
      BEFORE_QB8,
      line(1, { cp: -50 }, ['b3b8']),
      line(2, { cp: -60 }, ['b3c3']),
    );
    const after = evalOf(AFTER_QB8, line(1, { cp: -60 }, ['d7b8', 'd1d8']));
    expect(classify(before, after, qb8)?.category).toBe('best');
  });
});
