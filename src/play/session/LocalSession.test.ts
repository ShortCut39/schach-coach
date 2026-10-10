import { Chess } from 'chess.js';
import { LocalSession, type LocalOpponent } from './LocalSession';
import type { GameViewState } from './types';

/** Test-Gegner: spielt Züge aus einer Liste, sonst den ersten legalen Zug. Keine echte Engine. */
function scriptedOpponent(script: string[] = [], acceptDraw = false) {
  const calls: string[] = [];
  const opponent: LocalOpponent & { calls: string[] } = {
    calls,
    async chooseMove(position) {
      calls.push(position.fen);
      return script.shift() ?? new Chess(position.fen).moves({ verbose: true })[0]!.lan;
    },
    async acceptsDraw() {
      return acceptDraw;
    },
    dispose() {},
  };
  return opponent;
}

const players = { w: { name: 'Ich' }, b: { name: '' } };

function settled(session: LocalSession): Promise<GameViewState> {
  return new Promise((resolve) => {
    const check = (state: GameViewState) => {
      if (!state.waiting) {
        off();
        resolve(state);
      }
    };
    const off = session.subscribe(check);
    if (!session.state.waiting) {
      off();
      resolve(session.state);
    }
  });
}

describe('LocalSession', () => {
  it('spielt meinen Zug und lässt den Gegner antworten', async () => {
    const opponent = scriptedOpponent(['e7e5']);
    const session = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent,
      players,
      opponentDelay: () => 0,
    });
    session.start();
    await session.playMove({ from: 'e2', to: 'e4' });
    const state = await settled(session);
    expect(state.plies.map((p) => p.san)).toEqual(['e4', 'e5']);
    expect(state.turn).toBe('w');
    expect(state.status).toBe('playing');
  });

  it('lässt den Gegner mit Weiß zuerst ziehen', async () => {
    const session = new LocalSession({
      myColor: 'b',
      timeControl: null,
      opponent: scriptedOpponent(['d2d4']),
      players,
      opponentDelay: () => 0,
    });
    session.start();
    const state = await settled(session);
    expect(state.plies.map((p) => p.san)).toEqual(['d4']);
  });

  it('ignoriert illegale Züge und Züge, wenn ich nicht dran bin', async () => {
    const session = new LocalSession({
      myColor: 'b',
      timeControl: null,
      opponent: scriptedOpponent(),
      players,
      opponentDelay: () => 0,
    });
    await session.playMove({ from: 'e7', to: 'e5' });
    expect(session.state.plies).toHaveLength(0);
  });

  it('beendet die Partie bei Matt', async () => {
    const session = new LocalSession({
      myColor: 'b',
      timeControl: null,
      opponent: scriptedOpponent(['f2f3', 'g2g4']),
      players,
      opponentDelay: () => 0,
    });
    session.start();
    await settled(session);
    await session.playMove({ from: 'e7', to: 'e5' });
    await settled(session);
    await session.playMove({ from: 'd8', to: 'h4' });
    expect(session.state.outcome).toEqual({ result: '0-1', winner: 'b', reason: 'checkmate' });
    expect(session.state.status).toBe('ended');
  });

  it('nimmt meinen Zug samt Antwort zurück', async () => {
    const session = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent: scriptedOpponent(['e7e5', 'b8c6']),
      players,
      opponentDelay: () => 0,
    });
    await session.playMove({ from: 'e2', to: 'e4' });
    await settled(session);
    await session.playMove({ from: 'g1', to: 'f3' });
    await settled(session);
    await session.takeback();
    expect(session.state.plies.map((p) => p.san)).toEqual(['e4', 'e5']);
    expect(session.state.turn).toBe('w');
    expect(session.state.takebacks).toBe(1);
  });

  it('wertet Aufgabe und Abbruch', async () => {
    const a = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent: scriptedOpponent(),
      players,
    });
    expect(a.canAbort()).toBe(true);
    await a.abort();
    expect(a.state.outcome?.reason).toBe('aborted');

    const b = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent: scriptedOpponent(),
      players,
    });
    await b.resign();
    expect(b.state.outcome).toEqual({ result: '0-1', winner: 'b', reason: 'resign' });
  });

  it('Remisangebot: angenommen oder abgelehnt', async () => {
    const yes = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent: scriptedOpponent([], true),
      players,
    });
    await yes.offerDraw();
    expect(yes.state.outcome).toEqual({ result: '1/2-1/2', winner: null, reason: 'agreement' });

    const no = new LocalSession({
      myColor: 'w',
      timeControl: null,
      opponent: scriptedOpponent([], false),
      players,
    });
    await no.offerDraw();
    expect(no.state.status).toBe('playing');
    expect(no.state.notice?.code).toBe('drawDeclined');
    // Gleich noch einmal anbieten geht erst nach ein paar Zügen
    expect(no.canOfferDraw()).toBe(false);
  });

  it('verliert auf Zeit, wenn die eigene Uhr abläuft', async () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const session = new LocalSession({
        myColor: 'w',
        timeControl: { initialMs: 2_000, incrementMs: 0 },
        opponent: scriptedOpponent(['e7e5']),
        players,
        now: () => now,
        opponentDelay: () => 0,
      });
      const played = session.playMove({ from: 'e2', to: 'e4' });
      await vi.advanceTimersByTimeAsync(1);
      await played;
      expect(session.state.turn).toBe('w');
      // Meine Uhr läuft jetzt: 2 s vergehen
      now += 2_100;
      await vi.advanceTimersByTimeAsync(2_100);
      expect(session.state.outcome).toEqual({ result: '0-1', winner: 'b', reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});
