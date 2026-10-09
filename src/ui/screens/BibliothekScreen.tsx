import { useTranslation } from 'react-i18next';
import { PageHeader } from '../shared/PageHeader';
import { Panel } from '../shared/Panel';
import { VersionBadge } from '../shared/VersionBadge';

/** Platzhalter für Version 2 (Meilenstein 6). Bewusst ohne erfundene Beispieldaten. */
export function BibliothekScreen() {
  const { t } = useTranslation();
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-5 pt-7 pb-10"
    >
      <PageHeader title={t('bibliothek.title')} subtitle={t('bibliothek.subtitle')} />
      <div className="flex items-center gap-2.5 rounded-control border border-info-border bg-info-bg px-4 py-3 text-[13.5px] text-info-text">
        <VersionBadge version={2} />
        {t('bibliothek.banner')}
      </div>
      <Panel className="flex min-h-[200px] flex-col items-center justify-center gap-1 text-center">
        <p className="text-body">{t('bibliothek.placeholder')}</p>
        <p className="font-mono text-xs text-faint">
          {t('common.comingInMilestone', { milestone: 6 })}
        </p>
      </Panel>
    </main>
  );
}
