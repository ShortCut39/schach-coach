import { Chess } from 'chess.js';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { parsePgnGame } from '../chess/pgn';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { computeGameStats } from '../classification/gameStats';
import { loadOpeningBook } from '../classification/openingBook';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import type { PositionEval } from '../engine/types';
import { gameId, useLibrary, type LibraryMeta } from '../store/library';
import { useNavigation } from '../store/navigation';
import {
  getSettingsStorage,
  keyValueLibrary,
  memoryStorage,
  setLibraryStorage,
} from '../store/persistence';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { trainingFacts, useTraining } from '../store/training';
import { fakeLlmFetch } from '../test/fakeLlm';
import evalFixture from '../test/fixtures/opera-game-evals-d20.json';
import { operaGame } from '../test/fixtures';
import { App } from './App';

const evals = evalFixture.evals as PositionEval[];

/**
 * Opernpartie aus Sicht von Schwarz mit echten Stockfish-Bewertungen (Fehler: Sf6, b5, cxb5;
 * eine davon ist eine Ungenauigkeit). `copies` speichert sie mehrfach (die Muster-Seite braucht 3 Partien).
 */
async function storeOperaGame(copies = 1) {
  const parsed = parsePgnGame(operaGame);
  if (!parsed.ok) throw new Error('ungültig');
  const analysis = computeGameAnalysis(
    parsed.value,
    evals,
    await loadOpeningBook(),
    DEFAULT_CLASSIFICATION,
  );
  const id = gameId(parsed.value.pgn);
  const meta: LibraryMeta = {
    id,
    savedAt: '2026-10-01T10:00:00Z',
    date: null,
    white: 'Morphy',
    black: 'Herzog und Graf',
    event: null,
    opening: null,
    userColor: 'b',
    outcome: 'loss',
    accuracy: 50,
    mistakes: 1,
    blunders: 2,
    plies: parsed.value.plies.length,
    depth: 20,
    multipv: 3,
    playedAt: null,
    stats: computeGameStats(parsed.value, evals, analysis, 'b'),
  };
  const record = {
    version: 1,
    source: { kind: 'game', pgn: parsed.value.pgn },
    userColor: 'b',
    orientation: 'black',
    current: -1,
    analysis: { depth: 20, multipv: 3, engine: 'Stockfish 19', evals },
    explanations: {},
    summary: null,
  };
  const storage = keyValueLibrary(memoryStorage());
  for (let i = 0; i < copies; i++) {
    const copyId = i === 0 ? id : `${id.slice(0, -1)}${i}`;
    await storage.save(copyId, { ...meta, id: copyId }, record);
  }
  setLibraryStorage(storage);
  return parsed.value;
}

function currentPuzzle() {
  const { current } = useTraining.getState();
  if (!current) throw new Error('keine Aufgabe');
  return current;
}

async function enterMove(text: string) {
  fireEvent.change(await screen.findByLabelText('Zug eingeben'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Prüfen' }));
}

describe('Training aus eigenen Fehlern', () => {
  beforeEach(async () => {
    useLibrary.setState({ entries: [], loaded: false });
    useTraining.setState({ cards: {}, cardsLoaded: false, motif: null, run: null, current: null });
    await getSettingsStorage().set('trainingCards', null);
    await getSettingsStorage().set('trainingExplanations', null);
    useNavigation.setState({ screen: 'bibliothek', bibliothekView: 'training' });
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });
  afterEach(async () => {
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });

  it('übt Fehler aus der Bibliothek, prüft Züge und plant Wiederholungen', async () => {
    await storeOperaGame();
    render(<App />);
    expect(await screen.findByText('Neue Aufgaben')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Training starten (2 Aufgaben)' }));
    expect(await screen.findByText('Aufgabe 1 von 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schwarz am Zug/ })).toBeInTheDocument();
    await waitFor(() => expect(useTraining.getState().attempt.status).toBe('ready'));

    // Bestzug laut gespeicherter Analyse → richtig, ohne neue Engine-Rechnung
    const first = currentPuzzle();
    const best = first.before.lines[0]?.pv[0] ?? '';
    await enterMove(best);
    expect(await screen.findByText('Richtig!')).toBeInTheDocument();
    expect(screen.getByText(/genau der Zug der Engine/)).toBeInTheDocument();
    expect(screen.getByText('Kommt morgen wieder.')).toBeInTheDocument();
    // Ohne KI-Anbindung: Hinweis zur Einrichtung statt Erklärung
    expect(screen.getByText(/Richte die KI-Anbindung ein/)).toBeInTheDocument();

    // Zweite Aufgabe: Tipp, dann derselbe Zug wie in der Partie → falsch, dann Lösung
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Aufgabe' }));
    expect(await screen.findByText('Aufgabe 2 von 2')).toBeInTheDocument();
    await waitFor(() => expect(useTraining.getState().attempt.status).toBe('ready'));
    const second = currentPuzzle();
    fireEvent.click(screen.getByRole('button', { name: 'Tipp' }));
    expect(screen.getByRole('button', { name: 'Figur zeigen' })).toBeInTheDocument();
    await enterMove(second.played.uci);
    expect(await screen.findByText('Das reicht noch nicht.')).toBeInTheDocument();
    expect(screen.getByText(/derselbe Zug wie in der Partie/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lösung zeigen' }));
    expect(await screen.findByText('Lösung')).toBeInTheDocument();
    // Falsch gelöst → kommt in dieser Sitzung noch einmal (jetzt 3 Aufgaben)
    expect(screen.getByText('Aufgabe 2 von 3')).toBeInTheDocument();

    const stored = (await getSettingsStorage().get('trainingCards')) as Record<
      string,
      { box: number }
    >;
    expect(stored[first.puzzle.id]?.box).toBe(1);
    expect(stored[second.puzzle.id]?.box).toBe(0);

    // Die falsch gelöste Aufgabe kommt wieder; unmögliche Eingaben werden abgewiesen
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Aufgabe' }));
    expect(await screen.findByText('Aufgabe 3 von 3')).toBeInTheDocument();
    await waitFor(() => expect(currentPuzzle().puzzle.id).toBe(second.puzzle.id));
    await enterMove('Ke4');
    expect(
      await screen.findByText('Diesen Zug gibt es in der Stellung nicht.'),
    ).toBeInTheDocument();

    // Ein Zug ohne gespeicherte Bewertung wird von der Engine nachgerechnet (Test-Engine)
    const third = currentPuzzle();
    const known = new Set([third.played.uci, ...third.before.lines.map((l) => l.pv[0])]);
    const other = new Chess(third.fen)
      .moves({ verbose: true })
      .map((m) => m.lan)
      .find((uci) => !known.has(uci));
    await enterMove(other ?? '');
    await waitFor(() => expect(useTraining.getState().attempt.check?.source).toBe('engine'));
    expect(await screen.findByText(/Richtig!|Das reicht noch nicht\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Training beenden' }));
    expect(await screen.findByText('Wiederholungen fällig')).toBeInTheDocument();
  });

  it('lässt die KI nach dem Lösen erklären, warum der bessere Zug besser ist', async () => {
    const llm = fakeLlmFetch();
    vi.stubGlobal('fetch', llm.fetchFn);
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test-modell' },
    });
    await storeOperaGame();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Training starten (2 Aufgaben)' }));
    await waitFor(() => expect(useTraining.getState().attempt.status).toBe('ready'));
    const first = currentPuzzle();
    await enterMove(first.before.lines[0]?.pv[0] ?? '');

    expect(await screen.findByText('Warum dieser Zug besser ist')).toBeInTheDocument();
    expect(await screen.findByText(/^Test: .+ ist der bessere Zug\.$/)).toBeInTheDocument();
    expect(screen.getByText('Test-Merksatz.')).toBeInTheDocument();
    expect(screen.getByText('KI · test-modell')).toBeInTheDocument();

    // Die KI bekommt nur Engine- und chess.js-Daten, darunter Partiezug und Bestzug in Worten
    const request = llm.calls.at(-1)?.body.messages.at(-1)?.content ?? '';
    expect(request).toContain('"partiezug"');
    expect(request).toContain('"folge_in_worten"');
    expect(request).not.toContain('"dein_zug"');

    // Gespeichert: bei der Wiederholung wird nicht erneut gefragt
    const stored = (await getSettingsStorage().get('trainingExplanations')) as Record<
      string,
      unknown
    >;
    expect(stored[first.puzzle.id]).toBeDefined();
    const calls = llm.calls.length;
    useTraining.setState({
      attempt: { ...useTraining.getState().attempt, status: 'solution' },
      ai: { status: 'idle' },
    });
    await useTraining.getState().explain();
    expect(llm.calls.length).toBe(calls);
    expect(useTraining.getState().ai.status).toBe('done');

    // Anderer guter Zug als der Bestzug: wird mit erklärt (und nicht gespeichert)
    const second = first.before.lines[1]?.pv[0] ?? '';
    const facts = trainingFacts(first, {
      status: 'correct',
      move: second,
      check: { correct: true, isBest: false, winLoss: 1, continuation: [], source: 'stored' },
      hints: 0,
      recorded: true,
    });
    expect(facts.dein_zug?.zug_in_worten).toBeTruthy();
    expect(facts.bester_zug.zug).not.toBe(facts.dein_zug?.zug);
    vi.unstubAllGlobals();
  });

  it('nimmt nur die in den Einstellungen gewählten Fehlerarten', async () => {
    await storeOperaGame();
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      training: { blunders: false, missed: false, inaccuracies: true },
    });
    render(<App />);
    expect(
      await screen.findByRole('button', { name: 'Training starten (1 Aufgabe)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Aufgaben aus: Ungenauigkeiten')).toBeInTheDocument();
  });

  it('startet „Dieses Muster trainieren“ aus der Muster-Seite mit Filter', async () => {
    await storeOperaGame(3);
    useNavigation.setState({ bibliothekView: 'patterns' });
    render(<App />);
    const buttons = await screen.findAllByRole('button', { name: /trainieren$/ });
    fireEvent.click(buttons[0]!);
    expect(
      await screen.findByRole('tab', { name: 'Training', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Nur Muster:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alle Muster' }));
    expect(screen.queryByText(/^Nur Muster:/)).not.toBeInTheDocument();
  });

  it('verlangt in den Einstellungen mindestens eine Fehlerart', async () => {
    useNavigation.setState({ screen: 'einstellungen' });
    render(<App />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Patzer und Fehler' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Verpasste Chancen' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Wähle mindestens eine Fehlerart aus.');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });
});
