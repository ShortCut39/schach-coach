import { isTauri } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { UciEngine, type EngineOptions, type EngineTransport } from '../engine/engine';
import { createSidecarTransport } from '../engine/sidecarTransport';
import { createWorkerTransport } from '../engine/workerTransport';
import { assertNotLive, onLiveGuardChange } from '../play/liveGuard';
import { useSettings } from './settings';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';
export type EngineKind = 'native' | 'wasm';

interface EngineState {
  status: EngineStatus;
  /** Name, wie ihn die Engine meldet (`id name …`) */
  name: string | undefined;
  /** Tatsächlich laufende Engine */
  kind: EngineKind | null;
  /** Native Engine gewünscht, aber nicht startbar → WASM */
  nativeUnavailable: boolean;
}

export const useEngine = create<EngineState>()(() => ({
  status: 'idle',
  name: undefined,
  kind: null,
  nativeUnavailable: false,
}));

/** Hash je Engine-Prozess in MB */
const HASH_MB: Record<EngineKind, number> = { native: 64, wasm: 64 };
/** Obergrenze für „Automatisch“ (jede native Engine braucht etwa 300 MB) */
const MAX_AUTO_ENGINES = 4;

/**
 * Wie viele Stellungen gleichzeitig gerechnet werden: Einstellung „Threads“ oder automatisch
 * (halbe Zahl logischer Kerne, höchstens 4). Jede Engine rechnet mit einem Thread – bei Suchen mit
 * fester Tiefe bringt das mehr als viele Threads in einer Engine.
 */
export function poolSize(): number {
  const setting = useSettings.getState().threads;
  return setting > 0 ? setting : autoPoolSize();
}

/** „Automatisch“: halbe Zahl logischer Kerne, mindestens 1, höchstens 4. */
export function autoPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.min(MAX_AUTO_ENGINES, Math.max(1, Math.floor(cores / 2)));
}

type TransportFactory = (kind: EngineKind) => Promise<EngineTransport>;

const defaultFactory: TransportFactory = (kind) =>
  kind === 'native' ? createSidecarTransport() : Promise.resolve(createWorkerTransport());

let factory: TransportFactory = defaultFactory;
let pool: Promise<UciEngine>[] = [];
let poolKind: EngineKind | null = null;

/** Nur für Tests: andere Verbindung zur Engine verwenden (optional je Engine-Art). */
export function setEngineTransportFactory(
  create: (kind: EngineKind) => EngineTransport | Promise<EngineTransport>,
): void {
  factory = async (kind) => create(kind);
  disposePool();
  useEngine.setState({ status: 'idle', name: undefined, kind: null, nativeUnavailable: false });
}

/** Fertig gestartete Engines, damit `disposePool` sie sofort (synchron) beenden kann */
const running = new Set<UciEngine>();

function disposePool(): void {
  for (const engine of running) engine.dispose();
  running.clear();
  for (const engine of pool) void engine.then((e) => e.dispose()).catch(() => undefined);
  pool = [];
  poolKind = null;
}

async function startEngine(kind: EngineKind): Promise<UciEngine> {
  const transport = await factory(kind);
  const engine = new UciEngine(transport);
  // Absturz nach dem Start: Engine aus dem Pool nehmen, damit „Erneut versuchen“ neu startet
  transport.onError(() => {
    pool = pool.filter((p) => p !== promise);
    if (pool.length === 0) {
      poolKind = null;
      useEngine.setState({ status: 'error' });
    }
  });
  const options: EngineOptions = { hashMb: HASH_MB[kind] };
  const promise = engine.init(undefined, options).then(() => {
    running.add(engine);
    return engine;
  });
  return promise;
}

/** Erste Engine: bestimmt die Art (nativ, sonst WASM als Rückfall). */
async function startFirst(): Promise<UciEngine> {
  const wantNative =
    useSettings.getState().engine === 'native' && (isTauri() || factory !== defaultFactory);
  if (wantNative) {
    try {
      const engine = await startEngine('native');
      poolKind = 'native';
      useEngine.setState({ nativeUnavailable: false });
      return engine;
    } catch {
      useEngine.setState({ nativeUnavailable: true });
    }
  }
  const engine = await startEngine('wasm');
  poolKind = 'wasm';
  return engine;
}

/** Liefert `count` Engines (der Pool wächst bei Bedarf) und startet sie beim ersten Aufruf. */
export async function getEngines(count: number): Promise<UciEngine[]> {
  // Fair Play: Während einer Live-Partie startet keine Engine
  assertNotLive('engine');
  if (pool.length === 0) {
    useEngine.setState({ status: 'loading' });
    const first = startFirst();
    pool.push(first);
    first.then(
      (engine) => useEngine.setState({ status: 'ready', name: engine.name, kind: poolKind }),
      () => {
        pool = [];
        useEngine.setState({ status: 'error' });
      },
    );
  }
  await pool[0];
  while (pool.length < count && poolKind) {
    const extra = startEngine(poolKind);
    pool.push(extra);
    // Weitere Engines sind optional: Fällt eine aus, rechnen die anderen weiter
    extra.catch(() => {
      pool = pool.filter((p) => p !== extra);
    });
  }
  const settled = await Promise.allSettled(pool.slice(0, count));
  return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

/** Liefert die erste Engine (für einzelne Stellungen). */
export async function getEngine(): Promise<UciEngine> {
  const [engine] = await getEngines(1);
  if (!engine) throw new Error('Keine Engine verfügbar');
  return engine;
}

/** Eigenständige Engines außerhalb des Pools (Gegner im Spielmodus) */
const standalone = new Set<UciEngine>();

/**
 * Startet eine eigene Engine-Instanz, getrennt vom Analyse-Pool (z. B. der Gegner im lokalen
 * Spiel). Gleiche Art wie eingestellt (nativ, sonst WASM). Während einer Live-Partie verweigert.
 * Der Aufrufer beendet sie mit `dispose()`.
 */
export async function startStandaloneEngine(): Promise<UciEngine> {
  assertNotLive('engine');
  const wantNative =
    useSettings.getState().engine === 'native' && (isTauri() || factory !== defaultFactory);
  let transport: EngineTransport | undefined;
  if (wantNative) transport = await factory('native').catch(() => undefined);
  transport ??= await factory('wasm');
  const engine = new UciEngine(transport);
  standalone.add(engine);
  try {
    await engine.init(undefined, { hashMb: 16 });
  } catch (error) {
    standalone.delete(engine);
    engine.dispose();
    throw error;
  }
  return engine;
}

/** Beendet eine mit `startStandaloneEngine` gestartete Engine. */
export function disposeStandaloneEngine(engine: UciEngine): void {
  standalone.delete(engine);
  engine.dispose();
}

/** Nach geänderten Einstellungen (Engine-Art, Threads): Pool beenden und neu starten. */
export async function restartEngines(): Promise<void> {
  disposePool();
  useEngine.setState({ status: 'idle', name: undefined, kind: null });
  await getEngine().catch(() => undefined);
}

/**
 * Live-Partie beginnt: alle Analyse-Engines beenden (Worker bzw. Prozesse werden gestoppt, nicht nur
 * ausgeblendet). Nach Partieende startet die Engine wieder im Hintergrund.
 */
onLiveGuardChange(({ active }) => {
  if (active) {
    disposePool();
    for (const engine of standalone) engine.dispose();
    standalone.clear();
    useEngine.setState({ status: 'idle', name: undefined, kind: null });
  } else {
    void getEngine().catch(() => undefined);
  }
});
