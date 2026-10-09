import { parsePgnGame } from '../chess/pgn';
import { operaGame } from '../test/fixtures';
import { epdOf, loadOpeningBook, openingInfo } from './openingBook';

describe('Eröffnungsbuch', () => {
  it('schneidet die Zähler aus der FEN', () => {
    expect(epdOf('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    );
  });

  it('erkennt die Philidor-Verteidigung und 5 Theorie-Halbzüge in der Beispielpartie', async () => {
    const book = await loadOpeningBook();
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('Fixture ungültig');
    expect(openingInfo(parsed.value, book)).toEqual({
      eco: 'C41',
      name: 'Philidor Defense',
      bookPlies: 5, // 1. e4 e5 2. Sf3 d6 3. d4 – 3… Lg4 steht nicht im Buch
    });
  });

  it('zählt nur, solange die Partie ununterbrochen im Buch bleibt', async () => {
    const book = await loadOpeningBook();
    // 1. a3 steht im Buch (Anderssen-Eröffnung), 1… h5 2. h4 danach nicht mehr
    const parsed = parsePgnGame('1. a3 h5 2. h4 *');
    if (!parsed.ok) throw new Error('ungültig');
    expect(openingInfo(parsed.value, book)?.bookPlies).toBe(1);
  });

  it('liefert nichts, wenn schon der erste Zug nicht im Buch steht', async () => {
    const book = await loadOpeningBook();
    const parsed = parsePgnGame('[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. Kd2 *');
    if (!parsed.ok) throw new Error('ungültig');
    expect(openingInfo(parsed.value, book)).toBeUndefined();
  });
});
