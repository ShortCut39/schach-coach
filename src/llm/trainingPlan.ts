import { z } from 'zod';
import type { NotationStyle } from '../chess/notation';
import { systemPrompt, type Level } from './prompts';
import { LlmError, type ChatMessage } from './types';

/** Ein Beispiel für ein Fehlermotiv, in Worten (chess.js) */
export interface MotifExampleFacts {
  partie: string;
  zug: string;
  zug_in_worten: string | null;
  folge: string | null;
}

/** Fakten für den Trainingsplan – nur berechnete Zahlen und Beispiele aus den Partien. */
export interface TrainingFacts {
  partien: number;
  genauigkeit: {
    durchschnitt: number | null;
    letzte_partien: number | null;
    fruehere_partien: number | null;
    phasen: Record<string, { genauigkeit: number | null; fehler_pro_10_zuege: number | null }>;
  };
  fehler_motive: {
    motiv: string;
    erklaerung: string;
    anzahl: number;
    anteil_prozent: number;
    beispiele: MotifExampleFacts[];
  }[];
  eroeffnungen: {
    name: string;
    eco: string;
    farbe: string;
    partien: number;
    siege: number;
    remis: number;
    niederlagen: number;
    genauigkeit: number | null;
    theorie_zuege: number;
  }[];
}

const planSchema = z.object({
  einschaetzung: z.string().trim().min(1).max(600),
  empfehlungen: z
    .array(
      z.object({
        titel: z.string().trim().min(1).max(80),
        text: z.string().trim().min(1).max(600),
        uebung: z.string().trim().min(1).max(400),
      }),
    )
    .min(1),
});

export type TrainingPlan = z.infer<typeof planSchema>;

export function parseTrainingPlan(content: string): TrainingPlan {
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
  const result = planSchema.safeParse(data);
  if (!result.success) throw new LlmError('badResponse');
  return { ...result.data, empfehlungen: result.data.empfehlungen.slice(0, 3) };
}

const FORMAT =
  '{"einschaetzung":"…","empfehlungen":[{"titel":"…","text":"…","uebung":"…"},{"titel":"…","text":"…","uebung":"…"},{"titel":"…","text":"…","uebung":"…"}]}';

export function trainingPlanMessages(
  facts: TrainingFacts,
  level: Level,
  notation: NotationStyle,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(level, notation) },
    {
      role: 'user',
      content: [
        `Erstelle aus den Mustern von ${facts.partien} Partien des Spielers („du“) einen kurzen Trainingsplan.`,
        '„einschaetzung“: 1–2 Sätze: Was ist das wichtigste Muster, und in welcher Phase passieren die meisten Fehler?',
        '„empfehlungen“: genau 3 Empfehlungen, die wichtigste zuerst. Jede hat einen kurzen Titel (höchstens 5 Wörter), einen „text“ (1–2 Sätze, mit Bezug auf ein konkretes Beispiel aus fehler_motive, z. B. „wie bei 8… Dh4“) und eine „uebung“: eine konkrete Gewohnheit oder Übung für die nächsten Partien.',
        'Stütze dich nur auf die Zahlen und Beispiele in den Daten. Wenn es nur wenige Partien sind, sag, dass die Aussagen vorläufig sind.',
        `Antwortformat: ${FORMAT}`,
        'Daten:',
        JSON.stringify(facts, null, 1),
      ].join('\n'),
    },
  ];
}
