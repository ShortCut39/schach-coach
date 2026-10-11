import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { setLichessTestDoubles, useLichessAuth } from '../store/lichessAuth';
import { memoryTokenStorage, setTokenStorage } from '../store/persistence';
import { usePlay } from '../store/play';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { FakeLichess } from '../test/fakeLichess';
import { PlayScreen } from '../ui/screens/PlayScreen';
import { isLiveGuardActive, releaseLiveGuard } from './liveGuard';
import { validChallengeClock } from './lichess/lobby';

async function loginWith(server: FakeLichess) {
  const storage = memoryTokenStorage();
  await storage.set('lip_test');
  setTokenStorage(storage);
  setLichessTestDoubles({ fetch: server.fetch });
  await useLichessAuth.getState().load();
}

describe('Lichess: Herausforderungen, Chat, Rücknahme (simulierter Server)', () => {
  beforeEach(async () => {
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      play: {
        ...DEFAULT_SETTINGS.play,
        mode: 'lichess',
        sounds: false,
        lichessNoticeSeen: true,
        minutes: 5,
        increment: 3,
      },
    });
  });
  afterEach(async () => {
    act(() => usePlay.getState().close());
    await act(async () => useLichessAuth.getState().logout());
    releaseLiveGuard();
  });

  it('fordert einen Freund heraus (Blitz) und übernimmt die Partie nach dem Annehmen', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    render(<PlayScreen />);
    // Blitz ist für offene Suchen gesperrt, für Herausforderungen erlaubt
    expect(screen.getByRole('button', { name: 'Gegner suchen' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Benutzername auf Lichess'), {
      target: { value: 'Freund' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Herausfordern' }));
    expect(await screen.findByText('Warte, bis Freund annimmt …')).toBeInTheDocument();
    await vi.waitFor(() => expect(server.outgoing).not.toBeNull());
    expect(Object.fromEntries(server.lastChallengeForm!)).toMatchObject({
      'clock.limit': '300',
      'clock.increment': '3',
      rated: 'false',
      variant: 'standard',
      keepAliveStream: 'true',
    });
    expect(server.requests).toContain('POST /api/challenge/Freund');

    act(() => server.answerOutgoing('accepted'));
    expect(await screen.findByText('Live-Partie auf Lichess: Hilfen sind aus')).toBeInTheDocument();
    expect(isLiveGuardActive()).toBe(true);
  });

  it('meldet eine abgelehnte Herausforderung', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    render(<PlayScreen />);
    fireEvent.change(screen.getByLabelText('Benutzername auf Lichess'), {
      target: { value: 'Freund' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Herausfordern' }));
    await vi.waitFor(() => expect(server.outgoing).not.toBeNull());
    act(() => server.answerOutgoing('declined'));
    expect(await screen.findByText('Freund hat abgelehnt.')).toBeInTheDocument();
    expect(isLiveGuardActive()).toBe(false);
  });

  it('zeigt eingehende Herausforderungen und übernimmt die Partie nach dem Annehmen', async () => {
    const server = new FakeLichess();
    await loginWith(server);
    render(<PlayScreen />);
    await vi.waitFor(() => expect(server.eventStreams.length).toBeGreaterThan(0));
    act(() => server.incomingChallenge('inc00001'));
    const card = (await screen.findByText('Herausforderung erhalten')).parentElement!;
    expect(within(card).getByText(/Freund \(1600\) fordert dich heraus: 5\+3/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Annehmen' }));
    await vi.waitFor(() =>
      expect(server.requests).toContain('POST /api/challenge/inc00001/accept'),
    );
    expect(await screen.findByText('Live-Partie auf Lichess: Hilfen sind aus')).toBeInTheDocument();
    await vi.waitFor(() => expect(usePlay.getState().view?.myColor).toBe('b'));
  });

  it('Chat und Rücknahme-Anfrage in der Live-Partie', async () => {
    const server = new FakeLichess();
    server.addGame('live0003', 'white', ['e2e4', 'e7e5']);
    await loginWith(server);
    await vi.waitFor(() => expect(usePlay.getState().lichess.ongoing).toHaveLength(1));
    act(() => usePlay.getState().resumeLichess('live0003'));
    render(<PlayScreen />);
    await screen.findByText('Du bist am Zug.');

    // Gegner schreibt; eigene Nachricht senden
    for (const stream of server.gameStreams.get('live0003') ?? []) {
      act(() =>
        stream.push({ type: 'chatLine', room: 'player', username: 'Gegner', text: 'Viel Glück!' }),
      );
      act(() =>
        stream.push({ type: 'chatLine', room: 'spectator', username: 'Zuschauer', text: 'Hallo' }),
      );
    }
    const chat = await screen.findByRole('region', { name: 'Chat' });
    expect(await within(chat).findByText('Viel Glück!')).toBeInTheDocument();
    expect(within(chat).queryByText('Hallo')).not.toBeInTheDocument();
    fireEvent.change(within(chat).getByLabelText('Nachricht an deinen Gegner'), {
      target: { value: 'Danke, dir auch' },
    });
    fireEvent.click(within(chat).getByRole('button', { name: 'Senden' }));
    await vi.waitFor(() => expect(server.chats).toEqual(['Danke, dir auch']));
    expect(await within(chat).findByText('Danke, dir auch')).toBeInTheDocument();

    // Rücknahme anfragen: Lichess fragt den Gegner, die App nimmt nichts selbst zurück
    fireEvent.click(screen.getByRole('button', { name: 'Rücknahme anfragen' }));
    await vi.waitFor(() =>
      expect(server.requests).toContain('POST /api/board/game/live0003/takeback/yes'),
    );
    expect(await screen.findByRole('button', { name: 'Rücknahme angefragt' })).toBeDisabled();
    // Die Stellung bleibt, bis der Gegner zustimmt
    expect(usePlay.getState().view?.plies).toHaveLength(2);
  });

  it('prüft die erlaubten Uhren für Herausforderungen', () => {
    expect(validChallengeClock(5, 3)).toBe(true);
    expect(validChallengeClock(10, 0)).toBe(true);
    expect(validChallengeClock(2.5, 0)).toBe(false);
    expect(validChallengeClock(10, 61)).toBe(false);
    expect(validChallengeClock(181, 0)).toBe(false);
  });
});
