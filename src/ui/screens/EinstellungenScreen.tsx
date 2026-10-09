import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel } from '../shared/Panel';

const sections = ['ki', 'engine', 'analyse', 'darstellung'] as const;
type Section = (typeof sections)[number];

/** M0: Bereichsliste und leere Karte. Inhalte folgen in Meilenstein 4. */
export function EinstellungenScreen() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Section>('ki');

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start gap-6 px-5 pt-7 pb-10">
      <nav
        aria-label={t('einstellungen.sectionsLabel')}
        className="flex flex-[0_0_220px] flex-col gap-0.5"
      >
        <h1 className="mb-3 text-[26px] font-bold tracking-[-0.01em]">
          {t('einstellungen.title')}
        </h1>
        {sections.map((id) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => setActive(id)}
              className={`min-h-hit rounded-small px-3.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-accent-bg font-semibold text-accent-text'
                  : 'font-medium text-muted hover:text-text'
              }`}
            >
              {t(`einstellungen.sections.${id}`)}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-[18px]">
        <Panel className="p-5">
          <h2 className="text-[17px] font-semibold">{t(`einstellungen.sections.${active}`)}</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">{t('einstellungen.placeholder')}</p>
          <p className="mt-3 font-mono text-xs text-faint">
            {t('common.comingInMilestone', { milestone: 4 })}
          </p>
        </Panel>
      </div>
    </main>
  );
}
