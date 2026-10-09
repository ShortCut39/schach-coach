import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAnalysis } from '../store/analysis';
import { useGame } from '../store/game';
import { useImportDraft } from '../store/importDraft';
import { useNavigation } from '../store/navigation';
import { FEN_AFTER_QB8, operaGame } from '../test/fixtures';
import { App } from './App';

function openImport() {
  const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  fireEvent.click(within(nav).getByRole('button', { name: 'Import' }));
}

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

describe('Import → Analyse', () => {
  beforeEach(() => {
    useNavigation.setState({ screen: 'analyse' });
    useGame.getState().clear();
    useImportDraft.getState().reset();
    useAnalysis.getState().reset();
  });

  it('lädt die Beispielpartie und lässt sich per Tastatur und Knopf durchklicken', async () => {
    render(<App />);
    openImport();

    fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: operaGame } });
    expect(
      await screen.findByText('PGN erkannt: 17 Züge, 33 Halbzüge, Ergebnis 1-0'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));
    const board = screen.getByRole('img', { name: 'Ausgangsstellung' });
    expect(board).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '16. Db8+' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9… b5' })).toBeInTheDocument();

    press('End');
    expect(screen.getByRole('img', { name: 'Stellung nach 17. Td8#' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ein Zug vor' })).toBeDisabled();

    press('ArrowLeft');
    expect(screen.getByRole('img', { name: 'Stellung nach 16… Sxb8' })).toBeInTheDocument();
    press('ArrowLeft');
    expect(useGame.getState().source?.kind === 'game' && useGame.getState().current).toBe(30);
    const state = useGame.getState();
    expect(state.source?.kind === 'game' && state.source.plies[30]?.fenAfter).toBe(FEN_AFTER_QB8);

    press('Home');
    expect(screen.getByRole('img', { name: 'Ausgangsstellung' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ein Zug vor' }));
    expect(screen.getByRole('img', { name: 'Stellung nach 1. e4' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '7. Db3' }));
    expect(screen.getByRole('button', { name: '7. Db3' })).toHaveAttribute('aria-current', 'step');

    expect(useGame.getState().orientation).toBe('white');
    press('f');
    expect(useGame.getState().orientation).toBe('black');
  });

  it('behält die Eingabe beim Wechsel zwischen den Screens', () => {
    render(<App />);
    openImport();
    fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: '1. e4 e5' } });
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Bibliothek' }));
    openImport();
    expect(screen.getByLabelText('PGN der Partie')).toHaveValue('1. e4 e5');
  });

  it('sperrt „Analysieren“ bei einem unmöglichen Zug und nennt ihn', async () => {
    render(<App />);
    openImport();
    fireEvent.change(screen.getByLabelText('PGN der Partie'), {
      target: { value: '1. e4 e5 2. Ke3' },
    });
    expect(
      await screen.findByText('Zug 2. (Weiß): „Ke3“ ist in dieser Stellung nicht möglich.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analysieren' })).toBeDisabled();
  });

  it('zeigt bei einer FEN die Einzelstellung ohne Zugliste', async () => {
    render(<App />);
    openImport();
    fireEvent.click(screen.getByRole('tab', { name: 'FEN' }));
    fireEvent.change(screen.getByLabelText('FEN der Stellung'), {
      target: { value: FEN_AFTER_QB8 },
    });
    expect(await screen.findByText('FEN erkannt: Schwarz am Zug')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Schwarz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));
    expect(screen.getByRole('heading', { name: 'Einzelstellung' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Zugliste' })).not.toBeInTheDocument();
    expect(useGame.getState().orientation).toBe('black');
  });

  it('lädt eine Latin-1-Datei mit mehreren Partien und zeigt die Auswahlliste', async () => {
    const text = `[White "Müller"]\n[Black "Groß"]\n[Site "Köln"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n\n${operaGame}`;
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0)); // Latin-1: ein Byte pro Zeichen
    const file = new File([bytes], 'partien.pgn', { type: 'application/x-chess-pgn' });

    const { container } = render(<App />);
    openImport();
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error('Dateiauswahl fehlt');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Geladen: partien.pgn')).toBeInTheDocument();
    const list = await screen.findByRole('radiogroup', { name: 'Partie auswählen' });
    expect(within(list).getAllByRole('radio')).toHaveLength(2);
    expect(within(list).getByText('Müller – Groß')).toBeInTheDocument();
    expect(within(list).getByText('Köln · 1 Zug · 1-0')).toBeInTheDocument();

    fireEvent.click(within(list).getAllByRole('radio')[1]!);
    expect(
      await screen.findByText(/PGN erkannt: 17 Züge, 33 Halbzüge, Ergebnis 1-0/),
    ).toBeInTheDocument();
  });

  it('startet die Engine-Analyse und zeigt Bewertungen, Linien und Verlauf', async () => {
    render(<App />);
    openImport();
    fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: operaGame } });
    fireEvent.change(screen.getByLabelText('Engine-Tiefe'), { target: { value: '14' } });
    await screen.findByText(/PGN erkannt/);
    fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));

    await waitFor(() => expect(useAnalysis.getState().status).toBe('done'));
    expect(useAnalysis.getState().settings).toEqual({ depth: 14, multipv: 3 });
    expect(screen.getByText('Test-Engine · Tiefe 14')).toBeInTheDocument();
    expect(screen.getByText('33 Halbzüge')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Bewertungsbalken/ })).toBeInTheDocument();

    // Ausgangsstellung: drei Linien der (simulierten) Engine
    const lines = screen.getByRole('heading', { name: 'Engine-Linien' }).closest('section');
    if (!lines) throw new Error('Engine-Linien fehlen');
    expect(within(lines).getAllByRole('listitem')).toHaveLength(3);
    expect(within(lines).getByText('Ausgangsstellung')).toBeInTheDocument();

    press('End');
    expect(within(lines).getByText('vor 17. Td8#')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '17. Td8#' })).toHaveTextContent('#');
  });
});
