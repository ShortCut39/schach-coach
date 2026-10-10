import { DEFAULT_POSITION } from 'chess.js';
import type { Color } from '../../chess/types';
import { ChessClock, defaultTimeSource, type TimeSource } from '../clock/clock';
import { LichessError, type LichessClient } from '../lichess/client';
import {
  boardMoveToUci,
  drawOfferOf,
  isOngoing,
  outcomeOf,
  parseGameStreamMessage,
  playerInfo,
  rebuild,
  startFenOf,
  timeControlOf,
  uciMoves,
  type LichessGameFull,
  type LichessGameState,
} from '../lichess/mapper';
import { readNdjson } from '../lichess/ndjson';
import { applyUci } from '../rules/gameEnd';
import type {
  BoardMoveInput,
  ConnectionState,
  GameSession,
  GameViewState,
  SessionCapabilities,
  SessionNotice,
} from './types';

export interface LichessSessionOptions {
  gameId: string;
  client: LichessClient;
  /** Eigene Lichess-Kennung (klein geschrieben), um die eigene Farbe zu erkennen */
  accountId: string;
  now?: TimeSource;
  /** Warten vor dem Wiederverbinden (ms), je Versuch; Standard 1, 2, 4, 8, 15, 30 s */
  reconnectDelays?: readonly number[];
  /** So lange ohne jede Zeile gilt der Partiestrom als tot (Standard 20 s) */
  idleMs?: number;
  /** Für Tests: eigenes Warten */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const DEFAULT_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
const DEFAULT_IDLE_MS = 20_000;

const defaultWait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Live-Partie auf Lichess über die Board-API. Der Server ist die einzige Wahrheit: Jede
 * `gameState`-Nachricht baut die Stellung aus der Zugliste neu auf und übernimmt die Uhrzeiten.
 * Eigene Züge erscheinen sofort (optimistisch); lehnt der Server ab oder weicht sein Stand ab,
 * gilt wieder der Serverstand. Eine Zeitüberschreitung meldet nur der Server.
 * Hilfen gibt es keine (`capabilities`), die Fair-Play-Sperre setzt der Store.
 */
export class LichessSession implements GameSession {
  readonly capabilities: SessionCapabilities = {
    hints: false,
    takeback: false,
    evalBar: false,
    chat: true,
    abort: true,
  };
  private current: GameViewState;
  private readonly listeners = new Set<(state: GameViewState) => void>();
  private readonly controller = new AbortController();
  private readonly clock: ChessClock;
  private full: LichessGameFull | null = null;
  /** Letzter Serverstand (für das Zurücksetzen nach einem abgelehnten Zug) */
  private serverState: LichessGameState | null = null;
  private noticeId = 0;
  private disposed = false;
  private readonly now: TimeSource;

  constructor(private readonly options: LichessSessionOptions) {
    this.now = options.now ?? defaultTimeSource;
    this.clock = new ChessClock({ initialMs: 0, incrementMs: 0 }, this.now);
    this.current = {
      mode: 'lichess',
      status: 'starting',
      myColor: 'w',
      startFen: DEFAULT_POSITION,
      fen: DEFAULT_POSITION,
      turn: 'w',
      plies: [],
      players: { w: { name: '' }, b: { name: '' } },
      timeControl: null,
      clock: null,
      outcome: null,
      drawOffer: null,
      waiting: false,
      notice: null,
      hintsUsed: 0,
      takebacks: 0,
      startedAt: new Date(),
      live: {
        gameId: options.gameId,
        rated: false,
        speed: 'unknown',
        connection: 'connecting',
        opponentGone: null,
        takebackOffer: null,
      },
    };
  }

  get state(): GameViewState {
    return this.current;
  }

  get gameId(): string {
    return this.options.gameId;
  }

  subscribe(listener: (state: GameViewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Partiestrom öffnen; verbindet bei Abbrüchen selbst neu, bis die Partie zu Ende ist. */
  start(): void {
    void this.run();
  }

  private async run(): Promise<void> {
    const delays = this.options.reconnectDelays ?? DEFAULT_DELAYS;
    const wait = this.options.wait ?? defaultWait;
    let attempt = 0;
    while (!this.disposed && !this.ended()) {
      try {
        const body = await this.options.client.stream(
          `/api/board/game/stream/${encodeURIComponent(this.options.gameId)}`,
          { signal: this.controller.signal },
        );
        await readNdjson(
          body,
          (raw) => {
            attempt = 0;
            this.handle(raw);
          },
          { idleMs: this.options.idleMs ?? DEFAULT_IDLE_MS, signal: this.controller.signal },
        );
      } catch (error) {
        if (this.disposed) return;
        // Partie gibt es nicht (mehr): nicht endlos neu verbinden
        if (error instanceof LichessError && error.code === 'notFound') {
          this.finishUnknown();
          return;
        }
        if (error instanceof LichessError && error.code === 'rateLimited') {
          this.update({}, 'rateLimited');
        }
      }
      if (this.disposed || this.ended()) return;
      // Strom zu Ende, aber Partie läuft noch: neu verbinden (mit wachsender Wartezeit)
      this.setConnection('reconnecting');
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? 30_000;
      attempt++;
      await wait(delay, this.controller.signal);
    }
  }

  /** Als Methode, damit TypeScript den Zustand nach `await` neu liest */
  private ended(): boolean {
    return this.current.status === 'ended';
  }

  private handle(raw: unknown): void {
    const message = parseGameStreamMessage(raw);
    if (!message || this.disposed) return;
    switch (message.type) {
      case 'gameFull':
        this.applyFull(message);
        break;
      case 'gameState':
        this.applyState(message);
        break;
      case 'opponentGone':
        this.update({
          live: {
            ...this.live(),
            opponentGone: message.gone
              ? {
                  claimWinAt:
                    message.claimWinInSeconds === undefined
                      ? null
                      : this.now() + message.claimWinInSeconds * 1000,
                }
              : null,
          },
        });
        break;
      case 'chatLine':
        // Chat folgt in L6
        break;
    }
  }

  private live() {
    return (
      this.current.live ?? {
        gameId: this.options.gameId,
        rated: false,
        speed: 'unknown',
        connection: 'connected' as ConnectionState,
        opponentGone: null,
        takebackOffer: null,
      }
    );
  }

  private applyFull(full: LichessGameFull): void {
    this.full = full;
    const white = full.white.id?.toLowerCase() === this.options.accountId.toLowerCase();
    const myColor: Color = white ? 'w' : 'b';
    const timeControl = timeControlOf(full);
    this.update({
      myColor,
      startFen: startFenOf(full.initialFen),
      players: { w: playerInfo(full.white), b: playerInfo(full.black) },
      timeControl,
      ...(full.createdAt ? { startedAt: new Date(full.createdAt) } : {}),
      live: {
        ...this.live(),
        rated: full.rated,
        speed: full.speed,
        connection: 'connected',
      },
    });
    this.applyState(full.state);
  }

  private applyState(state: LichessGameState): void {
    if (!this.full) return;
    this.serverState = state;
    const moves = uciMoves(state.moves);
    const board = rebuild(this.current.startFen, moves);
    if (!board) return;
    const outcome = outcomeOf(state, board.chess);
    const ongoing = isOngoing(state.status);
    // Uhr: Die Zeit des Servers gilt. Lichess startet die Uhren erst nach den ersten beiden Zügen.
    const running: Color | null = ongoing && moves.length >= 2 ? board.turn : null;
    if (this.full.clock) this.clock.set({ w: state.wtime, b: state.btime }, running);
    const takeback = state.wtakeback ? 'w' : state.btakeback ? 'b' : null;
    this.update({
      status: ongoing ? 'playing' : 'ended',
      fen: board.fen,
      turn: board.turn,
      plies: board.plies,
      clock: this.full.clock ? this.clock.snapshot() : null,
      outcome,
      drawOffer: ongoing ? drawOfferOf(state) : null,
      waiting: false,
      live: {
        ...this.live(),
        connection: 'connected',
        takebackOffer: ongoing ? takeback : null,
        opponentGone: ongoing ? this.live().opponentGone : null,
      },
    });
  }

  /** Zurück auf den letzten Serverstand (nach abgelehntem Zug) */
  private resetToServer(notice: SessionNotice): void {
    if (this.serverState) this.applyState(this.serverState);
    this.update({}, notice);
  }

  async playMove(move: BoardMoveInput): Promise<void> {
    const state = this.current;
    if (state.status !== 'playing' || state.waiting || state.turn !== state.myColor) return;
    const uci = boardMoveToUci(move);
    const board = rebuild(
      state.startFen,
      state.plies.map((p) => p.uci),
    );
    if (!board || !applyUci(board.chess, uci)) {
      this.update({}, 'moveRejected');
      return;
    }
    // Sofort anzeigen; die Uhr bleibt bis zur Antwort des Servers stehen
    const optimistic = rebuild(state.startFen, [...state.plies.map((p) => p.uci), uci]);
    if (optimistic) {
      this.update({
        fen: optimistic.fen,
        turn: optimistic.turn,
        plies: optimistic.plies,
        waiting: true,
        drawOffer: null,
      });
    }
    try {
      await this.options.client.request(
        `/api/board/game/${encodeURIComponent(this.options.gameId)}/move/${uci}`,
        { method: 'POST' },
      );
      // Bestätigt; der neue Stand kommt mit dem nächsten gameState
      if (this.current.waiting && this.current.fen === optimistic?.fen)
        this.update({ waiting: false });
    } catch (error) {
      this.resetToServer(
        error instanceof LichessError && error.code === 'rateLimited'
          ? 'rateLimited'
          : 'moveRejected',
      );
    }
  }

  private async action(path: string): Promise<boolean> {
    try {
      await this.options.client.request(
        `/api/board/game/${encodeURIComponent(this.options.gameId)}/${path}`,
        { method: 'POST' },
      );
      return true;
    } catch (error) {
      this.update(
        {},
        error instanceof LichessError && error.code === 'rateLimited'
          ? 'rateLimited'
          : 'actionFailed',
      );
      return false;
    }
  }

  async resign(): Promise<void> {
    if (this.current.status === 'playing') await this.action('resign');
  }

  async offerDraw(): Promise<void> {
    if (this.current.status !== 'playing') return;
    if (await this.action('draw/yes')) this.update({}, 'drawOfferSent');
  }

  async respondDraw(accept: boolean): Promise<void> {
    if (this.current.status !== 'playing') return;
    if (await this.action(`draw/${accept ? 'yes' : 'no'}`)) this.update({ drawOffer: null });
  }

  /** Rücknahmewunsch des Gegners beantworten (Lichess bietet das selbst an) */
  async respondTakeback(accept: boolean): Promise<void> {
    if (this.current.status !== 'playing') return;
    if (await this.action(`takeback/${accept ? 'yes' : 'no'}`)) {
      this.update({ live: { ...this.live(), takebackOffer: null } });
    }
  }

  /** Bis jede Seite einmal gezogen hat, ist ein Abbruch möglich (wie auf Lichess). */
  canAbort(): boolean {
    return this.current.status === 'playing' && this.current.plies.length < 2;
  }

  async abort(): Promise<void> {
    if (this.canAbort()) await this.action('abort');
  }

  /** Gegner weg und Wartezeit vorbei: Sieg beanspruchen */
  canClaimVictory(): boolean {
    const gone = this.current.live?.opponentGone;
    return (
      this.current.status === 'playing' &&
      !!gone &&
      gone.claimWinAt !== null &&
      this.now() >= gone.claimWinAt
    );
  }

  async claimVictory(): Promise<void> {
    if (this.canClaimVictory()) await this.action('claim-victory');
  }

  async claimDraw(): Promise<void> {
    if (this.canClaimVictory()) await this.action('claim-draw');
  }

  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.listeners.clear();
  }

  private setConnection(connection: ConnectionState): void {
    if (this.current.live?.connection !== connection) {
      this.update({ live: { ...this.live(), connection } });
    }
  }

  /** Partie unbekannt (z. B. gelöscht): als beendet ohne Ergebnis melden */
  private finishUnknown(): void {
    this.update({
      status: 'ended',
      outcome: this.current.outcome ?? { result: '*', winner: null, reason: 'unknown' },
      clock: this.full?.clock ? (this.clock.stop(), this.clock.snapshot()) : null,
    });
  }

  private update(patch: Partial<GameViewState>, notice?: SessionNotice): void {
    if (this.disposed) return;
    this.current = {
      ...this.current,
      ...patch,
      ...(notice ? { notice: { code: notice, id: ++this.noticeId } } : {}),
    };
    for (const listener of [...this.listeners]) listener(this.current);
  }
}
