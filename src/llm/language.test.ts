import { describeLine, describeUci, piecesInDanger } from './describe';
import { chatMessages } from './chat';
import { batchMessages, systemPrompt } from './prompts';
import { summaryMessages } from './summary';
import { trainingExplainMessages } from './trainingExplain';
import { trainingPlanMessages } from './trainingPlan';

// Schäfermatt-Stellung: Schwarz am Zug, Bauer f7 nur vom König gedeckt
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
const AFTER_NF6 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

describe('KI auf Englisch', () => {
  it('beschreibt Züge und Gefahren auf Englisch (chess.js, nicht das LLM)', () => {
    expect(describeUci(FEN, 'g8f6', 'en')).toBe('knight g8 moves to f6');
    expect(describeLine(AFTER_NF6, ['h5f7'], 'en')).toEqual([
      'White: queen h5 captures pawn f7, checkmate',
    ]);
    expect(describeUci(FEN, 'g8f6')).toBe('Springer g8 zieht nach f6');
    const castle = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(describeUci(castle, 'e1g1', 'en')).toBe('castles kingside');
    // Springer d5 wird vom Läufer b3 angegriffen und ist nicht gedeckt
    expect(piecesInDanger('4k3/8/8/3n4/8/1B6/8/4K3 b - - 0 1', 'b', 'en')).toEqual([
      'knight d5 (attacked by bishop b3, undefended)',
    ]);
  });

  it('behält die Grundregeln in beiden Sprachen', () => {
    const en = systemPrompt('beginner', 'en', 'en');
    expect(en).toMatch(/Do not invent moves, variations or evaluations/);
    expect(en).toMatch(/do not calculate chess yourself/);
    expect(en).toMatch(/explaining moves .* in English/);
    expect(systemPrompt('beginner', 'de', 'de')).toMatch(/Erfinde keine Züge/);
  });

  it('schreibt jede Anfrage in der gewählten Sprache', () => {
    const user = (messages: { content: string }[]) => messages.at(-1)?.content ?? '';
    expect(user(batchMessages([], 'beginner', 'en', 'en'))).toMatch(
      /^Explain the following 0 moves/,
    );
    expect(user(batchMessages([], 'beginner', 'en', 'en'))).toContain('\nData:\n');
    expect(user(batchMessages([], 'beginner', 'de', 'de'))).toContain('\nDaten:\n');
    const summary = summaryMessages({} as never, 'club', 'en', 'en');
    expect(user(summary)).toMatch(/^Write a summary of this game/);
    const plan = trainingPlanMessages({ partien: 4 } as never, 'club', 'en', 'en');
    expect(user(plan)).toMatch(/^Create a short training plan from the patterns of 4 games/);
    const training = trainingExplainMessages({} as never, 'club', 'en', 'en');
    expect(user(training)).toContain('Training data:');
    const chat = chatMessages([], 'Why?', {} as never, 'club', 'en', 'en');
    expect(chat[0]?.content).toMatch(/You answer the player's questions/);
    expect(user(chat)).toContain('Current position data:');
  });
});
