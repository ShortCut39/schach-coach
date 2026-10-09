import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';

export const defaultNS = 'translation';
export const resources = { de: { translation: de } } as const;

/** Vorerst wird nur Deutsch ausgeliefert. Weitere Sprachen: neue JSON-Datei + Eintrag in `resources`. */
export const supportedLanguages = ['de'] as const;
export type Language = (typeof supportedLanguages)[number];

void i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  defaultNS,
  interpolation: { escapeValue: false }, // React escaped selbst
  returnNull: false,
});

export default i18n;
