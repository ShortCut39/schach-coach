import { Chess } from 'chess.js';
import { applyUci, boardOutcome, hasMatingMaterial, replay, timeoutOutcome } from './gameEnd';
import { allowedForLichessSeek, pgnTimeControl, speedOf, timeControl } from './timeControl';

describe('Partieende laut Brett', () => {
  it('erkennt Matt (Narrenmatt)', () => {
    const chess = replay(new Chess().fen(), ['f2f3', 'e7e5', 'g2g4', 'd8h4'])!;
    expect(boardOutcome(chess)).toEqual({ result: '0-1', winner: 'b', reason: 'checkmate' });
  });

  it('erkennt Patt', () => {
    const chess = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(boardOutcome(chess)).toMatchObject({ result: '1/2-1/2', reason: 'stalemate' });
  });

  it('erkennt zu wenig Material', () => {
    const chess = new Chess('8/8/4k3/8/8/3K4/8/6B1 w - - 0 1');
    expect(boardOutcome(chess)?.reason).toBe('insufficientMaterial');
  });

  it('erkennt dreifache Stellungswiederholung', () => {
    const moves = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const chess = replay(new Chess().fen(), moves)!;
    expect(boardOutcome(chess)?.reason).toBe('threefoldRepetition');
  });

  it('erkennt die 50-Züge-Regel', () => {
    const chess = new Chess('8/8/4k3/8/8/3K4/8/R7 w - - 99 80');
    chess.move('Ra2');
    expect(boardOutcome(chess)?.reason).toBe('fiftyMoves');
  });

  it('meldet nichts in einer laufenden Partie', () => {
    expect(boardOutcome(new Chess())).toBeNull();
  });
});

describe('Zeitüberschreitung', () => {
  it('verliert, wenn der Gegner mattsetzen kann', () => {
    const fen = '8/8/4k3/8/8/3K4/8/R7 w - - 0 1';
    expect(timeoutOutcome(fen, 'b')).toEqual({ result: '1-0', winner: 'w', reason: 'timeout' });
  });

  it('ist Remis, wenn der Gegner nur König (und eine Leichtfigur) hat', () => {
    expect(timeoutOutcome('8/8/4k3/8/8/3K4/8/R7 w - - 0 1', 'w')).toMatchObject({
      result: '1/2-1/2',
      reason: 'timeoutVsInsufficient',
    });
    expect(hasMatingMaterial('8/8/4k3/8/8/3K4/8/6N1 w - - 0 1', 'w')).toBe(false);
    expect(hasMatingMaterial('8/8/4k3/8/8/3K4/P7/8 w - - 0 1', 'w')).toBe(true);
    expect(hasMatingMaterial('8/8/4k3/8/8/3K4/8/5NN1 w - - 0 1', 'w')).toBe(true);
  });
});

describe('UCI-Züge anwenden', () => {
  const castleReady = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

  it('versteht Rochade als Königszug und als König-auf-Turm', () => {
    const a = new Chess(castleReady);
    expect(applyUci(a, 'e1g1')).toBe(true);
    const b = new Chess(castleReady);
    expect(applyUci(b, 'e1h1')).toBe(true);
    expect(b.fen()).toBe(a.fen());
    const c = new Chess(castleReady);
    expect(applyUci(c, 'e1a1')).toBe(true);
    expect(c.get('c1')?.type).toBe('k');
  });

  it('wandelt Bauern um und lehnt illegale Züge ab', () => {
    const chess = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    expect(applyUci(chess, 'e7e8n')).toBe(true);
    expect(chess.get('e8')?.type).toBe('n');
    expect(applyUci(new Chess(), 'e2e5')).toBe(false);
    expect(replay(new Chess().fen(), ['e2e4', 'e2e4'])).toBeNull();
  });
});

describe('Zeitkontrolle', () => {
  it('ordnet wie Lichess ein (Grundzeit + 40 × Inkrement)', () => {
    expect(speedOf(timeControl(10, 0))).toBe('rapid');
    expect(speedOf(timeControl(5, 3))).toBe('blitz');
    expect(speedOf(timeControl(7, 0))).toBe('blitz');
    expect(speedOf(timeControl(8, 0))).toBe('rapid');
    expect(speedOf(timeControl(15, 10))).toBe('rapid');
    expect(speedOf(timeControl(30, 0))).toBe('classical');
    expect(speedOf(timeControl(1, 0))).toBe('bullet');
  });

  it('erlaubt offene Lichess-Suchen nur ab Rapid', () => {
    expect(allowedForLichessSeek(timeControl(10, 0))).toBe(true);
    expect(allowedForLichessSeek(timeControl(5, 0))).toBe(false);
    expect(allowedForLichessSeek(timeControl(30, 0))).toBe(true);
  });

  it('schreibt die PGN-Kopfzeile', () => {
    expect(pgnTimeControl(timeControl(10, 5))).toBe('600+5');
    expect(pgnTimeControl(null)).toBe('-');
  });
});
