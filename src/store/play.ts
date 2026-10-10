import { create } from 'zustand';
import { parsePgnGame } from '../chess/pgn';
import type { Color, Game } from '../chess/types';
import type { PositionEval } from '../engine/types';
import { remainingAt, LOW_TIME_MS } from '../play/clock/clock';
import { StockfishOpponent } from '../play/opponent/stockfishOpponent';
import type { Level } from '../play/opponent/levels';
import { timeControl } from '../play/rules/timeControl';
import { LocalSession } from '../play/session/LocalSession';
import type { BoardMoveInput, GameSession, GameViewState } from '../play/session/types';
import { buildPgn, type PgnInfo } from '../play/pgn';
import { moveSound, playSound, type SoundKind } from '../play/sound';
import { getEngine } from './engine';
import { useGame, type Orientation } from './game';
import { useLibrary } from './library';
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

  startLocal: (setup: LocalSetup) => void;
  playMove: (move: BoardMoveInput) => void;
  requestHint: () => Promise<void>;
  takeback: () => Promise<void>;
  resign: () => Promise<void>;
  offerDraw: () => Promise<void>;
  respondDraw: (accept: boolean) => Promise<void>;
  abort: () => Promise<void>;
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

export const usePlay = create<PlayState>()((set, get) => {
  /**
   * Partie zu Ende: PGN bauen, in der Bibliothek ablegen („nicht analysiert“) und – falls
   * eingestellt – gleich analysieren. Abgebrochene Partien zählen nicht.
   */
  function onFinished(state: GameViewState): void {
    const info = get().pgnInfo;
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
      set({ view: state, ...(moved ? { hint: null, evaluation: null } : {}) });
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

  return {
    session: null,
    view: null,
    orientation: 'white',
    hint: null,
    hintLoading: false,
    evaluation: null,
    pgnInfo: null,
    finishedGame: null,

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
      get().session?.dispose();
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
