import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { activateLiveGuard, releaseLiveGuard } from '../../play/liveGuard';
import { usePlay } from '../../store/play';
import { DEFAULT_SETTINGS, useSettings } from '../../store/settings';
import { AnalyseScreen } from './AnalyseScreen';
import { PlayScreen } from './PlayScreen';

function square(id: string): HTMLElement {
  const element = document.getElementById(`play-board-square-${id}`);
  if (!element) throw new Error(`Feld ${id} fehlt`);
  return element;
}

describe('Spielen-Seite', () => {
  beforeEach(async () => {
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      play: { ...DEFAULT_SETTINGS.play, color: 'w', sounds: false },
    });
  });
  afterEach(() => {
    act(() => usePlay.getState().close());
    releaseLiveGuard();
  });

  it('startet eine lokale Partie, nimmt meinen Zug an und lässt Stockfish antworten', async () => {
    render(<PlayScreen />);
    expect(screen.getByRole('heading', { name: 'Neue Partie' })).toBeInTheDocument();
    // 10+0 ist voreingestellt und zählt als Rapid
    expect(screen.getByRole('button', { name: /10\+0/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('10+0 zählt als Rapid.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    expect(screen.getByText('Du bist am Zug.')).toBeInTheDocument();
    // Beide Uhren zeigen die Grundzeit
    expect(screen.getAllByRole('timer').map((t) => t.textContent)).toEqual(['10:00', '10:00']);

    fireEvent.click(square('e2'));
    fireEvent.click(square('e4'));
    const moves = screen.getByRole('region', { name: 'Züge' });
    expect(within(moves).getByText('e4')).toBeInTheDocument();
    expect(await screen.findByText('Du bist am Zug.', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(usePlay.getState().view?.plies).toHaveLength(2);
  });

  it('zeigt nach dem Aufgeben die Ergebniskarte', async () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    // Vor dem ersten Zug: Abbrechen statt Aufgeben
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    fireEvent.click(square('d2'));
    fireEvent.click(square('d4'));
    await screen.findByText('Du bist am Zug.', {}, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Aufgeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }));
    expect(await screen.findByRole('heading', { name: 'Du hast verloren' })).toBeInTheDocument();
    expect(screen.getByText('durch Aufgabe')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Partie' }));
    expect(screen.getByRole('heading', { name: 'Neue Partie' })).toBeInTheDocument();
  });

  it('zeigt Hilfen nur in der lokalen Partie', () => {
    render(<PlayScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Partie starten' }));
    expect(screen.getByRole('button', { name: 'Tipp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zug zurücknehmen' })).toBeDisabled();
  });
});

describe('Analyse während einer Live-Partie', () => {
  afterEach(() => releaseLiveGuard());

  it('zeigt statt der Analyse den Sperrhinweis', () => {
    act(() => activateLiveGuard('abc12345'));
    render(<AnalyseScreen />);
    expect(screen.getByText('Live-Partie läuft – Hilfen sind aus')).toBeInTheDocument();
    act(() => releaseLiveGuard());
    expect(screen.queryByText('Live-Partie läuft – Hilfen sind aus')).not.toBeInTheDocument();
  });
});
