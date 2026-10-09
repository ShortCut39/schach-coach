import { parsePgnGame } from '../chess/pgn';
import type { Category, PlyAnalysis } from './types';
import { unnoticedGoodMoves } from './unnoticed';

const game = (() => {
  const parsed = parsePgnGame('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O *');
  if (!parsed.ok) throw new Error('ungültig');
  return parsed.value;
})();

function a(category: Category, winLoss = 0): PlyAnalysis {
  return {
    category,
    winLoss,
    winBefore: 50,
    winAfter: 50,
    accuracy: 90,
    isSacrifice: false,
    bestMove: undefined,
  };
}

describe('unnoticedGoodMoves', () => {
  it('markiert einen Großartig-Zug, nach dem innerhalb von 2 eigenen Zügen ein Verlust ≥ 5 folgt', () => {
    // Weiß: Halbzüge 0, 2, 4, 6, 8
    const analyses = [a('great'), a('best'), a('good', 3), a('best'), a('inaccuracy', 6)];
    expect([...unnoticedGoodMoves(game, analyses)]).toEqual([0]);
  });

  it('markiert nicht, wenn der Verlust erst später kommt oder klein bleibt', () => {
    const late = [
      a('brilliant'),
      a('best'),
      a('good', 4),
      a('best'),
      a('good', 4),
      a('best'),
      a('mistake', 12),
    ];
    expect(unnoticedGoodMoves(game, late).size).toBe(0);
  });

  it('beachtet nur Züge desselben Spielers', () => {
    const analyses = [a('great'), a('blunder', 30), a('best'), a('blunder', 30), a('best')];
    expect(unnoticedGoodMoves(game, analyses).size).toBe(0);
  });
});
