// @vitest-environment node
/// <reference types="node" />
/**
 * Integrationstest mit der nativen Stockfish-Engine (Sidecar-Binary). Wird übersprungen, wenn
 * die Binary fehlt (`pnpm fetch:engine` lädt sie).
 */
import { existsSync } from 'node:fs';
import { parsePgnGame } from '../chess/pgn';
import { classifyGame } from '../classification/classify';
import { loadOpeningBook, openingInfo } from '../classification/openingBook';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import { NATIVE_ENGINE, processTransport } from '../test/processEngine';
import { operaGame } from '../test/fixtures';
import { EvalCache } from './cache';
import { UciEngine } from './engine';
import { analysePositions } from './queue';
import type { PositionEval } from './types';

describe.skipIf(!existsSync(NATIVE_ENGINE))('native Stockfish-Engine', () => {
  const engines: UciEngine[] = [];
  beforeAll(async () => {
    for (let i = 0; i < 4; i++) {
      const engine = new UciEngine(processTransport(true));
      await engine.init(undefined, { hashMb: 64 });
      engines.push(engine);
    }
  });
  afterAll(() => engines.forEach((e) => e.dispose()));

  it('meldet sich als Stockfish 19 (nicht Lite)', () => {
    expect(engines[0]?.name).toBe('Stockfish 19');
  });

  it('bewertet die Beispielpartie mit 4 parallelen Engines und erkennt 16. Db8+ als Brillant', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    const game = parsed.value;
    const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
    const evals: PositionEval[] = [];
    const started = Date.now();
    const outcome = await analysePositions(
      engines,
      new EvalCache(),
      fens,
      { depth: Number(process.env.NATIVE_DEPTH ?? 16), multipv: 3 },
      { onPosition: (i, e) => (evals[i] = e), onProgress: () => {} },
      new AbortController().signal,
    );
    const seconds = (Date.now() - started) / 1000;
    expect(outcome).toBe('done');
    expect(evals.filter(Boolean)).toHaveLength(34);

    const opening = openingInfo(game, await loadOpeningBook());
    const analyses = classifyGame(game, evals, opening?.bookPlies ?? 0, DEFAULT_CLASSIFICATION);
    expect(analyses[30]?.category).toBe('brilliant');
    if (process.env.SHOW_TIMING)
      process.stdout.write(
        `Native Engine, 4 parallel, Tiefe ${process.env.NATIVE_DEPTH ?? 16}: ${seconds.toFixed(1)} s\n`,
      );
  }, 180_000);
});
