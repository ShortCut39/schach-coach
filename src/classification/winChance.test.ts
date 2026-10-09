import { positionWhiteWinChance, whiteWinChance, winChanceFromCp } from './winChance';

describe('Gewinnchance', () => {
  it('ist 50 bei ausgeglichener Stellung und symmetrisch', () => {
    expect(winChanceFromCp(0)).toBe(50);
    expect(winChanceFromCp(300) + winChanceFromCp(-300)).toBeCloseTo(100, 10);
  });

  it('entspricht der Formel aus dem Projektdokument', () => {
    // win(100) = 50 + 50 * (2 / (1 + e^-0.368208) - 1) ≈ 59.10
    expect(winChanceFromCp(100)).toBeCloseTo(59.1, 1);
    expect(winChanceFromCp(1000)).toBeGreaterThan(95);
  });

  it('wertet Matt als 100 bzw. 0', () => {
    expect(whiteWinChance({ mate: 3 })).toBe(100);
    expect(whiteWinChance({ mate: -1 })).toBe(0);
  });

  it('kennt Matt und Patt auf dem Brett', () => {
    const base = { fen: 'x', depth: 1, multipv: 1, lines: [] };
    expect(positionWhiteWinChance({ ...base, terminal: { kind: 'checkmate', winner: 'b' } })).toBe(
      0,
    );
    expect(positionWhiteWinChance({ ...base, terminal: { kind: 'stalemate' } })).toBe(50);
    expect(positionWhiteWinChance(base)).toBeUndefined();
    expect(positionWhiteWinChance(undefined)).toBeUndefined();
  });
});
