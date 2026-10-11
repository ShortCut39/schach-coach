import { useTranslation } from 'react-i18next';
import { useAppearance } from '../../appearance/store';
import { formatList } from '../format';
import { IconAlert } from './icons';

/**
 * Einmaliger Hinweis, wenn eine gespeicherte Darstellung (eigener Satz) beim Start fehlte oder
 * beschädigt war. Die App nutzt dann schon den Standard; der Hinweis erklärt nur, warum.
 */
export function AppearanceNotice() {
  const { t } = useTranslation();
  const fallbacks = useAppearance((s) => s.fallbacks);
  const dismiss = useAppearance((s) => s.dismissFallbacks);
  if (fallbacks.length === 0) return null;
  const areas = formatList(fallbacks.map((kind) => t(`appearance.fallback.areas.${kind}`)));
  return (
    <div
      role="status"
      className="mx-auto mt-3 flex w-full max-w-[1240px] flex-wrap items-center gap-3 px-5"
    >
      <div className="flex flex-1 flex-wrap items-center gap-3 rounded-panel border border-border bg-panel px-4 py-2.5">
        <span className="shrink-0 text-danger">
          <IconAlert />
        </span>
        <p className="min-w-0 flex-1 text-[13.5px]">
          <span className="font-semibold">{t('appearance.fallback.title')}: </span>
          {t('appearance.fallback.text', { areas })}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-8 rounded-control px-3 text-[13px] font-semibold text-accent-text hover:bg-accent-bg"
        >
          {t('appearance.fallback.dismiss')}
        </button>
      </div>
    </div>
  );
}
