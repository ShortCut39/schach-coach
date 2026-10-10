import { parsePgnGame } from '../chess/pgn';
import { computeGameAnalysis } from '../classification/gameAnalysis';
import { computeGameStats } from '../classification/gameStats';
import { loadOpeningBook } from '../classification/openingBook';
import { DEFAULT_CLASSIFICATION } from '../classification/types';
import type { PositionEval } from '../engine/types';
import { gameId, type LibraryMeta } from '../store/library';
import { keyValueLibrary, memoryStorage, setLibraryStorage } from '../store/persistence';
import evalFixture from './fixtures/opera-game-evals-d20.json';
import { operaGame } from './fixtures';

const evals = evalFixture.evals as PositionEval[];

/**
 * Opernpartie aus Sicht von Schwarz mit echten Stockfish-Bewertungen (Fehler: Sf6, b5, cxb5;
 * eine davon ist eine Ungenauigkeit). `copies` speichert sie mehrfach (die Muster-Seite braucht 3 Partien).
 */
export async function storeOperaGame(copies = 1) {
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
    analysed: true,
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
