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
import { formatLineEval, formatPositionEval } from '../engine/evalFormat';
import i18n from '../i18n';
import { chatCompletion } from '../llm/client';
import { withJsonFallback } from '../llm/explain';
import { getFetch } from '../llm/http';
import {
  buildTrainingMoveFacts,
  parseTrainingExplanation,
  trainingExplainMessages,
  type TrainingExplainFacts,
  type TrainingExplanation,
} from '../llm/trainingExplain';
import { piecesInDanger } from '../llm/describe';
import { LlmError, type LlmErrorCode } from '../llm/types';
import { getEngine } from './engine';
import { currentLlmConfig, isLlmConfigured } from './explanations';
import type { LibraryMeta } from './library';
import { getLibraryStorage, getSettingsStorage } from './persistence';
import { gameTitle } from './patterns';
import { sessionSchema } from './session';
import { useSettings } from './settings';

const CARDS_KEY = 'trainingCards';
/** Gespeicherte KI-Erklärungen „Warum ist der bessere Zug besser?“ je Aufgabe */
const EXPLANATIONS_KEY = 'trainingExplanations';
/** Höchste Tiefe beim Nachrechnen eines Zugs (schnelle Antwort statt voller Analysetiefe) */
const MAX_CHECK_DEPTH = 18;

const storedExplanationsSchema = z.record(
  z.string(),
  z.object({
    explanation: z.object({ was: z.string(), warum: z.string(), merksatz: z.string().optional() }),
    model: z.string(),
  }),
);

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

/** KI-Erklärung nach einer gelösten Aufgabe */
export interface AiExplanation {
  status: 'idle' | 'loading' | 'done' | 'failed';
  explanation?: TrainingExplanation;
  model?: string;
  error?: LlmErrorCode;
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
  ai: AiExplanation;
  loadCards: () => Promise<void>;
  /** Fragt die KI, warum der bessere Zug besser ist (nach Lösen oder „Lösung zeigen“). */
  explain: () => Promise<void>;
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

/**
 * Fakten für die KI – nur Engine-Daten und chess.js. `withOwnMove`: der Spieler hat einen anderen
 * guten Zug als den Bestzug gefunden; der wird mit erklärt.
 */
export function trainingFacts(data: PuzzleData, attempt: Attempt): TrainingExplainFacts {
  const t = i18n.t.bind(i18n);
  const { notation } = useSettings.getState();
  const color = data.puzzle.color;
  const opponent = color === 'w' ? 'b' : 'w';
  const best = data.before.lines[0];
  const facts: TrainingExplainFacts = {
    am_zug: color === 'w' ? t('common.white') : t('common.black'),
    fen: data.fen,
    motiv: {
      name: t(`motifs.${data.puzzle.motif}.name`),
      erklaerung: t(`motifs.${data.puzzle.motif}.text`),
    },
    vor_dem_zug: {
      figuren_des_spielers_in_gefahr: piecesInDanger(data.fen, color),
      figuren_des_gegners_in_gefahr: piecesInDanger(data.fen, opponent),
    },
    bester_zug: buildTrainingMoveFacts(
      data.fen,
      {
        uci: best?.pv[0] ?? '',
        continuation: best?.pv.slice(1) ?? [],
        evaluation: best ? formatLineEval(best) : null,
        winLoss: 0,
      },
      color,
      notation,
    ),
    partiezug: {
      ...buildTrainingMoveFacts(
        data.fen,
        {
          uci: data.played.uci,
          continuation: data.played.after?.lines[0]?.pv ?? [],
          evaluation: formatPositionEval(data.played.after) ?? null,
          winLoss: data.puzzle.winLoss,
        },
        color,
        notation,
      ),
      kategorie: t(`categories.${data.puzzle.category}`),
    },
  };
  if (withOwnMove(data, attempt) && attempt.move && attempt.check) {
    facts.dein_zug = buildTrainingMoveFacts(
      data.fen,
      {
        uci: attempt.move,
        continuation: attempt.check.continuation,
        evaluation: null,
        winLoss: attempt.check.winLoss,
      },
      color,
      notation,
    );
  }
  return facts;
}

/** Richtig gelöst, aber mit einem anderen Zug als dem Engine-Bestzug */
function withOwnMove(data: PuzzleData, attempt: Attempt): boolean {
  return attempt.status === 'correct' && attempt.move !== data.before.lines[0]?.pv[0];
}

async function storedExplanations() {
  const parsed = storedExplanationsSchema.safeParse(
    await getSettingsStorage()
      .get(EXPLANATIONS_KEY)
      .catch(() => null),
  );
  return parsed.success ? parsed.data : {};
}

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
      set({
        run: { ...latest, index: i },
        current: null,
        attempt: freshAttempt('loading'),
        ai: { status: 'idle' },
      });
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
    ai: { status: 'idle' },

    loadCards: async () => {
      const parsed = cardsSchema.safeParse(
        await getSettingsStorage()
          .get(CARDS_KEY)
          .catch(() => null),
      );
      set({ cards: parsed.success ? parsed.data : {}, cardsLoaded: true });
    },

    // Ein neuer Filter beendet eine laufende Sitzung (sie gehört zum alten Filter)
    setMotif: (motif) =>
      set({
        motif,
        run: null,
        current: null,
        attempt: freshAttempt('ready'),
        ai: { status: 'idle' },
      }),

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
        if (check.correct && isLlmConfigured()) void get().explain();
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
      if (isLlmConfigured()) void get().explain();
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

    explain: async () => {
      const { current, attempt } = get();
      if (!current || (attempt.status !== 'correct' && attempt.status !== 'solution')) return;
      // Ohne eigenen Zug ist die Erklärung immer dieselbe – dann gespeicherte nehmen
      const cacheable = !withOwnMove(current, attempt);
      const id = current.puzzle.id;
      if (cacheable) {
        const cached = (await storedExplanations())[id];
        if (cached && get().current === current) {
          set({ ai: { status: 'done', explanation: cached.explanation, model: cached.model } });
          return;
        }
      }
      set({ ai: { status: 'loading' } });
      const settings = useSettings.getState();
      const config = currentLlmConfig();
      try {
        const ask = withJsonFallback(
          (messages, jsonMode) =>
            chatCompletion(config, messages, { jsonMode }, getFetch()).then((r) => r.content),
          `${config.baseUrl}|${config.model}`,
        );
        const messages = trainingExplainMessages(
          trainingFacts(current, attempt),
          settings.level,
          settings.notation,
        );
        let explanation: TrainingExplanation | undefined;
        for (let attemptNo = 0; attemptNo < 2 && !explanation; attemptNo++) {
          try {
            explanation = parseTrainingExplanation(await ask(messages));
          } catch (error) {
            // Nur unverwertbare Antworten werden einmal automatisch wiederholt
            if (!(error instanceof LlmError) || error.code !== 'badResponse' || attemptNo === 1)
              throw error;
          }
        }
        if (!explanation) throw new LlmError('badResponse');
        if (get().current !== current) return;
        set({ ai: { status: 'done', explanation, model: config.model } });
        if (cacheable) {
          const stored = await storedExplanations();
          await getSettingsStorage()
            .set(EXPLANATIONS_KEY, { ...stored, [id]: { explanation, model: config.model } })
            .catch(() => undefined);
        }
      } catch (error) {
        if (get().current !== current) return;
        set({
          ai: { status: 'failed', error: error instanceof LlmError ? error.code : 'badResponse' },
        });
      }
    },

    stop: () =>
      set({ run: null, current: null, attempt: freshAttempt('ready'), ai: { status: 'idle' } }),
  };
});
