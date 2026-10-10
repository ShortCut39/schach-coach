import { create } from 'zustand';

export const screens = ['spielen', 'analyse', 'import', 'bibliothek', 'einstellungen'] as const;
export type Screen = (typeof screens)[number];

/** Ansicht innerhalb von „Analyse“: Brett oder Zusammenfassung */
export type AnalyseView = 'board' | 'summary';
/** Ansicht innerhalb der Bibliothek: Partienliste, Muster oder Training */
export type BibliothekView = 'games' | 'patterns' | 'training';

interface NavigationState {
  screen: Screen;
  analyseView: AnalyseView;
  bibliothekView: BibliothekView;
  setScreen: (screen: Screen) => void;
  setAnalyseView: (view: AnalyseView) => void;
  setBibliothekView: (view: BibliothekView) => void;
}

export const useNavigation = create<NavigationState>()((set) => ({
  screen: 'analyse',
  analyseView: 'board',
  bibliothekView: 'games',
  setScreen: (screen) => set({ screen }),
  setAnalyseView: (analyseView) => set({ screen: 'analyse', analyseView }),
  setBibliothekView: (bibliothekView) => set({ screen: 'bibliothek', bibliothekView }),
}));
