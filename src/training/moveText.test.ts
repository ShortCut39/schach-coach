import { formatLine, parseMoveInput } from './moveText';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PROMO = '8/4P1k1/8/8/8/8/6K1/8 w - - 0 1';

describe('Züge als Text', () => {
  it('schreibt Zugfolgen mit Zugnummern in der gewählten Notation', () => {
    expect(formatLine(START, ['g1f3', 'g8f6', 'b1c3'], 'de')).toBe('1. Sf3 Sf6 2. Sc3');
    const black = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(formatLine(black, ['e7e5', 'g1f3'], 'en')).toBe('1… e5 2. Nf3');
  });

  it('versteht deutsche und englische Eingaben sowie Felder', () => {
    expect(parseMoveInput(START, 'Sf3')).toBe('g1f3');
    expect(parseMoveInput(START, 'Nf3')).toBe('g1f3');
    expect(parseMoveInput(START, 'e4')).toBe('e2e4');
    expect(parseMoveInput(START, 'e2-e4')).toBe('e2e4');
    expect(parseMoveInput(PROMO, 'e8=D')).toBe('e7e8q');
    expect(parseMoveInput(PROMO, 'e8=S+')).toBe('e7e8n');
    expect(parseMoveInput(START, 'Ke2')).toBeNull();
    expect(parseMoveInput(START, '')).toBeNull();
  });
});
