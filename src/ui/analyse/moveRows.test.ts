import { parsePgnGame } from '../../chess/pgn';
import { operaGame } from '../../test/fixtures';
import { buildRows } from './moveRows';

function plies(pgn: string) {
  const result = parsePgnGame(pgn);
  if (!result.ok) throw new Error('ungültig');
  return result.value.plies;
}

describe('buildRows', () => {
  it('baut 17 Zeilen für die Beispielpartie, die letzte nur mit Weiß', () => {
    const rows = buildRows(plies(operaGame));
    expect(rows).toHaveLength(17);
    expect(rows[15]).toMatchObject({
      moveNumber: 16,
      white: { san: 'Qb8+' },
      black: { san: 'Nxb8' },
    });
    expect(rows[16]?.white?.san).toBe('Rd8#');
    expect(rows[16]?.black).toBeUndefined();
  });

  it('lässt die erste Weiß-Zelle leer, wenn Schwarz beginnt', () => {
    const rows = buildRows(
      plies(
        '[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 Nc6 *',
      ),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.white).toBeUndefined();
    expect(rows[0]?.black?.san).toBe('e5');
    expect(rows[1]).toMatchObject({ white: { san: 'Nf3' }, black: { san: 'Nc6' } });
  });
});
