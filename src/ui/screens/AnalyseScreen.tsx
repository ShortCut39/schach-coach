import { useTranslation } from 'react-i18next';
import { useNavigation } from '../../store/navigation';
import { KnightIcon } from '../shared/KnightIcon';
import { Panel } from '../shared/Panel';

/** M0: Leerzustand. Brett, Zugliste und Coach folgen ab Meilenstein 1. */
export function AnalyseScreen() {
  const { t } = useTranslation();
  const setScreen = useNavigation((s) => s.setScreen);

  return (
    <main className="flex flex-1 items-start justify-center p-5">
      <h1 className="sr-only">{t('analyse.title')}</h1>
      <Panel className="mt-16 flex w-full max-w-[520px] flex-col items-center gap-3 px-8 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-panel bg-accent-bg text-accent-text">
          <KnightIcon className="size-7" />
        </span>
        <h2 className="text-lg font-semibold">{t('analyse.emptyTitle')}</h2>
        <p className="text-muted">{t('analyse.emptyText')}</p>
        <button
          type="button"
          onClick={() => setScreen('import')}
          className="mt-2 min-h-hit rounded-control bg-accent px-5 font-semibold text-on-accent hover:brightness-110"
        >
          {t('analyse.emptyAction')}
        </button>
      </Panel>
    </main>
  );
}
