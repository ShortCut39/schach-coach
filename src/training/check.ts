import { Chess } from 'chess.js';
import { sideToMove, terminalState } from '../chess/line';
import type { PositionEval } from '../engine/types';
import { positionWhiteWinChance, whiteWinChance } from '../classification/winChance';

/** Wie ein Zug in einer Trainingsaufgabe abgeschnitten hat (alle Werte von Stockfish). */
export interface MoveCheck {
  /** Höchstens so viel Gewinnchance verloren wie ein „Ausgezeichnet“-Zug */
  correct: boolean;
  /** Der Engine-Bestzug der Stellung */
  isBest: boolean;
  /** Verlorene Gewinnchance in Prozentpunkten gegenüber dem Bestzug */
  winLoss: number;
  /** Beste Fortsetzung nach dem Zug (UCI, beginnt mit dem Gegnerzug) */
  continuation: string[];
  /** Woher die Bewertung stammt: gespeicherte Analyse oder neue Engine-Rechnung */
  source: 'stored' | 'engine';
}

export interface CheckInput {
  /** Stellung der Aufgabe */
  fen: string;
  /** Gespeicherte Bewertung dieser Stellung (Multi-PV) */
  before: PositionEval;
  /** In der Partie gespielter Zug und die gespeicherte Bewertung danach */
  played: { uci: string; after: PositionEval | undefined };
  /** Zug des Nutzers (UCI) */
  move: string;
  /** Grenze für „Ausgezeichnet“ in Prozentpunkten */
  excellent: number;
  /** Bewertet die Stellung nach dem Zug (nur, wenn keine gespeicherte passt) */
  evaluate: (fen: string) => Promise<PositionEval>;
}

const forColor = (whiteWin: number, color: 'w' | 'b') =>
  color === 'w' ? whiteWin : 100 - whiteWin;

/** Spielt einen UCI-Zug; `null`, wenn er in der Stellung nicht legal ist. */
export function playMove(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  try {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
    });
    return chess.fen();
  } catch {
    return null;
  }
}

/**
 * Prüft einen Zug: Ist er einer der gespeicherten Engine-Züge (oder der Partiezug), genügt die
 * gespeicherte Analyse; sonst rechnet die Engine die Stellung nach dem Zug neu. Richtig ist alles,
 * was höchstens so viel Gewinnchance kostet wie ein „Ausgezeichnet“-Zug.
 */
export async function checkMove(input: CheckInput): Promise<MoveCheck> {
  const color = sideToMove(input.fen);
  const best = input.before.lines[0];
  const fenAfter = playMove(input.fen, input.move);
  if (!best || !fenAfter) throw new Error('illegal');
  const winBefore = forColor(whiteWinChance(best), color);
  const result = (
    winAfter: number,
    continuation: string[],
    source: MoveCheck['source'],
  ): MoveCheck => {
    const winLoss = Math.max(0, Math.round((winBefore - winAfter) * 10) / 10);
    return {
      correct: winLoss <= input.excellent,
      isBest: input.move === best.pv[0],
      winLoss,
      continuation,
      source,
    };
  };

  const stored = input.before.lines.find((line) => line.pv[0] === input.move);
  if (stored) return result(forColor(whiteWinChance(stored), color), stored.pv.slice(1), 'stored');

  const playedWin =
    input.move === input.played.uci ? positionWhiteWinChance(input.played.after) : undefined;
  if (playedWin !== undefined) {
    return result(forColor(playedWin, color), input.played.after?.lines[0]?.pv ?? [], 'stored');
  }

  // Matt oder Patt auf dem Brett braucht keine Engine
  const terminal = terminalState(fenAfter);
  if (terminal) {
    const win = terminal.kind === 'checkmate' ? (terminal.winner === color ? 100 : 0) : 50;
    return result(win, [], 'stored');
  }

  const after = await input.evaluate(fenAfter);
  const winAfter = positionWhiteWinChance(after);
  if (winAfter === undefined) throw new Error('noEval');
  return result(forColor(winAfter, color), after.lines[0]?.pv ?? [], 'engine');
}
