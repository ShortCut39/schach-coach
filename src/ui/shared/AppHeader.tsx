import { useTranslation } from 'react-i18next';
import { LLM_PRESETS } from '../../llm/presets';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import { useEngine } from '../../store/engine';
import { screens, useNavigation } from '../../store/navigation';
import { useSettings } from '../../store/settings';
import { KnightIcon } from './KnightIcon';
import { StatusIndicator } from './StatusIndicator';

export function AppHeader() {
  const { t } = useTranslation();
  const screen = useNavigation((s) => s.screen);
  const setScreen = useNavigation((s) => s.setScreen);
  const engineStatus = useEngine((s) => s.status);
  const engineName = useEngine((s) => s.name);
  const analysisDepth = useAnalysis((s) => (s.source ? s.settings.depth : undefined));
  const defaultDepth = useSettings((s) => s.engineDepth);
  const llm = useSettings((s) => s.llm);
  const apiKey = useApiKey((s) => s.key);
  const preset = LLM_PRESETS.find((p) => p.id === llm.preset);
  const llmReady =
    llm.baseUrl.trim() !== '' && llm.model.trim() !== '' && (apiKey !== '' || !preset?.needsKey);

  const engineLabel =
    engineStatus === 'ready'
      ? t('status.engineReady', { name: engineName ?? '', depth: analysisDepth ?? defaultDepth })
      : engineStatus === 'error'
        ? t('status.engineError')
        : t('status.engineLoading');

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
          <StatusIndicator label={engineLabel} ready={engineStatus === 'ready'} />
          <StatusIndicator
            label={
              llmReady ? t('status.llmReady', { model: llm.model }) : t('status.llmNotConfigured')
            }
            ready={llmReady}
          />
        </div>
      </div>
    </header>
  );
}
