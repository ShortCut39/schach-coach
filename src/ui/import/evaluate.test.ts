import { evaluateImport, loadableSource } from './evaluate';
import { FEN_AFTER_QB8, operaGame } from '../../test/fixtures';

const second = '[Event "Zweite"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1';
const broken = '[Event "Kaputt"]\n\n1. e4 e5 2. Ke3 *';

describe('evaluateImport', () => {
  it('erkennt leere Eingaben', () => {
    expect(evaluateImport('pgn', '  ', 0)).toEqual({ kind: 'empty' });
  });

  it('weist auf den falschen Tab hin', () => {
    expect(evaluateImport('pgn', FEN_AFTER_QB8, 0)).toEqual({ kind: 'wrongTab', detected: 'fen' });
    expect(evaluateImport('fen', operaGame, 0)).toEqual({ kind: 'wrongTab', detected: 'pgn' });
  });

  it('liefert die Beispielpartie als ladbare Partie', () => {
    const evaluation = evaluateImport('pgn', operaGame, 0);
    const source = loadableSource(evaluation);
    expect(source?.kind).toBe('game');
    expect(source?.kind === 'game' && source.plies).toHaveLength(33);
  });

  it('prüft bei mehreren Partien die ausgewählte', () => {
    const text = `${operaGame}\n\n${second}\n\n${broken}`;
    const first = evaluateImport('pgn', text, 0);
    expect(first.kind === 'pgn' && first.games).toHaveLength(3);
    expect(loadableSource(evaluateImport('pgn', text, 1))?.kind).toBe('game');

    const third = evaluateImport('pgn', text, 2);
    expect(third.kind === 'pgn' && !third.result.ok && third.result.error).toEqual({
      code: 'illegalMove',
      moveNumber: 2,
      color: 'w',
      san: 'Ke3',
    });
    expect(loadableSource(third)).toBeUndefined();
  });

  it('begrenzt einen veralteten Auswahl-Index', () => {
    const evaluation = evaluateImport('pgn', operaGame, 5);
    expect(evaluation.kind === 'pgn' && evaluation.selected).toBe(0);
  });

  it('liefert eine FEN als Einzelstellung', () => {
    expect(loadableSource(evaluateImport('fen', FEN_AFTER_QB8, 0))).toEqual({
      kind: 'position',
      fen: FEN_AFTER_QB8,
      turn: 'b',
    });
  });
});
