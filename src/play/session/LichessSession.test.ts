import { FakeLichess } from '../../test/fakeLichess';
import { LichessClient } from '../lichess/client';
import { LichessSession } from './LichessSession';

function setup(myColor: 'white' | 'black' = 'white', moves: string[] = []) {
  const server = new FakeLichess();
  const game = server.addGame('abcd1234', myColor, moves);
  let now = 10_000;
  const session = new LichessSession({
    gameId: 'abcd1234',
    client: new LichessClient(() => 'lip_test', server.fetch),
    accountId: 'ich',
    now: () => now,
    // Im Test fast sofort neu verbinden (aber den Timern Zeit lassen)
    wait: () => new Promise((resolve) => setTimeout(resolve, 1)),
    reconnectDelays: [0],
  });
  session.start();
  return {
    server,
    game,
    session,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('LichessSession (simulierter Server)', () => {
  it('normaler Verlauf: Startstand, eigener Zug, Gegnerzug, Serveruhr', async () => {
    const { server, game, session } = setup('white');
    await vi.waitFor(() => expect(session.state.status).toBe('playing'));
    expect(session.state).toMatchObject({
      myColor: 'w',
      timeControl: { initialMs: 600_000, incrementMs: 0 },
      live: { gameId: 'abcd1234', speed: 'rapid', connection: 'connected' },
    });
    expect(session.state.players.b).toMatchObject({ name: 'Gegner', rating: 1520 });

    await session.playMove({ from: 'e2', to: 'e4' });
    expect(server.requests).toContain('POST /api/board/game/abcd1234/move/e2e4');
    await vi.waitFor(() => expect(session.state.plies.map((p) => p.san)).toEqual(['e4']));

    game.btime = 590_000;
    game.wtime = 598_000;
    server.opponentMove('abcd1234', 'e7e5');
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    // Die Zeit des Servers gilt; nach zwei Zügen läuft meine Uhr
    expect(session.state.clock).toMatchObject({ w: 598_000, b: 590_000, running: 'w' });
    expect(session.state.turn).toBe('w');
  });

  it('versteht Rochade als König-auf-Turm in der Zugliste des Servers', async () => {
    const { session } = setup('white', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1h1']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(7));
    expect(session.state.plies.at(-1)?.san).toBe('O-O');
  });

  it('Zugablehnung: setzt auf den Serverstand zurück und meldet es', async () => {
    const { server, session } = setup('white');
    await vi.waitFor(() => expect(session.state.status).toBe('playing'));
    server.rejectNextMove = true;
    const move = session.playMove({ from: 'd2', to: 'd4' });
    // Optimistisch sofort sichtbar
    expect(session.state.plies.map((p) => p.san)).toEqual(['d4']);
    await move;
    expect(session.state.plies).toEqual([]);
    expect(session.state.turn).toBe('w');
    expect(session.state.notice?.code).toBe('moveRejected');
  });

  it('Verbindungsabbruch mitten in der Partie: verbindet neu und übernimmt den Serverstand', async () => {
    const { server, session } = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    server.gameStreamDown = true;
    server.dropGameStreams('abcd1234');
    await vi.waitFor(() => expect(session.state.live?.connection).toBe('reconnecting'));
    // Während der Trennung zieht der Server weiter (z. B. Zug von einem anderen Gerät)
    server.games.get('abcd1234')!.moves.push('g1f3', 'b8c6');
    server.gameStreamDown = false;
    await vi.waitFor(() => expect(session.state.live?.connection).toBe('connected'));
    expect(session.state.plies.map((p) => p.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    const opened = server.requests.filter((r) => r === 'GET /api/board/game/stream/abcd1234');
    expect(opened.length).toBeGreaterThanOrEqual(2);
  });

  it('Remisangebot des Gegners: wird angezeigt und kann angenommen werden', async () => {
    const { server, game, session } = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    game.bdraw = true;
    server.broadcast('abcd1234');
    await vi.waitFor(() => expect(session.state.drawOffer).toBe('b'));
    await session.respondDraw(true);
    await vi.waitFor(() => expect(session.state.status).toBe('ended'));
    expect(session.state.outcome).toEqual({ result: '1/2-1/2', winner: null, reason: 'agreement' });
  });

  it('eigenes Remisangebot und Ablehnung', async () => {
    const { server, game, session } = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    await session.offerDraw();
    expect(session.state.notice?.code).toBe('drawOfferSent');
    await vi.waitFor(() => expect(session.state.drawOffer).toBe('w'));
    game.wdraw = false;
    server.broadcast('abcd1234');
    await vi.waitFor(() => expect(session.state.drawOffer).toBeNull());
  });

  it('Zeitüberschreitung entscheidet nur der Server', async () => {
    const { server, game, session, advance } = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    // Lokal läuft die Uhr ab, aber die Partie bleibt offen, bis der Server etwas sagt
    advance(700_000);
    expect(session.state.status).toBe('playing');
    game.wtime = 0;
    game.status = 'outoftime';
    game.winner = 'black';
    server.broadcast('abcd1234');
    await vi.waitFor(() => expect(session.state.status).toBe('ended'));
    expect(session.state.outcome).toEqual({ result: '0-1', winner: 'b', reason: 'timeout' });
    expect(session.state.clock?.running).toBeNull();
  });

  it('Aufgabe des Gegners', async () => {
    const { server, game, session } = setup('black', ['d2d4', 'd7d5']);
    await vi.waitFor(() => expect(session.state.myColor).toBe('b'));
    game.status = 'resign';
    game.winner = 'black';
    server.broadcast('abcd1234');
    await vi.waitFor(() => expect(session.state.status).toBe('ended'));
    expect(session.state.outcome).toEqual({ result: '0-1', winner: 'b', reason: 'resign' });
  });

  it('eigene Aufgabe und Abbruch ganz am Anfang', async () => {
    const a = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(a.session.state.status).toBe('playing'));
    expect(a.session.canAbort()).toBe(false);
    await a.session.resign();
    await vi.waitFor(() => expect(a.session.state.outcome?.reason).toBe('resign'));
    expect(a.session.state.outcome?.winner).toBe('b');

    const b = setup('white');
    await vi.waitFor(() => expect(b.session.state.status).toBe('playing'));
    expect(b.session.canAbort()).toBe(true);
    await b.session.abort();
    await vi.waitFor(() => expect(b.session.state.outcome?.reason).toBe('aborted'));
  });

  it('Gegner weg: Sieg erst nach der Wartezeit beanspruchbar', async () => {
    const { server, session, advance } = setup('white', ['e2e4', 'e7e5']);
    await vi.waitFor(() => expect(session.state.plies).toHaveLength(2));
    for (const stream of server.gameStreams.get('abcd1234') ?? []) {
      stream.push({ type: 'opponentGone', gone: true, claimWinInSeconds: 30 });
    }
    await vi.waitFor(() => expect(session.state.live?.opponentGone).not.toBeNull());
    expect(session.canClaimVictory()).toBe(false);
    advance(30_000);
    expect(session.canClaimVictory()).toBe(true);
    await session.claimVictory();
    await vi.waitFor(() =>
      expect(session.state.outcome).toMatchObject({ winner: 'w', reason: 'opponentLeft' }),
    );
  });
});
