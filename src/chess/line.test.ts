import { sideToMove, terminalState, uciLineToSan } from './line';
import { FEN_AFTER_QB8 } from '../test/fixtures';

const BEFORE_QB8 = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';

describe('uciLineToSan', () => {
  it('wandelt die Mattführung um', () => {
    expect(uciLineToSan(BEFORE_QB8, ['b3b8', 'd7b8', 'd1d8'])).toEqual(['Qb8+', 'Nxb8', 'Rd8#']);
  });

  it('begrenzt die Länge', () => {
    expect(uciLineToSan(BEFORE_QB8, ['b3b8', 'd7b8', 'd1d8'], 2)).toEqual(['Qb8+', 'Nxb8']);
  });

  it('bricht bei einem ungültigen Zug ab', () => {
    expect(uciLineToSan(BEFORE_QB8, ['b3b8', 'e1e2', 'd1d8'])).toEqual(['Qb8+']);
  });

  it('kennt Umwandlungen', () => {
    expect(uciLineToSan('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', ['e7e8q'])).toEqual(['e8=Q']);
  });
});

describe('terminalState und sideToMove', () => {
  it('erkennt Matt mit Gewinner', () => {
    expect(terminalState('3Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17')).toEqual({
      kind: 'checkmate',
      winner: 'w',
    });
  });
  it('erkennt Patt und normale Stellungen', () => {
    expect(terminalState('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({ kind: 'stalemate' });
    expect(terminalState(FEN_AFTER_QB8)).toBeNull();
  });
  it('liest das Zugrecht', () => {
    expect(sideToMove(FEN_AFTER_QB8)).toBe('b');
    expect(sideToMove(BEFORE_QB8)).toBe('w');
  });
});
