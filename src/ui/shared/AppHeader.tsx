import { useTranslation } from 'react-i18next';
import { screens, useNavigation } from '../../store/navigation';
import { KnightIcon } from './KnightIcon';
import { StatusIndicator } from './StatusIndicator';

export function AppHeader() {
  const { t } = useTranslation();
  const screen = useNavigation((s) => s.screen);
  const setScreen = useNavigation((s) => s.setScreen);

  return (
    <header className="border-b border-border bg-header">
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-6 gap-y-1.5 px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-small bg-accent text-on-accent">
            <KnightIcon className="size-[18px]" />
          </span>
          <span className="text-[15px] font-bold">{t('app.name')}</span>
        </div>

        <nav aria-label={t('nav.label')} className="flex flex-1 flex-wrap gap-0.5">
          {screens.map((id) => {
            const active = id === screen;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setScreen(id)}
                className={`min-h-hit rounded-small px-3.5 text-sm transition-colors ${
                  active
                    ? 'bg-accent-bg font-semibold text-accent-text'
                    : 'font-medium text-muted hover:text-text'
                }`}
              >
                {t(`nav.${id}`)}
              </button>
            );
          })}
        </nav>

        <div
          aria-label={t('status.label')}
          role="group"
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs font-medium text-muted"
        >
          <StatusIndicator label={t('status.engineNotLoaded')} ready={false} />
          <StatusIndicator label={t('status.llmNotConfigured')} ready={false} />
        </div>
      </div>
    </header>
  );
}
