/// <reference types="node" />
/**
 * Echter Stockfish als Node-Kindprozess – Lite-WASM oder die native Binary – nur für Tests und Werkzeuge.
 * Tests, die das nutzen, brauchen `// @vitest-environment node`.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { EngineTransport } from '../engine/engine';

const ENGINE = fileURLToPath(
  new URL('../../node_modules/stockfish/bin/stockfish-19-lite-single.js', import.meta.url),
);

/** Native Engine (Sidecar-Binary), falls mit `pnpm fetch:engine` geladen */
export const NATIVE_ENGINE = fileURLToPath(
  new URL('../../src-tauri/binaries/stockfish-x86_64-unknown-linux-gnu', import.meta.url),
);

export function processTransport(native = false): EngineTransport {
  const child = native
    ? spawn(NATIVE_ENGINE, [], { stdio: ['pipe', 'pipe', 'ignore'] })
    : spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: child.stdout });
  return {
    send: (command) => child.stdin.write(`${command}\n`),
    onLine: (listener) => {
      lines.on('line', listener);
      return () => lines.off('line', listener);
    },
    onError: (listener) => {
      child.on('error', listener);
      return () => child.off('error', listener);
    },
    terminate: () => child.kill(),
  };
}
