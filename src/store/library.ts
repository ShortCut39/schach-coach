import { z } from 'zod';
import { create } from 'zustand';
import { formatPgnDate, headerValue } from '../chess/pgn';
import type { Color, Game } from '../chess/types';
import { playerAccuracy } from '../classification/accuracy';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { loadOpeningBook } from '../classification/openingBook';
import { countCategories } from '../classification/stats';
import { useAnalysis } from './analysis';
import { useGame } from './game';
import { getLibraryStorage } from './persistence';
import { applySnapshot, snapshot, type Session } from './session';
import { useSettings } from './settings';

export type Outcome = 'win' | 'loss' | 'draw' | 'open';

export const metaSchema = z.object({
  id: z.string(),
  /** Zeitpunkt der letzten Speicherung (ISO) */
  savedAt: z.string(),
  /** Partiedatum laut PGN, für die Anzeige formatiert */
  date: z.string().nullable(),
  white: z.string().nullable(),
  black: z.string().nullable(),
  event: z.string().nullable(),
  opening: z.object({ name: z.string(), eco: z.string() }).nullable(),
  userColor: z.enum(['w', 'b']),
  outcome: z.enum(['win', 'loss', 'draw', 'open']),
  /** Genauigkeit des Nutzers */
  accuracy: z.number().nullable(),
  mistakes: z.number(),
  blunders: z.number(),
  plies: z.number(),
  depth: z.number(),
  multipv: z.number(),
});

export type LibraryMeta = z.infer<typeof metaSchema>;

/**
 * Kennung einer Partie aus ihrem PGN (FNV-1a, 2 × 32 Bit, hexadezimal).
 * Dieselbe Partie bekommt immer dieselbe Kennung – so wird nichts doppelt gespeichert oder gerechnet.
 */
export function gameId(pgn: string): string {
  const text = pgn.replace(/\r\n?/g, '\n').trim();
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function outcomeFor(result: Game['result'], userColor: Color): Outcome {
  if (result === '1/2-1/2') return 'draw';
  if (result === '*') return 'open';
  return (result === '1-0') === (userColor === 'w') ? 'win' : 'loss';
}

async function metaFor(game: Game, record: Session): Promise<LibraryMeta> {
  const evals = useAnalysis.getState().evals;
  const book = await loadOpeningBook();
  const analysis = computeGameAnalysis(game, evals, book, useSettings.getState().thresholds);
  const counts = countCategories(game, analysis.plies, record.userColor);
  return {
    id: gameId(game.pgn),
    savedAt: new Date().toISOString(),
    date: formatPgnDate(game.headers.Date) ?? null,
    white: headerValue(game.headers, 'White') ?? null,
    black: headerValue(game.headers, 'Black') ?? null,
    event: headerValue(game.headers, 'Event') ?? null,
    opening: analysis.opening ? { name: analysis.opening.name, eco: analysis.opening.eco } : null,
    userColor: record.userColor,
    outcome: outcomeFor(game.result, record.userColor),
    accuracy: playerAccuracy(game, analysis.plies, record.userColor).overall ?? null,
    mistakes: counts.mistake + counts.miss,
    blunders: counts.blunder,
    plies: game.plies.length,
    depth: record.analysis?.depth ?? 0,
    multipv: record.analysis?.multipv ?? 0,
  };
}

interface LibraryState {
  entries: LibraryMeta[];
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Speichert die aktuelle Partie, sobald die Engine sie vollständig bewertet hat. */
  saveCurrent: () => Promise<void>;
  open: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  entries: [],
  loaded: false,

  refresh: async () => {
    const raw = await getLibraryStorage()
      .list()
      .catch(() => []);
    const entries = raw.flatMap((item) => {
      const parsed = metaSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    set({ entries, loaded: true });
  },

  saveCurrent: async () => {
    const { source } = useGame.getState();
    const analysis = useAnalysis.getState();
    if (source?.kind !== 'game' || analysis.source !== source || analysis.status !== 'done') return;
    const record = snapshot();
    if (!record) return;
    const meta = await metaFor(source, record);
    await getLibraryStorage().save(meta.id, meta, record);
    set({ entries: [...get().entries.filter((e) => e.id !== meta.id), meta] });
  },

  open: async (id) => {
    const record = await getLibraryStorage()
      .get(id)
      .catch(() => null);
    return applySnapshot(record);
  },

  remove: async (id) => {
    await getLibraryStorage().remove(id);
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },
}));

/** Gespeicherter Datensatz zu dieser Partie, falls vorhanden (für „nichts doppelt rechnen“). */
export async function findRecord(game: Game): Promise<unknown> {
  return getLibraryStorage()
    .get(gameId(game.pgn))
    .catch(() => null);
}
