import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const tabs = ['coach', 'chat', 'summary'] as const;
type Tab = (typeof tabs)[number];

/** Rechte Spalte: Reiter Coach · Chat · Zusammenfassung. Inhalte folgen in späteren Meilensteinen. */
export function SidePanel() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Tab>('coach');

  const placeholder: Record<Tab, { text: string; note: string }> = {
    coach: {
      text: t('analyse.side.coachPlaceholder'),
      note: t('common.comingInMilestone', { milestone: 4 }),
    },
    chat: { text: t('analyse.side.chatPlaceholder'), note: t('common.version', { version: 2 }) },
    summary: {
      text: t('analyse.side.summaryPlaceholder'),
      note: t('common.comingInMilestone', { milestone: 5 }),
    },
  };

  return (
    <section
      aria-label={t('analyse.side.label')}
      className="overflow-hidden rounded-panel border border-border bg-panel"
    >
      <div role="tablist" className="flex border-b border-border">
        {tabs.map((tab) => {
          const selected = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`side-tab-${tab}`}
              aria-selected={selected}
              aria-controls="side-panel"
              onClick={() => setActive(tab)}
              className={`min-h-[46px] flex-1 border-b-2 text-[13.5px] ${
                selected
                  ? 'border-accent bg-button-secondary font-semibold text-accent-text'
                  : 'border-transparent font-medium text-muted hover:text-text'
              }`}
            >
              {t(`analyse.side.${tab}`)}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="side-panel"
        aria-labelledby={`side-tab-${active}`}
        className="flex flex-col gap-1 p-4"
      >
        <p className="text-body">{placeholder[active].text}</p>
        <p className="font-mono text-xs text-faint">{placeholder[active].note}</p>
      </div>
    </section>
  );
}
