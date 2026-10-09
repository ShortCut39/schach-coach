import type { LibraryMeta } from '../../store/library';

export type LibraryFilter = 'all' | 'white' | 'black' | 'losses';
export type LibrarySort = 'newest' | 'accuracy' | 'blunders';

/** Suche (Eröffnung, Spieler, Titel), Filter und Sortierung der Bibliothek. */
export function filterLibrary(
  entries: readonly LibraryMeta[],
  query: string,
  filter: LibraryFilter,
  sort: LibrarySort,
): LibraryMeta[] {
  const needle = query.trim().toLowerCase();
  const matches = entries.filter((e) => {
    if (filter === 'white' && e.userColor !== 'w') return false;
    if (filter === 'black' && e.userColor !== 'b') return false;
    if (filter === 'losses' && e.outcome !== 'loss') return false;
    if (!needle) return true;
    return [e.opening?.name, e.opening?.eco, e.white, e.black, e.event].some((text) =>
      text?.toLowerCase().includes(needle),
    );
  });
  const byNewest = (a: LibraryMeta, b: LibraryMeta) => b.savedAt.localeCompare(a.savedAt);
  return matches.sort((a, b) => {
    if (sort === 'accuracy') return (b.accuracy ?? -1) - (a.accuracy ?? -1) || byNewest(a, b);
    if (sort === 'blunders') return b.blunders - a.blunders || byNewest(a, b);
    return byNewest(a, b);
  });
}
