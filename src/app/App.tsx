import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiKey } from '../store/apiKey';
import { getEngine } from '../store/engine';
import { restoreSession, startSessionAutosave } from '../store/session';
import { useSettings } from '../store/settings';
import { useNavigation, type Screen } from '../store/navigation';
import { AppHeader } from '../ui/shared/AppHeader';
import { ErrorBoundary } from '../ui/shared/ErrorBoundary';
import { AnalyseScreen } from '../ui/screens/AnalyseScreen';
import { ImportScreen } from '../ui/screens/ImportScreen';
import { BibliothekScreen } from '../ui/screens/BibliothekScreen';
import { EinstellungenScreen } from '../ui/screens/EinstellungenScreen';

const screenComponents: Record<Screen, () => React.JSX.Element> = {
  analyse: AnalyseScreen,
  import: ImportScreen,
  bibliothek: BibliothekScreen,
  einstellungen: EinstellungenScreen,
};

export function App() {
  const { t } = useTranslation();
  const screen = useNavigation((s) => s.screen);

  // Engine im Hintergrund starten, damit sie bei der ersten Analyse bereit ist,
  // und gespeicherte Einstellungen samt API-Key (aus dem Schlüsselbund) laden
  useEffect(() => {
    getEngine().catch(() => {
      // Status „Engine nicht verfügbar“ zeigt die Kopfleiste
    });
    void useSettings
      .getState()
      .load()
      .then(() => useApiKey.getState().loadFor(useSettings.getState().llm.baseUrl));
    // Letzte Partie samt Bewertungen wiederherstellen, danach Änderungen automatisch speichern
    let stopAutosave: (() => void) | undefined;
    let cancelled = false;
    void restoreSession()
      .catch(() => false)
      .then(() => {
        if (!cancelled) stopAutosave = startSessionAutosave();
      });
    return () => {
      cancelled = true;
      stopAutosave?.();
    };
  }, []);
  const ScreenComponent = screenComponents[screen];

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-accent px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('a11y.skipToContent')}
      </a>
      <AppHeader />
      <ErrorBoundary resetKey={screen}>
        <ScreenComponent />
      </ErrorBoundary>
    </div>
  );
}
