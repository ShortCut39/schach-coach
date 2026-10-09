import { Chess } from 'chess.js';
import { isSacrifice, materialBalance, pieceCount } from './material';

const BEFORE_QB8 = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';

describe('materialBalance', () => {
  it('ist 0 in der Ausgangsstellung', () => {
    expect(materialBalance(new Chess(), 'w')).toBe(0);
  });
  it('rechnet aus Sicht der angegebenen Farbe', () => {
    const chess = new Chess(BEFORE_QB8);
    // Weiß: D T L + 7 Bauern = 24; Schwarz: D T L S + 5 Bauern = 25
    expect(materialBalance(chess, 'w')).toBe(-1);
    expect(materialBalance(chess, 'b')).toBe(1);
  });
});

describe('isSacrifice', () => {
  it('erkennt das Damenopfer 16. Db8+ Sxb8 17. Td8#', () => {
    expect(isSacrifice(BEFORE_QB8, 'b3b8', ['d7b8', 'd1d8'], 3, 8)).toBe(true);
  });

  it('wertet einen normalen Abtausch nicht als Opfer', () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6: Läufer gegen Springer
    const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
    expect(isSacrifice(fen, 'b5c6', ['d7c6'], 3, 8)).toBe(false);
  });

  it('wertet sofort zurückgewonnenes Material nicht als Opfer', () => {
    // Weiß schlägt mit dem Läufer auf f7 (Schach), Kxf7, dann Sg5+ und Dxg4? – vereinfacht:
    // Dame gegen Dame: 1. Qxd8+ Kxd8 ist ein Tausch, kein Opfer
    const fen = 'rnbqkbnr/ppp2ppp/8/3pp3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3';
    expect(isSacrifice(fen, 'd4e5', ['d5e4', 'd1d8', 'e8d8'], 3, 8)).toBe(false);
  });

  it('Läuferopfer Lxh7+ (Figur gegen Bauer, netto −2) zählt erst ab Schwelle 2', () => {
    const fen = 'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8';
    expect(isSacrifice(fen, 'd3h7', ['g8h7', 'f3g5', 'h7g8'], 3, 8)).toBe(false);
    expect(isSacrifice(fen, 'd3h7', ['g8h7', 'f3g5', 'h7g8'], 2, 8)).toBe(true);
  });

  it('wertet einen Tausch an der Fenstergrenze nicht als Opfer (6. Lc4 der Beispielpartie)', () => {
    // Nach 6. Lc4: Df6 Db3 Sd7 Dxb7 Tb8 Da6 Dxa6 Lxa6 – Damentausch, das Zurückschlagen ist Halbzug 9
    const fen = 'rn1qkbnr/ppp2ppp/8/4p3/4P3/5Q2/PPP2PPP/RNB1KB1R w KQkq - 0 6';
    const pv = ['d8f6', 'f3b3', 'b8d7', 'b3b7', 'a8b8', 'b7a6', 'f6a6', 'c4a6', 'd7c5'];
    expect(isSacrifice(fen, 'f1c4', pv, 3, 8)).toBe(false);
  });

  it('ohne bekannte Antwort zählt der Verlust nur bei Partieende', () => {
    // Variante bricht nach Sxb8 ab (kein Matt): kein Opfer erkennbar
    expect(isSacrifice(BEFORE_QB8, 'b3b8', ['d7b8'], 3, 8)).toBe(false);
  });
});

describe('pieceCount', () => {
  it('zählt Figuren ohne Bauern und Könige', () => {
    expect(pieceCount(new Chess().fen())).toBe(14);
    expect(pieceCount(BEFORE_QB8)).toBe(7);
  });
});
