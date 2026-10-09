import { useTranslation } from 'react-i18next';
import type { SummaryEntry } from '../../store/explanations';
import { useNavigation } from '../../store/navigation';
import { Button } from '../shared/Button';

interface TipsCardProps {
  summary: SummaryEntry | null;
  configured: boolean;
  model: string;
  onRequest: () => void;
}

/** „Deine drei wichtigsten Tipps“ aus der KI-Zusammenfassung. */
export function TipsCard({ summary, configured, model, onRequest }: TipsCardProps) {
  const { t } = useTranslation();
  const setScreen = useNavigation((s) => s.setScreen);

  let body;
  if (!configured) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[13.5px] text-body">{t('summary.tipsNotConfigured')}</p>
        <Button variant="ghost" onClick={() => setScreen('einstellungen')}>
          {t('coach.setup')}
        </Button>
      </div>
    );
  } else if (summary?.status === 'done' && summary.data) {
    body = (
      <ol className="flex flex-col gap-3">
        {summary.data.tipps.map((tip, i) => (
          <li key={tip.titel} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-small bg-accent-bg font-mono text-[13px] font-semibold text-accent-text"
            >
              {i + 1}
            </span>
            <div>
              <div className="font-semibold">{tip.titel}</div>
              <div className="text-[13.5px] text-body">{tip.text}</div>
            </div>
          </li>
        ))}
      </ol>
    );
  } else if (summary?.status === 'loading') {
    body = (
      <p role="status" className="text-[13.5px] text-muted">
        {t('summary.tipsLoading')}
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col items-start gap-3">
        {summary?.status === 'failed' && (
          <p role="alert" className="text-[13.5px] text-danger">
            {t('summary.tipsFailed')} {summary.error ? t(`llmErrors.${summary.error}`) : ''}
          </p>
        )}
        <Button variant="primary" className="min-h-hit px-4 text-sm" onClick={onRequest}>
          {summary?.status === 'failed' ? t('coach.retry') : t('summary.tipsRequest')}
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-panel border border-border bg-panel px-[18px] py-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{t('summary.tips')}</h2>
        {configured && (
          <span className="font-mono text-[11.5px] font-medium text-muted">
            {t('summary.tipsSource', { model })}
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
