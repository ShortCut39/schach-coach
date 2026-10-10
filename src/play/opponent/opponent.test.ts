import { Chess } from 'chess.js';
import { goCommand } from '../../engine/engine';
import { setEngineTransportFactory } from '../../store/engine';
import { fakeEngineTransport } from '../../test/fakeEngine';
import { activateLiveGuard, LiveGuardError, releaseLiveGuard } from '../liveGuard';
import { acceptsDrawFromEval, moveLimits, moveTimeMs } from './levels';
import { StockfishOpponent } from './stockfishOpponent';

describe('Stärkestufen', () => {
  it('rechnet die Bedenkzeit aus der Restzeit', () => {
    // 10 Minuten Restzeit, kein Inkrement: 20 s geplant, Stufe „Maximal“ deckelt bei 10 s
    expect(moveTimeMs('max', { own: 600_000, increment: 0 })).toBe(10_000);
    // 3 Minuten + 2 s Inkrement: 6 s + 1,6 s, gedeckelt bei 6 s („Stark“)
    expect(moveTimeMs('strong', { own: 180_000, increment: 2_000 })).toBe(6_000);
    // Großes Inkrement, wenig Restzeit: höchstens ein Drittel der Restzeit
    expect(moveTimeMs('max', { own: 9_000, increment: 10_000 })).toBe(3_000);
    // Fast keine Zeit mehr: kurze Mindestzeit
    expect(moveTimeMs('max', { own: 900, increment: 0 })).toBe(50);
    expect(moveTimeMs('medium', null)).toBe(1_000);
  });

  it('begrenzt schwache Stufen zusätzlich über die Tiefe', () => {
    expect(moveLimits('beginner', null)).toEqual({ movetime: 200, depth: 1 });
    expect(moveLimits('max', null)).toEqual({ movetime: 1_000 });
    expect(goCommand(moveLimits('easy', { own: 600_000, increment: 0 }))).toBe(
      'go depth 2 movetime 300',
    );
  });

  it('nimmt Remis nur bei höchstens leichtem eigenem Vorteil an', () => {
    const line = (cp: number) => ({ multipv: 1, cp, pv: [], depth: 12 });
    // Bewertungen aus Sicht Weiß; Gegner hat Schwarz
    expect(acceptsDrawFromEval(line(0), 'b')).toBe(true);
    expect(acceptsDrawFromEval(line(-30), 'b')).toBe(true);
    expect(acceptsDrawFromEval(line(-31), 'b')).toBe(false);
    expect(acceptsDrawFromEval(line(200), 'b')).toBe(true);
    expect(acceptsDrawFromEval(line(45), 'w')).toBe(false);
    expect(acceptsDrawFromEval({ multipv: 1, mate: -3, pv: [], depth: 12 }, 'b')).toBe(false);
    expect(acceptsDrawFromEval({ multipv: 1, mate: 3, pv: [], depth: 12 }, 'b')).toBe(true);
  });
});

describe('StockfishOpponent', () => {
  afterEach(() => {
    releaseLiveGuard();
    setEngineTransportFactory(fakeEngineTransport);
  });

  it('startet eine eigene Engine, setzt die Stufe und liefert einen legalen Zug', async () => {
    const sent: string[] = [];
    setEngineTransportFactory(() => {
      const transport = fakeEngineTransport();
      return { ...transport, send: (c) => (sent.push(c), transport.send(c)) };
    });
    const opponent = new StockfishOpponent('beginner');
    const start = new Chess().fen();
    const move = await opponent.chooseMove(
      { startFen: start, moves: ['e2e4'] },
      null,
      new AbortController().signal,
    );
    const chess = new Chess();
    chess.move('e4');
    expect(chess.moves({ verbose: true }).map((m) => m.lan)).toContain(move);
    expect(sent).toContain('setoption name Skill Level value 0');
    expect(sent).toContain(`position fen ${start} moves e2e4`);
    expect(sent).toContain('go depth 1 movetime 200');
    opponent.dispose();
  });

  it('kann während einer Live-Partie nicht gestartet werden', async () => {
    activateLiveGuard('abc12345');
    const opponent = new StockfishOpponent('max');
    await expect(
      opponent.chooseMove(
        { startFen: new Chess().fen(), moves: [] },
        null,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(LiveGuardError);
  });

  it('wird beim Start einer Live-Partie beendet', async () => {
    let terminated = 0;
    setEngineTransportFactory(() => {
      const transport = fakeEngineTransport();
      return { ...transport, terminate: () => void terminated++ };
    });
    const opponent = new StockfishOpponent('max');
    await opponent.prepare();
    activateLiveGuard('abc12345');
    expect(terminated).toBe(1);
  });
});
