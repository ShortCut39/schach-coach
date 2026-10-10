import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import { useLibrary } from '../store/library';
import { useNavigation } from '../store/navigation';
import { getSettingsStorage } from '../store/persistence';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { useTraining } from '../store/training';
import { fakeLlmFetch } from '../test/fakeLlm';
import { storeOperaGame } from '../test/libraryFixtures';
import { App } from './App';

describe('Sprache', () => {
  beforeEach(async () => {
    useLibrary.setState({ entries: [], loaded: false });
    useTraining.setState({ cards: {}, cardsLoaded: false, motif: null, run: null, current: null });
    await getSettingsStorage().set('trainingCards', null);
    await getSettingsStorage().set('trainingExplanations', null);
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });

  it('schaltet die Oberfläche auf Englisch, die Notation wechselt mit', async () => {
    useNavigation.setState({ screen: 'einstellungen' });
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Sprache'), { target: { value: 'en' } });
    expect(screen.getByLabelText('Notation')).toHaveValue('en');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByRole('button', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(useSettings.getState()).toMatchObject({ language: 'en', notation: 'en' });

    // Zurück auf Deutsch
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });
    expect(screen.getByLabelText('Notation')).toHaveValue('de');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Bibliothek' })).toBeInTheDocument();
    expect(i18n.language).toBe('de');
  });

  it('lässt die KI auf Englisch erklären – mit englischen Fakten aus chess.js', async () => {
    const llm = fakeLlmFetch();
    vi.stubGlobal('fetch', llm.fetchFn);
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      language: 'en',
      notation: 'en',
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test-model' },
    });
    await storeOperaGame();
    useNavigation.setState({ screen: 'bibliothek', bibliothekView: 'training' });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start training (2 puzzles)' }));
    await waitFor(() => expect(useTraining.getState().attempt.status).toBe('ready'));
    expect(screen.getByRole('heading', { name: /Black to move/ })).toBeInTheDocument();

    const best = useTraining.getState().current?.before.lines[0]?.pv[0] ?? '';
    fireEvent.change(screen.getByLabelText('Enter move'), { target: { value: best } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Correct!')).toBeInTheDocument();
    expect(await screen.findByText('Why this move is better')).toBeInTheDocument();
    expect(await screen.findByText(/^Test: Q.+ ist der bessere Zug\.$/)).toBeInTheDocument();

    const system = llm.calls.at(-1)?.body.messages[0]?.content ?? '';
    const request = llm.calls.at(-1)?.body.messages.at(-1)?.content ?? '';
    expect(system).toMatch(/in English/);
    expect(system).toMatch(/Do not invent moves/);
    expect(request).toContain('Training data:');
    expect(request).toMatch(/"zug_in_worten": "queen d8 moves to f6"/);
    expect(request).toMatch(/"am_zug": "Black"/);
  });
});
