import { parsePgnGame } from '../chess/pgn';
import { describeLine, describeUci, piecesInDanger } from './describe';

// Testpartie (nur Züge): 8… Dh4?? stellt die Dame dem Springer f3 hin
const moves =
  '1. e4 e5 2. Nf3 Bc5 3. Nc3 Nf6 4. Bb5 c6 5. Ba4 b5 6. Bb3 d5 7. exd5 Nxd5 8. Ne4 Qh4 *';
const game = (() => {
  const parsed = parsePgnGame(moves);
  if (!parsed.ok) throw new Error('ungültig');
  return parsed.value;
})();
const qh4 = game.plies[15]!;

describe('Beschreibungen in Worten', () => {
  it('beschreibt Züge und Varianten', () => {
    expect(describeUci(qh4.fenBefore, 'd8h4')).toBe('Dame d8 zieht nach h4');
    expect(describeLine(qh4.fenAfter, ['f3h4', 'd5f4'])).toEqual([
      'Weiß: Springer f3 schlägt Dame h4',
      'Schwarz: Springer d5 zieht nach f4',
    ]);
    expect(describeUci('4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16', 'b3b8')).toBe(
      'Dame b3 zieht nach b8, Schach',
    );
    expect(describeUci('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1')).toBe('kurze Rochade');
  });

  it('nennt Figuren in Gefahr: vor 8… Dh4 den Läufer c5, danach die Dame h4', () => {
    expect(piecesInDanger(qh4.fenBefore, 'b')).toEqual([
      'Läufer c5 (angegriffen von Springer e4, nicht gedeckt)',
    ]);
    expect(piecesInDanger(qh4.fenAfter, 'b')).toEqual([
      'Läufer c5 (angegriffen von Springer e4, nicht gedeckt)',
      'Dame h4 (angegriffen von Springer f3, nicht gedeckt)',
    ]);
  });

  it('meldet gedeckte Figuren nur, wenn eine billigere Figur angreift', () => {
    // Weißer Turm d4 gedeckt durch Bauer c3, angegriffen von Bauer e5 → in Gefahr
    const fen = '4k3/8/8/4p3/3R4/2P5/8/4K3 w - - 0 1';
    expect(piecesInDanger(fen, 'w')).toEqual([
      'Turm d4 (angegriffen von Bauer e5, gedeckt von Bauer c3)',
    ]);
    // Springer d4 gedeckt, angegriffen vom Turm → keine Gefahr
    expect(piecesInDanger('3rk3/8/8/8/3N4/2P5/8/4K3 w - - 0 1', 'w')).toEqual([]);
  });
});
