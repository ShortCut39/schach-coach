import { terminalState } from '../chess/line';
import type { EvalCache } from './cache';
import type { SearchResult } from './engine';
import type { PositionEval, SearchSettings } from './types';

/** Was die Warteschlange von der Engine braucht (erleichtert Tests). */
export interface SearchEngine {
  search(
    fen: string,
    settings: SearchSettings,
    onDepth?: (depth: number) => void,
  ): Promise<SearchResult>;
  stop(): void;
}

export interface QueueProgress {
  /** Fertig bewertete Stellungen */
  done: number;
  total: number;
  /** Index der Stellung, die gerade gerechnet wird */
  current: number | null;
  /** Erreichte Tiefe in der aktuellen Stellung */
  depth: number | null;
}

export interface QueueCallbacks {
  onPosition: (index: number, evaluation: PositionEval) => void;
  onProgress: (progress: QueueProgress) => void;
}

/**
 * Bewertet Stellungen. Mit mehreren Engines rechnen diese parallel: Jede holt sich die nächste
 * offene Stellung aus einer gemeinsamen Warteschlange (Ergebnisse kommen daher nicht in
 * Reihenfolge). Bereits bekannte Stellungen kommen aus dem Cache, Matt/Patt wird ohne Engine
 * erkannt. Abbrechen über `signal` stoppt alle Engines.
 *
 * @returns `'done'` oder `'aborted'`
 */
export async function analysePositions(
  engines: SearchEngine | readonly SearchEngine[],
  cache: EvalCache,
  fens: readonly string[],
  settings: SearchSettings,
  callbacks: QueueCallbacks,
  signal: AbortSignal,
): Promise<'done' | 'aborted'> {
  const pool = Array.isArray(engines) ? engines : [engines as SearchEngine];
  const total = fens.length;
  let done = 0;
  let next = 0;
  let aborted = false;
  const onAbort = () => pool.forEach((engine) => engine.stop());
  signal.addEventListener('abort', onAbort);

  async function worker(engine: SearchEngine): Promise<void> {
    while (!aborted && !signal.aborted && next < total) {
      const index = next++;
      const fen = fens[index];
      if (fen === undefined) return;
      let evaluation = cache.get(fen, settings);
      if (!evaluation) {
        const terminal = terminalState(fen);
        if (terminal) {
          evaluation = { fen, ...settings, lines: [], terminal };
        } else {
          callbacks.onProgress({ done, total, current: index, depth: null });
          const result = await engine.search(fen, settings, (depth) =>
            callbacks.onProgress({ done, total, current: index, depth }),
          );
          if (result.aborted || signal.aborted) {
            aborted = true;
            return;
          }
          evaluation = { fen, ...settings, lines: result.lines };
        }
        cache.set(evaluation);
      }
      done++;
      callbacks.onPosition(index, evaluation);
      callbacks.onProgress({ done, total, current: null, depth: null });
    }
  }

  try {
    await Promise.all(pool.map(worker));
    return aborted || signal.aborted ? 'aborted' : 'done';
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
