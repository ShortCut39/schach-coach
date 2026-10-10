import { Chess } from 'chess.js';
import { uciLineToSan } from '../chess/line';
import { formatMoveNumber, formatSan, type NotationStyle } from '../chess/notation';
import type { Color, PlyBase } from '../chess/types';
import { materialBalance } from '../classification/material';
import type { Category, PlyAnalysis } from '../classification/types';
import { formatLineEval, formatPositionEval } from '../engine/evalFormat';
import type { PositionEval } from '../engine/types';
import { describeLine, describeUci, piecesInDanger } from './describe';
import type { ExplanationLanguage } from './types';

/** Höchstens so viele Halbzüge einer Variante gehen an das LLM (Projektdokument: 6). */
export const MAX_VARIATION_PLIES = 6;

/** Texte, die die Oberfläche liefert (llm/ kennt keine Übersetzungen). */
export interface FactLabels {
  category: Record<Category, string>;
  color: Record<Color, string>;
  unnoticed: string;
  /** Sprache der Beschreibungen in Worten (wie die Erklärungen) */
  language: ExplanationLanguage;
}

/**
 * Nur Fakten aus Engine und chess.js – das LLM rechnet nie selbst.
 * Gewinnchancen in Prozent für die ziehende Seite, Bewertungen aus Sicht von Weiß.
 */
export interface MoveFacts {
  ply: number;
  zugnummer: string;
  farbe: string;
  /** Wer hat gezogen: der Nutzer („du“) oder sein Gegner */
  wer: 'du' | 'gegner';
  zug: string;
  /** z. B. „Dame d8 zieht nach h4“ */
  zug_in_worten: string | null;
  kategorie: string;
  fen_davor: string;
  fen_danach: string;
  bester_zug: string | null;
  /** nur, wenn ein anderer Zug besser war */
  bester_zug_in_worten: string | null;
  gewinnchance_davor: number;
  gewinnchance_danach: number;
  bewertung_danach: string | null;
  hauptvariante_nach_zug: string[];
  /** Antwort des Gegners und Fortsetzung in Worten, z. B. „Weiß: Springer f3 schlägt Dame h4“ */
  hauptvariante_in_worten: string[];
  variante_mit_bestzug: string[] | null;
  variante_mit_bestzug_in_worten: string[] | null;
  /** Figuren (ohne Bauern/König), die angegriffen und ungedeckt sind oder von Billigerem angegriffen werden */
  vor_dem_zug: {
    figuren_des_ziehenden_in_gefahr: string[];
    figuren_des_gegners_in_gefahr: string[];
  };
  nach_dem_zug: {
    figuren_des_ziehenden_in_gefahr: string[];
    figuren_des_gegners_in_gefahr: string[];
  };
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
  userColor: Color,
  unnoticed = false,
): MoveFacts {
  const opponent: Color = ply.color === 'w' ? 'b' : 'w';
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
    wer: ply.color === userColor ? 'du' : 'gegner',
    zug: formatSan(ply.san, notation),
    zug_in_worten: describeUci(ply.fenBefore, ply.uci, labels.language),
    kategorie: labels.category[analysis.category],
    fen_davor: ply.fenBefore,
    fen_danach: ply.fenAfter,
    bester_zug: analysis.bestMove
      ? (fmt(uciLineToSan(ply.fenBefore, [analysis.bestMove]))[0] ?? null)
      : null,
    bester_zug_in_worten:
      !playedBest && analysis.bestMove
        ? describeUci(ply.fenBefore, analysis.bestMove, labels.language)
        : null,
    gewinnchance_davor: Math.round(analysis.winBefore),
    gewinnchance_danach: Math.round(analysis.winAfter),
    bewertung_danach: formatPositionEval(after) ?? null,
    hauptvariante_nach_zug: fmt(uciLineToSan(ply.fenAfter, continuation)),
    hauptvariante_in_worten: describeLine(ply.fenAfter, continuation, labels.language),
    variante_mit_bestzug: playedBest
      ? null
      : fmt(uciLineToSan(ply.fenBefore, bestLine.slice(0, MAX_VARIATION_PLIES))),
    variante_mit_bestzug_in_worten: playedBest
      ? null
      : describeLine(ply.fenBefore, bestLine.slice(0, MAX_VARIATION_PLIES), labels.language),
    vor_dem_zug: {
      figuren_des_ziehenden_in_gefahr: piecesInDanger(ply.fenBefore, ply.color, labels.language),
      figuren_des_gegners_in_gefahr: piecesInDanger(ply.fenBefore, opponent, labels.language),
    },
    nach_dem_zug: {
      figuren_des_ziehenden_in_gefahr: piecesInDanger(ply.fenAfter, ply.color, labels.language),
      figuren_des_gegners_in_gefahr: piecesInDanger(ply.fenAfter, opponent, labels.language),
    },
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
  engine_linien: { bewertung: string; zuege: string[]; in_worten: string[] }[];
  figuren_in_gefahr: { weiss: string[]; schwarz: string[] };
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
      in_worten: describeLine(fen, line.pv.slice(0, MAX_VARIATION_PLIES), labels.language),
    })),
    figuren_in_gefahr: {
      weiss: piecesInDanger(fen, 'w', labels.language),
      schwarz: piecesInDanger(fen, 'b', labels.language),
    },
  };
}
