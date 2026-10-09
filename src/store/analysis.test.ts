import { waitFor } from '@testing-library/react';
import { parsePgnGame } from '../chess/pgn';
import { operaGame } from '../test/fixtures';
import { useAnalysis } from './analysis';

function opera() {
  const result = parsePgnGame(operaGame);
  if (!result.ok) throw new Error('Fixture ungültig');
  return result.value;
}

describe('useAnalysis (mit simulierter Engine)', () => {
  beforeEach(() => useAnalysis.getState().reset());

  it('bewertet alle 34 Stellungen der Beispielpartie', async () => {
    const game = opera();
    await useAnalysis.getState().start(game, { depth: 8, multipv: 3 });
    const state = useAnalysis.getState();
    expect(state.status).toBe('done');
    expect(state.evals).toHaveLength(34);
    expect(state.evals.every(Boolean)).toBe(true);
    expect(state.progress).toMatchObject({ done: 34, total: 34 });
    // Schlussstellung nach 17. Td8#: Matt auf dem Brett, ohne Engine
    expect(state.evals[33]?.terminal).toEqual({ kind: 'checkmate', winner: 'w' });
  });

  it('lässt sich abbrechen und fortsetzen', async () => {
    const game = opera();
    const running = useAnalysis.getState().start(game, { depth: 9, multipv: 2 });
    useAnalysis.getState().cancel();
    await running;
    expect(useAnalysis.getState().status).toBe('aborted');
    expect(useAnalysis.getState().evals.filter(Boolean).length).toBeLessThan(34);

    await useAnalysis.getState().resume();
    await waitFor(() => expect(useAnalysis.getState().status).toBe('done'));
    expect(useAnalysis.getState().evals.every(Boolean)).toBe(true);
  });

  it('verwirft Ergebnisse einer alten Partie, wenn eine neue startet', async () => {
    const first = opera();
    const second = opera(); // gleicher Inhalt, aber neues Objekt = neue Partie
    const old = useAnalysis.getState().start(first, { depth: 10, multipv: 1 });
    const fresh = useAnalysis.getState().start(second, { depth: 10, multipv: 1 });
    await Promise.all([old, fresh]);
    expect(useAnalysis.getState().source).toBe(second);
    expect(useAnalysis.getState().status).toBe('done');
  });
});
