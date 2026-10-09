import { useTranslation } from 'react-i18next';
import { PageHeader } from '../shared/PageHeader';
import { Panel } from '../shared/Panel';

/** M0: leerer Screen. PGN/FEN/Datei-Import folgt in Meilenstein 1. */
export function ImportScreen() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-5 pt-7 pb-10">
      <PageHeader title={t('import.title')} subtitle={t('import.subtitle')} />
      <Panel className="flex min-h-[240px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-body">{t('import.placeholder')}</p>
        <p className="font-mono text-xs text-faint">
          {t('common.comingInMilestone', { milestone: 1 })}
        </p>
      </Panel>
    </main>
  );
}
