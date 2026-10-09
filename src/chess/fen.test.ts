import { normalizeFen, parseFen } from './fen';
import { FEN_AFTER_QB8 } from '../test/fixtures';

describe('parseFen', () => {
  it('erkennt eine gültige FEN und das Zugrecht', () => {
    const result = parseFen(FEN_AFTER_QB8);
    expect(result).toEqual({
      ok: true,
      value: { kind: 'position', fen: FEN_AFTER_QB8, turn: 'b' },
    });
  });

  it('ergänzt fehlende hintere Felder', () => {
    expect(normalizeFen('8/8/8/4k3/8/8/8/4K3')).toBe('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
    expect(normalizeFen('  8/8/8/4k3/8/8/8/4K3   b ')).toBe('8/8/8/4k3/8/8/8/4K3 b - - 0 1');
    expect(parseFen('8/8/8/4k3/8/8/8/4K3 b').ok).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['8/8/8/8/8/8/8/8 w - - 0 1', 'kings'],
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1', 'board'],
    ['rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'board'],
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1', 'turn'],
    ['P3k3/8/8/8/8/8/8/4K3 w - - 0 1', 'pawns'],
  ])('meldet Fehler für %j', (fen, expected) => {
    const result = parseFen(fen);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code === 'fen' ? result.error.reason : result.error.code).toBe(expected);
    }
  });
});
