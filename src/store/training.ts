import { z } from 'zod';
import { create } from 'zustand';
import { parsePgnGame } from '../chess/pgn';
import type { Motif } from '../classification/motifs';
import type { GameStats } from '../classification/gameStats';
import type { PositionEval } from '../engine/types';
import { checkMove, playMove, type MoveCheck } from '../training/check';
import {
  buildSession,
  collectPuzzles,
  type Puzzle,
  type PuzzleGameInput,
  type PuzzleSources,
} from '../training/puzzles';
import { nextState, type AttemptResult, type CardState } from '../training/srs';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import { getEngine } from './engine';
import type { LibraryMeta } from './library';
import { getLibraryStorage, getSettingsStorage } from './persistence';
import { gameTitle } from './patterns';
import { sessionSchema } from './session';
import { useSettings } from './settings';

const CARDS_KEY = 'trainingCards';
/** Höchste Tiefe beim Nachrechnen eines Zugs (schnelle Antwort statt voller Analysetiefe) */
const MAX_CHECK_DEPTH = 18;

const cardsSchema = z.record(
  z.string(),
  z.object({ box: z.number(), due: z.string(), attempts: z.number(), correct: z.number() }),
);

/** Alles, was zum Lösen einer Aufgabe gebraucht wird (aus dem gespeicherten Datensatz). */
export interface PuzzleData {
  puzzle: Puzzle;
  fen: string;
  /** Gespeicherte Bewertung der Stellung */
  before: PositionEval;
  played: { uci: string; fenAfter: string; after: PositionEval | undefined };
  /** Tiefe der gespeicherten Analyse */
  depth: number;
  /** Gespeicherte KI-Erklärung zu diesem Zug, falls vorhanden */
  explanation: { warum: string; merksatz?: string | undefined } | null;
}

export type AttemptStatus =
  'loading' | 'ready' | 'checking' | 'correct' | 'wrong' | 'solution' | 'error';

export interface Attempt {
  status: AttemptStatus;
  /** Zug des Nutzers (UCI) und Stellung danach */
  move?: string | undefined;
  fenAfter?: string | undefined;
  check?: MoveCheck | undefined;
  /** 0 = kein Hinweis, 1 = Tipp gelesen, 2 = Figur gezeigt */
  hints: 0 | 1 | 2;
  /** Ergebnis dieser Runde schon für die Wiederholung gespeichert */
  recorded: boolean;
}

export interface TrainingRun {
  queue: Puzzle[];
  index: number;
  /** Aufgaben, die nach einem Fehler schon einmal hinten angehängt wurden */
  requeued: string[];
  firstTry: { correct: number; total: number };
}

interface TrainingState {
  cards: Record<string, CardState>;
  cardsLoaded: boolean;
  /** Nur Aufgaben zu diesem Motiv („Dieses Muster trainieren“) */
  motif: Motif | null;
  run: TrainingRun | null;
  current: PuzzleData | null;
  attempt: Attempt;
  loadCards: () => Promise<void>;
  setMotif: (motif: Motif | null) => void;
  start: (entries: readonly LibraryMeta[]) => Promise<void>;
  tryMove: (uci: string) => Promise<void>;
  hint: () => void;
  showSolution: () => Promise<void>;
  retry: () => void;
  next: () => Promise<void>;
  stop: () => void;
}

/** Bibliothekseinträge mit Kennzahlen → Eingabe für die Aufgaben */
export function toPuzzleGames(entries: readonly LibraryMeta[]): PuzzleGameInput[] {
  return entries.flatMap((e) =>
    e.stats
      ? [
          {
            id: e.id,
            title: gameTitle(e),
            sortKey: e.playedAt ?? e.savedAt,
            stats: e.stats as GameStats,
          },
        ]
      : [],
  );
}

/** Alle Aufgaben laut Einstellungen und Motiv-Filter */
export function puzzlesFor(
  entries: readonly LibraryMeta[],
  motif: Motif | null,
  sources: PuzzleSources = useSettings.getState().training,
): Puzzle[] {
  return collectPuzzles(toPuzzleGames(entries), sources, motif ?? undefined);
}

async function loadPuzzle(puzzle: Puzzle): Promise<PuzzleData | null> {
  const parsed = sessionSchema.safeParse(
    await getLibraryStorage()
      .get(puzzle.gameId)
      .catch(() => null),
  );
  if (!parsed.success || parsed.data.source.kind !== 'game' || !parsed.data.analysis) return null;
  const game = parsePgnGame(parsed.data.source.pgn);
  const ply = game.ok ? game.value.plies[puzzle.ply] : undefined;
  const evals = parsed.data.analysis.evals;
  const before = evals[puzzle.ply] as PositionEval | null | undefined;
  if (!ply || !before?.lines[0]) return null;
  const explanation = parsed.data.explanations[String(puzzle.ply)]?.short?.explanation;
  return {
    puzzle,
    fen: ply.fenBefore,
    before,
    played: {
      uci: ply.uci,
      fenAfter: ply.fenAfter,
      after: (evals[puzzle.ply + 1] ?? undefined) as PositionEval | undefined,
    },
    depth: parsed.data.analysis.depth,
    explanation: explanation ? { warum: explanation.warum, merksatz: explanation.merksatz } : null,
  };
}

const freshAttempt = (status: AttemptStatus): Attempt => ({ status, hints: 0, recorded: false });

export const useTraining = create<TrainingState>()((set, get) => {
  /** Speichert das Ergebnis der aktuellen Aufgabe (einmal pro Runde) für die Wiederholung. */
  async function record(result: AttemptResult) {
    const { current, attempt, run, cards } = get();
    if (!current || !run || attempt.recorded) return;
    const id = current.puzzle.id;
    const updated = { ...cards, [id]: nextState(cards[id], result, new Date()) };
    const firstTime = !run.requeued.includes(id);
    const requeue = result === 'wrong' && firstTime;
    set({
      cards: updated,
      attempt: { ...get().attempt, recorded: true },
      run: {
        ...run,
        // Falsch gelöste Aufgaben kommen in dieser Sitzung noch einmal dran
        queue: requeue ? [...run.queue, current.puzzle] : run.queue,
        requeued: requeue ? [...run.requeued, id] : run.requeued,
        firstTry: firstTime
          ? {
              correct: run.firstTry.correct + (result === 'correct' ? 1 : 0),
              total: run.firstTry.total + 1,
            }
          : run.firstTry,
      },
    });
    await getSettingsStorage()
      .set(CARDS_KEY, updated)
      .catch(() => undefined);
  }

  /** Lädt die Aufgabe an `index`; nicht ladbare (z. B. gelöschte Partie) werden übersprungen. */
  async function show(index: number) {
    const run = get().run;
    if (!run) return;
    for (let i = index; i < run.queue.length; i++) {
      const latest = get().run;
      if (!latest) return;
      set({ run: { ...latest, index: i }, current: null, attempt: freshAttempt('loading') });
      const puzzle = run.queue[i];
      const data = puzzle ? await loadPuzzle(puzzle) : null;
      // Inzwischen beendet oder weitergeschaltet
      if (get().run?.index !== i) return;
      if (data) {
        set({ current: data, attempt: freshAttempt('ready') });
        return;
      }
    }
    const latest = get().run;
    if (!latest) return;
    set({
      run: { ...latest, index: latest.queue.length },
      current: null,
      attempt: freshAttempt('ready'),
    });
  }

  return {
    cards: {},
    cardsLoaded: false,
    motif: null,
    run: null,
    current: null,
    attempt: freshAttempt('ready'),

    loadCards: async () => {
      const parsed = cardsSchema.safeParse(
        await getSettingsStorage()
          .get(CARDS_KEY)
          .catch(() => null),
      );
      set({ cards: parsed.success ? parsed.data : {}, cardsLoaded: true });
    },

    // Ein neuer Filter beendet eine laufende Sitzung (sie gehört zum alten Filter)
    setMotif: (motif) => set({ motif, run: null, current: null, attempt: freshAttempt('ready') }),

    start: async (entries) => {
      const queue = buildSession(puzzlesFor(entries, get().motif), get().cards, new Date());
      if (queue.length === 0) return;
      set({ run: { queue, index: 0, requeued: [], firstTry: { correct: 0, total: 0 } } });
      await show(0);
    },

    tryMove: async (uci) => {
      const { current, attempt } = get();
      if (!current || (attempt.status !== 'ready' && attempt.status !== 'wrong')) return;
      const settings = useSettings.getState();
      // Den Zug sofort zeigen, während die Engine rechnet
      const fenAfter = playMove(current.fen, uci);
      if (!fenAfter) return;
      set({ attempt: { ...attempt, status: 'checking', move: uci, fenAfter, check: undefined } });
      try {
        const check = await checkMove({
          fen: current.fen,
          before: current.before,
          played: current.played,
          move: uci,
          excellent: DEFAULT_CLASSIFICATION.excellent,
          evaluate: async (fen) => {
            const engine = await getEngine();
            const depth = Math.min(current.depth || settings.engineDepth, MAX_CHECK_DEPTH);
            const result = await engine.search(fen, { depth, multipv: 1 });
            return { fen, depth: result.depth, multipv: 1, lines: result.lines };
          },
        });
        if (get().current !== current) return;
        set({
          attempt: {
            ...get().attempt,
            status: check.correct ? 'correct' : 'wrong',
            check,
            fenAfter,
          },
        });
        await record(
          check.correct ? (get().attempt.hints >= 2 ? 'correctWithHelp' : 'correct') : 'wrong',
        );
      } catch {
        if (get().current === current) set({ attempt: { ...get().attempt, status: 'error' } });
      }
    },

    hint: () => {
      const attempt = get().attempt;
      if (attempt.hints < 2) set({ attempt: { ...attempt, hints: (attempt.hints + 1) as 1 | 2 } });
    },

    showSolution: async () => {
      if (!get().current) return;
      set({ attempt: { ...get().attempt, status: 'solution' } });
      await record('wrong');
    },

    retry: () => {
      const attempt = get().attempt;
      if (attempt.status === 'wrong' || attempt.status === 'error') {
        set({ attempt: { status: 'ready', hints: attempt.hints, recorded: attempt.recorded } });
      }
    },

    next: async () => {
      const run = get().run;
      if (run) await show(run.index + 1);
    },

    stop: () => set({ run: null, current: null, attempt: freshAttempt('ready') }),
  };
});
