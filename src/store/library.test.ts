import { parsePgnGame } from '../chess/pgn';
import { operaGame } from '../test/fixtures';
import { useAnalysis } from './analysis';
import { useExplanations } from './explanations';
import { useGame } from './game';
import { gameId, metaSchema, outcomeFor, useLibrary } from './library';
import { keyValueLibrary, memoryStorage, setLibraryStorage } from './persistence';
import { analyseAndExplain } from './pipeline';

function opera() {
  const parsed = parsePgnGame(operaGame);
  if (!parsed.ok) throw new Error('ungültig');
  return parsed.value;
}

describe('Bibliothek', () => {
  beforeEach(() => {
    setLibraryStorage(keyValueLibrary(memoryStorage()));
    useLibrary.setState({ entries: [], loaded: false });
    useGame.getState().clear();
    useAnalysis.getState().reset();
    useExplanations.getState().reset();
  });

  it('erzeugt stabile Kennungen aus dem PGN', () => {
    expect(gameId(operaGame)).toBe(gameId(operaGame.replace(/\n/g, '\r\n')));
    expect(gameId(operaGame)).toMatch(/^[0-9a-f]{16}$/);
    expect(gameId(operaGame)).not.toBe(gameId(`${operaGame} `.replace('Rd8#', 'Rd7')));
  });

  it('wertet das Ergebnis aus Sicht des Nutzers', () => {
    expect(outcomeFor('1-0', 'w')).toBe('win');
    expect(outcomeFor('1-0', 'b')).toBe('loss');
    expect(outcomeFor('1/2-1/2', 'b')).toBe('draw');
    expect(outcomeFor('*', 'w')).toBe('open');
  });

  it('speichert eine bewertete Partie, listet, öffnet und löscht sie', async () => {
    const game = opera();
    useGame.getState().load(game, 'w');
    await useAnalysis.getState().start(game, { depth: 8, multipv: 3 });
    await useLibrary.getState().saveCurrent();

    useLibrary.setState({ entries: [] });
    await useLibrary.getState().refresh();
    const [entry] = useLibrary.getState().entries;
    expect(entry).toMatchObject({
      white: 'Morphy, Paul',
      date: '1858',
      opening: { eco: 'C41' },
      userColor: 'w',
      outcome: 'win',
      plies: 33,
      depth: 8,
    });

    useGame.getState().clear();
    useAnalysis.getState().reset();
    expect(await useLibrary.getState().open(entry!.id)).toBe(true);
    expect(useAnalysis.getState().status).toBe('done');

    await useLibrary.getState().remove(entry!.id);
    await useLibrary.getState().refresh();
    expect(useLibrary.getState().entries).toEqual([]);
  });

  it('rechnet eine schon gespeicherte Partie nicht noch einmal', async () => {
    const game = opera();
    useGame.getState().load(game, 'w');
    await analyseAndExplain(game, 8, 'all');
    await useLibrary.getState().saveCurrent();

    const start = vi.spyOn(useAnalysis.getState(), 'start');
    const again = opera();
    useGame.getState().load(again, 'w');
    await analyseAndExplain(again, 8, 'all');
    expect(start).not.toHaveBeenCalled();
    expect(useAnalysis.getState().status).toBe('done');
    start.mockRestore();
  });

  it('legt eine gespielte Partie als „nicht analysiert“ an und ersetzt sie nach der Analyse', async () => {
    const game = opera();
    await useLibrary.getState().savePlayed(game, 'b');
    await useLibrary.getState().refresh();
    const [played] = useLibrary.getState().entries;
    expect(played).toMatchObject({
      id: gameId(game.pgn),
      analysed: false,
      accuracy: null,
      userColor: 'b',
      outcome: 'loss',
    });
    expect(played?.stats).toBeUndefined();

    // Öffnen lädt die Partie aus der gespeicherten Sicht, noch ohne Bewertungen
    expect(await useLibrary.getState().open(played!.id)).toBe(true);
    expect(useGame.getState().userColor).toBe('b');
    expect(useAnalysis.getState().source).not.toBe(useGame.getState().source);

    // Nach der Analyse überschreibt das automatische Speichern den Eintrag
    const source = useGame.getState().source!;
    await analyseAndExplain(source, 8, 'errorsOnly');
    await useLibrary.getState().saveCurrent();
    const [analysed] = useLibrary.getState().entries;
    expect(useLibrary.getState().entries).toHaveLength(1);
    expect(analysed).toMatchObject({ analysed: true, userColor: 'b', depth: 8 });
    expect(analysed?.accuracy).not.toBeNull();

    // Ein zweites Speichern derselben gespielten Partie ändert nichts mehr
    await useLibrary.getState().savePlayed(game, 'b');
    await useLibrary.getState().refresh();
    expect(useLibrary.getState().entries[0]?.analysed).toBe(true);
  });

  it('liest ältere Einträge ohne das Feld „analysed“ als analysiert', () => {
    const parsed = metaSchema.parse({
      id: 'x',
      savedAt: '2026-10-01T10:00:00Z',
      date: null,
      white: null,
      black: null,
      event: null,
      opening: null,
      userColor: 'w',
      outcome: 'win',
      accuracy: 80,
      mistakes: 0,
      blunders: 0,
      plies: 10,
      depth: 20,
      multipv: 3,
    });
    expect(parsed.analysed).toBe(true);
  });
});
