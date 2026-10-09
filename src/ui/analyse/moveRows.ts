import type { PlyBase } from '../../chess/types';

export interface MoveRow {
  moveNumber: number;
  white?: PlyBase;
  black?: PlyBase;
}

/** Gruppiert Halbzüge in Zeilen `# | Weiß | Schwarz`. Beginnt Schwarz, bleibt die erste Weiß-Zelle leer. */
export function buildRows(plies: PlyBase[]): MoveRow[] {
  const rows: MoveRow[] = [];
  for (const ply of plies) {
    const last = rows.at(-1);
    if (ply.color === 'b' && last && last.moveNumber === ply.moveNumber && !last.black) {
      last.black = ply;
    } else if (ply.color === 'w') {
      rows.push({ moveNumber: ply.moveNumber, white: ply });
    } else {
      rows.push({ moveNumber: ply.moveNumber, black: ply });
    }
  }
  return rows;
}
