import { z } from 'zod';
import { MOTIFS } from '../classification/motifs';
import { CATEGORIES } from '../classification/types';

const phaseRecord = <T extends z.ZodType>(value: T) =>
  z.object({ opening: value, middlegame: value, endgame: value });

/** Prüfschema für gespeicherte Kennzahlen (siehe classification/gameStats.ts). */
export const gameStatsSchema = z.object({
  version: z.literal(1),
  motifs: z.array(
    z.object({
      motif: z.enum(MOTIFS as [string, ...string[]]),
      ply: z.number(),
      moveNumber: z.number(),
      color: z.enum(['w', 'b']),
      san: z.string(),
      category: z.enum(CATEGORIES as [string, ...string[]]),
      phase: z.enum(['opening', 'middlegame', 'endgame']),
      winLoss: z.number(),
    }),
  ),
  errorsByPhase: phaseRecord(z.number()),
  movesByPhase: phaseRecord(z.number()),
  accuracyByPhase: phaseRecord(z.number().nullable()),
  bookPlies: z.number(),
});
