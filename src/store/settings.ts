import { create } from 'zustand';
import type { NotationStyle } from '../chess/notation';
import { DEFAULT_SEARCH } from '../engine/types';

/**
 * Anzeige-Einstellungen. Die Bedienoberfläche dafür und das dauerhafte Speichern
 * kommen in Meilenstein 4; bis dahin gelten die Standardwerte.
 */
interface SettingsState {
  notation: NotationStyle;
  /** Standard-Tiefe für neue Analysen */
  engineDepth: number;
  /** Anzahl Engine-Linien (Multi-PV) */
  multiPv: number;
  setNotation: (notation: NotationStyle) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  notation: 'de',
  engineDepth: DEFAULT_SEARCH.depth,
  multiPv: DEFAULT_SEARCH.multipv,
  setNotation: (notation) => set({ notation }),
}));
