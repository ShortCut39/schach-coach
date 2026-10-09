// @vitest-environment node
/// <reference types="node" />
/**
 * Integrationstest mit dem echten Stockfish (Lite, single-threaded) als Node-Kindprozess.
 * Prüft, dass Wrapper und Warteschlange mit der echten UCI-Ausgabe funktionieren.
 */
import { processTransport } from '../test/processEngine';
import { parsePgnGame } from '../chess/pgn';
import { operaGame } from '../test/fixtures';
import { EvalCache } from './cache';
import { UciEngine } from './engine';
import { analysePositions } from './queue';
import type { PositionEval } from './types';

describe('echter Stockfish', () => {
  let engine: UciEngine;
  beforeAll(async () => {
    engine = new UciEngine(processTransport());
    await engine.init();
  });
  afterAll(() => engine.dispose());

  it('meldet sich mit Namen', () => {
    expect(engine.name).toMatch(/^Stockfish/);
  });

  it('findet das Matt in 2 vor 16. Db8+ und bewertet die ganze Beispielpartie', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('Fixture ungültig');
    const game = parsed.value;
    const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
    const evals: PositionEval[] = [];

    await engine.newGame();
    const outcome = await analysePositions(
      engine,
      new EvalCache(),
      fens,
      { depth: 10, multipv: 3 },
      { onPosition: (i, e) => (evals[i] = e), onProgress: () => {} },
      new AbortController().signal,
    );

    expect(outcome).toBe('done');
    expect(evals).toHaveLength(34);
    // Stellung vor 16. Db8+ (Index 30): Weiß setzt in 2 matt, Bestzug Db8+
    expect(evals[30]?.lines[0]).toMatchObject({ mate: 2, pv: expect.arrayContaining(['b3b8']) });
    expect(evals[30]?.lines[0]?.pv[0]).toBe('b3b8');
    // Nach 16. Db8+ hat Schwarz nur einen Zug: nur eine Linie
    expect(evals[31]?.lines).toHaveLength(1);
    expect(evals[31]?.lines[0]?.mate).toBe(1);
    // Nach 17. Td8# ist die Partie zu Ende
    expect(evals[33]?.terminal).toEqual({ kind: 'checkmate', winner: 'w' });
  }, 60_000);

  it('beendet Mattstellungen auch bei Tiefe 20 schnell (früher Stopp)', async () => {
    const started = Date.now();
    const result = await engine.search('1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17', {
      depth: 20,
      multipv: 3,
    });
    expect(result.lines[0]).toMatchObject({ mate: 1, pv: ['d1d8'] });
    expect(result.aborted).toBe(false);
    // Ohne frühen Stopp dauert das über eine Minute
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);
});
