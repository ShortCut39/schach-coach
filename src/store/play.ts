import { create } from 'zustand';
import { parsePgnGame } from '../chess/pgn';
import type { Color, Game } from '../chess/types';
import type { PositionEval } from '../engine/types';
import { remainingAt, LOW_TIME_MS } from '../play/clock/clock';
import { StockfishOpponent } from '../play/opponent/stockfishOpponent';
import type { Level } from '../play/opponent/levels';
import { timeControl } from '../play/rules/timeControl';
import { LichessSession } from '../play/session/LichessSession';
import { LocalSession } from '../play/session/LocalSession';
import type { BoardMoveInput, GameSession, GameViewState } from '../play/session/types';
import { activateLiveGuard, releaseLiveGuard } from '../play/liveGuard';
import { LichessError, type LichessErrorCode } from '../play/lichess/client';
import { LichessLobby, type SeekParams } from '../play/lichess/lobby';
import { nowPlayingSchema, type LichessEventGame, type NowPlaying } from '../play/lichess/mapper';
import { buildPgn, type PgnInfo } from '../play/pgn';
import { moveSound, playSound, type SoundKind } from '../play/sound';
import { getEngine } from './engine';
import { useGame, type Orientation } from './game';
import { useLibrary } from './library';
import { lichessClient, useLichessAuth } from './lichessAuth';
import { useNavigation } from './navigation';
import { analyseAndExplain } from './pipeline';
import { pickSettings, useSettings } from './settings';

export interface LocalSetup {
  color: Color | 'random';
  level: Level;
  /** `null` = ohne Uhr */
  minutes: number | null;
  increment: number;
  /** Spielername für das PGN (lokal: „Du“ bzw. der übersetzte Text) */
  playerName: string;
  /** Anzeigename des Gegners, z. B. „Stockfish (Stufe Mittel)“ */
  opponentName: string;
  /** PGN-Kopfzeilen `Event` und `Site` (übersetzt) */
  event: string;
  site: string;
}

interface PlayState {
  session: GameSession | null;
  view: GameViewState | null;
  orientation: Orientation;
  /** Angezeigter Tipp (bester Zug) zur Stellung `fen` */
  hint: { fen: string; uci: string } | null;
  hintLoading: boolean;
  /** Bewertung der aktuellen Stellung für den Balken (nur lokal, nur wenn eingeschaltet) */
  evaluation: PositionEval | null;
  /** Angaben fürs PGN der laufenden Partie */
  pgnInfo: PgnInfo | null;
  /** Die beendete Partie als eingelesenes PGN (für „Partie analysieren“); `null` bei Abbruch */
  finishedGame: Game | null;
  /** Lichess: Suche, Fehler der Suche, laufende Partien zum Fortsetzen */
  lichess: {
    seeking: SeekParams | null;
    error: { code: LichessErrorCode; detail?: string | undefined } | null;
    ongoing: NowPlaying[];
  };

  startLocal: (setup: LocalSetup) => void;
  playMove: (move: BoardMoveInput) => void;
  requestHint: () => Promise<void>;
  takeback: () => Promise<void>;
  resign: () => Promise<void>;
  offerDraw: () => Promise<void>;
  respondDraw: (accept: boolean) => Promise<void>;
  abort: () => Promise<void>;
  /** Lichess: Gegner suchen (öffnet vorher den Ereignisstrom) */
  startSeek: (params: SeekParams) => Promise<void>;
  cancelSeek: () => void;
  /** Laufende Lichess-Partien abfragen (beim Start und nach der Anmeldung) */
  refreshOngoing: () => Promise<void>;
  /** Laufende Lichess-Partie fortsetzen */
  resumeLichess: (gameId: string) => void;
  respondTakeback: (accept: boolean) => Promise<void>;
  claimVictory: () => Promise<void>;
  claimDraw: () => Promise<void>;
  /** Beendete Partie an die Analyse übergeben (aus meiner Sicht) und dorthin wechseln */
  analyseFinished: () => void;
  flip: () => void;
  /** Partie verlassen (zurück zum Dialog „Neue Partie“) */
  close: () => void;
}

/** Tiefe für Tipp und Balken (Analyse-Engine) */
const HINT_DEPTH = 16;
const EVAL_BAR_DEPTH = 14;

let unsubscribe: (() => void) | null = null;
let lowTimeWarned = false;
let lowTimeTimer: ReturnType<typeof setInterval> | null = null;

function resolveColor(color: Color | 'random'): Color {
  if (color !== 'random') return color;
  return Math.random() < 0.5 ? 'w' : 'b';
}

/** Ton mit der eingestellten Lautstärke (nichts, wenn Töne aus sind) */
function sound(kind: SoundKind): void {
  const { sounds, volume } = useSettings.getState().play;
  if (sounds) playSound(kind, volume / 100);
}

/**
 * Ton zum letzten Zug (eigener Zug wie Gegnerzug) bzw. zum Partieende. Welcher Ton, entscheidet
 * der Zug selbst (`moveSound`), nicht die Oberfläche.
 */
function soundFor(previous: GameViewState | null, next: GameViewState): void {
  const moved = !!previous && next.plies.length > previous.plies.length;
  const last = next.plies.at(-1);
  if (moved && last) sound(moveSound(last));
  if (next.status === 'ended' && previous?.status !== 'ended') {
    // Nach dem Zugton (z. B. Matt) kurz warten, damit beide zu hören sind
    if (moved) setTimeout(() => sound('gameEnd'), 220);
    else sound('gameEnd');
  }
}

/** PGN-Angaben einer Lichess-Partie (Event wie bei Lichess, Site = Partieseite, Wertungen) */
function lichessPgnInfo(state: GameViewState): PgnInfo | null {
  const live = state.live;
  if (!live) return null;
  const speed = live.speed.charAt(0).toUpperCase() + live.speed.slice(1);
  const ratings: Partial<Record<Color, number>> = {};
  if (state.players.w.rating !== undefined) ratings.w = state.players.w.rating;
  if (state.players.b.rating !== undefined) ratings.b = state.players.b.rating;
  return {
    event: `${live.rated ? 'Rated' : 'Casual'} ${speed} game`,
    site: `https://lichess.org/${live.gameId}`,
    names: { w: state.players.w.name, b: state.players.b.name },
    ratings,
  };
}

/** Nur Echtzeit-Partien in normalem Schach, die die Board-API spielen kann */
function playableHere(game: Pick<LichessEventGame, 'variant' | 'speed' | 'compat'>): boolean {
  return (
    (game.variant?.key ?? 'standard') === 'standard' &&
    game.speed !== 'correspondence' &&
    game.compat?.board !== false
  );
}

let lobby: LichessLobby | null = null;

export const usePlay = create<PlayState>()((set, get) => {
  /**
   * Partie zu Ende: PGN bauen, in der Bibliothek ablegen („nicht analysiert“) und – falls
   * eingestellt – gleich analysieren. Abgebrochene Partien zählen nicht.
   */
  function onFinished(state: GameViewState): void {
    // Live-Partie zu Ende: Sperre sofort aufheben (Analyse ist danach erlaubt)
    if (state.live) releaseLiveGuard(state.live.gameId);
    const info = state.live ? lichessPgnInfo(state) : get().pgnInfo;
    if (!info || state.outcome?.reason === 'aborted' || state.plies.length === 0) return;
    const parsed = parsePgnGame(buildPgn(state, info));
    if (!parsed.ok) return;
    set({ finishedGame: parsed.value });
    void useLibrary
      .getState()
      .savePlayed(parsed.value, state.myColor)
      .catch(() => undefined);
    if (useSettings.getState().play.autoAnalyse) get().analyseFinished();
  }

  function attach(session: GameSession, myColor: Color, pgnInfo: PgnInfo): void {
    get().session?.dispose();
    unsubscribe?.();
    lowTimeWarned = false;
    set({
      pgnInfo,
      finishedGame: null,
      session,
      view: session.state,
      orientation: myColor === 'w' ? 'white' : 'black',
      hint: null,
      hintLoading: false,
      evaluation: null,
    });
    unsubscribe = session.subscribe((state) => {
      const previous = get().view;
      soundFor(previous, state);
      const moved = previous && previous.fen !== state.fen;
      // Lichess: Farbe steht erst nach dem ersten Stand fest → eigene Farbe unten
      const colorKnown = previous?.status === 'starting' && state.status !== 'starting';
      set({
        view: state,
        ...(moved ? { hint: null, evaluation: null } : {}),
        ...(colorKnown ? { orientation: state.myColor === 'w' ? 'white' : 'black' } : {}),
      });
      if (moved) void refreshEvalBar();
      if (state.status === 'ended' && previous?.status !== 'ended') onFinished(state);
    });
    startLowTimeWatch();
    sound('gameStart');
    void refreshEvalBar();
  }

  /** Einmaliger Warnton, wenn die eigene Zeit unter 10 s fällt */
  function startLowTimeWatch(): void {
    if (lowTimeTimer) clearInterval(lowTimeTimer);
    lowTimeTimer = setInterval(() => {
      const view = get().view;
      if (!view?.clock || view.status !== 'playing' || lowTimeWarned) return;
      if (remainingAt(view.clock, view.myColor, performance.now()) < LOW_TIME_MS) {
        lowTimeWarned = true;
        sound('lowTime');
      }
    }, 250);
  }

  /** Lichess-Partie übernehmen: Sperre sofort an, dann Partiestrom öffnen */
  function attachLichess(gameId: string): void {
    const current = get().session;
    if (current instanceof LichessSession && current.gameId === gameId) return;
    const account = useLichessAuth.getState().account;
    if (!account) return;
    activateLiveGuard(gameId);
    const session = new LichessSession({ gameId, client: lichessClient(), accountId: account.id });
    attach(session, 'w', { event: '', site: '', names: { w: '', b: '' } });
    set((s) => ({
      lichess: {
        ...s.lichess,
        seeking: null,
        error: null,
        ongoing: s.lichess.ongoing.filter((g) => g.gameId !== gameId),
      },
    }));
    useNavigation.getState().setScreen('spielen');
    session.start();
  }

  function getLobby(): LichessLobby {
    lobby ??= new LichessLobby(lichessClient(), {
      onGameStart: (game) => {
        // Nur während einer Suche automatisch übernehmen (sonst über „Fortsetzen“)
        if (get().lichess.seeking && playableHere(game)) attachLichess(game.gameId);
        else void get().refreshOngoing();
      },
      onGameFinish: (game) => {
        const session = get().session;
        // Sicherheitsnetz: Die Partie selbst meldet ihr Ende über den Partiestrom
        if (!(session instanceof LichessSession) || session.gameId !== game.gameId) {
          releaseLiveGuard(game.gameId);
        }
      },
    });
    return lobby;
  }

  return {
    session: null,
    view: null,
    orientation: 'white',
    hint: null,
    hintLoading: false,
    evaluation: null,
    pgnInfo: null,
    finishedGame: null,
    lichess: { seeking: null, error: null, ongoing: [] },

    startSeek: async (params) => {
      if (get().lichess.seeking) return;
      set((s) => ({ lichess: { ...s.lichess, seeking: params, error: null } }));
      try {
        await getLobby().seek(params);
      } catch (error) {
        const code = error instanceof LichessError ? error.code : 'unreachable';
        const detail = error instanceof LichessError ? error.detail : undefined;
        set((s) => ({ lichess: { ...s.lichess, error: { code, detail } } }));
      } finally {
        // Gepaart (gameStart kam) oder abgebrochen bzw. abgelehnt
        set((s) => ({ lichess: { ...s.lichess, seeking: null } }));
      }
    },

    cancelSeek: () => {
      lobby?.cancelSeek();
      set((s) => ({ lichess: { ...s.lichess, seeking: null } }));
    },

    refreshOngoing: async () => {
      if (useLichessAuth.getState().status !== 'loggedIn') return;
      try {
        const parsed = nowPlayingSchema.safeParse(
          await lichessClient().json('/api/account/playing?nb=9'),
        );
        const ongoing = parsed.success ? parsed.data.nowPlaying.filter(playableHere) : [];
        const current = get().session;
        set((s) => ({
          lichess: {
            ...s.lichess,
            ongoing: ongoing.filter(
              (g) => !(current instanceof LichessSession && current.gameId === g.gameId),
            ),
          },
        }));
      } catch {
        // Ohne Verbindung keine Liste; die Partie läuft auf Lichess trotzdem weiter
      }
    },

    resumeLichess: (gameId) => attachLichess(gameId),

    respondTakeback: async (accept) => {
      const { session } = get();
      if (session instanceof LichessSession) await session.respondTakeback(accept);
    },
    claimVictory: async () => {
      const { session } = get();
      if (session instanceof LichessSession) await session.claimVictory();
    },
    claimDraw: async () => {
      const { session } = get();
      if (session instanceof LichessSession) await session.claimDraw();
    },

    startLocal: (setup) => {
      const myColor = resolveColor(setup.color);
      const opponentColor: Color = myColor === 'w' ? 'b' : 'w';
      const opponent = new StockfishOpponent(setup.level);
      const players = {
        [myColor]: { name: setup.playerName },
        [opponentColor]: { name: setup.opponentName },
      } as Record<Color, { name: string }>;
      const session = new LocalSession({
        myColor,
        timeControl: setup.minutes === null ? null : timeControl(setup.minutes, setup.increment),
        opponent,
        players,
      });
      attach(session, myColor, {
        event: setup.event,
        site: setup.site,
        names: { w: players.w.name, b: players.b.name },
      });
      // Engine schon jetzt starten, damit der erste Gegnerzug nicht warten muss
      void opponent.prepare().catch(() => undefined);
      session.start();
    },

    playMove: (move) => {
      void get().session?.playMove(move);
    },

    requestHint: async () => {
      const { session, view, hintLoading } = get();
      if (!(session instanceof LocalSession) || !session.capabilities.hints || !view) return;
      if (hintLoading || view.status !== 'playing' || view.turn !== view.myColor) return;
      const fen = view.fen;
      set({ hintLoading: true });
      try {
        const engine = await getEngine();
        const result = await engine.search(fen, { depth: HINT_DEPTH, multipv: 1 });
        const uci = result.lines[0]?.pv[0];
        if (uci && get().view?.fen === fen) {
          session.countHint();
          set({ hint: { fen, uci } });
        }
      } catch {
        // Kein Tipp verfügbar
      } finally {
        set({ hintLoading: false });
      }
    },

    takeback: async () => {
      const { session } = get();
      if (session instanceof LocalSession) await session.takeback();
    },
    resign: async () => {
      await get().session?.resign();
    },
    offerDraw: async () => {
      await get().session?.offerDraw();
    },
    respondDraw: async (accept) => {
      await get().session?.respondDraw(accept);
    },
    abort: async () => {
      await get().session?.abort();
    },
    analyseFinished: () => {
      const { finishedGame, view } = get();
      if (!finishedGame || !view) return;
      const { engineDepth, explainScope } = useSettings.getState();
      useGame.getState().load(finishedGame, view.myColor);
      void analyseAndExplain(finishedGame, engineDepth, explainScope);
      useNavigation.getState().setAnalyseView('board');
    },
    flip: () => set((s) => ({ orientation: s.orientation === 'white' ? 'black' : 'white' })),
    close: () => {
      const { session } = get();
      // Eine Live-Partie wird nur nach ihrem Ende geschlossen; die Sperre gilt dann nicht mehr
      if (session instanceof LichessSession && session.state.status === 'ended') {
        releaseLiveGuard(session.gameId);
      }
      session?.dispose();
      unsubscribe?.();
      unsubscribe = null;
      if (lowTimeTimer) clearInterval(lowTimeTimer);
      lowTimeTimer = null;
      set({
        session: null,
        view: null,
        hint: null,
        hintLoading: false,
        evaluation: null,
        pgnInfo: null,
        finishedGame: null,
      });
    },
  };
});

/** Bewertungsbalken ein- oder ausschalten (wird gespeichert) */
export async function setEvalBar(on: boolean): Promise<void> {
  const settings = pickSettings(useSettings.getState());
  await useSettings.getState().save({ ...settings, play: { ...settings.play, evalBar: on } });
  usePlay.setState({ evaluation: null });
  if (on) await refreshEvalBar();
}

/** Bewertungsbalken: Die Analyse-Engine rechnet die aktuelle Stellung (nur lokal, nur wenn an). */
async function refreshEvalBar(): Promise<void> {
  const { session, view } = usePlay.getState();
  if (!session?.capabilities.evalBar || !view || !useSettings.getState().play.evalBar) return;
  const fen = view.fen;
  try {
    const engine = await getEngine();
    const result = await engine.search(fen, { depth: EVAL_BAR_DEPTH, multipv: 1 });
    if (usePlay.getState().view?.fen === fen) {
      usePlay.setState({
        evaluation: { fen, depth: result.depth, multipv: 1, lines: result.lines },
      });
    }
  } catch {
    // Ohne Bewertung bleibt der Balken neutral
  }
}

// Nach der Anmeldung (auch beim App-Start) laufende Lichess-Partien abfragen und anbieten; nach dem Abmelden
// den Ereignisstrom schließen
useLichessAuth.subscribe((state, previous) => {
  if (state.status === previous.status) return;
  if (state.status === 'loggedIn') {
    void usePlay
      .getState()
      .refreshOngoing()
      .then(() => {
        // Laufende Partie (z. B. nach einem Neustart): Uhr tickt schon → gleich zu „Spielen“
        const { lichess, session } = usePlay.getState();
        if (lichess.ongoing.length > 0 && !session) {
          useNavigation.getState().setScreen('spielen');
        }
      });
  }
  if (state.status === 'loggedOut') {
    lobby?.close();
    lobby = null;
    usePlay.setState((s) => ({ lichess: { ...s.lichess, seeking: null, ongoing: [] } }));
  }
});
