import { create } from 'zustand';
import type { Color } from '../chess/types';
import type { ExplainScope } from '../llm/selection';

export type ImportTab = 'pgn' | 'fen' | 'datei';

/** Entwurf auf dem Import-Screen. Bleibt beim Wechsel zwischen den Screens erhalten. */
interface ImportDraftState {
  tab: ImportTab;
  pgnText: string;
  fenText: string;
  selected: number;
  userColor: Color;
  fileName: string | undefined;
  /** Engine-Tiefe für diese Analyse; `null` = Wert aus den Einstellungen */
  depth: number | null;
  /** Benutzername des Online-Imports (für „Du spielst“ automatisch) */
  onlineUser: string | null;
  /** Erklärungsumfang; `null` = Wert aus den Einstellungen */
  explainScope: ExplainScope | null;
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
  depth: null as number | null,
  explainScope: null as ExplainScope | null,
  onlineUser: null as string | null,
};

export const useImportDraft = create<ImportDraftState>()((set) => ({
  ...initial,
  update: (patch) => set(patch),
  // Gewählte Farbe, Tiefe und Umfang bleiben beim Zurücksetzen erhalten
  reset: () =>
    set((s) => ({
      ...initial,
      userColor: s.userColor,
      depth: s.depth,
      explainScope: s.explainScope,
    })),
}));
