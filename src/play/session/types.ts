import type { Color, PlyBase } from '../../chess/types';
import type { ClockSnapshot, TimeControl } from '../clock/clock';
import type { GameOutcome } from '../rules/gameEnd';

export type PlayMode = 'local' | 'lichess';

/** Zug, wie er vom Brett kommt */
export interface BoardMoveInput {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface PlayerInfo {
  /** Anzeigename; beim lokalen Gegner leer (die Oberfläche zeigt „Stockfish (Stufe …)“) */
  name: string;
  rating?: number;
  provisional?: boolean;
  /** Lichess-Titel, z. B. `GM`, `BOT` */
  title?: string;
}

export type GameStatus = 'starting' | 'playing' | 'ended';

/** Kurze Meldungen an den Nutzer (die Oberfläche übersetzt sie) */
export type SessionNotice =
  | 'moveRejected'
  | 'drawDeclined'
  | 'drawOfferSent'
  | 'opponentError'
  | 'connectionLost'
  | 'actionFailed'
  | 'rateLimited';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

/** Nur bei Lichess-Partien */
export interface LiveInfo {
  gameId: string;
  rated: boolean;
  /** Tempo laut Lichess (`rapid`, `classical` …) */
  speed: string;
  connection: ConnectionState;
  /** Gegner hat die Partie verlassen; ab `claimWinAt` (performance.now) kann Sieg beansprucht werden */
  opponentGone: { claimWinAt: number | null } | null;
  /** Offener Rücknahmewunsch und von wem */
  takebackOffer: Color | null;
}

/** Alles, was die Spielen-Seite anzeigt. Unveränderlich: jede Änderung ist ein neues Objekt. */
export interface GameViewState {
  mode: PlayMode;
  status: GameStatus;
  myColor: Color;
  startFen: string;
  /** Aktuelle Stellung */
  fen: string;
  turn: Color;
  plies: PlyBase[];
  players: Record<Color, PlayerInfo>;
  /** `null` = ohne Uhr */
  timeControl: TimeControl | null;
  clock: ClockSnapshot | null;
  outcome: GameOutcome | null;
  /** Offenes Remisangebot und von wem */
  drawOffer: Color | null;
  /** Gegner rechnet bzw. wir warten auf den Server */
  waiting: boolean;
  notice: { code: SessionNotice; id: number } | null;
  /** Wie oft ein Tipp angezeigt wurde (nur lokal) */
  hintsUsed: number;
  /** Wie oft ein Zug zurückgenommen wurde (nur lokal) */
  takebacks: number;
  /** Datum des Partiebeginns (für das PGN) */
  startedAt: Date;
  /** Nur Lichess: Partie-Kennung, Verbindung, Gegner weg … */
  live?: LiveInfo;
}

/** Welche Hilfen die Oberfläche anbieten darf. Bei Lichess ist alles aus. */
export interface SessionCapabilities {
  hints: boolean;
  takeback: boolean;
  evalBar: boolean;
  chat: boolean;
  /** Abbruch ist grundsätzlich möglich (ob gerade, sagt `canAbort`) */
  abort: boolean;
}

/** Gemeinsame Schnittstelle für lokale Partien und Lichess-Partien. */
export interface GameSession {
  readonly capabilities: SessionCapabilities;
  readonly state: GameViewState;
  subscribe(listener: (state: GameViewState) => void): () => void;
  playMove(move: BoardMoveInput): Promise<void>;
  resign(): Promise<void>;
  offerDraw(): Promise<void>;
  respondDraw(accept: boolean): Promise<void>;
  /** Abbruch ohne Wertung, nur ganz am Anfang */
  abort(): Promise<void>;
  canAbort(): boolean;
  dispose(): void;
}

/** Die ersten Züge: Bis jede Seite einmal gezogen hat, ist ein Abbruch möglich (wie auf Lichess). */
export function abortable(state: GameViewState): boolean {
  return state.status === 'playing' && state.plies.length < 2;
}

export function uciOf(move: BoardMoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
