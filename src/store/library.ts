import { z } from 'zod';
import { create } from 'zustand';
import { formatPgnDate, headerValue, parsePgnGame } from '../chess/pgn';
import type { Color, Game } from '../chess/types';
import { playerAccuracy } from '../classification/accuracy';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { computeGameStats } from '../classification/gameStats';
import type { PositionEval } from '../engine/types';
import { gameStatsSchema } from './libraryStats';
import { loadOpeningBook } from '../classification/openingBook';
import { countCategories } from '../classification/stats';
import { useAnalysis } from './analysis';
import { useGame, type LoadedSource } from './game';
import { getLibraryStorage } from './persistence';
import { applySnapshot, sessionSchema, snapshot, type Session } from './session';
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
  /** Spieldatum als ISO-Datum (YYYY-MM-DD), falls in der PGN vollständig angegeben */
  playedAt: z.string().nullable().catch(null),
  /** Kennzahlen für „Muster über viele Partien“; fehlt bei älteren Einträgen */
  stats: gameStatsSchema.optional().catch(undefined),
  /** `false` = gespielt, aber noch nicht von der Engine bewertet (ältere Einträge sind alle analysiert) */
  analysed: z.boolean().catch(true),
});

export type LibraryMeta = z.infer<typeof metaSchema>;

/** `2026.10.09` → `2026-10-09`; unvollständige Daten → `null` */
export function isoDate(pgnDate: string | undefined): string | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(pgnDate?.trim() ?? '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

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

async function metaFor(
  game: Game,
  record: Session,
  evals: readonly (PositionEval | undefined)[],
  savedAt = new Date().toISOString(),
): Promise<LibraryMeta> {
  const book = await loadOpeningBook();
  const analysis = computeGameAnalysis(game, evals, book, useSettings.getState().thresholds);
  const counts = countCategories(game, analysis.plies, record.userColor);
  return {
    id: gameId(game.pgn),
    savedAt,
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
    playedAt: isoDate(game.headers.Date),
    stats: computeGameStats(game, evals, analysis, record.userColor),
    analysed: true,
  };
}

/** Eintrag für eine gespielte, noch nicht analysierte Partie (Eröffnung aus dem Buch, sonst leer). */
async function unanalysedMeta(game: Game, userColor: Color): Promise<LibraryMeta> {
  const book = await loadOpeningBook();
  const opening = computeGameAnalysis(game, [], book, useSettings.getState().thresholds).opening;
  return {
    id: gameId(game.pgn),
    savedAt: new Date().toISOString(),
    date: formatPgnDate(game.headers.Date) ?? null,
    white: headerValue(game.headers, 'White') ?? null,
    black: headerValue(game.headers, 'Black') ?? null,
    event: headerValue(game.headers, 'Event') ?? null,
    opening: opening ? { name: opening.name, eco: opening.eco } : null,
    userColor,
    outcome: outcomeFor(game.result, userColor),
    accuracy: null,
    mistakes: 0,
    blunders: 0,
    plies: game.plies.length,
    depth: 0,
    multipv: 0,
    playedAt: isoDate(game.headers.Date),
    analysed: false,
  };
}

interface LibraryState {
  entries: LibraryMeta[];
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Speichert die aktuelle Partie, sobald die Engine sie vollständig bewertet hat. */
  saveCurrent: () => Promise<void>;
  /**
   * Legt eine gerade gespielte Partie ohne Bewertungen an („nicht analysiert“). Eine schon
   * vorhandene Partie mit derselben Kennung bleibt unverändert.
   */
  savePlayed: (game: Game, userColor: Color) => Promise<void>;
  open: (id: string) => Promise<boolean>;
  /** Rechnet fehlende Kennzahlen älterer Einträge aus den gespeicherten Bewertungen nach. */
  ensureStats: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Gelöschte, aber noch geöffnete Partie: Das automatische Speichern darf sie nicht wieder anlegen
 * (z. B. beim nächsten Zugwechsel). Ein neuer Import oder ein erneutes Öffnen ist ein anderes
 * Objekt und wird wieder gespeichert.
 */
let removedSource: LoadedSource | null = null;

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
    if (source === removedSource) return;
    const record = snapshot();
    if (!record) return;
    const meta = await metaFor(source, record, analysis.evals);
    await getLibraryStorage().save(meta.id, meta, record);
    set({ entries: [...get().entries.filter((e) => e.id !== meta.id), meta] });
  },

  savePlayed: async (game, userColor) => {
    const storage = getLibraryStorage();
    const id = gameId(game.pgn);
    if (await storage.get(id).catch(() => null)) return;
    const meta = await unanalysedMeta(game, userColor);
    const record: Session = {
      version: 1,
      source: { kind: 'game', pgn: game.pgn },
      userColor,
      orientation: userColor === 'w' ? 'white' : 'black',
      current: -1,
      analysis: null,
      explanations: {},
      summary: null,
    };
    await storage.save(id, meta, record);
    set({ entries: [...get().entries.filter((e) => e.id !== id), meta] });
  },

  open: async (id) => {
    const record = await getLibraryStorage()
      .get(id)
      .catch(() => null);
    return applySnapshot(record);
  },

  ensureStats: async () => {
    // Nicht analysierte Partien haben keine Bewertungen, aus denen sich etwas nachrechnen ließe
    const missing = get().entries.filter((e) => !e.stats && e.analysed);
    if (missing.length === 0) return;
    const updated: LibraryMeta[] = [];
    for (const entry of missing) {
      const raw = await getLibraryStorage()
        .get(entry.id)
        .catch(() => null);
      const parsed = sessionSchema.safeParse(raw);
      if (!parsed.success || parsed.data.source.kind !== 'game' || !parsed.data.analysis) continue;
      const game = parsePgnGame(parsed.data.source.pgn);
      if (!game.ok) continue;
      const evals = parsed.data.analysis.evals.map(
        (e) => (e ?? undefined) as PositionEval | undefined,
      );
      const meta = await metaFor(game.value, parsed.data, evals, entry.savedAt);
      await getLibraryStorage().save(meta.id, meta, parsed.data);
      updated.push(meta);
    }
    if (updated.length) {
      const byId = new Map(updated.map((m) => [m.id, m]));
      set({ entries: get().entries.map((e) => byId.get(e.id) ?? e) });
    }
  },

  remove: async (id) => {
    const { source } = useGame.getState();
    if (source?.kind === 'game' && gameId(source.pgn) === id) removedSource = source;
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
