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
 * Bewertet Stellungen der Reihe nach. Bereits bekannte Stellungen kommen aus dem Cache,
 * Matt/Patt wird ohne Engine erkannt. Abbrechen über `signal`.
 *
 * @returns `'done'` oder `'aborted'`
 */
export async function analysePositions(
  engine: SearchEngine,
  cache: EvalCache,
  fens: readonly string[],
  settings: SearchSettings,
  callbacks: QueueCallbacks,
  signal: AbortSignal,
): Promise<'done' | 'aborted'> {
  const total = fens.length;
  let done = 0;
  const onAbort = () => engine.stop();
  signal.addEventListener('abort', onAbort);

  try {
    for (const [index, fen] of fens.entries()) {
      if (signal.aborted) return 'aborted';

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
          if (result.aborted || signal.aborted) return 'aborted';
          evaluation = { fen, ...settings, lines: result.lines };
        }
        cache.set(evaluation);
      }

      done++;
      callbacks.onPosition(index, evaluation);
      callbacks.onProgress({ done, total, current: null, depth: null });
    }
    return 'done';
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
