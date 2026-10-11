import { act, fireEvent, render, screen } from '@testing-library/react';
import { chatCompletion } from '../llm/client';
import { getEngines } from '../store/engine';
import { setLichessTestDoubles, useLichessAuth } from '../store/lichessAuth';
import { useLiveGuard } from '../store/liveGuard';
import { useNavigation } from '../store/navigation';
import { memoryTokenStorage, setTokenStorage } from '../store/persistence';
import { setPairingTimingsForTests, usePlay } from '../store/play';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { FakeLichess } from '../test/fakeLichess';
import { AnalyseScreen } from '../ui/screens/AnalyseScreen';
import { PlayScreen } from '../ui/screens/PlayScreen';
import { isLiveGuardActive, LiveGuardError, releaseLiveGuard } from './liveGuard';

async function loginWith(server: FakeLichess) {
  const storage = memoryTokenStorage();
  await storage.set('lip_test');
  setTokenStorage(storage);
  setLichessTestDoubles({ fetch: server.fetch });
  await useLichessAuth.getState().load();
  expect(useLichessAuth.getState().status).toBe('loggedIn');
}

function square(id: string): HTMLElement {
  const element = document.getElementById(`play-board-square-${id}`);
  if (!element) throw new Error(`Feld ${id} fehlt`);
  return element;
}

describe('Lichess-Partie von der Suche bis zur Analyse (simulierter Server)', () => {
  beforeEach(async () => {
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      play: { ...DEFAULT_SETTINGS.play, mode: 'lichess', sounds: false },
    });
  });
  afterEach(async () => {
    act(() => usePlay.getState().close());
    await act(async () => useLichessAuth.getState().logout());
    releaseLiveGuard();
  });

  it('sucht, sperrt alle Hilfen während der Partie und gibt sie danach wieder frei', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    render(<PlayScreen />);

    // Fair-Play-Hinweis muss vor der ersten Suche bestätigt werden
    const seek = screen.getByRole('button', { name: 'Gegner suchen' });
    expect(seek).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
    await vi.waitFor(() => expect(seek).toBeEnabled());
    fireEvent.click(seek);
    expect(await screen.findByText(/Suche läuft/)).toBeInTheDocument();

    // Der Ereignisstrom ist vor der Suche offen (sonst ginge der Partiestart verloren)
    await vi.waitFor(() => expect(server.seekStreams).toHaveLength(1));
    const order = server.requests.filter((r) => r.includes('stream/event') || r.includes('seek'));
    expect(order).toEqual(['GET /api/stream/event', 'POST /api/board/seek']);

    act(() => server.pairSeek('live0001', 'white'));
    await vi.waitFor(() => expect(isLiveGuardActive()).toBe(true));
    expect(useLiveGuard.getState().gameId).toBe('live0001');
    expect(await screen.findByText('Live-Partie auf Lichess: Hilfen sind aus')).toBeInTheDocument();
    await screen.findByText('Du bist am Zug.');
    // Keine Hilfen in der Oberfläche
    expect(screen.queryByRole('button', { name: 'Tipp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zug zurücknehmen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Bewertungsbalken' })).not.toBeInTheDocument();
    // … und auch nicht über Umwege: Engine und KI sind gesperrt
    await expect(getEngines(1)).rejects.toBeInstanceOf(LiveGuardError);
    await expect(
      chatCompletion(
        { baseUrl: 'https://example.test/v1', apiKey: '', model: 'x' },
        [{ role: 'user', content: 'Hilfe?' }],
        { jsonMode: false },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'liveGame' });

    // Zug spielen, Gegner antwortet, dann gibt der Gegner auf
    fireEvent.click(square('e2'));
    fireEvent.click(square('e4'));
    await vi.waitFor(() => expect(server.games.get('live0001')?.moves).toEqual(['e2e4']));
    act(() => server.opponentMove('live0001', 'e7e5'));
    await screen.findByText('Du bist am Zug.');
    const game = server.games.get('live0001')!;
    game.status = 'resign';
    game.winner = 'white';
    act(() => server.broadcast('live0001'));

    expect(await screen.findByRole('heading', { name: 'Du hast gewonnen' })).toBeInTheDocument();
    expect(isLiveGuardActive()).toBe(false);
    expect(await getEngines(1)).toHaveLength(1);

    // Übergabe an die Analyse: PGN mit Lichess-Kopfzeilen, aus meiner Sicht
    const pgn = usePlay.getState().finishedGame?.pgn ?? '';
    expect(pgn).toContain('[Site "https://lichess.org/live0001"]');
    expect(pgn).toContain('[Event "Casual Rapid game"]');
    expect(pgn).toContain('[White "Ich"]');
    expect(pgn).toContain('[BlackElo "1520"]');
    expect(pgn).toContain('[TimeControl "600+0"]');
    fireEvent.click(screen.getByRole('button', { name: 'Partie analysieren' }));
    expect(useNavigation.getState().screen).toBe('analyse');
  });

  it('zeigt während der Live-Partie keine Analyse (auch nicht für andere Partien)', async () => {
    const server = new FakeLichess();
    server.addGame('live0002', 'black');
    useNavigation.setState({ screen: 'analyse' });
    await loginWith(server);
    await vi.waitFor(() => expect(usePlay.getState().lichess.ongoing).toHaveLength(1));
    // Die Uhr läuft schon: Die App wechselt von selbst zu „Spielen“
    await vi.waitFor(() => expect(useNavigation.getState().screen).toBe('spielen'));
    act(() => usePlay.getState().resumeLichess('live0002'));
    expect(isLiveGuardActive()).toBe(true);
    render(<AnalyseScreen />);
    expect(screen.getByText('Live-Partie läuft – Hilfen sind aus')).toBeInTheDocument();
    // Fortgesetzte Partie: eigene Farbe (Schwarz) unten
    await vi.waitFor(() => expect(usePlay.getState().view?.myColor).toBe('b'));
    expect(usePlay.getState().orientation).toBe('black');
  });

  it('nennt die Begründung, wenn Lichess die Suche ablehnt', async () => {
    const server = new FakeLichess();
    server.rejectSeek = 'Too many seeks';
    await loginWith(server);
    await act(async () =>
      usePlay.getState().startSeek({ minutes: 10, increment: 0, rated: false, color: 'random' }),
    );
    expect(usePlay.getState().lichess).toMatchObject({
      seeking: null,
      error: { code: 'rejected', detail: 'Too many seeks' },
    });
    expect(isLiveGuardActive()).toBe(false);
  });

  it('bricht die Suche ab, indem die Verbindung geschlossen wird', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    const seeking = usePlay
      .getState()
      .startSeek({ minutes: 15, increment: 10, rated: true, color: 'w' });
    await vi.waitFor(() => expect(server.seekStreams).toHaveLength(1));
    act(() => usePlay.getState().cancelSeek());
    await seeking;
    expect(usePlay.getState().lichess.seeking).toBeNull();
    expect(usePlay.getState().session).toBeNull();
  });

  it('übernimmt die Partie, auch wenn Lichess die Suche vor dem Partiestart schließt', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    const seeking = usePlay
      .getState()
      .startSeek({ minutes: 10, increment: 0, rated: false, color: 'random' });
    await vi.waitFor(() => expect(server.seekStreams).toHaveLength(1));
    // Echte Reihenfolge: Suche zu, gameStart erst 200 ms später
    act(() => server.pairSeek('late0001', 'white', { gameStartDelayMs: 200 }));
    await seeking;
    expect(usePlay.getState().lichess.pairing).toBe(true);
    await vi.waitFor(() => expect(usePlay.getState().view?.live?.gameId).toBe('late0001'));
    expect(usePlay.getState().lichess.pairing).toBe(false);
    expect(usePlay.getState().lichess.ongoing).toEqual([]);
    expect(isLiveGuardActive()).toBe(true);
  });

  it('findet die neue Partie selbst, wenn das Startsignal verloren geht', async () => {
    setPairingTimingsForTests({ fallbackMs: 50 });
    try {
      const server = new FakeLichess();
      await loginWith(server);
      const seeking = usePlay
        .getState()
        .startSeek({ minutes: 10, increment: 0, rated: false, color: 'random' });
      await vi.waitFor(() => expect(server.seekStreams).toHaveLength(1));
      act(() => server.pairSeek('lost0001', 'black', { loseGameStart: true }));
      await seeking;
      await vi.waitFor(() => expect(usePlay.getState().view?.live?.gameId).toBe('lost0001'));
      expect(server.requests).toContain('GET /api/account/playing');
      await vi.waitFor(() => expect(usePlay.getState().view?.myColor).toBe('b'));
    } finally {
      setPairingTimingsForTests({ fallbackMs: 3_000 });
    }
  });
});
