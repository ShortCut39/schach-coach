import { EvalCache } from './cache';
import type { SearchResult } from './engine';
import { analysePositions, type QueueProgress, type SearchEngine } from './queue';
import type { PositionEval } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const MATE = '3Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17';
const settings = { depth: 12, multipv: 2 };

class FakeEngine implements SearchEngine {
  calls: string[] = [];
  stopped = 0;
  /** Wird aufgerufen, bevor eine Suche antwortet (z. B. um abzubrechen) */
  beforeAnswer?: () => void;

  search(fen: string, _s: unknown, onDepth?: (depth: number) => void): Promise<SearchResult> {
    this.calls.push(fen);
    onDepth?.(6);
    this.beforeAnswer?.();
    const aborted = this.stopped > 0;
    return Promise.resolve({
      lines: [{ multipv: 1, cp: 25, pv: ['e2e4'], depth: 12 }],
      depth: 12,
      aborted,
    });
  }
  stop() {
    this.stopped++;
  }
}

function run(
  engine: SearchEngine,
  cache: EvalCache,
  fens: string[],
  signal = new AbortController().signal,
) {
  const positions: [number, PositionEval][] = [];
  const progress: QueueProgress[] = [];
  const promise = analysePositions(
    engine,
    cache,
    fens,
    settings,
    { onPosition: (i, e) => positions.push([i, e]), onProgress: (p) => progress.push(p) },
    signal,
  );
  return { promise, positions, progress };
}

describe('analysePositions', () => {
  it('bewertet alle Stellungen der Reihe nach und meldet Fortschritt', async () => {
    const engine = new FakeEngine();
    const { promise, positions, progress } = run(engine, new EvalCache(), [START, AFTER_E4]);
    expect(await promise).toBe('done');
    expect(engine.calls).toEqual([START, AFTER_E4]);
    expect(positions.map(([i]) => i)).toEqual([0, 1]);
    expect(progress).toContainEqual({ done: 0, total: 2, current: 0, depth: 6 });
    expect(progress.at(-1)).toEqual({ done: 2, total: 2, current: null, depth: null });
  });

  it('rechnet nichts doppelt (Cache nach fen, depth, multipv)', async () => {
    const engine = new FakeEngine();
    const cache = new EvalCache();
    await run(engine, cache, [START, AFTER_E4]).promise;
    await run(engine, cache, [START, AFTER_E4, START]).promise;
    expect(engine.calls).toEqual([START, AFTER_E4]);
    expect(cache.size).toBe(2);
  });

  it('erkennt Matt auf dem Brett ohne Engine', async () => {
    const engine = new FakeEngine();
    const { promise, positions } = run(engine, new EvalCache(), [MATE]);
    await promise;
    expect(engine.calls).toEqual([]);
    expect(positions[0]?.[1]).toMatchObject({
      lines: [],
      terminal: { kind: 'checkmate', winner: 'w' },
    });
  });

  it('bricht ab, stoppt die Engine und speichert die abgebrochene Stellung nicht', async () => {
    const engine = new FakeEngine();
    const cache = new EvalCache();
    const controller = new AbortController();
    engine.beforeAnswer = () => {
      if (engine.calls.length === 2) controller.abort();
    };
    const { promise, positions } = run(engine, cache, [START, AFTER_E4, START], controller.signal);
    expect(await promise).toBe('aborted');
    expect(engine.stopped).toBe(1);
    expect(positions.map(([i]) => i)).toEqual([0]);
    expect(cache.size).toBe(1);
  });
});
