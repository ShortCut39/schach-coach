import type { Game, PlyBase } from '../chess/types';
import type { EngineLine, PositionEval } from '../engine/types';
import { isSacrifice } from './material';
import type { Category, ClassificationConfig, PlyAnalysis } from './types';
import { moveAccuracy } from './accuracy';
import { positionWhiteWinChance, whiteWinChance } from './winChance';

function forColor(whiteWin: number, color: 'w' | 'b'): number {
  return color === 'w' ? whiteWin : 100 - whiteWin;
}

function lineWin(line: EngineLine, color: 'w' | 'b'): number {
  return forColor(whiteWinChance(line), color);
}

/** Setzt die Engine-Linie Matt für `color`? */
function matesFor(line: EngineLine | undefined, color: 'w' | 'b'): boolean {
  if (line?.mate === undefined) return false;
  return color === 'w' ? line.mate > 0 : line.mate < 0;
}

/**
 * Abstand des gespielten Zugs zur besten Engine-Alternative (einem anderen Zug).
 * Den Wert des gespielten Zugs nehmen wir aus derselben Suche, wenn er unter den Linien ist,
 * sonst die Bewertung nach dem Zug. Ohne Multi-PV ≥ 2 gibt es keinen Vergleich (−∞).
 */
function greatGap(
  playedUci: string,
  lines: readonly EngineLine[],
  winAfter: number,
  color: 'w' | 'b',
): number {
  if (lines.length < 2) return -Infinity;
  const played = lines.find((line) => line.pv[0] === playedUci);
  const alternative = lines.find((line) => line.pv[0] !== playedUci);
  if (!alternative) return -Infinity;
  return (played ? lineWin(played, color) : winAfter) - lineWin(alternative, color);
}

function baseCategory(winLoss: number, isBest: boolean, config: ClassificationConfig): Category {
  if (isBest) return 'best';
  if (winLoss <= config.excellent) return 'excellent';
  if (winLoss < config.inaccuracy) return 'good';
  if (winLoss < config.mistake) return 'inaccuracy';
  if (winLoss < config.blunder) return 'mistake';
  return 'blunder';
}

/**
 * Klassifiziert einen Halbzug. Alle Regeln sind Näherungen (Chess.com legt seine Regeln nicht offen):
 *
 * - **Theorie**: Stellung nach dem Zug im Eröffnungsbuch, solange die Partie im Buch bleibt
 *   (wird außerhalb über `inBook` übergeben).
 * - **Beste**: gespielter Zug = Engine-Zug 1.
 * - **Ausgezeichnet / Gut / Ungenauigkeit / Fehler / Patzer**: nach Verlust an Gewinnchance
 *   (≤ 2 / < 5 / < 10 / < 20 / ab 20; die letzten drei Schwellen sind einstellbar).
 * - **Verpasst**: Der Gegner hat vorher mindestens 10 verloren, der Bestzug hätte klar gewonnen
 *   (Gewinnchance ≥ 80), und du verlierst gegenüber dem Bestzug mindestens 10.
 * - **Großartig**: Beste/Ausgezeichnet, die beste Engine-Alternative (ein anderer Zug) ist mindestens
 *   10 schlechter (Multi-PV ≥ 2), und die Stellung war vorher nicht entschieden (Gewinnchance
 *   zwischen 10 und 90). Verfeinerung: verglichen wird der gespielte Zug mit der besten Alternative,
 *   nicht stur Linie 1 mit Linie 2 – sonst würde ein Zug „großartig“, der selbst nur Linie 3 ist.
 * - **Brillant**: Beste/Ausgezeichnet mit Figurenopfer (siehe `isSacrifice`), danach nicht schlechter
 *   (Gewinnchance ≥ 50) und die Stellung war vorher nicht entschieden (< 90).
 *   **Anpassung für 16. Db8+:** Führt das Opfer zu einem erzwungenen Matt, während der zweitbeste
 *   Zug kein Matt erzwingt, gilt die Stellung nicht als „ohnehin entschieden“ – das Opfer verwandelt
 *   einen großen Vorteil in Matt. Ohne diese Ausnahme wäre 16. Db8+ nie brillant, weil Weiß vorher
 *   schon klar gewinnt (Gewinnchance ≈ 99, Matt in 2 = 100).
 */
export function classifyPly(
  ply: PlyBase,
  before: PositionEval,
  after: PositionEval,
  previous: PlyAnalysis | undefined,
  inBook: boolean,
  config: ClassificationConfig,
): PlyAnalysis | undefined {
  const color = ply.color;
  const best = before.lines[0];
  if (!best) return undefined;
  const winAfterWhite = positionWhiteWinChance(after);
  if (winAfterWhite === undefined) return undefined;

  const winBefore = lineWin(best, color);
  const winAfter = forColor(winAfterWhite, color);
  const winLoss = Math.max(0, winBefore - winAfter);
  const bestMove = best.pv[0];
  const isBest = bestMove === ply.uci;
  const sacrifice = isSacrifice(
    ply.fenBefore,
    ply.uci,
    after.lines[0]?.pv ?? [],
    config.sacrificeMaterial,
    config.sacrificeWindow,
  );

  let category: Category = baseCategory(winLoss, isBest, config);
  const second = before.lines[1];
  const decided = winBefore >= config.decided || winBefore <= 100 - config.decided;

  if (inBook) {
    category = 'book';
  } else if (category === 'best' || category === 'excellent') {
    const leadsToMate = after.terminal?.kind === 'checkmate' || matesFor(after.lines[0], color);
    const mateException = leadsToMate && !matesFor(second, color);
    if (
      sacrifice &&
      winAfter >= config.brilliantMinWin &&
      (winBefore < config.decided || mateException)
    ) {
      category = 'brilliant';
    } else if (!decided && greatGap(ply.uci, before.lines, winAfter, color) >= config.greatGap) {
      category = 'great';
    }
  } else if (
    previous !== undefined &&
    previous.winLoss >= config.missOpponentLoss &&
    winLoss >= config.missOwnLoss &&
    winBefore >= config.missBestWin
  ) {
    category = 'miss';
  }

  return {
    category,
    winBefore,
    winAfter,
    winLoss,
    accuracy: moveAccuracy(winLoss),
    isSacrifice: sacrifice,
    bestMove,
  };
}

/**
 * Klassifiziert alle Halbzüge, für die Bewertungen davor und danach vorliegen.
 * `bookPlies` = Anzahl Halbzüge vom Beginn an im Eröffnungsbuch.
 */
export function classifyGame(
  game: Game,
  evals: readonly (PositionEval | undefined)[],
  bookPlies: number,
  config: ClassificationConfig,
): (PlyAnalysis | undefined)[] {
  const result: (PlyAnalysis | undefined)[] = [];
  for (const ply of game.plies) {
    const before = evals[ply.index];
    const after = evals[ply.index + 1];
    result.push(
      before && after
        ? classifyPly(ply, before, after, result[ply.index - 1], ply.index < bookPlies, config)
        : undefined,
    );
  }
  return result;
}
