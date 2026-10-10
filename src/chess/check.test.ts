import { getCheckSquare } from './check';

describe('getCheckSquare', () => {
  it('liefert nichts ohne Schach', () => {
    expect(getCheckSquare('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('findet den weißen König im Schach', () => {
    // 1. f3 e5 2. Kf2 Dh4+
    expect(getCheckSquare('rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPPKPP/RNBQ1BNR w kq - 2 3')).toEqual({
      square: 'f2',
      mate: false,
    });
  });

  it('findet den schwarzen König im Schach', () => {
    expect(getCheckSquare('4k3/8/8/8/8/8/8/4K2R b - - 0 1')).toBeNull();
    expect(getCheckSquare('4k3/8/8/8/8/8/8/R3K3 b - - 0 1')).toBeNull();
    expect(getCheckSquare('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1')).toEqual({
      square: 'e8',
      mate: false,
    });
  });

  it('erkennt Matt (Narrenmatt und 1. e4 f6 2. d4 g5 3. Dh5#)', () => {
    expect(getCheckSquare('rnbqkbnr/ppppp2p/5p2/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3')).toEqual(
      {
        square: 'e8',
        mate: true,
      },
    );
    expect(getCheckSquare('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toEqual(
      {
        square: 'e1',
        mate: true,
      },
    );
  });

  it('übersteht eine ungültige FEN', () => {
    expect(getCheckSquare('kein fen')).toBeNull();
  });
});
