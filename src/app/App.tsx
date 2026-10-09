import { useEffect } from 'react';
import { useApiKey } from '../store/apiKey';
import { getEngine } from '../store/engine';
import { useSettings } from '../store/settings';
import { useNavigation, type Screen } from '../store/navigation';
import { AppHeader } from '../ui/shared/AppHeader';
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
  }, []);
  const ScreenComponent = screenComponents[screen];

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <AppHeader />
      <ScreenComponent />
    </div>
  );
}
