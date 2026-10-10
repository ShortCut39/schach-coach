import { Chess } from 'chess.js';
import { endangeredPieces } from '../chess/danger';
import type { Color, PlyBase } from '../chess/types';
import type { EngineLine, PositionEval } from '../engine/types';
import type { PlyAnalysis } from './types';

/** Typische Fehlermotive (für „Muster über viele Partien“). */
export type Motif =
  'mateAllowed' | 'mateMissed' | 'threatIgnored' | 'hangingPiece' | 'missedCapture' | 'other';

export const MOTIFS: readonly Motif[] = [
  'hangingPiece',
  'threatIgnored',
  'missedCapture',
  'mateAllowed',
  'mateMissed',
  'other',
];

function matesFor(line: EngineLine | undefined, color: Color): boolean {
  if (line?.mate === undefined) return false;
  return color === 'w' ? line.mate > 0 : line.mate < 0;
}

/** Zielfeld eines UCI-Zugs, wenn er in `fen` etwas schlägt. */
function captureSquare(fen: string, uci: string | undefined): string | undefined {
  if (!uci) return undefined;
  try {
    const move = new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci[4] ? { promotion: uci[4] } : {}),
    });
    return move.captured ? move.to : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ordnet einen Fehler einem Motiv zu (in dieser Reihenfolge):
 * 1. Matt zugelassen – nach dem Zug kann der Gegner erzwungen matt setzen (vorher nicht).
 * 2. Matt verpasst – der Bestzug hätte erzwungen matt gesetzt, nach dem Zug geht das nicht mehr.
 * 3. Drohung übersehen – eine Figur war schon vor dem Zug in Gefahr, und die beste Antwort schlägt sie.
 * 4. Material eingestellt – der Zug bringt eine Figur oder einen Bauern in Gefahr, und die beste Antwort schlägt sie.
 * 5. Schlag verpasst – eine gegnerische Figur war in Gefahr, der Bestzug hätte sie geschlagen.
 * 6. Sonstiges – z. B. positionelle Fehler oder Kombinationen.
 * „In Gefahr“ = angegriffen und ungedeckt oder von Billigerem angegriffen (inklusive Bauern).
 */
export function detectMotif(
  ply: PlyBase,
  analysis: PlyAnalysis,
  before: PositionEval,
  after: PositionEval,
): Motif {
  const me = ply.color;
  const opponent: Color = me === 'w' ? 'b' : 'w';
  const reply = after.terminal ? undefined : after.lines[0];

  if (matesFor(reply, opponent) && !matesFor(before.lines[0], opponent)) return 'mateAllowed';
  if (
    matesFor(before.lines[0], me) &&
    !(after.terminal?.kind === 'checkmate') &&
    !matesFor(reply, me)
  ) {
    return 'mateMissed';
  }

  const replyCapture = captureSquare(ply.fenAfter, reply?.pv[0]);
  if (replyCapture) {
    const dangerBefore = new Set(
      endangeredPieces(ply.fenBefore, me, true).map((p) => p.square as string),
    );
    const dangerAfter = new Set(
      endangeredPieces(ply.fenAfter, me, true).map((p) => p.square as string),
    );
    if (dangerAfter.has(replyCapture)) {
      // Figur stand schon vorher dort in Gefahr und wurde nicht weggezogen/gedeckt
      if (dangerBefore.has(replyCapture) && replyCapture !== ply.to) return 'threatIgnored';
      return 'hangingPiece';
    }
  }

  const bestCapture =
    analysis.bestMove !== ply.uci ? captureSquare(ply.fenBefore, analysis.bestMove) : undefined;
  if (
    bestCapture &&
    endangeredPieces(ply.fenBefore, opponent, true).some((p) => p.square === bestCapture)
  ) {
    return 'missedCapture';
  }
  return 'other';
}
