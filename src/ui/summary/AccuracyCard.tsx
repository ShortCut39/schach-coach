import { useTranslation } from 'react-i18next';
import { PHASES, type AccuracySummary } from '../../classification/accuracy';
import { accuracyColor, formatPercent } from '../format';

export function AccuracyCard({ title, accuracy }: { title: string; accuracy: AccuracySummary }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-[1_1_300px] flex-col gap-3 rounded-panel border border-border bg-panel px-[18px] py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        <span
          className="font-mono text-[30px] font-semibold"
          style={{ color: accuracyColor(accuracy.overall) }}
        >
          {formatPercent(accuracy.overall)}
        </span>
      </div>
      <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
        {t('summary.byPhase')}
      </div>
      {PHASES.map((phase) => {
        const value = accuracy.byPhase[phase];
        return (
          <div key={phase}>
            <div className="mb-[3px] flex justify-between text-[13px]">
              <span>{t(`phases.${phase}`)}</span>
              <span className="font-mono text-[12.5px] font-medium text-body">
                {formatPercent(value)}
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 rounded-full bg-track">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${value ?? 0}%`, background: accuracyColor(value) }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
