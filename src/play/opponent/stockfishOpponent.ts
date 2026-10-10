import type { Color } from '../../chess/types';
import type { UciEngine } from '../../engine/engine';
import { disposeStandaloneEngine, startStandaloneEngine } from '../../store/engine';
import type { LocalOpponent } from '../session/LocalSession';
import {
  acceptsDrawFromEval,
  DRAW_CHECK_DEPTH,
  LEVEL_CONFIG,
  moveLimits,
  type Level,
} from './levels';

/**
 * Stockfish als Gegner: eine eigene Engine-Instanz, getrennt vom Analyse-Pool. Sie wird beim ersten
 * Zug gestartet (während einer Live-Partie verweigert der Engine-Store den Start).
 */
export class StockfishOpponent implements LocalOpponent {
  private engine: Promise<UciEngine> | null = null;
  private disposed = false;

  constructor(private readonly level: Level) {}

  /** Startet die Engine schon vor dem ersten Zug (z. B. beim Partiestart). */
  prepare(): Promise<UciEngine> {
    this.engine ??= (async () => {
      const engine = await startStandaloneEngine();
      if (this.disposed) {
        disposeStandaloneEngine(engine);
        throw new Error('Gegner beendet');
      }
      await engine.newGame();
      await engine.setOptions(LEVEL_CONFIG[this.level].options);
      return engine;
    })();
    // Fehlgeschlagener Start: beim nächsten Zug erneut versuchen
    this.engine.catch(() => {
      this.engine = null;
    });
    return this.engine;
  }

  async chooseMove(
    position: { startFen: string; moves: readonly string[] },
    clock: { own: number; other: number; increment: number } | null,
    signal: AbortSignal,
  ): Promise<string> {
    const engine = await this.prepare();
    const move = await engine.bestMove(position, moveLimits(this.level, clock), signal);
    if (!move) throw new Error('Kein Zug');
    return move;
  }

  async acceptsDraw(fen: string, color: Color, signal: AbortSignal): Promise<boolean> {
    const engine = await this.prepare();
    const onAbort = () => engine.stop();
    signal.addEventListener('abort', onAbort);
    try {
      const result = await engine.search(fen, { depth: DRAW_CHECK_DEPTH, multipv: 1 });
      return acceptsDrawFromEval(result.lines[0], color);
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  dispose(): void {
    this.disposed = true;
    void this.engine?.then(disposeStandaloneEngine).catch(() => undefined);
    this.engine = null;
  }
}
