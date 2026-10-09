// @vitest-environment node
/// <reference types="node" />
/**
 * Erzeugt src/test/fixtures/opera-game-evals-d20.json mit echten Stockfish-Bewertungen
 * (Tiefe 20, Multi-PV 3) für alle Stellungen der Beispielpartie.
 * Läuft nur auf Wunsch: GENERATE_EVAL_FIXTURE=1 pnpm vitest run src/test/tools
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processTransport } from '../processEngine';
import { parsePgnGame } from '../../chess/pgn';
import { EvalCache } from '../../engine/cache';
import { UciEngine } from '../../engine/engine';
import { analysePositions } from '../../engine/queue';
import type { PositionEval } from '../../engine/types';
import { operaGame } from '../fixtures';

const OUTPUT = fileURLToPath(new URL('../fixtures/opera-game-evals-d20.json', import.meta.url));

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
