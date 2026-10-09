import { create } from 'zustand';

export const screens = ['analyse', 'import', 'bibliothek', 'einstellungen'] as const;
export type Screen = (typeof screens)[number];

interface NavigationState {
  screen: Screen;
  setScreen: (screen: Screen) => void;
}

export const useNavigation = create<NavigationState>()((set) => ({
  screen: 'analyse',
  setScreen: (screen) => set({ screen }),
}));
