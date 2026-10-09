import { EngineError, mateStopDepth, UciEngine, type EngineTransport } from './engine';

/** Simulierte Engine: antwortet auf Befehle mit vorgegebenen Zeilen. */
class FakeTransport implements EngineTransport {
  sent: string[] = [];
  private lineListeners = new Set<(line: string) => void>();
  private errorListeners = new Set<(error: unknown) => void>();
  constructor(private readonly respond: (command: string, emit: (line: string) => void) => void) {}

  send(command: string) {
    this.sent.push(command);
    queueMicrotask(() => this.respond(command, (line) => this.emit(line)));
  }
  emit(line: string) {
    for (const listener of [...this.lineListeners]) listener(line);
  }
  crash() {
    for (const listener of this.errorListeners) listener(new Error('WASM kaputt'));
  }
  onLine(listener: (line: string) => void) {
    this.lineListeners.add(listener);
    return () => this.lineListeners.delete(listener);
  }
  onError(listener: (error: unknown) => void) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
  terminate() {}
}

function standardResponder(command: string, emit: (line: string) => void) {
  if (command === 'uci') {
    emit('id name Stockfish 19 Lite WASM');
    emit('id author the Stockfish developers');
    emit('uciok');
  } else if (command === 'isready') emit('readyok');
  else if (command.startsWith('go')) {
    emit('info depth 1 seldepth 1 multipv 1 score cp 20 nodes 1 pv e7e5');
    emit('info depth 2 seldepth 2 multipv 1 score cp 35 upperbound nodes 2 pv e7e5');
    emit('info depth 2 seldepth 2 multipv 1 score cp 30 nodes 3 pv e7e5 g1f3');
    emit('info depth 2 seldepth 2 multipv 2 score cp 45 nodes 3 pv c7c5 g1f3');
    emit('bestmove e7e5 ponder g1f3');
  }
}

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('UciEngine', () => {
  it('initialisiert und liest den Namen', async () => {
    const transport = new FakeTransport(standardResponder);
    const engine = new UciEngine(transport);
    await engine.init();
    expect(engine.name).toBe('Stockfish 19 Lite WASM');
    expect(transport.sent).toEqual(['uci', 'setoption name Hash value 64', 'isready']);
  });

  it('sucht mit Multi-PV, ignoriert Schranken und dreht auf Weiß-Sicht', async () => {
    const transport = new FakeTransport(standardResponder);
    const engine = new UciEngine(transport);
    await engine.init();
    const depths: number[] = [];
    const result = await engine.search(AFTER_E4, { depth: 2, multipv: 2 }, (d) => depths.push(d));

    expect(transport.sent.slice(-3)).toEqual([
      'setoption name MultiPV value 2',
      `position fen ${AFTER_E4}`,
      'go depth 2',
    ]);
    expect(depths).toEqual([1, 2]);
    expect(result).toEqual({
      aborted: false,
      depth: 2,
      lines: [
        { multipv: 1, cp: -30, pv: ['e7e5', 'g1f3'], depth: 2 },
        { multipv: 2, cp: -45, pv: ['c7c5', 'g1f3'], depth: 2 },
      ],
    });
  });

  it('setzt Multi-PV nur bei Änderung neu und führt Suchen nacheinander aus', async () => {
    const transport = new FakeTransport(standardResponder);
    const engine = new UciEngine(transport);
    await engine.init();
    await Promise.all([
      engine.search(AFTER_E4, { depth: 2, multipv: 2 }),
      engine.search(AFTER_E4, { depth: 2, multipv: 2 }),
    ]);
    expect(transport.sent.filter((c) => c.startsWith('setoption name MultiPV'))).toHaveLength(1);
    const order = transport.sent.filter((c) => c.startsWith('position') || c.startsWith('go'));
    expect(order).toEqual([
      `position fen ${AFTER_E4}`,
      'go depth 2',
      `position fen ${AFTER_E4}`,
      'go depth 2',
    ]);
  });

  it('meldet einen Abbruch per stop', async () => {
    let finish: (() => void) | undefined;
    const transport = new FakeTransport((command, emit) => {
      if (command.startsWith('go')) {
        emit('info depth 5 multipv 1 score cp 10 nodes 1 pv e7e5');
        finish = () => emit('bestmove e7e5');
      } else if (command === 'stop') finish?.();
      else standardResponder(command, emit);
    });
    const engine = new UciEngine(transport);
    const search = engine.search(AFTER_E4, { depth: 30, multipv: 1 });
    await new Promise((r) => setTimeout(r, 0));
    engine.stop();
    expect(await search).toMatchObject({ aborted: true, depth: 5 });
  });

  it('meldet Zeitüberschreitung und Absturz', async () => {
    const silent = new UciEngine(new FakeTransport(() => {}));
    await expect(silent.init(20)).rejects.toEqual(new EngineError('timeout'));

    const transport = new FakeTransport(() => {});
    const crashing = new UciEngine(transport);
    const init = crashing.init();
    transport.crash();
    await expect(init).rejects.toEqual(new EngineError('crashed'));
  });

  it('stoppt früh, sobald ein Matt in einer vollständigen Iteration sicher ist', async () => {
    // Stellung nach 16… Sxb8: Weiß setzt mit Td8# matt
    const fen = '1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17';
    let finish: (() => void) | undefined;
    const transport = new FakeTransport((command, emit) => {
      if (command.startsWith('go')) {
        for (let depth = 1; depth <= 12; depth++) {
          emit(`info depth ${depth} multipv 1 score mate 1 nodes 1 pv d1d8`);
          emit(`info depth ${depth} multipv 2 score cp 900 nodes 1 pv g5d2`);
        }
        finish = () => emit('bestmove d1d8');
      } else if (command === 'stop') finish?.();
      else standardResponder(command, emit);
    });
    const engine = new UciEngine(transport);
    const result = await engine.search(fen, { depth: 20, multipv: 2 });
    expect(transport.sent).toContain('stop');
    expect(result.aborted).toBe(false);
    expect(result.depth).toBeGreaterThanOrEqual(10);
    expect(result.lines.map((l) => l.multipv)).toEqual([1, 2]);
    expect(result.lines[0]?.mate).toBe(1);
  });
});

describe('mateStopDepth', () => {
  it('verlangt mindestens Tiefe 10 und mehr bei längeren Matts', () => {
    expect(mateStopDepth(1)).toBe(10);
    expect(mateStopDepth(-2)).toBe(10);
    expect(mateStopDepth(5)).toBe(16);
  });
});
