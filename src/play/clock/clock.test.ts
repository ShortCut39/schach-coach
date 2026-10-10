import { ChessClock, formatClock, remainingAt } from './clock';

function fakeTime(start = 1000) {
  let now = start;
  return {
    source: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('ChessClock', () => {
  it('zieht nur der laufenden Seite Zeit ab', () => {
    const time = fakeTime();
    const clock = new ChessClock({ initialMs: 600_000, incrementMs: 0 }, time.source);
    clock.start('w');
    time.advance(5_000);
    expect(clock.remaining('w')).toBe(595_000);
    expect(clock.remaining('b')).toBe(600_000);
  });

  it('schreibt das Inkrement nach dem eigenen Zug gut und startet die Gegneruhr', () => {
    const time = fakeTime();
    const clock = new ChessClock({ initialMs: 600_000, incrementMs: 5_000 }, time.source);
    clock.start('w');
    time.advance(3_000);
    clock.press('w');
    expect(clock.remaining('w')).toBe(602_000);
    expect(clock.runningColor()).toBe('b');
    time.advance(10_000);
    expect(clock.remaining('b')).toBe(590_000);
    expect(clock.remaining('w')).toBe(602_000);
  });

  it('erkennt die abgelaufene Zeit und wird nie negativ', () => {
    const time = fakeTime();
    const clock = new ChessClock({ initialMs: 1_000, incrementMs: 0 }, time.source);
    clock.start('b');
    time.advance(400);
    expect(clock.flagged()).toBeNull();
    expect(clock.msUntilFlag()).toBe(600);
    time.advance(2_000);
    expect(clock.flagged()).toBe('b');
    expect(clock.remaining('b')).toBe(0);
  });

  it('steht nach stop() still', () => {
    const time = fakeTime();
    const clock = new ChessClock({ initialMs: 60_000, incrementMs: 0 }, time.source);
    clock.start('w');
    time.advance(1_000);
    clock.stop();
    time.advance(30_000);
    expect(clock.remaining('w')).toBe(59_000);
    expect(clock.runningColor()).toBeNull();
  });

  it('übernimmt Serverzeiten und tickt danach lokal weiter', () => {
    const time = fakeTime();
    const clock = new ChessClock({ initialMs: 600_000, incrementMs: 0 }, time.source);
    clock.start('w');
    time.advance(1_000);
    // Server meldet abweichende Zeiten: Der Server gewinnt
    clock.set({ w: 550_000, b: 580_000 }, 'b');
    expect(clock.remaining('w')).toBe(550_000);
    time.advance(2_500);
    expect(clock.remaining('b')).toBe(577_500);
  });

  it('liefert einen Schnappschuss, aus dem die Anzeige rechnen kann', () => {
    const time = fakeTime(0);
    const clock = new ChessClock({ initialMs: 10_000, incrementMs: 0 }, time.source);
    clock.start('w');
    const snapshot = clock.snapshot();
    expect(remainingAt(snapshot, 'w', 4_000)).toBe(6_000);
    expect(remainingAt(snapshot, 'b', 4_000)).toBe(10_000);
  });
});

describe('formatClock', () => {
  it('zeigt Minuten und Sekunden', () => {
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(65_999)).toBe('1:05');
    expect(formatClock(20_000)).toBe('0:20');
  });

  it('zeigt unter 20 s Zehntelsekunden', () => {
    expect(formatClock(19_999)).toBe('0:19.9');
    expect(formatClock(9_450)).toBe('0:09.4');
    expect(formatClock(0)).toBe('0:00.0');
    expect(formatClock(-50)).toBe('0:00.0');
    expect(formatClock(5_300, ',')).toBe('0:05,3');
  });

  it('zeigt Stunden bei langen Partien', () => {
    expect(formatClock(3 * 3600_000 + 61_000)).toBe('3:01:01');
  });
});
