import { parsePgnGame } from '../chess/pgn';
import { parseFen } from '../chess/fen';
import { operaGame, FEN_AFTER_QB8 } from '../test/fixtures';
import { selectCurrentFen, selectCurrentPly, useGame } from './game';

function loadOpera(color: 'w' | 'b' = 'w') {
  const result = parsePgnGame(operaGame);
  if (!result.ok) throw new Error('Fixture ungültig');
  useGame.getState().load(result.value, color);
  return result.value;
}

describe('useGame', () => {
  beforeEach(() => useGame.getState().clear());

  it('startet nach dem Laden in der Ausgangsstellung', () => {
    const game = loadOpera();
    const state = useGame.getState();
    expect(state.current).toBe(-1);
    expect(selectCurrentFen(state)).toBe(game.startFen);
    expect(selectCurrentPly(state)).toBeUndefined();
  });

  it('navigiert vor, zurück, Anfang und Ende und bleibt in den Grenzen', () => {
    loadOpera();
    const g = useGame.getState();
    g.prev();
    expect(useGame.getState().current).toBe(-1);
    g.next();
    g.next();
    expect(selectCurrentPly(useGame.getState())?.san).toBe('e5');
    g.last();
    expect(useGame.getState().current).toBe(32);
    g.next();
    expect(useGame.getState().current).toBe(32);
    g.goTo(30);
    expect(selectCurrentFen(useGame.getState())).toBe(FEN_AFTER_QB8);
    g.first();
    expect(useGame.getState().current).toBe(-1);
  });

  it('richtet das Brett nach der eigenen Farbe aus und kann es drehen', () => {
    loadOpera('b');
    expect(useGame.getState().orientation).toBe('black');
    useGame.getState().flip();
    expect(useGame.getState().orientation).toBe('white');
  });

  it('zeigt bei einer Einzelstellung immer diese Stellung', () => {
    const result = parseFen(FEN_AFTER_QB8);
    if (!result.ok) throw new Error('FEN ungültig');
    useGame.getState().load(result.value, 'w');
    useGame.getState().next();
    expect(useGame.getState().current).toBe(-1);
    expect(selectCurrentFen(useGame.getState())).toBe(FEN_AFTER_QB8);
  });
});
