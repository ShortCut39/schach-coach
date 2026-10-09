import { parseBestMove, parseEngineName, parseInfo, toEngineLine } from './uci';

describe('parseInfo', () => {
  it('liest Tiefe, Multi-PV, Score und PV', () => {
    expect(
      parseInfo(
        'info depth 20 seldepth 29 multipv 2 score cp 104 nodes 3275805 nps 347713 hashfull 861 time 9421 pv c1e3 b8d7 b1c3',
      ),
    ).toEqual({
      depth: 20,
      multipv: 2,
      score: { type: 'cp', value: 104 },
      pv: ['c1e3', 'b8d7', 'b1c3'],
    });
  });

  it('liest Mattwerte und Schranken', () => {
    expect(
      parseInfo('info depth 12 seldepth 3 multipv 1 score mate -1 nodes 25 pv d7b8 d1d8'),
    ).toEqual({
      depth: 12,
      multipv: 1,
      score: { type: 'mate', value: -1 },
      pv: ['d7b8', 'd1d8'],
    });
    expect(parseInfo('info depth 9 multipv 1 score cp 30 lowerbound nodes 1 pv e2e4')?.bound).toBe(
      'lower',
    );
  });

  it('ignoriert Zeilen ohne Bewertung oder PV', () => {
    expect(parseInfo('info string NNUE evaluation using nn-61e7af4bb97d.nnue')).toBeNull();
    expect(parseInfo('info depth 0 score mate 0')).toBeNull();
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfo('bestmove e2e4')).toBeNull();
  });

  it('setzt Multi-PV 1, wenn die Angabe fehlt', () => {
    expect(parseInfo('info depth 5 score cp 12 pv e2e4')?.multipv).toBe(1);
  });
});

describe('parseBestMove und parseEngineName', () => {
  it('erkennt Bestzug und „kein Zug“', () => {
    expect(parseBestMove('bestmove d7b8 ponder d1d8')).toBe('d7b8');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeUndefined();
  });

  it('liest den Engine-Namen', () => {
    expect(parseEngineName('id name Stockfish 19 Lite WASM')).toBe('Stockfish 19 Lite WASM');
    expect(parseEngineName('id author the Stockfish developers')).toBeUndefined();
  });
});

describe('toEngineLine', () => {
  const info = { depth: 12, multipv: 1, pv: ['d7b8'] };
  it('dreht Schwarz-Sicht auf Weiß-Sicht', () => {
    expect(toEngineLine({ ...info, score: { type: 'cp', value: 50 } }, 'b').cp).toBe(-50);
    expect(toEngineLine({ ...info, score: { type: 'mate', value: -1 } }, 'b').mate).toBe(1);
    expect(toEngineLine({ ...info, score: { type: 'cp', value: 50 } }, 'w').cp).toBe(50);
  });
});
