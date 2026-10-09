import { detectInput } from './detect';
import { FEN_AFTER_QB8, operaGame } from '../test/fixtures';

describe('detectInput', () => {
  it('unterscheidet leer, FEN und PGN', () => {
    expect(detectInput('   \n ')).toBe('empty');
    expect(detectInput(FEN_AFTER_QB8)).toBe('fen');
    expect(detectInput('8/8/8/4k3/8/8/8/4K3')).toBe('fen');
    expect(detectInput(operaGame)).toBe('pgn');
    expect(detectInput('1. e4 e5 2. Nf3')).toBe('pgn');
  });
});
