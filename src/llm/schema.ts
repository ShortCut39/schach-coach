import { z } from 'zod';
import { LlmError } from './types';

const text = z.string().trim().min(1).max(800);

/** Eine Erklärung pro Zug, jeweils 1–3 kurze Sätze (bei „ausführlich“ mehr). */
export const explanationSchema = z.object({
  ply: z.number().int().nonnegative(),
  was: text,
  warum: text,
  aufbauen: text,
  merksatz: z.string().trim().max(400).optional(),
});

export const batchResponseSchema = z.object({ explanations: z.array(explanationSchema) });

export type Explanation = z.infer<typeof explanationSchema>;

/**
 * Holt das JSON aus der Antwort (auch wenn ein Modell ```json-Zäune oder Text drumherum schreibt)
 * und prüft es. Ein nacktes Array wird als `{ explanations: [...] }` akzeptiert.
 */
export function parseExplanations(content: string): Explanation[] {
  const unfenced = content.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.search(/[[{]/);
  const end = Math.max(unfenced.lastIndexOf('}'), unfenced.lastIndexOf(']'));
  if (start < 0 || end < start) throw new LlmError('badResponse');
  let data: unknown;
  try {
    data = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new LlmError('badResponse');
  }
  if (Array.isArray(data)) data = { explanations: data };
  const result = batchResponseSchema.safeParse(data);
  if (!result.success) throw new LlmError('badResponse');
  // Leere Merksätze weglassen
  return result.data.explanations.map(({ merksatz, ...rest }) =>
    merksatz ? { ...rest, merksatz } : rest,
  );
}
