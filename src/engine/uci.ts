import type { EngineLine } from './types';

export type UciScore = { type: 'cp' | 'mate'; value: number };

export interface UciInfo {
  depth: number;
  multipv: number;
  score: UciScore;
  /** Bei einer Aspiration-Window-Grenze ist der Wert nur eine Schranke, nicht exakt. */
  bound?: 'lower' | 'upper';
  pv: string[];
}

/**
 * Liest eine `info`-Zeile mit Bewertung und Hauptvariante, z. B.
 * `info depth 20 seldepth 29 multipv 1 score cp 106 nodes … pv d4e5 b8c6`.
 * Zeilen ohne Score oder ohne PV (z. B. `info string …`, `info depth 0 score mate 0`) ergeben `null`.
 */
export function parseInfo(line: string): UciInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') return null;

  let depth: number | undefined;
  let multipv = 1;
  let score: UciScore | undefined;
  let bound: UciInfo['bound'];
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'depth') depth = Number(tokens[++i]);
    else if (token === 'multipv') multipv = Number(tokens[++i]);
    else if (token === 'score') {
      const type = tokens[++i];
      const value = Number(tokens[++i]);
      if ((type === 'cp' || type === 'mate') && Number.isFinite(value)) score = { type, value };
    } else if (token === 'lowerbound') bound = 'lower';
    else if (token === 'upperbound') bound = 'upper';
    else if (token === 'pv') {
      pv = tokens.slice(i + 1);
      break;
    } else if (token === 'string') return null;
  }

  if (depth === undefined || !Number.isFinite(depth) || !score || pv.length === 0) return null;
  return bound ? { depth, multipv, score, bound, pv } : { depth, multipv, score, pv };
}

/** `bestmove d7b8 ponder d1d8` → `d7b8`; `bestmove (none)` → `null` */
export function parseBestMove(line: string): string | null | undefined {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove') return undefined;
  const move = tokens[1];
  return !move || move === '(none)' ? null : move;
}

/** `id name Stockfish 19 Lite WASM` → `Stockfish 19 Lite WASM` */
export function parseEngineName(line: string): string | undefined {
  const match = /^id name (.+)$/.exec(line.trim());
  return match?.[1];
}

/** UCI bewertet aus Sicht der Seite am Zug. Für die App drehen wir auf Weiß-Sicht. */
export function toEngineLine(info: UciInfo, sideToMove: 'w' | 'b'): EngineLine {
  const sign = sideToMove === 'w' ? 1 : -1;
  const base = { multipv: info.multipv, pv: info.pv, depth: info.depth };
  return info.score.type === 'cp'
    ? { ...base, cp: sign * info.score.value }
    : { ...base, mate: sign * info.score.value };
}
