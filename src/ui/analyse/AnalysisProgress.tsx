import { useTranslation } from 'react-i18next';
import { useAnalysis } from '../../store/analysis';

/** Kleiner Status mit Abbrechen/Fortsetzen, z. B. im Kopf des Bewertungsverlaufs. */
export function AnalysisProgress() {
  const { t } = useTranslation();
  const status = useAnalysis((s) => s.status);
  const progress = useAnalysis((s) => s.progress);
  const cancel = useAnalysis((s) => s.cancel);
  const resume = useAnalysis((s) => s.resume);

  const buttonClass =
    'min-h-8 rounded-small border border-border-input px-2.5 font-sans text-[12.5px] font-semibold text-text hover:bg-button-secondary';

  if (status === 'running') {
    const counts = { done: progress.done, total: progress.total };
    const text =
      progress.depth !== null
        ? t('analyse.progress.runningDepth', { ...counts, depth: progress.depth })
        : t('analyse.progress.running', counts);
    return (
      <span className="flex items-center gap-2">
        <span role="status">{text}</span>
        <button type="button" onClick={cancel} className={buttonClass}>
          {t('common.cancel')}
        </button>
      </span>
    );
  }
  if (status === 'aborted') {
    return (
      <span className="flex items-center gap-2">
        <span role="status">
          {t('analyse.progress.aborted', { done: progress.done, total: progress.total })}
        </span>
        <button type="button" onClick={() => void resume()} className={buttonClass}>
          {t('common.resume')}
        </button>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span role="alert" className="text-danger">
        {t('analyse.progress.error')}
      </span>
    );
  }
  return null;
}
