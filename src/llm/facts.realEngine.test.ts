// @vitest-environment node
/**
 * Fakten für 8… Dh4?? aus einer Testpartie mit echten Stockfish-Daten: Das LLM muss erfahren,
 * dass die Dame auf h4 ungedeckt vom Springer f3 geschlagen wird – in Worten, nicht nur als „Sxh4“.
 */
import { parsePgnGame } from '../chess/pgn';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { loadOpeningBook } from '../classification/openingBook';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import { EvalCache } from '../engine/cache';
import { UciEngine } from '../engine/engine';
import { analysePositions } from '../engine/queue';
import type { PositionEval } from '../engine/types';
import { processTransport } from '../test/processEngine';
import type { Category } from '../classification/types';
import { buildMoveFacts } from './facts';
import { batchMessages } from './prompts';

const moves =
  '1. e4 e5 2. Nf3 Bc5 3. Nc3 Nf6 4. Bb5 c6 5. Ba4 b5 6. Bb3 d5 7. exd5 Nxd5 8. Ne4 Qh4 *';
const labels = {
  category: new Proxy({}, { get: (_t, c) => String(c) }) as Record<Category, string>,
  color: { w: 'Weiß', b: 'Schwarz' } as const,
  unnoticed: '',
};

describe('Fakten mit echten Engine-Daten', () => {
  it('beschreiben 8… Dh4 konkret: Dame h4 hängt, Springer f3 schlägt sie', async () => {
    const parsed = parsePgnGame(moves);
    if (!parsed.ok) throw new Error('ungültig');
    const game = parsed.value;
    const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
    const engine = new UciEngine(processTransport());
    await engine.init();
    const evals: PositionEval[] = [];
    await analysePositions(
      engine,
      new EvalCache(),
      fens,
      { depth: 12, multipv: 3 },
      { onPosition: (i, e) => (evals[i] = e), onProgress: () => {} },
      new AbortController().signal,
    );
    engine.dispose();

    const analysis = computeGameAnalysis(
      game,
      evals,
      await loadOpeningBook(),
      DEFAULT_CLASSIFICATION,
    );
    const ply = game.plies[15]!;
    const facts = buildMoveFacts(
      ply,
      analysis.plies[15]!,
      evals[15]!,
      evals[16]!,
      'de',
      labels,
      'b',
    );

    expect(facts.wer).toBe('du');
    expect(facts.zug_in_worten).toBe('Dame d8 zieht nach h4');
    expect(facts.hauptvariante_in_worten[0]).toBe('Weiß: Springer f3 schlägt Dame h4');
    expect(facts.nach_dem_zug.figuren_des_ziehenden_in_gefahr).toContain(
      'Dame h4 (angegriffen von Springer f3, nicht gedeckt)',
    );
    expect(facts.vor_dem_zug.figuren_des_ziehenden_in_gefahr).toContain(
      'Läufer c5 (angegriffen von Springer e4, nicht gedeckt)',
    );
    expect(facts.material.nach_hauptvariante).toBeLessThanOrEqual(-6);
    // Eine eingestellte Dame ist kein Opfer
    expect(facts.flags.opfer).toBe(false);

    if (process.env.SHOW_PROMPT)
      process.stdout.write(`${batchMessages([facts], 'beginner', 'de')[1]?.content}\n`);
  }, 60_000);
});
