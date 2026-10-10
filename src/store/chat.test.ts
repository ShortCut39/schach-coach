import { parsePgnGame } from '../chess/pgn';
import { fakeLlmFetch } from '../test/fakeLlm';
import { operaGame } from '../test/fixtures';
import { useAnalysis } from './analysis';
import { useChat } from './chat';
import { useGame } from './game';
import { DEFAULT_SETTINGS, useSettings } from './settings';

describe('Chat zur Stellung', () => {
  beforeEach(async () => {
    useChat.getState().reset();
    useGame.getState().clear();
    useAnalysis.getState().reset();
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test' },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('schickt die Engine-Daten der angezeigten Stellung mit und zeigt die Antwort', async () => {
    const { fetchFn, calls } = fakeLlmFetch();
    vi.stubGlobal('fetch', fetchFn);
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    useGame.getState().load(parsed.value, 'w');
    await useAnalysis.getState().start(parsed.value, { depth: 8, multipv: 3 });
    useGame.getState().goTo(30);

    await useChat.getState().send('Was droht hier?');
    const { messages, error } = useChat.getState();
    expect(error).toBeNull();
    expect(messages).toEqual([
      { role: 'user', content: 'Was droht hier?', context: '16. Db8+' },
      { role: 'assistant', content: 'Test-Antwort: Schwarz ist am Zug.' },
    ]);
    const request = calls[0]!.body;
    // Keine Tokengrenze (Modelle mit „Nachdenken“ hätten sonst keine Antwort übrig)
    expect(request).not.toHaveProperty('max_tokens');
    expect(request.response_format).toBeUndefined();
    expect(request.messages.at(-1)?.content).toContain('"letzter_zug"');
    expect(request.messages[0]?.content).toContain('Erfinde keine Züge');
  });

  it('wartet auf die Engine-Bewertung der Stellung', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    useGame.getState().load(parsed.value, 'w');
    await useChat.getState().send('Und jetzt?');
    expect(useChat.getState().error).toBe('noEval');
    expect(useChat.getState().messages).toEqual([]);
  });
});
