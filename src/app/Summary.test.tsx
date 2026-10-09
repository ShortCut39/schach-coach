import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAnalysis } from '../store/analysis';
import { useExplanations } from '../store/explanations';
import { useGame } from '../store/game';
import { useImportDraft } from '../store/importDraft';
import { useNavigation } from '../store/navigation';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { fakeLlmFetch } from '../test/fakeLlm';
import { operaGame } from '../test/fixtures';
import { ErrorBoundary } from '../ui/shared/ErrorBoundary';
import { App } from './App';

async function analyseOpera() {
  const bar = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  fireEvent.click(within(bar).getByRole('button', { name: 'Import' }));
  fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: operaGame } });
  await screen.findByText(/PGN erkannt/);
  fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));
  await waitFor(() => expect(useAnalysis.getState().status).toBe('done'));
}

describe('Zusammenfassung', () => {
  beforeEach(async () => {
    useNavigation.setState({ screen: 'analyse', analyseView: 'board' });
    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
    useImportDraft.getState().reset();
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test-modell' },
    });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });

  it('zeigt Genauigkeit, Wendepunkte, KI-Tipps und exportiert Markdown', async () => {
    vi.stubGlobal('fetch', fakeLlmFetch().fetchFn);
    const created: Blob[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (b: Blob) => (created.push(b), 'blob:test'),
        revokeObjectURL: () => {},
      }),
    );
    render(<App />);
    await analyseOpera();
    await waitFor(() => expect(useExplanations.getState().summary?.status).toBe('done'));

    fireEvent.click(screen.getByRole('tab', { name: 'Zusammenfassung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zusammenfassung öffnen' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Zusammenfassung der Partie' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Du (Weiß)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gegner (Schwarz)' })).toBeInTheDocument();
    expect(screen.getByText('Test-Tipp 1')).toBeInTheDocument();
    expect(screen.getByText('Test-Eröffnung.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Als Markdown exportieren' }));
    expect(await screen.findByText(/Exportiert: schach-coach-Morphy_Paul/)).toBeInTheDocument();
    expect(await created[0]?.text()).toContain('## Die drei wichtigsten Tipps');

    // Wendepunkt anklicken: zurück aufs Brett, Stellung nach dem Zug
    const points = screen.getByRole('heading', { name: 'Wendepunkte' }).closest('section');
    if (!points) throw new Error('Wendepunkte fehlen');
    fireEvent.click(within(points).getAllByRole('button')[0]!);
    expect(useNavigation.getState().analyseView).toBe('board');
    expect(useGame.getState().current).toBeGreaterThanOrEqual(0);
  });

  it('erklärt, warum es noch keine Zusammenfassung gibt', () => {
    useNavigation.setState({ analyseView: 'summary' });
    render(<App />);
    expect(screen.getByText(/Lade zuerst eine Partie/)).toBeInTheDocument();
  });

  it('Reiter lassen sich mit den Pfeiltasten wechseln', async () => {
    render(<App />);
    await analyseOpera();
    const coach = screen.getByRole('tab', { name: 'Coach' });
    coach.focus();
    fireEvent.keyDown(coach, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveFocus();
    // Die Brettsteuerung reagiert dabei nicht
    expect(useGame.getState().current).toBe(-1);
  });
});

describe('Fehlergrenze', () => {
  it('zeigt statt eines leeren Fensters eine Meldung', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('kaputt');
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Hier ist etwas schiefgelaufen');
    act(() => spy.mockRestore());
  });
});
