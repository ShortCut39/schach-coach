import engineScriptUrl from 'stockfish/bin/stockfish-19-lite-single.js?url';
import engineWasmUrl from 'stockfish/bin/stockfish-19-lite-single.wasm?url';
import type { EngineTransport } from './engine';

/**
 * Startet Stockfish 19 Lite (single-threaded, WASM) in einem Web Worker.
 * Das Skript des Pakets ist selbst der Worker; den Pfad zur .wasm-Datei
 * erwartet es im Hash der Worker-URL.
 */
export function createWorkerTransport(): EngineTransport {
  const worker = new Worker(`${engineScriptUrl}#${encodeURIComponent(engineWasmUrl)}`);
  return {
    send: (command) => worker.postMessage(command),
    onLine: (listener) => {
      const handler = (event: MessageEvent) => {
        if (typeof event.data === 'string') listener(event.data);
      };
      worker.addEventListener('message', handler);
      return () => worker.removeEventListener('message', handler);
    },
    onError: (listener) => {
      const handler = (event: ErrorEvent) => listener(event.error ?? event.message);
      worker.addEventListener('error', handler);
      return () => worker.removeEventListener('error', handler);
    },
    terminate: () => worker.terminate(),
  };
}
