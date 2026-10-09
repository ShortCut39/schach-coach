import { moveAccuracy, phaseOf } from './accuracy';

describe('moveAccuracy', () => {
  it('folgt der Formel aus dem Projektdokument und bleibt in 0..100', () => {
    expect(moveAccuracy(0)).toBeCloseTo(99.9999, 3);
    expect(moveAccuracy(10)).toBeCloseTo(103.1668 * Math.exp(-0.4354) - 3.1669, 6);
    expect(moveAccuracy(100)).toBe(0);
    expect(moveAccuracy(-5)).toBe(100);
  });
});

describe('phaseOf', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const endgame = '8/5pk1/6p1/8/3R4/6P1/r4PK1/8 w - - 0 40';
  it('trennt Eröffnung, Mittelspiel und Endspiel', () => {
    expect(phaseOf(start, 1)).toBe('opening');
    expect(phaseOf(start, 10)).toBe('opening');
    expect(phaseOf(start, 11)).toBe('middlegame');
    expect(phaseOf(endgame, 40)).toBe('endgame');
    expect(phaseOf(endgame, 5)).toBe('endgame');
  });
});
