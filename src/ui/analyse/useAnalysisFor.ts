import type { PositionEval } from '../../engine/types';
import { useAnalysis } from '../../store/analysis';
import { useGame } from '../../store/game';

const EMPTY: (PositionEval | undefined)[] = [];

/** Bewertungen, sofern sie zur aktuell geladenen Partie gehören (sonst leer). */
export function useCurrentEvals(): (PositionEval | undefined)[] {
  const source = useGame((s) => s.source);
  const analysisSource = useAnalysis((s) => s.source);
  const evals = useAnalysis((s) => s.evals);
  return source && source === analysisSource ? evals : EMPTY;
}
