import { create } from 'zustand';
import type { Color, Game, PlyBase, Position } from '../chess/types';

export type LoadedSource = Game | Position;
export type Orientation = 'white' | 'black';

interface GameState {
  source: LoadedSource | null;
  /** Mit welcher Farbe der Nutzer gespielt hat */
  userColor: Color;
  orientation: Orientation;
  /** Index des zuletzt ausgeführten Halbzugs; -1 = Ausgangsstellung */
  current: number;

  load: (source: LoadedSource, userColor: Color) => void;
  clear: () => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  flip: () => void;
}

function plyCount(source: LoadedSource | null): number {
  return source?.kind === 'game' ? source.plies.length : 0;
}

export const useGame = create<GameState>()((set, get) => ({
  source: null,
  userColor: 'w',
  orientation: 'white',
  current: -1,

  load: (source, userColor) =>
    set({ source, userColor, orientation: userColor === 'w' ? 'white' : 'black', current: -1 }),
  clear: () => set({ source: null, current: -1 }),
  goTo: (index) => {
    const max = plyCount(get().source) - 1;
    set({ current: Math.min(Math.max(index, -1), max) });
  },
  next: () => get().goTo(get().current + 1),
  prev: () => get().goTo(get().current - 1),
  first: () => get().goTo(-1),
  last: () => get().goTo(plyCount(get().source) - 1),
  flip: () => set((s) => ({ orientation: s.orientation === 'white' ? 'black' : 'white' })),
}));

/** Der zuletzt gespielte Halbzug der angezeigten Stellung (für Hervorhebung). */
export function selectCurrentPly(state: GameState): PlyBase | undefined {
  return state.source?.kind === 'game' ? state.source.plies[state.current] : undefined;
}

/** FEN der angezeigten Stellung. */
export function selectCurrentFen(state: GameState): string | undefined {
  const { source } = state;
  if (!source) return undefined;
  if (source.kind === 'position') return source.fen;
  return source.plies[state.current]?.fenAfter ?? source.startFen;
}
