import { useTranslation } from 'react-i18next';

interface StatusIndicatorProps {
  label: string;
  ready: boolean;
}

/** Kleine Statusanzeige mit Punkt. Bedeutung steht zusätzlich im Text (nicht nur Farbe). */
export function StatusIndicator({ label, ready }: StatusIndicatorProps) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`inline-block size-[7px] rounded-full ${ready ? 'bg-success' : 'bg-faint'}`}
      />
      <span>{label}</span>
      <span className="sr-only">({ready ? t('status.ready') : t('status.notReady')})</span>
    </span>
  );
}
