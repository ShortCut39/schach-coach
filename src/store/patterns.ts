import { z } from 'zod';
import { create } from 'zustand';
import { formatMoveNumber, formatSan } from '../chess/notation';
import { parsePgnGame } from '../chess/pgn';
import type { PatternGame, PatternReport } from '../classification/patterns';
import { PHASES } from '../classification/accuracy';
import type { GameStats } from '../classification/gameStats';
import i18n, { currentLanguage } from '../i18n';
import { chatCompletion } from '../llm/client';
import { describeLine, describeUci } from '../llm/describe';
import { withJsonFallback } from '../llm/explain';
import { getFetch } from '../llm/http';
import {
  parseTrainingPlan,
  trainingPlanMessages,
  type TrainingFacts,
  type TrainingPlan,
} from '../llm/trainingPlan';
import { LlmError, type LlmErrorCode } from '../llm/types';
import { currentLlmConfig } from './explanations';
import type { LibraryMeta } from './library';
import { getLibraryStorage, getSettingsStorage } from './persistence';
import { sessionSchema } from './session';
import { useSettings } from './settings';

const PLAN_KEY = 'trainingPlan';
/** Beispiele je Motiv und Motive im Trainingsplan */
const EXAMPLES_PER_MOTIF = 2;
const MOTIFS_IN_PLAN = 4;

/** Titel einer Partie für Listen und den Trainingsplan */
export function gameTitle(meta: Pick<LibraryMeta, 'white' | 'black' | 'event'>): string {
  if (meta.white && meta.black) return `${meta.white} – ${meta.black}`;
  return meta.event ?? i18n.t('bibliothek.untitled');
}

/** Bibliotheks-Einträge mit Kennzahlen → Eingabe für die Auswertung */
export function toPatternGames(entries: readonly LibraryMeta[]): PatternGame[] {
  return entries.flatMap((e) =>
    e.stats
      ? [
          {
            id: e.id,
            title: gameTitle(e),
            sortKey: e.playedAt ?? e.savedAt,
            userColor: e.userColor,
            outcome: e.outcome,
            accuracy: e.accuracy,
            opening: e.opening,
            stats: e.stats as GameStats,
          },
        ]
      : [],
  );
}

const storedPlanSchema = z.object({
  plan: z.object({
    einschaetzung: z.string(),
    empfehlungen: z.array(z.object({ titel: z.string(), text: z.string(), uebung: z.string() })),
  }),
  gameCount: z.number(),
  model: z.string(),
  createdAt: z.string(),
});

export interface PlanState {
  status: 'idle' | 'loading' | 'done' | 'failed';
  plan?: TrainingPlan;
  gameCount?: number;
  model?: string;
  error?: LlmErrorCode;
}

interface PatternsState {
  plan: PlanState;
  loadPlan: () => Promise<void>;
  createPlan: (report: PatternReport, entries: readonly LibraryMeta[]) => Promise<void>;
}

const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/** Beispiele in Worten: Zug und erste Antwort laut Engine (aus dem gespeicherten Datensatz). */
async function exampleFacts(gameId: string, ply: number, title: string) {
  const parsed = sessionSchema.safeParse(
    await getLibraryStorage()
      .get(gameId)
      .catch(() => null),
  );
  if (!parsed.success || parsed.data.source.kind !== 'game') return null;
  const game = parsePgnGame(parsed.data.source.pgn);
  const move = game.ok ? game.value.plies[ply] : undefined;
  if (!move) return null;
  const reply = parsed.data.analysis?.evals[ply + 1]?.lines[0]?.pv.slice(0, 1) ?? [];
  const notation = useSettings.getState().notation;
  return {
    partie: title,
    zug: `${formatMoveNumber(move.moveNumber, move.color)} ${formatSan(move.san, notation)}`,
    zug_in_worten: describeUci(move.fenBefore, move.uci, currentLanguage()),
    folge: describeLine(move.fenAfter, reply, currentLanguage())[0] ?? null,
  };
}

async function buildTrainingFacts(report: PatternReport): Promise<TrainingFacts> {
  const t = i18n.t.bind(i18n);
  const phaseNames = {
    opening: 'eroeffnung',
    middlegame: 'mittelspiel',
    endgame: 'endspiel',
  } as const;
  const motifs = [];
  for (const summary of report.motifs.slice(0, MOTIFS_IN_PLAN)) {
    const beispiele = [];
    if (summary.motif !== 'other') {
      for (const example of summary.examples.slice(0, EXAMPLES_PER_MOTIF)) {
        const facts = await exampleFacts(example.gameId, example.ply, example.title);
        if (facts) beispiele.push(facts);
      }
    }
    motifs.push({
      motiv: t(`motifs.${summary.motif}.name`),
      erklaerung: t(`motifs.${summary.motif}.text`),
      anzahl: summary.count,
      anteil_prozent: Math.round(summary.share * 100),
      beispiele,
    });
  }
  const all = report.timeline.map((p) => p.accuracy);
  return {
    partien: report.games,
    genauigkeit: {
      durchschnitt: round(all.length ? all.reduce((a, b) => a + b, 0) / all.length : null),
      letzte_partien: round(report.trend.recent),
      fruehere_partien: round(report.trend.earlier),
      phasen: Object.fromEntries(
        PHASES.map((p) => [
          phaseNames[p],
          {
            genauigkeit: round(report.phases[p].accuracy),
            fehler_pro_10_zuege: round(report.phases[p].errorsPer10),
          },
        ]),
      ),
    },
    fehler_motive: motifs,
    eroeffnungen: report.openings.slice(0, 5).map((o) => ({
      name: o.name,
      eco: o.eco,
      farbe: o.color === 'w' ? t('common.white') : t('common.black'),
      partien: o.games,
      siege: o.wins,
      remis: o.draws,
      niederlagen: o.losses,
      genauigkeit: round(o.accuracy),
      theorie_zuege: o.bookMoves,
    })),
  };
}

export const usePatterns = create<PatternsState>()((set) => ({
  plan: { status: 'idle' },

  loadPlan: async () => {
    const parsed = storedPlanSchema.safeParse(
      await getSettingsStorage()
        .get(PLAN_KEY)
        .catch(() => null),
    );
    if (parsed.success) {
      set({
        plan: {
          status: 'done',
          plan: parsed.data.plan,
          gameCount: parsed.data.gameCount,
          model: parsed.data.model,
        },
      });
    }
  },

  createPlan: async (report) => {
    set({ plan: { status: 'loading' } });
    const settings = useSettings.getState();
    const config = currentLlmConfig();
    try {
      const facts = await buildTrainingFacts(report);
      const ask = withJsonFallback(
        (messages, jsonMode) =>
          chatCompletion(config, messages, { jsonMode }, getFetch()).then((r) => r.content),
        `${config.baseUrl}|${config.model}`,
      );
      let plan: TrainingPlan | undefined;
      for (let attempt = 0; attempt < 2 && !plan; attempt++) {
        try {
          plan = parseTrainingPlan(
            await ask(
              trainingPlanMessages(facts, settings.level, settings.notation, currentLanguage()),
            ),
          );
        } catch (error) {
          // Nur ungültige Antworten werden einmal automatisch wiederholt
          if (!(error instanceof LlmError) || error.code !== 'badResponse' || attempt === 1)
            throw error;
        }
      }
      if (!plan) throw new LlmError('badResponse');
      const stored = {
        plan,
        gameCount: report.games,
        model: config.model,
        createdAt: new Date().toISOString(),
      };
      await getSettingsStorage().set(PLAN_KEY, stored);
      set({ plan: { status: 'done', plan, gameCount: report.games, model: config.model } });
    } catch (error) {
      set({
        plan: { status: 'failed', error: error instanceof LlmError ? error.code : 'badResponse' },
      });
    }
  },
}));
