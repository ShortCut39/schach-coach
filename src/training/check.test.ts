import type { PositionEval } from '../engine/types';
import { checkMove, playMove } from './check';

// Weiß am Zug, Dame auf d1 kann den ungedeckten Turm auf d8 schlagen
const FEN = '3r2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1';
const before: PositionEval = {
  fen: FEN,
  depth: 18,
  multipv: 2,
  lines: [
    { multipv: 1, mate: 1, pv: ['d1d8'], depth: 18 },
    { multipv: 2, cp: 0, pv: ['g2g3', 'd8d1'], depth: 18 },
  ],
};
const evaluate = vi.fn(async (fen: string): Promise<PositionEval> => ({
  fen,
  depth: 18,
  multipv: 1,
  lines: [{ multipv: 1, cp: -900, pv: ['d8d1'], depth: 18 }],
}));
const base = {
  fen: FEN,
  before,
  played: { uci: 'g2g3', after: undefined },
  excellent: 2,
  evaluate,
};

describe('Zugprüfung im Training', () => {
  beforeEach(() => evaluate.mockClear());

  it('erkennt den Bestzug ohne neue Engine-Rechnung (hier sogar Matt)', async () => {
    const check = await checkMove({ ...base, move: 'd1d8' });
    expect(check).toMatchObject({ correct: true, isBest: true, winLoss: 0, source: 'stored' });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('bewertet gespeicherte zweitbeste Züge mit ihrem Verlust', async () => {
    const check = await checkMove({ ...base, move: 'g2g3' });
    expect(check.correct).toBe(false);
    expect(check.winLoss).toBe(50);
    expect(check.continuation).toEqual(['d8d1']);
  });

  it('lässt andere Züge von der Engine nachrechnen', async () => {
    const check = await checkMove({ ...base, move: 'd1e2' });
    expect(evaluate).toHaveBeenCalledWith(playMove(FEN, 'd1e2'));
    expect(check).toMatchObject({ correct: false, source: 'engine', continuation: ['d8d1'] });
  });

  it('zählt einen Zug mit kleinem Verlust (≤ 2 Prozentpunkte) als richtig', async () => {
    const equal: PositionEval = {
      ...before,
      lines: [{ multipv: 1, cp: 30, pv: ['g2g3'], depth: 18 }],
    };
    const near = vi.fn(async (fen: string): Promise<PositionEval> => ({
      fen,
      depth: 18,
      multipv: 1,
      lines: [{ multipv: 1, cp: 15, pv: ['g8f8'], depth: 18 }],
    }));
    const check = await checkMove({ ...base, before: equal, evaluate: near, move: 'h2h3' });
    expect(check.correct).toBe(true);
    expect(check.isBest).toBe(false);
  });

  it('weist unmögliche Züge ab', async () => {
    await expect(checkMove({ ...base, move: 'd1d7' })).resolves.toBeDefined();
    await expect(checkMove({ ...base, move: 'e1e2' })).rejects.toThrow('illegal');
  });
});
