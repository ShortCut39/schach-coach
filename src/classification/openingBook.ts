import type { Game } from '../chess/types';

/** EPD → [ECO, Name]. Quelle: lichess-org/chess-openings (CC0), siehe data/chess-openings. */
export type OpeningBook = Record<string, readonly [string, string]>;

export interface OpeningInfo {
  eco: string;
  name: string;
  /** Anzahl Halbzüge vom Partiebeginn an, die im Buch liegen */
  bookPlies: number;
}

/** EPD = FEN ohne Halbzug- und Zugzähler */
export function epdOf(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

let loading: Promise<OpeningBook> | null = null;

/** Lädt das Buch beim ersten Bedarf (eigene Datei, damit der App-Start schnell bleibt). */
export function loadOpeningBook(): Promise<OpeningBook> {
  loading ??= import('./data/openings.json').then(
    (module) => module.default as unknown as OpeningBook,
  );
  return loading;
}

/**
 * Wie lange bleibt die Partie im Buch? Ein Halbzug ist Theorie, wenn die Stellung danach im Buch
 * steht **und** alle vorherigen Halbzüge ebenfalls Theorie waren. Der Name der Eröffnung ist der
 * der letzten Buchstellung. Gibt es keine, ist das Ergebnis `undefined`.
 */
export function openingInfo(game: Game, book: OpeningBook): OpeningInfo | undefined {
  let bookPlies = 0;
  let last: readonly [string, string] | undefined;
  for (const ply of game.plies) {
    const entry = book[epdOf(ply.fenAfter)];
    if (!entry) break;
    bookPlies++;
    last = entry;
  }
  return last ? { eco: last[0], name: last[1], bookPlies } : undefined;
}
