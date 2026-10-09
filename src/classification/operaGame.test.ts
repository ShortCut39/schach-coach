import { parsePgnGame } from '../chess/pgn';
import type { PositionEval } from '../engine/types';
import evalFixture from '../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../test/fixtures';
import { playerAccuracy } from './accuracy';
import { classifyGame } from './classify';
import { loadOpeningBook, openingInfo } from './openingBook';
import { countCategories } from './stats';
import { DEFAULT_CLASSIFICATION } from './types';

/**
 * Soll-Test mit echten Stockfish-Bewertungen (Stockfish 19 Lite, Tiefe 20, Multi-PV 3),
 * erzeugt mit `GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools`.
 */
async function analyseOpera() {
  const parsed = parsePgnGame(operaGame);
  if (!parsed.ok) throw new Error('Fixture ungültig');
  const game = parsed.value;
  const book = await loadOpeningBook();
  const opening = openingInfo(game, book);
  const evals = evalFixture.evals as PositionEval[];
  const plies = classifyGame(game, evals, opening?.bookPlies ?? 0, DEFAULT_CLASSIFICATION);
  return { game, plies, opening };
}

describe('Beispielpartie mit echten Engine-Daten', () => {
  it('erkennt 16. Db8+ als Brillant (Soll-Test aus dem Projektdokument)', async () => {
    const { game, plies } = await analyseOpera();
    expect(game.plies[30]?.san).toBe('Qb8+');
    expect(plies[30]).toMatchObject({ category: 'brilliant', isSacrifice: true });
  });

  it('klassifiziert alle 33 Halbzüge', async () => {
    const { game, plies, opening } = await analyseOpera();
    expect(opening).toMatchObject({ eco: 'C41', bookPlies: 5 });
    expect(plies.every(Boolean)).toBe(true);
    const list = game.plies.map((p) => `${p.san} ${plies[p.index]?.category}`);
    expect(list).toMatchSnapshot();
    expect(countCategories(game, plies, 'w')).toMatchSnapshot();
    expect(playerAccuracy(game, plies, 'w').overall).toBeGreaterThan(
      playerAccuracy(game, plies, 'b').overall ?? 100,
    );
  });
});
