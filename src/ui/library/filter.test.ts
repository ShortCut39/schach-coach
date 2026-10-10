import type { LibraryMeta } from '../../store/library';
import { filterLibrary } from './filter';

function meta(partial: Partial<LibraryMeta> & Pick<LibraryMeta, 'id'>): LibraryMeta {
  return {
    savedAt: '2026-10-01T10:00:00Z',
    date: null,
    white: null,
    black: null,
    event: null,
    opening: null,
    userColor: 'w',
    outcome: 'win',
    accuracy: 80,
    mistakes: 0,
    blunders: 0,
    plies: 40,
    depth: 20,
    multipv: 3,
    playedAt: null,
    analysed: true,
    ...partial,
  };
}

const entries = [
  meta({
    id: 'a',
    savedAt: '2026-10-03T10:00:00Z',
    opening: { name: 'Philidor Defense', eco: 'C41' },
    accuracy: 96,
  }),
  meta({
    id: 'b',
    savedAt: '2026-10-02T10:00:00Z',
    userColor: 'b',
    outcome: 'loss',
    white: 'Gegner99',
    blunders: 3,
    accuracy: 60,
  }),
  meta({ id: 'c', savedAt: '2026-10-01T10:00:00Z', outcome: 'loss', blunders: 1, accuracy: null }),
];

describe('filterLibrary', () => {
  it('sortiert standardmäßig nach Speicherdatum, neueste zuerst', () => {
    expect(filterLibrary(entries, '', 'all', 'newest').map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  it('sortiert nach Genauigkeit und Patzern', () => {
    expect(filterLibrary(entries, '', 'all', 'accuracy').map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(filterLibrary(entries, '', 'all', 'blunders').map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
  it('filtert nach Farbe und Niederlagen', () => {
    expect(filterLibrary(entries, '', 'black', 'newest').map((e) => e.id)).toEqual(['b']);
    expect(filterLibrary(entries, '', 'losses', 'newest').map((e) => e.id)).toEqual(['b', 'c']);
  });
  it('sucht in Eröffnung, ECO und Spielern, ohne Groß-/Kleinschreibung', () => {
    expect(filterLibrary(entries, 'philidor', 'all', 'newest').map((e) => e.id)).toEqual(['a']);
    expect(filterLibrary(entries, 'c41', 'all', 'newest').map((e) => e.id)).toEqual(['a']);
    expect(filterLibrary(entries, 'gegner', 'all', 'newest').map((e) => e.id)).toEqual(['b']);
  });
});
