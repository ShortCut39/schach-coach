import { create } from 'zustand';
import type { Color } from '../chess/types';

export type ImportTab = 'pgn' | 'fen' | 'datei';

/** Entwurf auf dem Import-Screen. Bleibt beim Wechsel zwischen den Screens erhalten. */
interface ImportDraftState {
  tab: ImportTab;
  pgnText: string;
  fenText: string;
  selected: number;
  userColor: Color;
  fileName: string | undefined;
  update: (patch: Partial<Omit<ImportDraftState, 'update' | 'reset'>>) => void;
  reset: () => void;
}

const initial = {
  tab: 'pgn' as ImportTab,
  pgnText: '',
  fenText: '',
  selected: 0,
  userColor: 'w' as Color,
  fileName: undefined,
};

export const useImportDraft = create<ImportDraftState>()((set) => ({
  ...initial,
  update: (patch) => set(patch),
  // Die gewählte Farbe bleibt beim Zurücksetzen erhalten
  reset: () => set((s) => ({ ...initial, userColor: s.userColor })),
}));
