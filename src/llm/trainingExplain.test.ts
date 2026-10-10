import {
  buildTrainingMoveFacts,
  parseTrainingExplanation,
  trainingExplainMessages,
} from './trainingExplain';
import { LlmError } from './types';

// Schäfermatt-Stellung: Schwarz am Zug, 3… Sf6?? erlaubt 4. Dxf7#
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

describe('KI-Erklärung im Training', () => {
  it('beschreibt Züge und ihre Folge in Worten (chess.js), nicht vom LLM', () => {
    const played = buildTrainingMoveFacts(
      FEN,
      { uci: 'g8f6', continuation: ['h5f7'], evaluation: '#', winLoss: 50 },
      'b',
      'de',
    );
    expect(played.zug).toBe('Sf6');
    expect(played.zug_in_worten).toBe('Springer g8 zieht nach f6');
    expect(played.folge).toEqual(['Dxf7#']);
    expect(played.folge_in_worten[0]).toMatch(/Weiß: Dame h5 schlägt Bauer f7.*Schachmatt/);
    expect(played.verlust_gewinnchance).toBe(50);
  });

  it('baut den Prompt mit den Grundregeln und den Trainingsdaten', () => {
    const move = buildTrainingMoveFacts(
      FEN,
      { uci: 'g7g6', continuation: [], evaluation: null, winLoss: 0 },
      'b',
      'de',
    );
    const messages = trainingExplainMessages(
      {
        am_zug: 'Schwarz',
        fen: FEN,
        motiv: { name: 'Matt zugelassen', erklaerung: '…' },
        vor_dem_zug: { figuren_des_spielers_in_gefahr: [], figuren_des_gegners_in_gefahr: [] },
        bester_zug: move,
        partiezug: { ...move, kategorie: 'Patzer' },
      },
      'beginner',
      'de',
    );
    expect(messages[0]?.content).toMatch(/Erfinde keine Züge/);
    expect(messages[1]?.content).toMatch(/warum bester_zug besser ist als der partiezug/);
    expect(messages[1]?.content).toContain('"zug": "g6"');
  });

  it('liest die Antwort und lehnt unbrauchbare ab', () => {
    expect(
      parseTrainingExplanation('```json\n{"was":"A.","warum":"B.","merksatz":""}\n```'),
    ).toEqual({ was: 'A.', warum: 'B.' });
    expect(() => parseTrainingExplanation('kein JSON')).toThrow(LlmError);
    expect(() => parseTrainingExplanation('{"was":"A."}')).toThrow(LlmError);
  });
});
