import { create } from 'zustand';
import { UciEngine, type EngineTransport } from '../engine/engine';
import { createWorkerTransport } from '../engine/workerTransport';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EngineState {
  status: EngineStatus;
  /** Name, wie ihn die Engine meldet (`id name …`) */
  name: string | undefined;
}

export const useEngine = create<EngineState>()(() => ({ status: 'idle', name: undefined }));

let transportFactory: () => EngineTransport = createWorkerTransport;
let instance: Promise<UciEngine> | null = null;

/** Nur für Tests: andere Verbindung zur Engine verwenden. */
export function setEngineTransportFactory(factory: () => EngineTransport): void {
  transportFactory = factory;
  instance = null;
  useEngine.setState({ status: 'idle', name: undefined });
}

/** Liefert die (einzige) Engine-Instanz und startet sie beim ersten Aufruf. */
export function getEngine(): Promise<UciEngine> {
  if (instance) return instance;
  useEngine.setState({ status: 'loading' });
  const attempt = (async () => {
    const transport = transportFactory();
    const engine = new UciEngine(transport);
    transport.onError(() => {
      // Absturz nach dem Start: beim nächsten Aufruf neu starten
      if (instance === attempt) instance = null;
      useEngine.setState({ status: 'error' });
    });
    await engine.init();
    useEngine.setState({ status: 'ready', name: engine.name });
    return engine;
  })();
  instance = attempt;
  attempt.catch(() => {
    if (instance === attempt) instance = null;
    useEngine.setState({ status: 'error' });
  });
  return attempt;
}
