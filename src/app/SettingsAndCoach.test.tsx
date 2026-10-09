import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAnalysis } from '../store/analysis';
import { useApiKey } from '../store/apiKey';
import { useExplanations } from '../store/explanations';
import { useGame } from '../store/game';
import { useImportDraft } from '../store/importDraft';
import { useNavigation } from '../store/navigation';
import { getSecretStorage } from '../store/persistence';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { fakeLlmFetch } from '../test/fakeLlm';
import { operaGame } from '../test/fixtures';
import { App } from './App';

function nav(name: string) {
  const bar = screen.getByRole('navigation', { name: 'Hauptnavigation' });
  fireEvent.click(within(bar).getByRole('button', { name }));
}

describe('Einstellungen und Coach', () => {
  beforeEach(async () => {
    useNavigation.setState({ screen: 'einstellungen' });
    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
    useImportDraft.getState().reset();
    await useSettings.getState().save(DEFAULT_SETTINGS);
    await getSecretStorage().set('https://openrouter.ai/api/v1', '');
    await getSecretStorage().set('http://localhost:11434/v1', '');
    useApiKey.setState({ key: '', baseUrl: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('testet die Verbindung, speichert Einstellungen und den Key getrennt pro Endpunkt', async () => {
    const { fetchFn, calls } = fakeLlmFetch({ expectedKey: 'sk-or' });
    vi.stubGlobal('fetch', fetchFn);
    render(<App />);

    fireEvent.change(screen.getByLabelText('API-Key'), { target: { value: 'sk-or' } });
    fireEvent.change(screen.getByLabelText('Modellname'), { target: { value: 'openai/gpt-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verbindung testen' }));
    expect(await screen.findByText(/Verbunden · Antwort in/)).toBeInTheDocument();
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument();
    expect(useSettings.getState().llm.model).toBe('openai/gpt-test');
    expect(await getSecretStorage().get('https://openrouter.ai/api/v1')).toBe('sk-or');
    expect(screen.getByText('openai/gpt-test')).toBeInTheDocument(); // Kopfleiste

    // Wechsel auf Ollama: Der OpenRouter-Key wird nicht übernommen
    fireEvent.click(screen.getByRole('button', { name: 'Ollama (lokal)' }));
    await waitFor(() => expect(screen.getByLabelText('API-Key')).toHaveValue(''));
    expect(screen.getByLabelText('Base-URL')).toHaveValue('http://localhost:11434/v1');
  });

  it('zeigt verständliche Fehler beim Verbindungstest', async () => {
    vi.stubGlobal('fetch', fakeLlmFetch({ expectedKey: 'richtig' }).fetchFn);
    render(<App />);
    fireEvent.change(screen.getByLabelText('API-Key'), { target: { value: 'falsch' } });
    fireEvent.change(screen.getByLabelText('Modellname'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verbindung testen' }));
    expect(
      await screen.findByText('Der API-Key wurde abgelehnt. Prüfe den Key.'),
    ).toBeInTheDocument();
  });

  it('sperrt Speichern bei unsinnigen Schwellen und setzt sie zurück', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Fehler ab/), { target: { value: '3' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Die Schwellen müssen aufsteigen');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(screen.getByLabelText(/Fehler ab/)).toHaveValue(10);
  });

  it('Coach: ohne KI Hinweis, mit KI Erklärung anfordern und anzeigen', async () => {
    vi.stubGlobal('fetch', fakeLlmFetch().fetchFn);
    render(<App />);

    nav('Import');
    fireEvent.change(screen.getByLabelText('PGN der Partie'), { target: { value: operaGame } });
    await screen.findByText(/PGN erkannt/);
    fireEvent.click(screen.getByRole('button', { name: 'Analysieren' }));
    await waitFor(() => expect(useAnalysis.getState().status).toBe('done'));

    fireEvent.click(screen.getByRole('button', { name: /^16\. Db8\+/ }));
    expect(screen.getByText(/Richte zuerst die KI-Anbindung ein/)).toBeInTheDocument();

    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama-test' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Erklärung anfordern' }));
    expect(await screen.findByText('Test-Erklärung zu Db8+.')).toBeInTheDocument();
    expect(screen.getByText('Warum')).toBeInTheDocument();
    expect(screen.getByText('Aufbauen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gegner-Sicht' }));
    expect(await screen.findByText('Aus Sicht des Gegners')).toBeInTheDocument();
  });
});
