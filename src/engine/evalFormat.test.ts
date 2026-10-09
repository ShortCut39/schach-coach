import { formatLineEval, formatPositionEval } from './evalFormat';

describe('formatLineEval', () => {
  it.each([
    [{ cp: 30 }, '+0.3'],
    [{ cp: -120 }, '-1.2'],
    [{ cp: 1000 }, '+10.0'],
    [{ cp: 0 }, '0.0'],
    [{ cp: 4 }, '0.0'],
    [{ cp: -4 }, '0.0'],
    [{ mate: 2 }, 'M2'],
    [{ mate: -3 }, '-M3'],
  ])('%j → %s', (line, expected) => {
    expect(formatLineEval(line)).toBe(expected);
  });
});

describe('formatPositionEval', () => {
  const base = { fen: 'x', depth: 20, multipv: 3 };
  it('zeigt Matt auf dem Brett als #, Patt als 0.0', () => {
    expect(
      formatPositionEval({ ...base, lines: [], terminal: { kind: 'checkmate', winner: 'w' } }),
    ).toBe('#');
    expect(formatPositionEval({ ...base, lines: [], terminal: { kind: 'stalemate' } })).toBe('0.0');
  });
  it('nimmt sonst die beste Linie', () => {
    expect(
      formatPositionEval({ ...base, lines: [{ multipv: 1, mate: 2, pv: ['b3b8'], depth: 20 }] }),
    ).toBe('M2');
    expect(formatPositionEval(undefined)).toBeUndefined();
  });
});
