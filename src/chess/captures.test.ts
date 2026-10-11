import { Chess } from 'chess.js';
import { capturedPieces, whiteMaterialAdvantage } from './captures';
import { pliesFromHistory } from './pgn';

function plies(moves: string[], fen?: string) {
  const chess = new Chess(fen);
  for (const move of moves) chess.move(move);
  return { plies: pliesFromHistory(chess.history({ verbose: true })), fen: chess.fen() };
}

describe('Geschlagene Figuren', () => {
  it('sammelt je Seite die geschlagenen Figuren, sortiert wie bei Lichess', () => {
    const game = plies(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qxa2', 'Rxa2']);
    expect(capturedPieces(game.plies)).toEqual({ w: ['p', 'q'], b: ['p', 'p'] });
    expect(whiteMaterialAdvantage(game.fen)).toBe(8);
  });

  it('zählt en passant als Bauern', () => {
    const game = plies(['e4', 'a6', 'e5', 'd5', 'exd6']);
    expect(capturedPieces(game.plies)).toEqual({ w: ['p'], b: [] });
  });

  it('zählt eine umgewandelte Figur als das, was sie beim Schlagen war', () => {
    const game = plies(['b8=Q+', 'Kxb8'], '2k5/1P6/8/8/8/8/8/K7 w - - 0 1');
    expect(capturedPieces(game.plies)).toEqual({ w: [], b: ['q'] });
    expect(whiteMaterialAdvantage(game.fen)).toBe(0);
  });

  it('bleibt leer ohne Schlagzüge', () => {
    expect(capturedPieces(plies(['e4', 'e5']).plies)).toEqual({ w: [], b: [] });
    expect(whiteMaterialAdvantage('kaputt')).toBe(0);
  });
});
