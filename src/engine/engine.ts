import { Chess } from 'chess.js';
import { sideToMove } from '../chess/line';
import type { EngineLine, SearchSettings } from './types';
import { parseBestMove, parseEngineName, parseInfo, toEngineLine } from './uci';

/** Verbindung zur Engine: Web Worker in der App, Kindprozess im Test. */
export interface EngineTransport {
  send(command: string): void;
  /** Registriert einen Empfänger für Ausgabezeilen; gibt eine Abmeldefunktion zurück. */
  onLine(listener: (line: string) => void): () => void;
  /** Meldet einen fatalen Fehler (z. B. WASM nicht ladbar). */
  onError(listener: (error: unknown) => void): () => void;
  terminate(): void;
}

export interface SearchResult {
  lines: EngineLine[];
  depth: number;
  /** `true`, wenn die Suche per `stop` vorzeitig beendet wurde */
  aborted: boolean;
}

export class EngineError extends Error {
  constructor(public readonly code: 'timeout' | 'crashed' | 'disposed') {
    super(`Engine: ${code}`);
  }
}

const INIT_TIMEOUT_MS = 30_000;
/** Großer Hash beschleunigt die Analyse aufeinanderfolgender Stellungen. */
const DEFAULT_HASH_MB = 64;

export interface EngineOptions {
  /** Hash-Tabelle in MB */
  hashMb?: number;
  /** Threads pro Engine-Prozess (die App rechnet lieber mehrere Stellungen parallel) */
  threads?: number;
}

/**
 * Früher Stopp bei erzwungenem Matt: Hat die beste Linie ein Matt und ist eine Iteration
 * mit mindestens dieser Tiefe vollständig, ändert weiteres Rechnen an der Bewertung nichts
 * Wesentliches mehr (nur die Nebenlinien würden verfeinert). Ohne Stopp braucht z. B. ein
 * Matt in 1 bis Tiefe 20 über eine Minute.
 */
export function mateStopDepth(mate: number): number {
  return Math.max(10, 2 * Math.abs(mate) + 6);
}

/**
 * Schlanker UCI-Client. Führt immer nur eine Suche gleichzeitig aus;
 * weitere Aufträge warten in einer Kette.
 */
export class UciEngine {
  name: string | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private multipv: number | undefined;
  private searching = false;
  private stopRequested = false;
  private disposed = false;
  private crashListeners = new Set<(error: unknown) => void>();

  constructor(private readonly transport: EngineTransport) {
    transport.onError((error) => {
      for (const listener of this.crashListeners) listener(error);
    });
  }

  /** Startet die Engine: `uci` → Name + `uciok`, dann Hash setzen und auf `readyok` warten. */
  async init(timeoutMs = INIT_TIMEOUT_MS, options: EngineOptions = {}): Promise<void> {
    await this.exchange(
      'uci',
      (line) => {
        this.name ??= parseEngineName(line);
        return line.trim() === 'uciok';
      },
      timeoutMs,
    );
    this.transport.send(`setoption name Hash value ${options.hashMb ?? DEFAULT_HASH_MB}`);
    if (options.threads && options.threads > 1) {
      this.transport.send(`setoption name Threads value ${options.threads}`);
    }
    await this.ready(timeoutMs);
  }

  /** Vor einer neuen Partie: Hash leeren. */
  newGame(): Promise<void> {
    return this.enqueue(async () => {
      this.transport.send('ucinewgame');
      await this.ready(INIT_TIMEOUT_MS);
    });
  }

  /** Bewertet eine Stellung bis zur gewünschten Tiefe mit Multi-PV. */
  search(
    fen: string,
    settings: SearchSettings,
    onDepth?: (depth: number) => void,
  ): Promise<SearchResult> {
    return this.enqueue(() => this.runSearch(fen, settings, onDepth));
  }

  /** Bricht die laufende Suche ab (die Engine antwortet dann mit `bestmove`). */
  stop(): void {
    if (this.searching && !this.stopRequested) {
      this.stopRequested = true;
      this.transport.send('stop');
    }
  }

  dispose(): void {
    this.disposed = true;
    try {
      this.transport.send('quit');
    } finally {
      this.transport.terminate();
    }
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => {
      if (this.disposed) throw new EngineError('disposed');
      return job();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private ready(timeoutMs: number): Promise<void> {
    return this.exchange('isready', (line) => line.trim() === 'readyok', timeoutMs);
  }

  /** Sendet einen Befehl und wartet, bis eine Zeile `done` erfüllt. */
  private exchange(
    command: string,
    done: (line: string) => boolean,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        offLine();
        this.crashListeners.delete(onCrash);
      };
      const onCrash = () => {
        cleanup();
        reject(new EngineError('crashed'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new EngineError('timeout'));
      }, timeoutMs);
      const offLine = this.transport.onLine((line) => {
        if (done(line)) {
          cleanup();
          resolve();
        }
      });
      this.crashListeners.add(onCrash);
      this.transport.send(command);
    });
  }

  private runSearch(
    fen: string,
    settings: SearchSettings,
    onDepth?: (depth: number) => void,
  ): Promise<SearchResult> {
    if (this.multipv !== settings.multipv) {
      this.transport.send(`setoption name MultiPV value ${settings.multipv}`);
      this.multipv = settings.multipv;
    }
    const turn = sideToMove(fen);
    // So viele Linien liefert die Engine pro Iteration (weniger, wenn es weniger legale Züge gibt)
    const expectedLines = Math.min(settings.multipv, new Chess(fen).moves().length);
    let earlyStopSent = false;
    /** Linien der letzten vollständigen Iteration (alle Multi-PV-Linien mit derselben Tiefe) */
    let lastComplete: EngineLine[] | undefined;
    const byPv = new Map<number, EngineLine>();
    let reportedDepth = 0;
    this.searching = true;
    this.stopRequested = false;

    return new Promise<SearchResult>((resolve, reject) => {
      const cleanup = () => {
        offLine();
        this.crashListeners.delete(onCrash);
        this.searching = false;
      };
      const onCrash = () => {
        cleanup();
        reject(new EngineError('crashed'));
      };
      const offLine = this.transport.onLine((line) => {
        const info = parseInfo(line);
        if (info) {
          // Schranken aus dem Aspiration Window sind keine exakten Werte
          if (info.bound) return;
          byPv.set(info.multipv, toEngineLine(info, turn));
          if (info.multipv === expectedLines) {
            const iteration = sortedLines(byPv).filter((line) => line.depth === info.depth);
            if (iteration.length === expectedLines) lastComplete = iteration;
          }
          const best = byPv.get(1);
          if (
            !earlyStopSent &&
            !this.stopRequested &&
            info.multipv === expectedLines &&
            best?.mate !== undefined &&
            best.depth === info.depth &&
            info.depth >= mateStopDepth(best.mate)
          ) {
            earlyStopSent = true;
            this.transport.send('stop');
          }
          if (info.multipv === 1 && info.depth > reportedDepth) {
            reportedDepth = info.depth;
            onDepth?.(info.depth);
          }
          return;
        }
        if (parseBestMove(line) !== undefined) {
          const aborted = this.stopRequested;
          cleanup();
          resolve(resultOf(lastComplete ?? sortedLines(byPv), aborted));
        }
      });
      this.crashListeners.add(onCrash);
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go depth ${settings.depth}`);
    });
  }
}

function sortedLines(byPv: Map<number, EngineLine>): EngineLine[] {
  return [...byPv.values()].sort((a, b) => a.multipv - b.multipv);
}

/**
 * Ergebnis aus der letzten vollständigen Iteration. Gibt es keine (sehr früher Abbruch),
 * bleiben nur Linien mit der Tiefe von Linie 1.
 */
function resultOf(lines: EngineLine[], aborted: boolean): SearchResult {
  const depth = lines[0]?.depth ?? 0;
  return { lines: lines.filter((line) => line.depth === depth), depth, aborted };
}
