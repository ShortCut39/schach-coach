import { Chess, DEFAULT_POSITION } from 'chess.js';
import { plyFromMove } from '../../chess/pgn';
import type { Color } from '../../chess/types';
import { ChessClock, defaultTimeSource, type TimeControl, type TimeSource } from '../clock/clock';
import {
  applyUci,
  boardOutcome,
  drawOutcome,
  opposite,
  timeoutOutcome,
  winOutcome,
  type GameOutcome,
} from '../rules/gameEnd';
import {
  abortable,
  uciOf,
  type BoardMoveInput,
  type GameSession,
  type GameViewState,
  type PlayerInfo,
  type SessionCapabilities,
  type SessionNotice,
} from './types';

/** Was die lokale Partie vom Gegner braucht (Stockfish; im Test eine Attrappe). */
export interface LocalOpponent {
  /** Wählt einen Zug in UCI. `clock` = Restzeiten (ms) oder `null` ohne Uhr. */
  chooseMove(
    position: { startFen: string; moves: readonly string[]; fen: string },
    clock: { own: number; other: number; increment: number } | null,
    signal: AbortSignal,
  ): Promise<string>;
  /** Nimmt der Gegner (Farbe `color`) in dieser Stellung ein Remis an? */
  acceptsDraw(fen: string, color: Color, signal: AbortSignal): Promise<boolean>;
  dispose(): void;
}

export interface LocalSessionOptions {
  myColor: Color;
  timeControl: TimeControl | null;
  opponent: LocalOpponent;
  /** Spielerangaben (der Gegner heißt z. B. „Stockfish (Stufe Mittel)“) */
  players: Record<Color, PlayerInfo>;
  startFen?: string;
  /** Hilfen anbieten (Tipp, Zurücknehmen, Bewertungsbalken) */
  helpers?: boolean;
  now?: TimeSource;
  /** Künstliche Wartezeit vor dem Gegnerzug in ms (Standard: zufällig 400–1200) */
  opponentDelay?: () => number;
  /** Abstand in Halbzügen, bevor ein neues Remisangebot möglich ist */
  drawOfferGap?: number;
}

const DEFAULT_DRAW_OFFER_GAP = 6;

function randomDelay(): number {
  return 400 + Math.random() * 800;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Lokale Partie gegen Stockfish. Hält die ganze Zugfolge in chess.js (für Wiederholung, Rücknahme
 * und PGN), die Uhr und den Partiestand. Der Gegner zieht asynchron; Rücknahme, Aufgabe und Abbruch
 * brechen seine laufende Suche ab.
 */
export class LocalSession implements GameSession {
  readonly capabilities: SessionCapabilities;
  private current: GameViewState;
  private readonly chess: Chess;
  private readonly clock: ChessClock | null;
  private readonly listeners = new Set<(state: GameViewState) => void>();
  private opponentController: AbortController | null = null;
  private flagTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDrawOfferPly = -Infinity;
  private noticeId = 0;
  private disposed = false;
  private readonly opponentColor: Color;

  constructor(private readonly options: LocalSessionOptions) {
    const startFen = options.startFen ?? DEFAULT_POSITION;
    const helpers = options.helpers ?? true;
    this.capabilities = {
      hints: helpers,
      takeback: helpers,
      evalBar: helpers,
      chat: false,
      abort: true,
    };
    this.chess = new Chess(startFen);
    this.opponentColor = opposite(options.myColor);
    this.clock = options.timeControl
      ? new ChessClock(options.timeControl, options.now ?? defaultTimeSource)
      : null;
    this.current = {
      mode: 'local',
      status: 'playing',
      myColor: options.myColor,
      startFen,
      fen: startFen,
      turn: this.chess.turn(),
      plies: [],
      players: options.players,
      timeControl: options.timeControl,
      clock: this.clock?.snapshot() ?? null,
      outcome: null,
      drawOffer: null,
      waiting: false,
      notice: null,
      hintsUsed: 0,
      takebacks: 0,
      startedAt: new Date(),
    };
  }

  get state(): GameViewState {
    return this.current;
  }

  /** Startet die Partie: Ist der Gegner am Zug (z. B. er hat Weiß), zieht er sofort. */
  start(): void {
    if (this.chess.turn() === this.opponentColor) void this.opponentTurn();
  }

  subscribe(listener: (state: GameViewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async playMove(move: BoardMoveInput): Promise<void> {
    const state = this.current;
    if (state.status !== 'playing' || state.waiting || state.turn !== this.options.myColor) return;
    if (!applyUci(this.chess, uciOf(move))) {
      this.notify('moveRejected');
      return;
    }
    this.afterMove(this.options.myColor, { drawOffer: null });
    if (this.current.status === 'playing') await this.opponentTurn();
  }

  async resign(): Promise<void> {
    if (this.current.status !== 'playing') return;
    this.finish(winOutcome(this.opponentColor, 'resign'));
  }

  canAbort(): boolean {
    return abortable(this.current);
  }

  async abort(): Promise<void> {
    if (!this.canAbort()) return;
    this.finish({ result: '*', winner: null, reason: 'aborted' });
  }

  /** Remis anbieten: nur am eigenen Zug und höchstens alle `drawOfferGap` Halbzüge. */
  canOfferDraw(): boolean {
    const state = this.current;
    const gap = this.options.drawOfferGap ?? DEFAULT_DRAW_OFFER_GAP;
    return (
      state.status === 'playing' &&
      !state.waiting &&
      state.turn === this.options.myColor &&
      state.plies.length - this.lastDrawOfferPly >= gap
    );
  }

  async offerDraw(): Promise<void> {
    if (!this.canOfferDraw()) return;
    this.lastDrawOfferPly = this.current.plies.length;
    const controller = new AbortController();
    this.opponentController = controller;
    this.update({ waiting: true, drawOffer: this.options.myColor });
    // Kann der Gegner nicht rechnen, lehnt er ab
    const accepted = await this.options.opponent
      .acceptsDraw(this.chess.fen(), this.opponentColor, controller.signal)
      .catch(() => false);
    if (this.disposed || controller.signal.aborted || this.current.status !== 'playing') return;
    this.opponentController = null;
    if (accepted) {
      this.update({ waiting: false, drawOffer: null });
      this.finish(drawOutcome('agreement'));
    } else {
      this.update({ waiting: false, drawOffer: null }, 'drawDeclined');
    }
  }

  /** Der lokale Gegner bietet nie selbst Remis an. */
  async respondDraw(): Promise<void> {}

  /** Zählt einen angezeigten Tipp (für die Ergebniskarte). */
  countHint(): void {
    if (this.current.status === 'playing') this.update({ hintsUsed: this.current.hintsUsed + 1 });
  }

  /**
   * Nimmt den eigenen letzten Zug zurück, samt Antwort des Gegners (rechnet er noch, wird seine Suche
   * abgebrochen). Die Uhren bekommen keine Zeit zurück.
   */
  canTakeback(): boolean {
    const state = this.current;
    return (
      this.capabilities.takeback &&
      state.status === 'playing' &&
      state.plies.some((ply) => ply.color === this.options.myColor)
    );
  }

  async takeback(): Promise<void> {
    if (!this.canTakeback()) return;
    this.opponentController?.abort();
    this.opponentController = null;
    // Gegnerzüge bis zum eigenen Zug zurücknehmen, dann den eigenen
    while (this.chess.history().length > 0 && this.chess.turn() === this.options.myColor) {
      this.chess.undo();
    }
    this.chess.undo();
    if (this.clock) {
      // Laufende Zeit verbuchen, danach läuft die eigene Uhr (vor dem ersten Zug noch keine)
      this.clock.stop();
      if (this.chess.history().length > 0) this.clock.start(this.options.myColor);
    }
    const history = this.chess.history({ verbose: true });
    this.update({
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      plies: history.map((move, index) => plyFromMove(move, index)),
      clock: this.clock?.snapshot() ?? null,
      waiting: false,
      drawOffer: null,
      takebacks: this.current.takebacks + 1,
    });
    this.scheduleFlagCheck();
  }

  dispose(): void {
    this.disposed = true;
    this.opponentController?.abort();
    this.clearFlagTimer();
    this.clock?.stop();
    this.options.opponent.dispose();
    this.listeners.clear();
  }

  private async opponentTurn(): Promise<void> {
    const controller = new AbortController();
    this.opponentController = controller;
    this.update({ waiting: true });
    const delay = (this.options.opponentDelay ?? randomDelay)();
    const clockInfo = this.clock && {
      own: this.clock.remaining(this.opponentColor),
      other: this.clock.remaining(this.options.myColor),
      increment: this.clock.control.incrementMs,
    };
    const position = {
      startFen: this.current.startFen,
      moves: this.current.plies.map((ply) => ply.uci),
      fen: this.chess.fen(),
    };
    let uci: string | null = null;
    for (let attempt = 0; attempt < 2 && uci === null; attempt++) {
      try {
        const [move] = await Promise.all([
          this.options.opponent.chooseMove(position, clockInfo, controller.signal),
          wait(delay, controller.signal),
        ]);
        uci = move;
      } catch {
        if (controller.signal.aborted) return;
      }
    }
    if (this.disposed || controller.signal.aborted || this.current.status !== 'playing') return;
    this.opponentController = null;
    if (uci === null || !applyUci(this.chess, uci)) {
      this.update({ waiting: false }, 'opponentError');
      return;
    }
    this.afterMove(this.opponentColor, { waiting: false });
  }

  /** Nach einem Zug: Uhr drücken, Stand übernehmen, Partieende prüfen. */
  private afterMove(mover: Color, patch: Partial<GameViewState>): void {
    this.clock?.press(mover);
    const history = this.chess.history({ verbose: true });
    const last = history.at(-1);
    const plies = last
      ? [...this.current.plies, plyFromMove(last, history.length - 1)]
      : this.current.plies;
    this.update({
      ...patch,
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      plies,
      clock: this.clock?.snapshot() ?? null,
    });
    const outcome = boardOutcome(this.chess);
    if (outcome) this.finish(outcome);
    else this.scheduleFlagCheck();
  }

  private finish(outcome: GameOutcome): void {
    if (this.current.status === 'ended') return;
    this.opponentController?.abort();
    this.opponentController = null;
    this.clearFlagTimer();
    this.clock?.stop();
    this.update({
      status: 'ended',
      outcome,
      waiting: false,
      drawOffer: null,
      clock: this.clock?.snapshot() ?? null,
    });
  }

  /** Weckt sich, wenn die laufende Uhr abläuft (auch während der Gegner rechnet). */
  private scheduleFlagCheck(): void {
    this.clearFlagTimer();
    const ms = this.clock?.msUntilFlag();
    if (ms === null || ms === undefined || this.current.status !== 'playing') return;
    this.flagTimer = setTimeout(() => this.checkFlag(), ms + 5);
  }

  private checkFlag(): void {
    const flagged = this.clock?.flagged();
    if (!flagged) {
      this.scheduleFlagCheck();
      return;
    }
    this.finish(timeoutOutcome(this.chess.fen(), flagged));
  }

  private clearFlagTimer(): void {
    if (this.flagTimer) clearTimeout(this.flagTimer);
    this.flagTimer = null;
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

  private notify(notice: SessionNotice): void {
    this.update({}, notice);
  }
}
