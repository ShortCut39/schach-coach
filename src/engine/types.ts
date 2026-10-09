/** Engine-Datentypen. Alle Bewertungen sind aus Sicht von Weiß. */

export interface EngineLine {
  /** 1..N */
  multipv: number;
  /** Centipawns aus Sicht Weiß */
  cp?: number;
  /** Matt in N, positiv = Weiß setzt matt */
  mate?: number;
  /** UCI-Züge, z. B. `d7b8` */
  pv: string[];
  depth: number;
}

/** Bewertung einer Stellung. */
export interface PositionEval {
  fen: string;
  depth: number;
  multipv: number;
  /** Nach Güte sortiert (multipv 1 zuerst). Leer, wenn die Partie in dieser Stellung zu Ende ist. */
  lines: EngineLine[];
  /** Matt oder Patt auf dem Brett (keine Engine-Rechnung nötig) */
  terminal?: { kind: 'checkmate'; winner: 'w' | 'b' } | { kind: 'stalemate' };
}

export interface SearchSettings {
  depth: number;
  multipv: number;
}

export const DEFAULT_SEARCH: SearchSettings = { depth: 20, multipv: 3 };
