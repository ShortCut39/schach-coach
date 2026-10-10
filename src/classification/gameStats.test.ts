import { parsePgnGame } from '../chess/pgn';
import type { PositionEval } from '../engine/types';
import evalFixture from '../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../test/fixtures';
import { computeGameAnalysis } from './gameAnalysis';
import { computeGameStats } from './gameStats';
import { loadOpeningBook } from './openingBook';
import { DEFAULT_CLASSIFICATION } from './types';

describe('computeGameStats (echte Engine-Daten, Sicht von Schwarz)', () => {
  it('erfasst die Fehler von Schwarz mit Motiv und Phase', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    const evals = evalFixture.evals as PositionEval[];
    const analysis = computeGameAnalysis(
      parsed.value,
      evals,
      await loadOpeningBook(),
      DEFAULT_CLASSIFICATION,
    );
    const stats = computeGameStats(parsed.value, evals, analysis, 'b');

    expect(stats.motifs.map((m) => m.san)).toEqual(['Nf6', 'b5', 'cxb5']);
    expect(stats.motifs.every((m) => m.color === 'b')).toBe(true);
    expect(stats.errorsByPhase.opening + stats.errorsByPhase.middlegame).toBe(3);
    expect(stats.bookPlies).toBe(5);
    expect(
      stats.movesByPhase.opening + stats.movesByPhase.middlegame + stats.movesByPhase.endgame,
    ).toBe(16);
    if (process.env.SHOW_MOTIFS)
      process.stdout.write(
        `${JSON.stringify(stats.motifs.map((m) => [m.san, m.motif, m.category]))}\n`,
      );
  });
});
