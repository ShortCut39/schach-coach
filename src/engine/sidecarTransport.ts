import { Command, type Child } from '@tauri-apps/plugin-shell';
import type { EngineTransport } from './engine';

/**
 * Native Stockfish-Engine als Tauri-Sidecar (`src-tauri/binaries/stockfish-<triple>`).
 * Startet den Prozess, reicht UCI-Befehle über stdin weiter und meldet jede Ausgabezeile.
 * Schlägt der Start fehl (z. B. Binary fehlt), lehnt das Promise ab – dann nutzt die App WASM.
 */
export async function createSidecarTransport(): Promise<EngineTransport> {
  const command = Command.sidecar('binaries/stockfish');
  const lineListeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  command.stdout.on('data', (line) => {
    for (const listener of lineListeners) listener(line.trimEnd());
  });
  command.on('error', (error) => {
    for (const listener of errorListeners) listener(error);
  });
  command.on('close', (payload) => {
    for (const listener of errorListeners)
      listener(new Error(`Engine beendet (Code ${payload.code ?? '?'})`));
  });

  const child: Child = await command.spawn();
  return {
    send: (line) => {
      void child.write(`${line}\n`).catch((error: unknown) => {
        for (const listener of errorListeners) listener(error);
      });
    },
    onLine: (listener) => {
      lineListeners.add(listener);
      return () => lineListeners.delete(listener);
    },
    onError: (listener) => {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    terminate: () => {
      errorListeners.clear();
      void child.kill().catch(() => undefined);
    },
  };
}
