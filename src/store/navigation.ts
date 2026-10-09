import { create } from 'zustand';

export const screens = ['analyse', 'import', 'bibliothek', 'einstellungen'] as const;
export type Screen = (typeof screens)[number];

/** Ansicht innerhalb von „Analyse“: Brett oder Zusammenfassung */
export type AnalyseView = 'board' | 'summary';

interface NavigationState {
  screen: Screen;
  analyseView: AnalyseView;
  setScreen: (screen: Screen) => void;
  setAnalyseView: (view: AnalyseView) => void;
}

export const useNavigation = create<NavigationState>()((set) => ({
  screen: 'analyse',
  analyseView: 'board',
  setScreen: (screen) => set({ screen }),
  setAnalyseView: (analyseView) => set({ screen: 'analyse', analyseView }),
}));
