import { parsePgnGame } from '../chess/pgn';
import type { PositionEval } from '../engine/types';
import evalFixture from '../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../test/fixtures';
import { classifyGame } from './classify';
import { turningPoints } from './turningPoints';
import { DEFAULT_CLASSIFICATION } from './types';

describe('turningPoints', () => {
  it('findet in der Beispielpartie Db3, b5, Sxb5 und Db8+ (chronologisch)', () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    const analyses = classifyGame(
      parsed.value,
      evalFixture.evals as PositionEval[],
      5,
      DEFAULT_CLASSIFICATION,
    );
    const points = turningPoints(parsed.value, analyses);
    const sans = points.map((i) => parsed.value.plies[i]?.san);
    expect(sans).toEqual(expect.arrayContaining(['Qb3', 'b5', 'Nxb5', 'Qb8+']));
    expect(points).toEqual([...points].sort((a, b) => a - b));
    expect(points.length).toBeLessThanOrEqual(6);
  });
});
