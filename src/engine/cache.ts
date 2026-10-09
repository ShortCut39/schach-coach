import type { PositionEval, SearchSettings } from './types';

/** Merkt sich Bewertungen nach `(fen, depth, multipv)`, damit nichts doppelt gerechnet wird. */
export class EvalCache {
  private readonly entries = new Map<string, PositionEval>();

  static key(fen: string, settings: SearchSettings): string {
    return `${fen}|${settings.depth}|${settings.multipv}`;
  }

  get(fen: string, settings: SearchSettings): PositionEval | undefined {
    return this.entries.get(EvalCache.key(fen, settings));
  }

  set(evaluation: PositionEval): void {
    this.entries.set(
      EvalCache.key(evaluation.fen, { depth: evaluation.depth, multipv: evaluation.multipv }),
      evaluation,
    );
  }

  get size(): number {
    return this.entries.size;
  }
}
