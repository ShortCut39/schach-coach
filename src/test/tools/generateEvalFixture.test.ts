// @vitest-environment node
/// <reference types="node" />
/**
 * Erzeugt src/test/fixtures/opera-game-evals-d20.json mit echten Stockfish-Bewertungen
 * (Tiefe 20, Multi-PV 3) für alle Stellungen der Beispielpartie.
 * Läuft nur auf Wunsch: GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parsePgnGame } from '../../chess/pgn';
import { EvalCache } from '../../engine/cache';
import { UciEngine, type EngineTransport } from '../../engine/engine';
import { analysePositions } from '../../engine/queue';
import type { PositionEval } from '../../engine/types';
import { operaGame } from '../fixtures';

const ENGINE = fileURLToPath(
  new URL('../../../node_modules/stockfish/bin/stockfish-19-lite-single.js', import.meta.url),
);
const OUTPUT = fileURLToPath(new URL('../fixtures/opera-game-evals-d20.json', import.meta.url));

function processTransport(): EngineTransport {
  const child = spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
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

describe.skipIf(!process.env.GENERATE_EVAL_FIXTURE)('Fixture erzeugen', () => {
  it('rechnet die Beispielpartie mit Tiefe 20', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('Fixture ungültig');
    const fens = [parsed.value.startFen, ...parsed.value.plies.map((p) => p.fenAfter)];
    const engine = new UciEngine(processTransport());
    await engine.init();
    await engine.newGame();
    const evals: PositionEval[] = [];
    await analysePositions(
      engine,
      new EvalCache(),
      fens,
      { depth: 20, multipv: 3 },
      {
        onPosition: (i, e) => {
          evals[i] = e;
          process.stdout.write(`Stellung ${i + 1}/${fens.length}\n`);
        },
        onProgress: () => {},
      },
      new AbortController().signal,
    );
    engine.dispose();
    writeFileSync(
      OUTPUT,
      JSON.stringify({ engine: engine.name, depth: 20, multipv: 3, evals }, null, 1) + '\n',
    );
  }, 900_000);
});
