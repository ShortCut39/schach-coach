import { z } from 'zod';
import { uciLineToSan } from '../chess/line';
import { formatSan, type NotationStyle } from '../chess/notation';
import type { Color } from '../chess/types';
import { playMove } from '../training/check';
import { describeLine, describeUci, piecesInDanger } from './describe';
import { MAX_VARIATION_PLIES } from './facts';
import { systemPrompt, type Level } from './prompts';
import { LlmError, type ChatMessage, type ExplanationLanguage } from './types';

/** Ein Zug der Aufgabe mit seiner Folge laut Engine – alles in Worten von chess.js. */
export interface TrainingMoveFacts {
  zug: string;
  zug_in_worten: string | null;
  /** Beste Fortsetzung danach (beginnt mit der Antwort des Gegners) */
  folge: string[];
  folge_in_worten: string[];
  bewertung_danach: string | null;
  /** Verlorene Gewinnchance gegenüber dem besten Zug in Prozentpunkten */
  verlust_gewinnchance: number;
  nach_dem_zug: {
    figuren_des_spielers_in_gefahr: string[];
    figuren_des_gegners_in_gefahr: string[];
  };
}

/** Fakten für „Warum ist der bessere Zug besser?“ nach einer gelösten Trainingsaufgabe. */
export interface TrainingExplainFacts {
  am_zug: string;
  fen: string;
  motiv: { name: string; erklaerung: string };
  vor_dem_zug: {
    figuren_des_spielers_in_gefahr: string[];
    figuren_des_gegners_in_gefahr: string[];
  };
  bester_zug: TrainingMoveFacts;
  partiezug: TrainingMoveFacts & { kategorie: string };
  /** Nur, wenn der Spieler einen anderen guten Zug gefunden hat */
  dein_zug?: TrainingMoveFacts;
}

export interface TrainingMoveInput {
  uci: string;
  /** Beste Fortsetzung nach dem Zug (UCI) */
  continuation: string[];
  /** Bewertung nach dem Zug, z. B. „+1.2“ oder „M2“ */
  evaluation: string | null;
  winLoss: number;
}

export function buildTrainingMoveFacts(
  fen: string,
  move: TrainingMoveInput,
  color: Color,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): TrainingMoveFacts {
  const opponent: Color = color === 'w' ? 'b' : 'w';
  const fenAfter = playMove(fen, move.uci) ?? fen;
  const line = move.continuation.slice(0, MAX_VARIATION_PLIES);
  return {
    zug: uciLineToSan(fen, [move.uci]).map((m) => formatSan(m, notation))[0] ?? move.uci,
    zug_in_worten: describeUci(fen, move.uci, language),
    folge: uciLineToSan(fenAfter, line).map((m) => formatSan(m, notation)),
    folge_in_worten: describeLine(fenAfter, line, language),
    bewertung_danach: move.evaluation,
    verlust_gewinnchance: Math.round(move.winLoss),
    nach_dem_zug: {
      figuren_des_spielers_in_gefahr: piecesInDanger(fenAfter, color, language),
      figuren_des_gegners_in_gefahr: piecesInDanger(fenAfter, opponent, language),
    },
  };
}

const text = z.string().trim().min(1).max(800);
const answerSchema = z.object({
  was: text,
  warum: text,
  merksatz: z.string().trim().max(400).optional(),
});

export type TrainingExplanation = z.infer<typeof answerSchema>;

export function parseTrainingExplanation(content: string): TrainingExplanation {
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
  const result = answerSchema.safeParse(data);
  if (!result.success) throw new LlmError('badResponse');
  const { merksatz, ...rest } = result.data;
  return merksatz ? { ...rest, merksatz } : rest;
}

const FORMAT = '{"was":"…","warum":"…","merksatz":"…"}';

/** Marker vor den Trainingsdaten */
export const TRAINING_DATA_LABEL: Record<ExplanationLanguage, string> = {
  de: 'Trainingsdaten:',
  en: 'Training data:',
};

const TASK: Record<ExplanationLanguage, string[]> = {
  de: [
    'Der Spieler („du“) hat gerade eine Trainingsaufgabe aus seiner eigenen Partie gelöst. Erkläre, warum bester_zug besser ist als der partiezug, den er damals gespielt hat.',
    '„was“: 1–2 Sätze: was bester_zug auf dem Brett tut und wie es laut folge_in_worten weitergeht.',
    '„warum“: 2–3 Sätze: der konkrete Unterschied zum partiezug. Nutze dessen folge_in_worten und die Figuren in Gefahr (vor_dem_zug und nach_dem_zug), z. B. welche Figur verloren ging oder welches Schach übersehen wurde. Gibt es dein_zug, sag in einem Satz, warum auch dieser Zug gut ist.',
    '„merksatz“: eine kurze allgemeine Regel, die zum motiv passt.',
    'Gewinnchancen sind Prozent für den Spieler, verlust_gewinnchance ist der Abstand zum besten Zug.',
    `Antwortformat: ${FORMAT}`,
  ],
  en: [
    'The player ("you") has just solved a training puzzle from their own game. Explain why bester_zug (the best move) is better than the partiezug (the move they played in the game).',
    '"was" (what): 1–2 sentences: what bester_zug does on the board and how play continues according to folge_in_worten.',
    '"warum" (why): 2–3 sentences: the concrete difference to the partiezug. Use its folge_in_worten and the pieces in danger (vor_dem_zug and nach_dem_zug, before and after the move), e.g. which piece was lost or which check was overlooked. If dein_zug (your move) exists, say in one sentence why this move is good too.',
    '"merksatz" (rule of thumb): a short general rule that fits the motiv (motif).',
    'Winning chances are percentages for the player, verlust_gewinnchance is the distance to the best move.',
    `Answer format: ${FORMAT}`,
  ],
};

export function trainingExplainMessages(
  facts: TrainingExplainFacts,
  level: Level,
  notation: NotationStyle,
  language: ExplanationLanguage = 'de',
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(level, notation, language) },
    {
      role: 'user',
      content: [
        ...TASK[language],
        TRAINING_DATA_LABEL[language],
        JSON.stringify(facts, null, 1),
      ].join('\n'),
    },
  ];
}
