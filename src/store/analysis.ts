import { create } from 'zustand';
import { EvalCache } from '../engine/cache';
import { analysePositions, type QueueProgress } from '../engine/queue';
import type { PositionEval, SearchSettings } from '../engine/types';
import { DEFAULT_SEARCH } from '../engine/types';
import { getEngine } from './engine';
import type { LoadedSource } from './game';

export type AnalysisStatus = 'idle' | 'running' | 'done' | 'aborted' | 'error';

interface AnalysisState {
  /** Partie oder Stellung, zu der die Bewertungen gehören */
  source: LoadedSource | null;
  /** Alle Stellungen: Index 0 = Ausgangsstellung, Index i = nach Halbzug i */
  fens: string[];
  evals: (PositionEval | undefined)[];
  settings: SearchSettings;
  status: AnalysisStatus;
  progress: QueueProgress;

  start: (source: LoadedSource, settings: SearchSettings) => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const emptyProgress: QueueProgress = { done: 0, total: 0, current: null, depth: null };

/** Bewertungen über Partien hinweg merken (nach fen, depth, multipv). */
const cache = new EvalCache();
let controller: AbortController | null = null;
let runId = 0;
let lastEngineGame: LoadedSource | null = null;

export function positionsOf(source: LoadedSource): string[] {
  return source.kind === 'game'
    ? [source.startFen, ...source.plies.map((ply) => ply.fenAfter)]
    : [source.fen];
}

export const useAnalysis = create<AnalysisState>()((set, get) => {
  async function run(): Promise<void> {
    const { source, fens, settings } = get();
    if (!source) return;
    controller?.abort();
    const myRun = ++runId;
    const myController = new AbortController();
    controller = myController;
    const isCurrent = () => myRun === runId;

    set({ status: 'running', progress: { ...emptyProgress, total: fens.length } });
    try {
      const engine = await getEngine();
      if (!isCurrent()) return;
      if (lastEngineGame !== source) {
        await engine.newGame();
        lastEngineGame = source;
      }
      const outcome = await analysePositions(
        engine,
        cache,
        fens,
        settings,
        {
          onPosition: (index, evaluation) => {
            if (!isCurrent()) return;
            set((s) => {
              const evals = [...s.evals];
              evals[index] = evaluation;
              return { evals };
            });
          },
          onProgress: (progress) => {
            if (isCurrent()) set({ progress });
          },
        },
        myController.signal,
      );
      if (isCurrent()) set({ status: outcome === 'done' ? 'done' : 'aborted' });
    } catch {
      if (isCurrent()) set({ status: 'error' });
    }
  }

  return {
    source: null,
    fens: [],
    evals: [],
    settings: DEFAULT_SEARCH,
    status: 'idle',
    progress: emptyProgress,

    start: (source, settings) => {
      const fens = positionsOf(source);
      set({ source, fens, settings, evals: new Array(fens.length).fill(undefined) });
      return run();
    },
    resume: () => run(),
    cancel: () => {
      controller?.abort();
    },
    reset: () => {
      controller?.abort();
      runId++;
      set({ source: null, fens: [], evals: [], status: 'idle', progress: emptyProgress });
    },
  };
});
