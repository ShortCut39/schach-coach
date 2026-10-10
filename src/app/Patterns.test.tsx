import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { parsePgnGame } from '../chess/pgn';
import type { GameStats } from '../classification/gameStats';
import { useAnalysis } from '../store/analysis';
import { useGame } from '../store/game';
import { gameId, useLibrary, type LibraryMeta } from '../store/library';
import { useNavigation } from '../store/navigation';
import { usePatterns } from '../store/patterns';
import { keyValueLibrary, memoryStorage, setLibraryStorage } from '../store/persistence';
import { DEFAULT_SETTINGS, useSettings } from '../store/settings';
import { fakeLlmFetch } from '../test/fakeLlm';
import { operaGame } from '../test/fixtures';
import { App } from './App';

function stats(motifs: GameStats['motifs']): GameStats {
  return {
    version: 1,
    motifs,
    errorsByPhase: { opening: motifs.length, middlegame: 0, endgame: 0 },
    movesByPhase: { opening: 10, middlegame: 8, endgame: 0 },
    accuracyByPhase: { opening: 72, middlegame: 88, endgame: null },
    bookPlies: 4,
  };
}

function meta(id: string, partial: Partial<LibraryMeta>): LibraryMeta {
  return {
    id,
    savedAt: `2026-10-0${id.length}T10:00:00Z`,
    date: null,
    white: 'Ich',
    black: `Gegner ${id}`,
    event: null,
    opening: { name: 'Italian Game', eco: 'C50' },
    userColor: 'w',
    outcome: 'win',
    accuracy: 75,
    mistakes: 1,
    blunders: 1,
    plies: 30,
    depth: 20,
    multipv: 3,
    playedAt: null,
    stats: stats([
      {
        motif: 'hangingPiece',
        ply: 14,
        moveNumber: 8,
        color: 'w',
        san: 'Qh5',
        category: 'blunder',
        phase: 'opening',
        winLoss: 35,
      },
    ]),
    ...partial,
  };
}

describe('Muster über viele Partien', () => {
  beforeEach(async () => {
    setLibraryStorage(keyValueLibrary(memoryStorage()));
    useLibrary.setState({ entries: [], loaded: false });
    usePatterns.setState({ plan: { status: 'idle' } });
    useNavigation.setState({ screen: 'bibliothek', bibliothekView: 'games', analyseView: 'board' });
    await useSettings.getState().save({
      ...DEFAULT_SETTINGS,
      llm: { preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'test-modell' },
    });
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await useSettings.getState().save(DEFAULT_SETTINGS);
  });

  async function store(...metas: LibraryMeta[]) {
    const storage = keyValueLibrary(memoryStorage());
    for (const m of metas) await storage.save(m.id, m, { version: 1 });
    setLibraryStorage(storage);
  }

  it('weist auf zu wenige Partien hin', async () => {
    await store(meta('a', {}), meta('bb', {}));
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Muster' }));
    expect(
      await screen.findByText(/Muster erscheinen ab 3 analysierten Partien. Bisher: 2./),
    ).toBeInTheDocument();
  });

  it('zeigt Motive, Phasen und Eröffnungen und erstellt einen Trainingsplan', async () => {
    vi.stubGlobal('fetch', fakeLlmFetch().fetchFn);
    await store(
      meta('a', {}),
      meta('bb', { outcome: 'loss', accuracy: 60 }),
      meta('ccc', {
        userColor: 'b',
        opening: { name: 'Sicilian Defense', eco: 'B20' },
        stats: stats([]),
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Muster' }));

    const motifs = (await screen.findByRole('heading', { name: 'Typische Fehler' })).closest(
      'section',
    )!;
    expect(within(motifs).getByText('Material eingestellt')).toBeInTheDocument();
    expect(within(motifs).getByText('2× · 100 %')).toBeInTheDocument();
    fireEvent.click(within(motifs).getByRole('button', { name: 'Beispiele zeigen' }));
    expect(within(motifs).getAllByRole('button', { name: /8\. Dh5 in Ich – Gegner/ })).toHaveLength(
      2,
    );

    const openings = screen.getByRole('table', { name: 'Ergebnisse und Genauigkeit je Eröffnung' });
    expect(within(openings).getByText('Italian Game')).toBeInTheDocument();
    expect(within(openings).getByText('1 · 0 · 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trainingsplan erstellen' }));
    expect(await screen.findByText('Test-Empfehlung 1')).toBeInTheDocument();
    expect(screen.getByText('Test-Einschätzung.')).toBeInTheDocument();
  });
});

describe('Kennzahlen älterer Bibliothekseinträge', () => {
  it('werden aus den gespeicherten Bewertungen nachgerechnet', async () => {
    setLibraryStorage(keyValueLibrary(memoryStorage()));
    useLibrary.setState({ entries: [], loaded: false });
    const parsed = parsePgnGame(operaGame);
    if (!parsed.ok) throw new Error('ungültig');
    useGame.getState().load(parsed.value, 'w');
    await useAnalysis.getState().start(parsed.value, { depth: 8, multipv: 3 });
    await useLibrary.getState().saveCurrent();

    // Eintrag wie vor Einführung der Muster: ohne Kennzahlen
    const id = gameId(parsed.value.pgn);
    useLibrary.setState({
      entries: useLibrary.getState().entries.map((e) => ({ ...e, stats: undefined })),
    });
    await useLibrary.getState().ensureStats();
    await waitFor(() =>
      expect(useLibrary.getState().entries.find((e) => e.id === id)?.stats?.version).toBe(1),
    );
  });
});
