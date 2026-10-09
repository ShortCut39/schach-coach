import { parsePgnGame } from '../chess/pgn';
import { operaGame } from '../test/fixtures';
import { useAnalysis } from './analysis';
import { useExplanations } from './explanations';
import { useGame } from './game';
import { getSettingsStorage } from './persistence';
import { restoreSession, saveSession } from './session';

describe('Sitzung', () => {
  beforeEach(() => {
    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
  });

  it('stellt Partie, Stellung, Bewertungen und Erklärungen wieder her', async () => {
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    useGame.getState().load(parsed.value, 'b');
    useGame.getState().goTo(30);
    await useAnalysis.getState().start(parsed.value, { depth: 8, multipv: 2 });
    useExplanations.setState({
      source: parsed.value,
      entries: {
        30: {
          short: { status: 'done', explanation: { ply: 30, was: 'a', warum: 'b', aufbauen: 'c' } },
        },
        31: { short: { status: 'loading' } },
      },
    });
    await saveSession();

    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
    expect(await restoreSession()).toBe(true);

    const game = useGame.getState();
    expect(game.source?.kind === 'game' && game.source.plies).toHaveLength(33);
    expect(game.current).toBe(30);
    expect(game.userColor).toBe('b');
    expect(game.orientation).toBe('black');
    expect(useAnalysis.getState()).toMatchObject({
      status: 'done',
      settings: { depth: 8, multipv: 2 },
    });
    expect(useAnalysis.getState().source).toBe(game.source);
    expect(useExplanations.getState().entries[30]?.short?.explanation?.was).toBe('a');
    expect(useExplanations.getState().entries[31]).toBeUndefined(); // „lädt“ wird nicht gespeichert
  });

  it('ignoriert kaputte oder fehlende Sitzungsdaten', async () => {
    await getSettingsStorage().set('lastSession', {
      version: 1,
      source: { kind: 'game', pgn: 'Unsinn' },
    });
    expect(await restoreSession()).toBe(false);
    await getSettingsStorage().set('lastSession', null);
    expect(await restoreSession()).toBe(false);
  });
});
