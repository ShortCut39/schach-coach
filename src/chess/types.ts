/** Kern-Datentypen der Schachlogik. Keine UI-Abhängigkeiten. */

export type Color = 'w' | 'b';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface MoveFlags {
  check: boolean;
  mate: boolean;
  capture: boolean;
  castle: boolean;
  promotion: boolean;
  enPassant: boolean;
}

/**
 * Ein Halbzug, wie ihn chess.js liefert. Engine-Daten, Gewinnchance und Kategorie
 * kommen in späteren Meilensteinen als Erweiterung dieses Typs hinzu.
 */
export interface PlyBase {
  /** 0-basiert */
  index: number;
  moveNumber: number;
  color: Color;
  /** Intern immer englische SAN, z. B. `Qb8+` */
  san: string;
  /** z. B. `b3b8`, bei Umwandlung `e7e8q` */
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  flags: MoveFlags;
}

export interface Game {
  kind: 'game';
  /** PGN-Header, unverändert. Unbekannte Werte wie `?` bleiben erhalten. */
  headers: Record<string, string>;
  startFen: string;
  plies: PlyBase[];
  result: GameResult;
  /** PGN-Text dieser einen Partie (zum Wiederherstellen und Exportieren) */
  pgn: string;
}

export interface Position {
  kind: 'position';
  fen: string;
  turn: Color;
}

export type FenErrorReason =
  'fields' | 'board' | 'kings' | 'pawns' | 'turn' | 'castling' | 'enPassant' | 'counters' | 'other';

/** Fehler als Codes. Die Oberfläche übersetzt sie in verständliche Texte. */
export type ChessError =
  | { code: 'empty' }
  | { code: 'noMoves' }
  | { code: 'syntax' }
  | { code: 'illegalMove'; moveNumber: number; color: Color; san: string }
  | { code: 'fen'; reason: FenErrorReason };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: ChessError };
