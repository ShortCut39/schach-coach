import { resolveBoardMove, targetSquares } from './boardMoves';

const CASTLING = 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1';
const PROMO = '8/4P1k1/8/8/8/8/6K1/8 w - - 0 1';

describe('Züge auf dem Trainingsbrett', () => {
  it('erlaubt Rochade per Zielfeld oder König auf den Turm', () => {
    expect(resolveBoardMove(CASTLING, 'e1', 'g1')).toEqual({
      from: 'e1',
      to: 'g1',
      needsPromotion: false,
    });
    expect(resolveBoardMove(CASTLING, 'e1', 'h1')).toEqual({
      from: 'e1',
      to: 'g1',
      needsPromotion: false,
    });
    expect(resolveBoardMove(CASTLING, 'e1', 'a1')).toEqual({
      from: 'e1',
      to: 'c1',
      needsPromotion: false,
    });
    const black = CASTLING.replace(' w ', ' b ');
    expect(resolveBoardMove(black, 'e8', 'h8')?.to).toBe('g8');
  });

  it('lehnt Rochade ohne Rochaderecht und andere illegale Züge ab', () => {
    const noRights = CASTLING.replace('KQkq', 'kq');
    expect(resolveBoardMove(noRights, 'e1', 'h1')).toBeNull();
    expect(resolveBoardMove(noRights, 'e1', 'g1')).toBeNull();
    expect(resolveBoardMove(CASTLING, 'e1', 'e3')).toBeNull();
  });

  it('erkennt Umwandlungen und liefert die möglichen Zielfelder', () => {
    expect(resolveBoardMove(PROMO, 'e7', 'e8')).toEqual({
      from: 'e7',
      to: 'e8',
      needsPromotion: true,
    });
    expect(targetSquares(CASTLING, 'e1').sort()).toEqual(['c1', 'd1', 'e2', 'f1', 'g1']);
    expect(targetSquares(CASTLING, 'e4')).toEqual([]);
  });
});
