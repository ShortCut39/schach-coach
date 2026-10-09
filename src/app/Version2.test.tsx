import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAnalysis } from '../store/analysis';
import { useExplanations } from '../store/explanations';
import { useGame } from '../store/game';
import { useImportDraft } from '../store/importDraft';
import { useLibrary } from '../store/library';
import { useNavigation } from '../store/navigation';
import { keyValueLibrary, memoryStorage, setLibraryStorage } from '../store/persistence';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { operaGame } from '../test/fixtures';
import { App } from './App';

function nav(name: string) {
  const bar = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  fireEvent.click(within(bar).getByRole('button', { name }));
}

describe('Version 2', () => {
  beforeEach(async () => {
    setLibraryStorage(keyValueLibrary(memoryStorage()));
    useLibrary.setState({ entries: [], loaded: false });
    useNavigation.setState({ screen: 'import', analyseView: 'board' });
    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
    useImportDraft.getState().reset();
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('legt analysierte Partien in der Bibliothek ab, öffnet und löscht sie', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: operaGame } });
    await screen.findByText(/PGN erkannt/);
    fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));
    await waitFor(() => expect(useAnalysis.getState().status).toBe('done'));
    await useLibrary.getState().saveCurrent();

    nav('Bibliothek');
    const table = await screen.findByRole('table', { name: 'Analysierte Partien' });
    expect(within(table).getByText('Philidor Defense')).toBeInTheDocument();
    expect(within(table).getByText('Sieg')).toBeInTheDocument();
    expect(screen.getByText('1 Partie')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Partien durchsuchen'), {
      target: { value: 'sizilianisch' },
    });
    expect(screen.getByText('Keine Partie passt zu Suche und Filter.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Partien durchsuchen'), { target: { value: 'morphy' } });

    fireEvent.click(within(table).getByRole('button', { name: 'Öffnen' }));
    await waitFor(() => expect(useNavigation.getState().screen).toBe('analyse'));

    nav('Bibliothek');
    fireEvent.click(await screen.findByRole('button', { name: 'Partie löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText('Noch keine Partien')).toBeInTheDocument();
  });

  it('lädt Partien von Lichess und erkennt die eigene Farbe', async () => {
    const games = [
      '[Event "A"]\n[White "Gegner1"]\n[Black "Nils_99"]\n[Result "0-1"]\n\n1. e4 e5 0-1',
      '[Event "B"]\n[White "Nils_99"]\n[Black "Gegner2"]\n[Result "1-0"]\n\n1. d4 d5 1-0',
    ].join('\n\n');
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      return new Response(games, { status: 200 });
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'Nils_99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Partien laden' }));

    expect(await screen.findByText(/Lichess · Nils_99 \(2 Partien\)/)).toBeInTheDocument();
    expect(urls[0]).toContain('https://lichess.org/api/games/user/Nils_99');
    expect(useImportDraft.getState().userColor).toBe('b');
    const list = await screen.findByRole('radiogroup', { name: 'Partie auswählen' });
    fireEvent.click(within(list).getAllByRole('radio')[1]!);
    expect(useImportDraft.getState().userColor).toBe('w');
    expect(useSettings.getState().online).toEqual({ platform: 'lichess', username: 'Nils_99' });
  });

  it('meldet einen unbekannten Benutzer verständlich', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'gibtsnicht' } });
    fireEvent.click(screen.getByRole('button', { name: 'Partien laden' }));
    expect(await screen.findByText('Diesen Benutzer gibt es dort nicht.')).toBeInTheDocument();
  });

  it('schaltet auf das helle Farbschema um', async () => {
    render(<App />);
    nav('Einstellungen');
    fireEvent.click(screen.getByRole('button', { name: 'Hell' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    await useSettings.getState().save(DEFAULT_SETTINGS);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
