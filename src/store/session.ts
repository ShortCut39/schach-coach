import { z } from 'zod';
import { parseFen } from '../chess/fen';
import { parsePgnGame } from '../chess/pgn';
import type { PositionEval } from '../engine/types';
import type { GameSummary } from '../llm/summary';
import { positionsOf, useAnalysis } from './analysis';
import { useChat } from './chat';
import { useExplanations, type PlyExplanations } from './explanations';
import { useGame, type LoadedSource } from './game';
import { useLibrary } from './library';
import { getSettingsStorage } from './persistence';

/**
 * Letzte Sitzung: Partie, Stellung, Engine-Bewertungen, Erklärungen und Zusammenfassung.
 * Wird beim Start wiederhergestellt, damit nichts neu gerechnet werden muss.
 */
const STORAGE_KEY = 'lastSession';
/** Engine aller Analysen vor Einführung der nativen Engine */
export const LEGACY_ENGINE = 'Stockfish 19 Lite WASM';
const SAVE_DELAY_MS = 1000;

const lineSchema = z.object({
  multipv: z.number(),
  cp: z.number().optional(),
  mate: z.number().optional(),
  pv: z.array(z.string()),
  depth: z.number(),
});
const evalSchema = z.object({
  fen: z.string(),
  depth: z.number(),
  multipv: z.number(),
  lines: z.array(lineSchema),
  terminal: z
    .union([
      z.object({ kind: z.literal('checkmate'), winner: z.enum(['w', 'b']) }),
      z.object({ kind: z.literal('stalemate') }),
    ])
    .optional(),
});
const explanationSchema = z.object({
  ply: z.number(),
  was: z.string(),
  warum: z.string(),
  aufbauen: z.string(),
  merksatz: z.string().optional(),
});
const entrySchema = z.object({ status: z.literal('done'), explanation: explanationSchema });

export const sessionSchema = z.object({
  version: z.literal(1),
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('game'), pgn: z.string() }),
    z.object({ kind: z.literal('position'), fen: z.string() }),
  ]),
  userColor: z.enum(['w', 'b']),
  orientation: z.enum(['white', 'black']),
  current: z.number().int(),
  analysis: z
    .object({
      depth: z.number().int(),
      multipv: z.number().int(),
      /** Engine, die bewertet hat; ältere Einträge stammen alle von der WASM-Lite-Version */
      engine: z.string().catch(LEGACY_ENGINE),
      evals: z.array(evalSchema.nullable()),
    })
    .nullable(),
  explanations: z.record(
    z.string(),
    z.object({
      short: entrySchema.optional(),
      detailed: entrySchema.optional(),
      opponent: entrySchema.optional(),
    }),
  ),
  summary: z
    .object({
      eroeffnung: z.string(),
      wendepunkte: z.array(z.object({ ply: z.number(), text: z.string() })),
      tipps: z.array(z.object({ titel: z.string(), text: z.string() })),
    })
    .nullable(),
  /** Chat zur Stellung (optional, ältere Sitzungen haben keinen) */
  chat: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        context: z.string().optional(),
      }),
    )
    .optional(),
});

export type Session = z.infer<typeof sessionSchema>;

/** Nur fertige Erklärungen werden gespeichert (nicht „lädt“ oder „fehlgeschlagen“). */
function doneOnly(entries: Record<number, PlyExplanations>): Session['explanations'] {
  const result: Session['explanations'] = {};
  for (const [ply, entry] of Object.entries(entries)) {
    const kept: Session['explanations'][string] = {};
    for (const kind of ['short', 'detailed', 'opponent'] as const) {
      const e = entry[kind];
      if (e?.status === 'done' && e.explanation)
        kept[kind] = { status: 'done', explanation: e.explanation };
    }
    if (Object.keys(kept).length) result[ply] = kept;
  }
  return result;
}

export function snapshot(): Session | null {
  const { source, userColor, orientation, current } = useGame.getState();
  if (!source) return null;
  const analysis = useAnalysis.getState();
  const explanations = useExplanations.getState();
  const ownAnalysis = analysis.source === source;
  const ownExplanations = explanations.source === source;
  return {
    version: 1,
    source:
      source.kind === 'game'
        ? { kind: 'game', pgn: source.pgn }
        : { kind: 'position', fen: source.fen },
    userColor,
    orientation,
    current,
    analysis: ownAnalysis
      ? {
          ...analysis.settings,
          engine: analysis.engine ?? LEGACY_ENGINE,
          evals: analysis.evals.map((e) => e ?? null),
        }
      : null,
    explanations: ownExplanations ? doneOnly(explanations.entries) : {},
    summary:
      ownExplanations && explanations.summary?.status === 'done'
        ? (explanations.summary.data ?? null)
        : null,
  };
}

export async function saveSession(): Promise<void> {
  const data = snapshot();
  await getSettingsStorage().set(STORAGE_KEY, data);
}

/** Stellt die letzte Sitzung wieder her. `false`, wenn es keine (gültige) gibt. */
export async function restoreSession(): Promise<boolean> {
  try {
    return applySnapshot(await getSettingsStorage().get(STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Lädt eine Momentaufnahme (Sitzung oder Bibliothekseintrag) in die Stores. */
export function applySnapshot(raw: unknown): boolean {
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) return false;
  const session = parsed.data;

  let source: LoadedSource;
  if (session.source.kind === 'game') {
    const game = parsePgnGame(session.source.pgn);
    if (!game.ok) return false;
    source = game.value;
  } else {
    const position = parseFen(session.source.fen);
    if (!position.ok) return false;
    source = position.value;
  }

  useGame.getState().load(source, session.userColor);
  useGame.setState({ orientation: session.orientation });
  useGame.getState().goTo(session.current);

  const fens = positionsOf(source);
  if (session.analysis && session.analysis.evals.length === fens.length) {
    const evals = session.analysis.evals.map((e, i) =>
      e && e.fen === fens[i] ? (e as PositionEval) : undefined,
    );
    const done = evals.filter(Boolean).length;
    useAnalysis.setState({
      source,
      fens,
      evals,
      settings: { depth: session.analysis.depth, multipv: session.analysis.multipv },
      engine: session.analysis.engine,
      status: done === fens.length ? 'done' : 'aborted',
      progress: { done, total: fens.length, current: null, depth: null },
    });
  }

  const entries: Record<number, PlyExplanations> = {};
  for (const [ply, entry] of Object.entries(session.explanations)) {
    entries[Number(ply)] = entry as PlyExplanations;
  }
  useExplanations.setState({
    source,
    entries,
    summary: session.summary ? { status: 'done', data: session.summary as GameSummary } : null,
    run: { status: 'idle', done: 0, total: 0 },
  });
  useChat.setState({
    source,
    messages: (session.chat ?? []).map((m) =>
      m.context ? { ...m, context: m.context } : { role: m.role, content: m.content },
    ),
    pending: false,
    error: null,
  });
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Speichert Änderungen verzögert (höchstens einmal pro Sekunde). Gibt eine Abmeldefunktion zurück. */
export function startSessionAutosave(): () => void {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void saveSession().catch(() => undefined);
      // Vollständig bewertete Partien landen automatisch in der Bibliothek
      void useLibrary
        .getState()
        .saveCurrent()
        .catch(() => undefined);
    }, SAVE_DELAY_MS);
  };
  const unsubscribers = [
    useGame.subscribe(schedule),
    useAnalysis.subscribe((state, previous) => {
      if (state.evals !== previous.evals || state.status !== previous.status) schedule();
    }),
    useChat.subscribe((state, previous) => {
      if (state.messages !== previous.messages) schedule();
    }),
    useExplanations.subscribe((state, previous) => {
      if (state.entries !== previous.entries || state.summary !== previous.summary) schedule();
    }),
  ];
  return () => {
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
