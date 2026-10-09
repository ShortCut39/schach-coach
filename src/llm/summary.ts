import { formatMoveNumber, formatSan } from '../chess/notation';
import type { Color, Game } from '../chess/types';
import { playerAccuracy, type AccuracySummary } from '../classification/accuracy';
import type { GameAnalysis } from '../classification/gameAnalysis';
import { countCategories } from '../classification/stats';
import { turningPoints } from '../classification/turningPoints';
import { CATEGORIES, ERROR_CATEGORIES } from '../classification/types';
import type { PositionEval } from '../engine/types';
import { buildMoveFacts, type FactLabels } from './facts';
import { z } from 'zod';
import type { NotationStyle } from '../chess/notation';
import type { MoveFacts } from './facts';
import { systemPrompt, type Level } from './prompts';
import { LlmError, type ChatMessage } from './types';

/** Fakten für die Zusammenfassung – wieder nur Engine- und chess.js-Daten. */
export interface SummaryFacts {
  du_spielst: string;
  ergebnis: string;
  eroeffnung: {
    name: string;
    eco: string;
    theorie_bis: string | null;
    theorie_halbzuege: number;
  } | null;
  genauigkeit: {
    du: Record<'gesamt' | 'eroeffnung' | 'mittelspiel' | 'endspiel', number | null>;
    gegner: Record<'gesamt' | 'eroeffnung' | 'mittelspiel' | 'endspiel', number | null>;
  };
  kategorien: { du: Record<string, number>; gegner: Record<string, number> };
  /** Die wichtigsten Momente beider Seiten */
  wendepunkte: MoveFacts[];
  /** Fehler des Spielers (für Tipps), höchstens 10 */
  deine_fehler: MoveFacts[];
}

const summarySchema = z.object({
  eroeffnung: z.string().trim().min(1).max(600),
  wendepunkte: z.array(
    z.object({ ply: z.number().int().nonnegative(), text: z.string().trim().min(1).max(500) }),
  ),
  tipps: z
    .array(
      z.object({
        titel: z.string().trim().min(1).max(80),
        text: z.string().trim().min(1).max(500),
      }),
    )
    .min(1),
});

export type GameSummary = z.infer<typeof summarySchema>;

/** Holt und prüft das JSON der Zusammenfassung; höchstens drei Tipps werden übernommen. */
export function parseSummary(content: string): GameSummary {
  const unfenced = content.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end < start) throw new LlmError('badResponse');
  let data: unknown;
  try {
    data = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new LlmError('badResponse');
  }
  const result = summarySchema.safeParse(data);
  if (!result.success) throw new LlmError('badResponse');
  return { ...result.data, tipps: result.data.tipps.slice(0, 3) };
}

const SUMMARY_FORMAT =
  '{"eroeffnung":"…","wendepunkte":[{"ply":<ply aus den Daten>,"text":"…"}],"tipps":[{"titel":"…","text":"…"},{"titel":"…","text":"…"},{"titel":"…","text":"…"}]}';

export function summaryMessages(
  facts: SummaryFacts,
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(level, notation) },
    {
      role: 'user',
      content: [
        'Schreibe eine Zusammenfassung dieser Partie für den Spieler („du“).',
        '„eroeffnung“: 1–2 Sätze: welche Eröffnung, bis wohin die Partie in der Theorie blieb und wer zuerst abwich.',
        '„wendepunkte“: für jeden gelieferten Wendepunkt genau ein Eintrag mit 1 konkretem Satz, was passiert ist (Figuren und Felder, siehe hauptvariante_in_worten und Figuren in Gefahr).',
        '„tipps“: genau 3 Tipps für den Spieler. Jeder Tipp hat einen kurzen Titel (höchstens 5 Wörter) und 1–2 Sätze, die sich auf konkrete Züge aus deine_fehler oder den Wendepunkten beziehen. Keine allgemeinen Tipps ohne Bezug zu dieser Partie. Wenn sich Fehler ähneln (z. B. mehrmals eine ungedeckte Figur), nenne das Muster.',
        `Antwortformat: ${SUMMARY_FORMAT}`,
        'Daten:',
        JSON.stringify(facts, null, 1),
      ].join('\n'),
    },
  ];
}

// Fakten zusammenstellen

const MAX_OWN_ERRORS = 10;

function round(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value * 10) / 10;
}

function accuracyFacts(summary: AccuracySummary) {
  return {
    gesamt: round(summary.overall),
    eroeffnung: round(summary.byPhase.opening),
    mittelspiel: round(summary.byPhase.middlegame),
    endspiel: round(summary.byPhase.endgame),
  };
}

export function buildSummaryFacts(
  game: Game,
  analysis: GameAnalysis,
  evals: readonly (PositionEval | undefined)[],
  userColor: Color,
  notation: NotationStyle,
  labels: FactLabels,
): SummaryFacts {
  const opponent: Color = userColor === 'w' ? 'b' : 'w';
  const factsFor = (index: number) => {
    const ply = game.plies[index];
    const plyAnalysis = analysis.plies[index];
    const before = evals[index];
    const after = evals[index + 1];
    return ply && plyAnalysis && before && after
      ? [
          buildMoveFacts(
            ply,
            plyAnalysis,
            before,
            after,
            notation,
            labels,
            userColor,
            analysis.unnoticed.has(index),
          ),
        ]
      : [];
  };
  const named = (counts: Record<string, number>) =>
    Object.fromEntries(CATEGORIES.map((c) => [labels.category[c], counts[c] ?? 0]));
  const lastBook = analysis.opening ? game.plies[analysis.opening.bookPlies - 1] : undefined;

  return {
    du_spielst: labels.color[userColor],
    ergebnis: game.result,
    eroeffnung: analysis.opening
      ? {
          name: analysis.opening.name,
          eco: analysis.opening.eco,
          theorie_bis: lastBook
            ? `${formatMoveNumber(lastBook.moveNumber, lastBook.color)} ${formatSan(lastBook.san, notation)}`
            : null,
          theorie_halbzuege: analysis.opening.bookPlies,
        }
      : null,
    genauigkeit: {
      du: accuracyFacts(playerAccuracy(game, analysis.plies, userColor)),
      gegner: accuracyFacts(playerAccuracy(game, analysis.plies, opponent)),
    },
    kategorien: {
      du: named(countCategories(game, analysis.plies, userColor)),
      gegner: named(countCategories(game, analysis.plies, opponent)),
    },
    wendepunkte: turningPoints(game, analysis.plies).flatMap(factsFor),
    deine_fehler: game.plies
      .filter(
        (p) =>
          p.color === userColor &&
          ERROR_CATEGORIES.has(analysis.plies[p.index]?.category ?? 'best'),
      )
      .slice(0, MAX_OWN_ERRORS)
      .flatMap((p) => factsFor(p.index)),
  };
}
