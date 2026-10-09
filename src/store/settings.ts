import { create } from 'zustand';
import type { NotationStyle } from '../chess/notation';
import { DEFAULT_CLASSIFICATION, type ClassificationConfig } from '../classification/types';
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
  /** Schwellen für Ungenauigkeit / Fehler / Patzer (Verlust an Gewinnchance) */
  thresholds: Pick<ClassificationConfig, 'inaccuracy' | 'mistake' | 'blunder'>;
  /** Pfeile für gespielten Zug, Bestzug und Fortsetzung auf dem Brett */
  showArrows: boolean;
  setNotation: (notation: NotationStyle) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  notation: 'de',
  engineDepth: DEFAULT_SEARCH.depth,
  multiPv: DEFAULT_SEARCH.multipv,
  thresholds: {
    inaccuracy: DEFAULT_CLASSIFICATION.inaccuracy,
    mistake: DEFAULT_CLASSIFICATION.mistake,
    blunder: DEFAULT_CLASSIFICATION.blunder,
  },
  showArrows: true,
  setNotation: (notation) => set({ notation }),
}));
