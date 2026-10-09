import { Chess } from 'chess.js';
import { uciLineToSan } from '../chess/line';
import { formatMoveNumber, formatSan, type NotationStyle } from '../chess/notation';
import type { Color, PlyBase } from '../chess/types';
import { materialBalance } from '../classification/material';
import type { Category, PlyAnalysis } from '../classification/types';
import { formatLineEval, formatPositionEval } from '../engine/evalFormat';
import type { PositionEval } from '../engine/types';

/** Höchstens so viele Halbzüge einer Variante gehen an das LLM (Projektdokument: 6). */
export const MAX_VARIATION_PLIES = 6;

/** Texte, die die Oberfläche liefert (llm/ kennt keine Übersetzungen). */
export interface FactLabels {
  category: Record<Category, string>;
  color: Record<Color, string>;
  unnoticed: string;
}

/**
 * Nur Fakten aus Engine und chess.js – das LLM rechnet nie selbst.
 * Gewinnchancen in Prozent für die ziehende Seite, Bewertungen aus Sicht von Weiß.
 */
export interface MoveFacts {
  ply: number;
  zugnummer: string;
  farbe: string;
  zug: string;
  kategorie: string;
  fen_davor: string;
  fen_danach: string;
  bester_zug: string | null;
  gewinnchance_davor: number;
  gewinnchance_danach: number;
  bewertung_danach: string | null;
  hauptvariante_nach_zug: string[];
  variante_mit_bestzug: string[] | null;
  material: { durch_zug: number; nach_hauptvariante: number };
  flags: { schach: boolean; matt: boolean; schlag: boolean; opfer: boolean };
  hinweis?: string;
}

function materialChange(fen: string, moves: readonly string[], mover: Color): number {
  const chess = new Chess(fen);
  const start = materialBalance(chess, mover);
  for (const uci of moves) {
    try {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci[4] ? { promotion: uci[4] } : {}),
      });
    } catch {
      break;
    }
  }
  return materialBalance(chess, mover) - start;
}

export function buildMoveFacts(
  ply: PlyBase,
  analysis: PlyAnalysis,
  before: PositionEval,
  after: PositionEval,
  notation: NotationStyle,
  labels: FactLabels,
  unnoticed = false,
): MoveFacts {
  const fmt = (moves: string[]) => moves.map((m) => formatSan(m, notation));
  const continuation = after.terminal
    ? []
    : (after.lines[0]?.pv ?? []).slice(0, MAX_VARIATION_PLIES);
  const bestLine = before.lines[0]?.pv ?? [];
  const playedBest = analysis.bestMove === ply.uci;

  const facts: MoveFacts = {
    ply: ply.index,
    zugnummer: formatMoveNumber(ply.moveNumber, ply.color),
    farbe: labels.color[ply.color],
    zug: formatSan(ply.san, notation),
    kategorie: labels.category[analysis.category],
    fen_davor: ply.fenBefore,
    fen_danach: ply.fenAfter,
    bester_zug: analysis.bestMove
      ? (fmt(uciLineToSan(ply.fenBefore, [analysis.bestMove]))[0] ?? null)
      : null,
    gewinnchance_davor: Math.round(analysis.winBefore),
    gewinnchance_danach: Math.round(analysis.winAfter),
    bewertung_danach: formatPositionEval(after) ?? null,
    hauptvariante_nach_zug: fmt(uciLineToSan(ply.fenAfter, continuation)),
    variante_mit_bestzug: playedBest
      ? null
      : fmt(uciLineToSan(ply.fenBefore, bestLine.slice(0, MAX_VARIATION_PLIES))),
    material: {
      durch_zug: materialChange(ply.fenBefore, [ply.uci], ply.color),
      nach_hauptvariante: materialChange(ply.fenBefore, [ply.uci, ...continuation], ply.color),
    },
    flags: {
      schach: ply.flags.check,
      matt: ply.flags.mate,
      schlag: ply.flags.capture,
      opfer: analysis.isSacrifice,
    },
  };
  if (unnoticed) facts.hinweis = labels.unnoticed;
  return facts;
}

/** Fakten zu einer einzelnen Stellung (FEN-Import). */
export interface PositionFacts {
  ply: 0;
  fen: string;
  am_zug: string;
  bewertung: string | null;
  engine_linien: { bewertung: string; zuege: string[] }[];
}

export function buildPositionFacts(
  fen: string,
  evaluation: PositionEval,
  notation: NotationStyle,
  labels: FactLabels,
): PositionFacts {
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  return {
    ply: 0,
    fen,
    am_zug: labels.color[turn],
    bewertung: formatPositionEval(evaluation) ?? null,
    engine_linien: evaluation.lines.map((line) => ({
      bewertung: formatLineEval(line),
      zuege: uciLineToSan(fen, line.pv, MAX_VARIATION_PLIES).map((m) => formatSan(m, notation)),
    })),
  };
}
