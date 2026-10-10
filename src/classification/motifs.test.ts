import { parsePgnGame } from '../chess/pgn';
import type { EngineLine, PositionEval } from '../engine/types';
import { detectMotif } from './motifs';
import type { PlyAnalysis } from './types';

/** Feste Stellungen mit konstruierten Engine-Linien (keine echten Engine-Daten). */
function gameOf(moves: string) {
  const parsed = parsePgnGame(moves);
  if (!parsed.ok) throw new Error(`ungültig: ${moves}`);
  return parsed.value;
}
const line = (score: { cp: number } | { mate: number }, pv: string[]): EngineLine => ({
  multipv: 1,
  depth: 18,
  pv,
  ...score,
});
const evalOf = (fen: string, ...lines: EngineLine[]): PositionEval => ({
  fen,
  depth: 18,
  multipv: 3,
  lines,
});
const analysis = (bestMove: string): PlyAnalysis => ({
  category: 'blunder',
  bestMove,
  winBefore: 45,
  winAfter: 5,
  winLoss: 40,
  accuracy: 10,
  isSacrifice: false,
});

describe('detectMotif', () => {
  it('8… Dh4: Material eingestellt (Dame wird vom Springer f3 geschlagen)', () => {
    const game = gameOf(
      '1. e4 e5 2. Nf3 Bc5 3. Nc3 Nf6 4. Bb5 c6 5. Ba4 b5 6. Bb3 d5 7. exd5 Nxd5 8. Ne4 Qh4 *',
    );
    const ply = game.plies[15]!;
    const motif = detectMotif(
      ply,
      analysis('c5b6'),
      evalOf(ply.fenBefore, line({ cp: -20 }, ['c5b6'])),
      evalOf(ply.fenAfter, line({ cp: 850 }, ['f3h4', 'c5e7'])),
    );
    expect(motif).toBe('hangingPiece');
  });

  it('Drohung übersehen: der schon angegriffene Läufer c5 wird geschlagen', () => {
    // Statt den Läufer c5 (angegriffen von Se4) zu retten, spielt Schwarz a6
    const game = gameOf(
      '1. e4 e5 2. Nf3 Bc5 3. Nc3 Nf6 4. Bb5 c6 5. Ba4 b5 6. Bb3 d5 7. exd5 Nxd5 8. Ne4 a6 *',
    );
    const ply = game.plies[15]!;
    const motif = detectMotif(
      ply,
      analysis('c5b6'),
      evalOf(ply.fenBefore, line({ cp: -20 }, ['c5b6'])),
      evalOf(ply.fenAfter, line({ cp: 300 }, ['e4c5'])),
    );
    expect(motif).toBe('threatIgnored');
  });

  it('Schlag verpasst: eine ungedeckte Figur wird nicht genommen', () => {
    // Nach 3… Sd4 ist der Bauer e5 ungedeckt (der Springer hat c6 verlassen). Weiß spielt 4. a3
    // statt 4. Sxe5 – die beste Antwort Sxf3+ schlägt keine gefährdete Figur.
    const game = gameOf('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. a3 *');
    const ply = game.plies[6]!;
    const motif = detectMotif(
      ply,
      analysis('f3e5'),
      evalOf(ply.fenBefore, line({ cp: 120 }, ['f3e5'])),
      evalOf(ply.fenAfter, line({ cp: 10 }, ['d4f3'])),
    );
    expect(motif).toBe('missedCapture');
  });

  it('Matt zugelassen und Matt verpasst', () => {
    const game = gameOf('1. f3 e5 2. g4 *');
    const ply = game.plies[2]!;
    const allowed = detectMotif(
      ply,
      analysis('e2e3'),
      evalOf(ply.fenBefore, line({ cp: -80 }, ['e2e3'])),
      evalOf(ply.fenAfter, line({ mate: -1 }, ['d8h4'])),
    );
    expect(allowed).toBe('mateAllowed');

    const black = gameOf('1. f3 e5 2. g4 a6 *').plies[3]!;
    const missed = detectMotif(
      black,
      analysis('d8h4'),
      evalOf(black.fenBefore, line({ mate: -1 }, ['d8h4'])),
      evalOf(black.fenAfter, line({ cp: -150 }, ['e2e3'])),
    );
    expect(missed).toBe('mateMissed');
  });

  it('ordnet den Rest als „Sonstiges“ ein', () => {
    const game = gameOf('1. e4 e5 2. a3 *');
    const ply = game.plies[2]!;
    const motif = detectMotif(
      ply,
      analysis('g1f3'),
      evalOf(ply.fenBefore, line({ cp: 30 }, ['g1f3'])),
      evalOf(ply.fenAfter, line({ cp: -10 }, ['g8f6'])),
    );
    expect(motif).toBe('other');
  });
});
