import { useTranslation } from 'react-i18next';
import { useNavigation } from '../../store/navigation';
import { Panel } from './Panel';

/**
 * Ersetzt Analyse und Training, solange eine Live-Partie auf Lichess läuft (Fair Play).
 * Die Sperre selbst sitzt in Engine und KI-Client; das hier ist nur die Anzeige.
 */
export function LiveLockNotice() {
  const { t } = useTranslation();
  const setScreen = useNavigation((s) => s.setScreen);
  return (
    <div className="flex flex-1 items-start justify-center">
      <Panel className="mt-12 flex w-full max-w-[560px] flex-col items-center gap-3 border-live-border bg-live-bg px-8 py-10 text-center">
        <h2 className="text-lg font-semibold text-live-text">{t('liveLock.title')}</h2>
        <p className="text-text-body">{t('liveLock.text')}</p>
        <button
          type="button"
          onClick={() => setScreen('spielen')}
          className="mt-2 min-h-hit rounded-control bg-accent px-5 font-semibold text-on-accent hover:brightness-110"
        >
          {t('liveLock.back')}
        </button>
      </Panel>
    </div>
  );
}
