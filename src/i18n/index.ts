import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';
import enJson from './en.json';

/** Englisch muss dieselben Schlüssel haben wie Deutsch (fehlende fallen beim Typecheck auf). */
const en: typeof de = enJson;

export const defaultNS = 'translation';
export const resources = { de: { translation: de }, en: { translation: en } } as const;

/** Sprachen für Oberfläche und KI-Erklärungen. Weitere: JSON-Datei + Eintrag hier und in `LOCALES`. */
export const supportedLanguages = ['de', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];

/** Format für Zahlen und Datum je Sprache (Englisch britisch, passend zur Schreibweise der Texte) */
const LOCALES: Record<Language, string> = { de: 'de-DE', en: 'en-GB' };

void i18n.use(initReactI18next).init({
  resources,
  lng: 'de',
  fallbackLng: 'de',
  defaultNS,
  interpolation: { escapeValue: false }, // React escaped selbst
  returnNull: false,
});

export function currentLanguage(): Language {
  return i18n.language === 'en' ? 'en' : 'de';
}

/** Zahlen- und Datumsformat der eingestellten Sprache, z. B. `de-DE` */
export function currentLocale(): string {
  return LOCALES[currentLanguage()];
}

/** Schaltet Oberfläche und `<html lang>` um. */
export function applyLanguage(language: Language): void {
  if (i18n.language !== language) void i18n.changeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

export default i18n;
