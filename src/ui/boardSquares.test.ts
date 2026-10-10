import { checkSquareStyles, layerSquareStyle, withCheckHighlight } from './boardSquares';

const CHECK = 'rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPPKPP/RNBQ1BNR w kq - 2 3';
const MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

describe('Schach-Hervorhebung auf dem Brett', () => {
  it('markiert nur das Königsfeld, bei Matt mit Ring', () => {
    expect(Object.keys(checkSquareStyles(CHECK))).toEqual(['f2']);
    expect(checkSquareStyles(MATE).e1?.boxShadow).toContain('var(--sc-check-ring)');
    expect(checkSquareStyles(CHECK).f2?.boxShadow).not.toContain('var(--sc-check-ring)');
    expect(checkSquareStyles('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toEqual({});
  });

  it('legt die Markierung über andere, ohne sie zu löschen', () => {
    const lastMove = { boxShadow: 'inset 0 0 0 999px var(--sc-last-move)' };
    const styles = withCheckHighlight(CHECK, { f2: lastMove, h4: lastMove });
    expect(styles.h4).toEqual(lastMove);
    expect(styles.f2?.boxShadow).toMatch(/var\(--sc-check\).*var\(--sc-last-move\)/);
    expect(styles.f2?.backgroundImage).toContain('var(--sc-check)');
  });

  it('verbindet Hintergrundbilder (z. B. Zielfeld-Punkt) in fester Reihenfolge', () => {
    expect(
      layerSquareStyle(
        { backgroundImage: 'a', color: 'red' },
        { backgroundImage: 'b', color: 'blue' },
      ),
    ).toEqual({ backgroundImage: 'a, b', color: 'red' });
  });
});
