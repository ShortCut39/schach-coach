/** Die zwölf Figuren in der Schreibweise von react-chessboard und Lichess (`wK` … `bP`). */
export const PIECE_CODES = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
] as const;
export type PieceCode = (typeof PIECE_CODES)[number];

/** Arten eigener Sätze; zugleich die Unterordner im App-Datenordner (`src-tauri/src/appearance.rs`) */
export type AssetKind = 'pieces' | 'boards' | 'sounds';

/** Präfixe der Kennungen: mitgeliefert oder vom Nutzer hochgeladen */
export const BUILTIN = 'builtin:';
export const CUSTOM = 'custom:';

export function isCustomId(id: string): boolean {
  return id.startsWith(CUSTOM);
}

export function customId(uuid: string): string {
  return `${CUSTOM}${uuid}`;
}

export function uuidOf(id: string): string {
  return id.slice(CUSTOM.length);
}
