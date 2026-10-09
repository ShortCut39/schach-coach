import { create } from 'zustand';
import type { Game } from '../chess/types';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { loadOpeningBook } from '../classification/openingBook';
import { CATEGORIES, type Category } from '../classification/types';
import i18n from '../i18n';
import { chatCompletion } from '../llm/client';
import { requestExplanations, withJsonFallback } from '../llm/explain';
import { buildMoveFacts, buildPositionFacts, type FactLabels } from '../llm/facts';
import { getFetch } from '../llm/http';
import { LLM_PRESETS } from '../llm/presets';
import { batchMessages, detailMessages, positionMessages, type DetailMode } from '../llm/prompts';
import type { Explanation } from '../llm/schema';
import { buildSummaryFacts, parseSummary, summaryMessages, type GameSummary } from '../llm/summary';
import { chunk, selectPlies, type ExplainScope } from '../llm/selection';
import { LlmError, type ChatMessage, type LlmConfig, type LlmErrorCode } from '../llm/types';
import { useAnalysis } from './analysis';
import { useApiKey } from './apiKey';
import { useGame, type LoadedSource } from './game';
import { useSettings } from './settings';

export type EntryStatus = 'loading' | 'done' | 'failed';

export interface ExplanationEntry {
  status: EntryStatus;
  explanation?: Explanation;
  error?: LlmErrorCode;
}

/** Erklärungen eines Halbzugs: kurz (Batch), ausführlich und aus Gegner-Sicht */
export interface PlyExplanations {
  short?: ExplanationEntry;
  detailed?: ExplanationEntry;
  opponent?: ExplanationEntry;
}

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface SummaryEntry {
  status: EntryStatus;
  data?: GameSummary;
  error?: LlmErrorCode;
}

interface ExplanationsState {
  source: LoadedSource | null;
  /** Index = Halbzug; bei einer FEN wird Index 0 für die Stellung verwendet */
  entries: Record<number, PlyExplanations>;
  run: { status: RunStatus; done: number; total: number; error?: LlmErrorCode };
  /** KI-Zusammenfassung (Eröffnung, Wendepunkte, drei Tipps) */
  summary: SummaryEntry | null;

  /** Erklärt die ausgewählten Züge der geladenen Partie in Paketen. */
  explainGame: (scope: ExplainScope) => Promise<void>;
  /** Einzelne Züge (z. B. „Erklärung anfordern“ oder „Erneut versuchen“). */
  explainPlies: (plies: number[]) => Promise<void>;
  explainDetail: (ply: number, mode: DetailMode) => Promise<void>;
  explainPosition: () => Promise<void>;
  /** Eigene Anfrage: Eröffnung, Wendepunkte und die drei wichtigsten Tipps. */
  explainSummary: () => Promise<void>;
  /** Zurück zur Kurzfassung */
  discardDetail: (ply: number) => void;
  reset: () => void;
}

/** Ist die KI so weit eingerichtet, dass Anfragen möglich sind? */
export function isLlmConfigured(): boolean {
  const { llm } = useSettings.getState();
  const preset = LLM_PRESETS.find((p) => p.id === llm.preset);
  const hasKey = useApiKey.getState().key.trim() !== '';
  return llm.baseUrl.trim() !== '' && llm.model.trim() !== '' && (hasKey || !preset?.needsKey);
}

/** Verbindung aus Einstellungen und Key (Key nur im Arbeitsspeicher). */
export function currentLlmConfig(): LlmConfig {
  const { llm } = useSettings.getState();
  return { baseUrl: llm.baseUrl, model: llm.model, apiKey: useApiKey.getState().key };
}

function createAsk(): (messages: ChatMessage[]) => Promise<string> {
  const { llm } = useSettings.getState();
  const config = currentLlmConfig();
  const fetchFn = getFetch();
  return withJsonFallback(
    (messages, jsonMode) =>
      chatCompletion(config, messages, { jsonMode }, fetchFn).then((r) => r.content),
    `${llm.baseUrl}|${llm.model}`,
  );
}

export function labels(): FactLabels {
  const t = i18n.t.bind(i18n);
  return {
    category: Object.fromEntries(CATEGORIES.map((c) => [c, t(`categories.${c}`)])) as Record<
      Category,
      string
    >,
    color: { w: t('common.white'), b: t('common.black') },
    unnoticed: t('coach.unnoticedFact'),
  };
}

/** Alles, was für Fakten gebraucht wird – nur, wenn Analyse und Partie zusammenpassen. */
export async function gameContext() {
  const { source, userColor } = useGame.getState();
  const analysis = useAnalysis.getState();
  if (source?.kind !== 'game' || analysis.source !== source) return null;
  const settings = useSettings.getState();
  const book = await loadOpeningBook();
  const result = computeGameAnalysis(source, analysis.evals, book, settings.thresholds);
  return { game: source as Game, evals: analysis.evals, result, userColor, settings };
}

function errorCode(error: unknown): LlmErrorCode {
  return error instanceof LlmError ? error.code : 'badResponse';
}

export const useExplanations = create<ExplanationsState>()((set, get) => {
  /** Setzt Einträge für die aktuelle Quelle; Antworten zu einer alten Partie werden verworfen. */
  function update(
    source: LoadedSource,
    ply: number,
    kind: keyof PlyExplanations,
    entry: ExplanationEntry,
  ) {
    if (get().source !== source) return;
    set((s) => ({ entries: { ...s.entries, [ply]: { ...s.entries[ply], [kind]: entry } } }));
  }

  function ensureSource(): LoadedSource | null {
    const source = useGame.getState().source;
    if (source && get().source !== source) {
      set({ source, entries: {}, summary: null, run: { status: 'idle', done: 0, total: 0 } });
    }
    return source;
  }

  async function explainBatches(requested: number[], skipDone = false): Promise<void> {
    const source = ensureSource();
    // Schon erklärte Züge nicht erneut anfragen (z. B. aus der Bibliothek übernommen)
    const plies = skipDone
      ? requested.filter((ply) => get().entries[ply]?.short?.status !== 'done')
      : requested;
    const context = await gameContext();
    if (!source || !context || plies.length === 0) return;
    const { game, evals, result, settings } = context;
    const notation = settings.notation;
    const factLabels = labels();
    const factsFor = (ply: number) => {
      const p = game.plies[ply];
      const analysis = result.plies[ply];
      const before = evals[ply];
      const after = evals[ply + 1];
      return p && analysis && before && after
        ? buildMoveFacts(
            p,
            analysis,
            before,
            after,
            notation,
            factLabels,
            context.userColor,
            result.unnoticed.has(ply),
          )
        : null;
    };
    const factsByPly = new Map(
      plies.flatMap((ply) => {
        const facts = factsFor(ply);
        return facts ? [[ply, facts] as const] : [];
      }),
    );
    const explainable = [...factsByPly.keys()];
    for (const ply of explainable) update(source, ply, 'short', { status: 'loading' });
    set({ run: { status: 'running', done: 0, total: explainable.length } });

    const ask = createAsk();
    let done = 0;
    for (const batch of chunk(explainable)) {
      try {
        const { explanations, failed } = await requestExplanations(
          ask,
          (missing) =>
            batchMessages(
              missing.flatMap((ply) => factsByPly.get(ply) ?? []),
              settings.level,
              notation,
            ),
          batch,
        );
        for (const [ply, explanation] of explanations)
          update(source, ply, 'short', { status: 'done', explanation });
        for (const ply of failed)
          update(source, ply, 'short', { status: 'failed', error: 'badResponse' });
      } catch (error) {
        // Verbindung, Key o. Ä.: Rest als fehlgeschlagen markieren und abbrechen
        const code = errorCode(error);
        const remaining = explainable.slice(done);
        for (const ply of remaining)
          update(source, ply, 'short', { status: 'failed', error: code });
        if (get().source === source)
          set({ run: { status: 'error', done, total: explainable.length, error: code } });
        return;
      }
      done += batch.length;
      if (get().source === source)
        set({ run: { status: 'running', done, total: explainable.length } });
    }
    if (get().source === source) set({ run: { status: 'done', done, total: explainable.length } });
  }

  return {
    source: null,
    entries: {},
    run: { status: 'idle', done: 0, total: 0 },
    summary: null,

    explainGame: async (scope) => {
      ensureSource();
      const context = await gameContext();
      if (!context) return;
      await explainBatches(
        selectPlies(context.game, context.result.plies, context.userColor, scope),
      );
    },

    explainPlies: (plies) => explainBatches(plies),

    explainDetail: async (ply, mode) => {
      const source = ensureSource();
      const context = await gameContext();
      if (!source || !context) return;
      const { game, evals, result, settings } = context;
      const p = game.plies[ply];
      const analysis = result.plies[ply];
      const before = evals[ply];
      const after = evals[ply + 1];
      if (!p || !analysis || !before || !after) return;
      const facts = buildMoveFacts(
        p,
        analysis,
        before,
        after,
        settings.notation,
        labels(),
        context.userColor,
        result.unnoticed.has(ply),
      );
      const kind = mode === 'detailed' ? 'detailed' : 'opponent';
      update(source, ply, kind, { status: 'loading' });
      try {
        const { explanations } = await requestExplanations(
          createAsk(),
          () => detailMessages(facts, mode, settings.level, settings.notation),
          [ply],
        );
        const explanation = explanations.get(ply);
        update(
          source,
          ply,
          kind,
          explanation
            ? { status: 'done', explanation }
            : { status: 'failed', error: 'badResponse' },
        );
      } catch (error) {
        update(source, ply, kind, { status: 'failed', error: errorCode(error) });
      }
    },

    explainPosition: async () => {
      const source = ensureSource();
      const analysis = useAnalysis.getState();
      const evaluation = analysis.evals[0];
      if (source?.kind !== 'position' || analysis.source !== source || !evaluation) return;
      const settings = useSettings.getState();
      const facts = buildPositionFacts(source.fen, evaluation, settings.notation, labels());
      update(source, 0, 'short', { status: 'loading' });
      try {
        const { explanations } = await requestExplanations(
          createAsk(),
          () => positionMessages(facts, settings.level, settings.notation),
          [0],
        );
        const explanation = explanations.get(0);
        update(
          source,
          0,
          'short',
          explanation
            ? { status: 'done', explanation }
            : { status: 'failed', error: 'badResponse' },
        );
      } catch (error) {
        update(source, 0, 'short', { status: 'failed', error: errorCode(error) });
      }
    },

    explainSummary: async () => {
      const source = ensureSource();
      const context = await gameContext();
      if (!source || !context) return;
      const { game, evals, result, settings, userColor } = context;
      const facts = buildSummaryFacts(game, result, evals, userColor, settings.notation, labels());
      const ask = createAsk();
      const setSummary = (summary: SummaryEntry) => {
        if (get().source === source) set({ summary });
      };
      setSummary({ status: 'loading' });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const content = await ask(summaryMessages(facts, settings.level, settings.notation));
          setSummary({ status: 'done', data: parseSummary(content) });
          return;
        } catch (error) {
          const code = errorCode(error);
          // Nur ungültige Antworten werden einmal automatisch wiederholt
          if (code !== 'badResponse' || attempt === 1) {
            setSummary({ status: 'failed', error: code });
            return;
          }
        }
      }
    },

    discardDetail: (ply) =>
      set((s) => {
        const entry = { ...s.entries[ply] };
        delete entry.detailed;
        return { entries: { ...s.entries, [ply]: entry } };
      }),

    reset: () =>
      set({ source: null, entries: {}, summary: null, run: { status: 'idle', done: 0, total: 0 } }),
  };
});
