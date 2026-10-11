import { DEFAULT_POSITION } from 'chess.js';
import { z } from 'zod';
import { pliesFromHistory } from '../../chess/pgn';
import type { Color, PlyBase } from '../../chess/types';
import type { TimeControl } from '../clock/clock';
import { boardOutcome, drawOutcome, replay, winOutcome, type GameOutcome } from '../rules/gameEnd';
import type { PlayerInfo } from '../session/types';

/** Daten aus dem Board-API-Partiestrom (nur, was die App braucht; der Rest wird ignoriert) */
const colorSchema = z.enum(['white', 'black']);

export const gameStateSchema = z.object({
  type: z.literal('gameState'),
  moves: z.string(),
  wtime: z.number(),
  btime: z.number(),
  winc: z.number().optional().catch(undefined),
  binc: z.number().optional().catch(undefined),
  status: z.string(),
  winner: colorSchema.optional().catch(undefined),
  wdraw: z.boolean().optional().catch(undefined),
  bdraw: z.boolean().optional().catch(undefined),
  wtakeback: z.boolean().optional().catch(undefined),
  btakeback: z.boolean().optional().catch(undefined),
});
export type LichessGameState = z.infer<typeof gameStateSchema>;

const playerSchema = z.object({
  id: z.string().nullable().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  title: z.string().nullable().optional().catch(undefined),
  rating: z.number().optional().catch(undefined),
  provisional: z.boolean().optional().catch(undefined),
  aiLevel: z.number().optional().catch(undefined),
});

export const gameFullSchema = z.object({
  type: z.literal('gameFull'),
  id: z.string(),
  variant: z.object({ key: z.string() }).catch({ key: 'unknown' }),
  clock: z.object({ initial: z.number(), increment: z.number() }).nullable().optional().catch(null),
  speed: z.string().catch('unknown'),
  rated: z.boolean().catch(false),
  createdAt: z.number().optional().catch(undefined),
  white: playerSchema,
  black: playerSchema,
  initialFen: z.string().catch('startpos'),
  state: gameStateSchema,
});
export type LichessGameFull = z.infer<typeof gameFullSchema>;

export const opponentGoneSchema = z.object({
  type: z.literal('opponentGone'),
  gone: z.boolean().catch(false),
  claimWinInSeconds: z.number().optional().catch(undefined),
});

export const chatLineSchema = z.object({
  type: z.literal('chatLine'),
  room: z.string().catch('player'),
  username: z.string().catch(''),
  text: z.string().catch(''),
});

export type GameStreamMessage =
  | LichessGameFull
  | LichessGameState
  | z.infer<typeof opponentGoneSchema>
  | z.infer<typeof chatLineSchema>;

/** Eine Zeile des Partiestroms; unbekannte Nachrichten ergeben `null`. */
export function parseGameStreamMessage(raw: unknown): GameStreamMessage | null {
  const type = (raw as { type?: unknown } | null)?.type;
  const schema =
    type === 'gameFull'
      ? gameFullSchema
      : type === 'gameState'
        ? gameStateSchema
        : type === 'opponentGone'
          ? opponentGoneSchema
          : type === 'chatLine'
            ? chatLineSchema
            : null;
  if (!schema) return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Ereignisstrom: Partiestart und -ende (nur die Felder, die die App braucht) */
const eventGameSchema = z.object({
  gameId: z.string(),
  fullId: z.string().optional().catch(undefined),
  color: colorSchema.optional().catch(undefined),
  variant: z.object({ key: z.string() }).optional().catch(undefined),
  speed: z.string().optional().catch(undefined),
  rated: z.boolean().optional().catch(undefined),
  compat: z.object({ board: z.boolean().optional() }).optional().catch(undefined),
  opponent: z
    .object({ username: z.string().optional(), rating: z.number().optional().nullable() })
    .optional()
    .catch(undefined),
});
const challengeUserSchema = z
  .object({
    id: z.string().optional().catch(undefined),
    name: z.string().catch('?'),
    rating: z.number().nullable().optional().catch(undefined),
    title: z.string().nullable().optional().catch(undefined),
  })
  .nullable()
  .catch(null);

/** Herausforderung (eingehend oder ausgehend), nur die nötigen Felder */
export const challengeSchema = z.object({
  id: z.string(),
  status: z.string().catch('created'),
  challenger: challengeUserSchema,
  destUser: challengeUserSchema,
  variant: z.object({ key: z.string() }).catch({ key: 'unknown' }),
  rated: z.boolean().catch(false),
  speed: z.string().catch('unknown'),
  timeControl: z
    .object({
      type: z.string(),
      limit: z.number().optional().catch(undefined),
      increment: z.number().optional().catch(undefined),
    })
    .catch({ type: 'unknown' }),
  color: z.string().catch('random'),
  direction: z.enum(['in', 'out']).optional().catch(undefined),
});
export type LichessChallenge = z.infer<typeof challengeSchema>;

export const lichessEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gameStart'), game: eventGameSchema }),
  z.object({ type: z.literal('gameFinish'), game: eventGameSchema }),
  z.object({ type: z.literal('challenge'), challenge: challengeSchema }),
  z.object({ type: z.literal('challengeCanceled'), challenge: challengeSchema }),
  z.object({ type: z.literal('challengeDeclined'), challenge: challengeSchema }),
]);

/** Kann die App diese Herausforderung spielen? (normales Schach mit Uhr, kein Fernschach) */
export function playableChallenge(challenge: LichessChallenge): boolean {
  return challenge.variant.key === 'standard' && challenge.timeControl.type === 'clock';
}
export type LichessEvent = z.infer<typeof lichessEventSchema>;
export type LichessEventGame = z.infer<typeof eventGameSchema>;

export function parseLichessEvent(raw: unknown): LichessEvent | null {
  const parsed = lichessEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Laufende Partien (`GET /api/account/playing`) */
export const nowPlayingSchema = z.object({
  nowPlaying: z
    .array(
      z.object({
        gameId: z.string(),
        color: colorSchema.catch('white'),
        variant: z.object({ key: z.string() }).catch({ key: 'unknown' }),
        speed: z.string().catch('unknown'),
        rated: z.boolean().catch(false),
        isMyTurn: z.boolean().catch(false),
        secondsLeft: z.number().nullable().optional().catch(undefined),
        opponent: z
          .object({ username: z.string().catch('?'), rating: z.number().nullable().optional() })
          .catch({ username: '?' }),
      }),
    )
    .catch([]),
});
export type NowPlaying = z.infer<typeof nowPlayingSchema>['nowPlaying'][number];

export function toColor(color: 'white' | 'black'): Color {
  return color === 'white' ? 'w' : 'b';
}

export function startFenOf(initialFen: string): string {
  return initialFen === 'startpos' || !initialFen.trim() ? DEFAULT_POSITION : initialFen;
}

export function uciMoves(moves: string): string[] {
  return moves.trim() ? moves.trim().split(/\s+/) : [];
}

/** Stellung und Halbzüge aus der Zugliste des Servers; `null`, wenn ein Zug nicht passt. */
export function rebuild(
  startFen: string,
  moves: readonly string[],
): {
  fen: string;
  turn: Color;
  plies: PlyBase[];
  chess: NonNullable<ReturnType<typeof replay>>;
} | null {
  const chess = replay(startFen, moves);
  if (!chess) return null;
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    plies: pliesFromHistory(chess.history({ verbose: true })),
    chess,
  };
}

/** Läuft die Partie laut Server noch? */
export function isOngoing(status: string): boolean {
  return status === 'created' || status === 'started';
}

/**
 * Ergebnis aus dem Status des Servers. Bei `draw` wird, wenn das Brett es hergibt, der genaue
 * Grund (Wiederholung, 50 Züge …) genannt, sonst „durch Einigung“.
 */
export function outcomeOf(
  state: Pick<LichessGameState, 'status' | 'winner'>,
  chess: Parameters<typeof boardOutcome>[0] | null,
): GameOutcome | null {
  const winner = state.winner ? toColor(state.winner) : null;
  const decided = (reason: GameOutcome['reason']) =>
    winner ? winOutcome(winner, reason) : drawOutcome(reason);
  switch (state.status) {
    case 'created':
    case 'started':
      return null;
    case 'aborted':
      return { result: '*', winner: null, reason: 'aborted' };
    case 'mate':
      return decided('checkmate');
    case 'resign':
      return decided('resign');
    case 'stalemate':
      return drawOutcome('stalemate');
    case 'outoftime':
      return winner ? winOutcome(winner, 'timeout') : drawOutcome('timeoutVsInsufficient');
    case 'timeout':
      // Lichess: Ein Spieler hat die Partie verlassen, der andere hat Sieg/Remis beansprucht
      return decided('opponentLeft');
    case 'draw': {
      const board = chess ? boardOutcome(chess) : null;
      return board && board.winner === null ? board : drawOutcome('agreement');
    }
    case 'insufficientMaterialClaim':
      return drawOutcome('insufficientMaterial');
    case 'noStart':
      return winner
        ? winOutcome(winner, 'noStart')
        : { result: '*', winner: null, reason: 'noStart' };
    case 'cheat':
      return decided('cheat');
    default:
      return decided('unknown');
  }
}

export function playerInfo(player: z.infer<typeof playerSchema>): PlayerInfo {
  const info: PlayerInfo = {
    name: player.name ?? (player.aiLevel ? `Stockfish ${player.aiLevel}` : '?'),
  };
  if (player.rating !== undefined) info.rating = player.rating;
  if (player.provisional) info.provisional = true;
  if (player.title) info.title = player.title;
  return info;
}

export function timeControlOf(full: LichessGameFull): TimeControl | null {
  return full.clock ? { initialMs: full.clock.initial, incrementMs: full.clock.increment } : null;
}

/** Offenes Remisangebot laut Server */
export function drawOfferOf(state: LichessGameState): Color | null {
  if (state.wdraw) return 'w';
  if (state.bdraw) return 'b';
  return null;
}

/** Zug vom Brett als UCI (Rochade als Königszug, z. B. `e1g1`) */
export function boardMoveToUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
