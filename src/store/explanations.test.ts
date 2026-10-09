import { waitFor } from '@testing-library/react';
import { parsePgnGame } from '../chess/pgn';
import { fakeLlmFetch } from '../test/fakeLlm';
import { operaGame } from '../test/fixtures';
import { useAnalysis } from './analysis';
import { useApiKey } from './apiKey';
import { isLlmConfigured, useExplanations } from './explanations';
import { useGame } from './game';
import { analyseAndExplain } from './pipeline';
import { DEFAULT_SETTINGS, useSettings } from './settings';

function opera() {
  const parsed = parsePgnGame(operaGame);
  if (!parsed.ok) throw new Error('Fixture ungültig');
  return parsed.value;
}

async function configure(key = 'sk-test') {
  await useSettings.getState().save({
    ...DEFAULT_SETTINGS,
    llm: { preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'test/model' },
  });
  await useApiKey.getState().saveFor('https://openrouter.ai/api/v1', key);
}

describe('Erklärungen (simulierter Endpunkt)', () => {
  beforeEach(async () => {
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
    await useSettings.getState().save(DEFAULT_SETTINGS);
    await useApiKey.getState().saveFor('https://openrouter.ai/api/v1', '');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ist ohne Modell und Key nicht eingerichtet', async () => {
    expect(isLlmConfigured()).toBe(false);
    await configure();
    expect(isLlmConfigured()).toBe(true);
  });

  it('erklärt nach der Engine-Analyse die ausgewählten Züge in Paketen', async () => {
    await configure();
    const { fetchFn, calls } = fakeLlmFetch({ expectedKey: 'sk-test' });
    vi.stubGlobal('fetch', fetchFn);
    const game = opera();
    useGame.getState().load(game, 'w');

    await analyseAndExplain(game, 8, 'all');

    const { run, entries } = useExplanations.getState();
    expect(run).toMatchObject({ status: 'done', total: 28 }); // 33 Halbzüge − 5 Theorie
    expect(calls).toHaveLength(5); // 4 Pakete zu 7 + Zusammenfassung
    expect(entries[30]?.short).toMatchObject({
      status: 'done',
      explanation: { was: expect.stringContaining('Db8+') },
    });
    // Der Key geht nur an den eingestellten Endpunkt
    expect(calls.every((c) => c.url === 'https://openrouter.ai/api/v1/chat/completions')).toBe(
      true,
    );
    expect(calls.every((c) => c.authorization === 'Bearer sk-test')).toBe(true);
    // Das LLM bekommt Fakten, keine Aufforderung zum Rechnen
    expect(calls[0]?.body.messages[0]?.content).toContain('Erfinde keine Züge');
  });

  it('fällt ohne JSON-Modus zurück, wenn der Endpunkt ihn ablehnt', async () => {
    await configure();
    const { fetchFn, calls } = fakeLlmFetch({ rejectJsonMode: true });
    vi.stubGlobal('fetch', fetchFn);
    const game = opera();
    useGame.getState().load(game, 'w');
    await analyseAndExplain(game, 8, 'all');
    expect(useExplanations.getState().run.status).toBe('done');
    expect(calls[0]?.body.response_format).toEqual({ type: 'json_object' });
    expect(calls.at(-1)?.body.response_format).toBeUndefined();
  });

  it('meldet einen abgelehnten Key verständlich und markiert die Züge als fehlgeschlagen', async () => {
    await configure('falsch');
    vi.stubGlobal('fetch', fakeLlmFetch({ expectedKey: 'sk-richtig' }).fetchFn);
    const game = opera();
    useGame.getState().load(game, 'w');
    await analyseAndExplain(game, 8, 'all');
    const { run, entries } = useExplanations.getState();
    expect(run).toMatchObject({ status: 'error', error: 'unauthorized' });
    expect(entries[30]?.short).toMatchObject({ status: 'failed', error: 'unauthorized' });
  });

  it('erklärt einzelne Züge ausführlicher und aus Gegner-Sicht', async () => {
    await configure();
    const { fetchFn, calls } = fakeLlmFetch();
    vi.stubGlobal('fetch', fetchFn);
    const game = opera();
    useGame.getState().load(game, 'w');
    await useAnalysis.getState().start(game, { depth: 8, multipv: 3 });

    await useExplanations.getState().explainDetail(30, 'detailed');
    await useExplanations.getState().explainDetail(30, 'opponent');
    await waitFor(() =>
      expect(useExplanations.getState().entries[30]?.opponent?.status).toBe('done'),
    );
    expect(useExplanations.getState().entries[30]?.detailed?.status).toBe('done');
    expect(calls[1]?.body.messages[1]?.content).toContain('aus Sicht des Gegners');
  });
});

describe('KI-Zusammenfassung', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('wird nach den Zug-Erklärungen angefordert und enthält drei Tipps', async () => {
    useExplanations.getState().reset();
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test' },
    });
    const { fetchFn, calls } = fakeLlmFetch();
    vi.stubGlobal('fetch', fetchFn);
    const game = opera();
    useGame.getState().load(game, 'w');
    await analyseAndExplain(game, 8, 'all');

    const { summary } = useExplanations.getState();
    expect(summary?.status).toBe('done');
    expect(summary?.data?.tipps).toHaveLength(3);
    const request = calls.at(-1)?.body.messages[1]?.content ?? '';
    expect(request).toContain('"du_spielst": "Weiß"');
    expect(request).toContain('"wendepunkte"');
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });
});
