import { useTranslation } from 'react-i18next';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import { isLlmConfigured, useExplanations } from '../../store/explanations';
import { useSettings } from '../../store/settings';
import { useNavigation } from '../../store/navigation';
import { Button } from '../shared/Button';

/** Fortschritt der laufenden oder letzten Analyse mit Abbrechen/Fortsetzen. */
export function ProgressCard() {
  const { t } = useTranslation();
  const status = useAnalysis((s) => s.status);
  const progress = useAnalysis((s) => s.progress);
  const cancel = useAnalysis((s) => s.cancel);
  const resume = useAnalysis((s) => s.resume);
  const setScreen = useNavigation((s) => s.setScreen);
  const aiRun = useExplanations((s) => s.run);
  useApiKey((s) => s.key);
  useSettings((s) => s.llm);
  const aiConfigured = isLlmConfigured();
  const aiPercent = aiRun.total > 0 ? (aiRun.done / aiRun.total) * 100 : 0;
  const aiText = !aiConfigured
    ? t('import.progress.aiNotConfigured')
    : aiRun.status === 'running'
      ? `${aiRun.done} / ${aiRun.total}`
      : aiRun.status === 'done'
        ? t('import.progress.aiDone')
        : aiRun.status === 'error'
          ? t('import.progress.aiError')
          : t('import.progress.aiWaiting');

  if (status === 'idle') return null;
  const percent = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const stateText = {
    running: progress.depth !== null ? t('analyse.engine.depth', { depth: progress.depth }) : '',
    done: t('import.progress.done'),
    aborted: t('import.progress.aborted'),
    error: t('import.progress.error'),
  }[status];

  return (
    <section
      aria-label={t('import.progress.label')}
      className="flex flex-col gap-3 rounded-panel border border-border bg-panel px-4 py-3.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{t('import.progress.title')}</h2>
        <span
          role="status"
          className={`font-mono text-[11.5px] font-medium ${status === 'error' ? 'text-danger' : 'text-muted'}`}
        >
          {stateText}
        </span>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[13px]">
          <span>{t('import.progress.engine')}</span>
          <span className="font-mono text-[12.5px] font-medium text-accent-text">
            {progress.done} / {progress.total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('import.progress.engineBar')}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-2 overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-2 bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div>
        <div
          className={`mb-1 flex justify-between text-[13px] ${aiRun.status === 'running' ? '' : 'text-muted'}`}
        >
          <span>{t('import.progress.ai')}</span>
          <span
            className={`font-mono text-[12.5px] font-medium ${aiRun.status === 'error' ? 'text-danger' : aiRun.status === 'running' ? 'text-accent-text' : ''}`}
          >
            {aiText}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('import.progress.aiBar')}
          aria-valuemin={0}
          aria-valuemax={aiRun.total}
          aria-valuenow={aiRun.done}
          className="h-2 overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-2 bg-accent transition-[width] duration-300"
            style={{ width: `${aiPercent}%` }}
          />
        </div>
        {aiRun.status === 'error' && aiRun.error && (
          <p role="alert" className="mt-1 text-[12.5px] text-danger">
            {t(`llmErrors.${aiRun.error}`)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === 'running' && (
          <Button variant="ghost" onClick={cancel}>
            {t('common.cancel')}
          </Button>
        )}
        {(status === 'aborted' || status === 'error') && (
          <Button variant="ghost" onClick={() => void resume()}>
            {t('common.resume')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setScreen('analyse')}>
          {t('import.progress.toBoard')}
        </Button>
      </div>
    </section>
  );
}
