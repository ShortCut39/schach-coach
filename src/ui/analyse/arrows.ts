import type { PlyBase } from '../../chess/types';
import type { PlyAnalysis } from '../../classification/types';
import type { PositionEval } from '../../engine/types';
import type { BoardArrow } from './BoardOverlay';

function fromUci(uci: string | undefined, kind: BoardArrow['kind']): BoardArrow[] {
  if (!uci || uci.length < 4) return [];
  return [{ kind, from: uci.slice(0, 2), to: uci.slice(2, 4) }];
}

/**
 * Pfeile für die angezeigte Stellung:
 * - ohne Zug (Ausgangsstellung, FEN): Bestzug der Stellung (gelb)
 * - gespielter Zug (blau, durchgezogen)
 * - war der Zug nicht der Engine-Bestzug (und keine Theorie): Bestzug (gelb)
 * - beste Antwort des Gegners (rot)
 * - war der Zug der Bestzug: die eigene Fortsetzung danach (gelb)
 */
export function arrowsFor(
  ply: PlyBase | undefined,
  analysis: PlyAnalysis | undefined,
  shown: PositionEval | undefined,
): BoardArrow[] {
  const mainLine = shown?.terminal ? [] : (shown?.lines[0]?.pv ?? []);
  if (!ply) return fromUci(mainLine[0], 'best');

  const arrows: BoardArrow[] = [...fromUci(ply.uci, 'played')];
  const playedBest = analysis?.bestMove === ply.uci;
  if (analysis && analysis.category !== 'book' && !playedBest) {
    arrows.push(...fromUci(analysis.bestMove, 'best'));
  }
  arrows.push(...fromUci(mainLine[0], 'reply'));
  if (playedBest) arrows.push(...fromUci(mainLine[1], 'continuation'));

  // Doppelte Pfeile (gleiche Felder) nur einmal zeichnen
  const seen = new Set<string>();
  return arrows.filter((arrow) => {
    const key = `${arrow.from}${arrow.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
