import type { PlyBase } from '../../chess/types';
import type { PlyAnalysis } from '../../classification/types';
import type { PositionEval } from '../../engine/types';
import { arrowsFor } from './arrows';

const ply = { uci: 'b3b8' } as PlyBase;
const analysis = (category: PlyAnalysis['category'], bestMove: string): PlyAnalysis => ({
  category,
  bestMove,
  winBefore: 0,
  winAfter: 0,
  winLoss: 0,
  accuracy: 100,
  isSacrifice: false,
});
const shown = (pv: string[]): PositionEval => ({
  fen: 'x',
  depth: 20,
  multipv: 1,
  lines: [{ multipv: 1, mate: 1, pv, depth: 20 }],
});

describe('arrowsFor', () => {
  it('Bestzug gespielt: gespielt, Antwort, Fortsetzung (wie im Mockup bei 16. Db8+)', () => {
    expect(arrowsFor(ply, analysis('brilliant', 'b3b8'), shown(['d7b8', 'd1d8']))).toEqual([
      { kind: 'played', from: 'b3', to: 'b8' },
      { kind: 'reply', from: 'd7', to: 'b8' },
      { kind: 'continuation', from: 'd1', to: 'd8' },
    ]);
  });

  it('anderer Zug als der Bestzug: zusätzlich der Bestzug, keine Fortsetzung', () => {
    expect(arrowsFor(ply, analysis('mistake', 'b3c3'), shown(['d7b8', 'd1d8']))).toEqual([
      { kind: 'played', from: 'b3', to: 'b8' },
      { kind: 'best', from: 'b3', to: 'c3' },
      { kind: 'reply', from: 'd7', to: 'b8' },
    ]);
  });

  it('bei Theorie kein Bestzug-Pfeil, bei Matt keine Antwort', () => {
    const mate: PositionEval = {
      fen: 'x',
      depth: 20,
      multipv: 1,
      lines: [],
      terminal: { kind: 'checkmate', winner: 'w' },
    };
    expect(arrowsFor(ply, analysis('book', 'e2e4'), mate)).toEqual([
      { kind: 'played', from: 'b3', to: 'b8' },
    ]);
  });

  it('ohne Zug: Bestzug der angezeigten Stellung', () => {
    expect(arrowsFor(undefined, undefined, shown(['e2e4']))).toEqual([
      { kind: 'best', from: 'e2', to: 'e4' },
    ]);
    expect(arrowsFor(undefined, undefined, undefined)).toEqual([]);
  });
});
