import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../../store/navigation';
import { Button } from '../shared/Button';
import { handleTabKeys } from '../shared/tabKeys';
import { CoachCard } from './CoachCard';

const tabs = ['coach', 'chat', 'summary'] as const;
type Tab = (typeof tabs)[number];

/** Rechte Spalte: Reiter Coach · Chat · Zusammenfassung. Inhalte folgen in späteren Meilensteinen. */
export function SidePanel() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Tab>('coach');
  const setAnalyseView = useNavigation((s) => s.setAnalyseView);

  const chatPlaceholder = {
    text: t('analyse.side.chatPlaceholder'),
    note: t('common.version', { version: 2 }),
  };

  return (
    <section
      aria-label={t('analyse.side.label')}
      className="overflow-hidden rounded-panel border border-border bg-panel"
    >
      <div
        role="tablist"
        aria-label={t('analyse.side.label')}
        onKeyDown={(event) => handleTabKeys(event, tabs, active, setActive)}
        className="flex border-b border-border"
      >
        {tabs.map((tab) => {
          const selected = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`side-tab-${tab}`}
              aria-selected={selected}
              tabIndex={selected ? undefined : -1}
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
        {active === 'coach' ? (
          <CoachCard />
        ) : active === 'summary' ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body">{t('summary.sideText')}</p>
            <Button
              variant="primary"
              className="min-h-hit px-4 text-sm"
              onClick={() => setAnalyseView('summary')}
            >
              {t('summary.openFull')}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-body">{chatPlaceholder.text}</p>
            <p className="font-mono text-xs text-faint">{chatPlaceholder.note}</p>
          </>
        )}
      </div>
    </section>
  );
}
