import { create } from 'zustand';
import type { NotationStyle } from '../chess/notation';

/**
 * Anzeige-Einstellungen. Die Bedienoberfläche dafür und das dauerhafte Speichern
 * kommen in Meilenstein 4; bis dahin gelten die Standardwerte.
 */
interface SettingsState {
  notation: NotationStyle;
  setNotation: (notation: NotationStyle) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  notation: 'de',
  setNotation: (notation) => set({ notation }),
}));
